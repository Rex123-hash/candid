import { beforeEach, describe, expect, it, vi } from "vitest";
import { demoStandRecord } from "@/lib/demo";
import type { Sale, StandRecord } from "@/lib/types";

// The payouts route with an in-memory stand and a fake PayPal, to prove a lost
// reply can't turn into a second payment.
let record: StandRecord;
const sendGrowerPayouts = vi.fn();

class PayPalError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

vi.mock("@/lib/store", () => ({
  updateStandRecord: async <T>(_id: string, change: (r: StandRecord) => T | Promise<T>) => change(record),
}));
vi.mock("@/lib/paypal", () => ({ PayPalError, sendGrowerPayouts: (...args: unknown[]) => sendGrowerPayouts(...args) }));
vi.mock("@/lib/http", async (original) => ({
  ...(await original<typeof import("@/lib/http")>()),
  requireOwner: async () => record,
  assertSameOrigin: () => undefined,
}));

const { POST } = await import("@/app/api/stands/[id]/payouts/route");
const call = () => POST(new Request("http://localhost/api/stands/demo-maple-lane/payouts", { method: "POST" }), { params: Promise.resolve({ id: record.stand.id }) });

function sale(): Sale {
  return {
    id: "s1",
    standId: record.stand.id,
    lines: [{ itemId: "eggs", name: "Free-range eggs", qty: 2, unitCents: 600 }],
    totalCents: 1200,
    method: "paypal",
    status: "CAPTURED",
    paypalOrderId: "ORDER1",
    captureRequestId: "c1",
    createdAt: "2026-11-12T10:00:00.000Z",
    capturedAt: "2026-11-12T10:00:00.000Z",
  };
}

beforeEach(() => {
  record = demoStandRecord();
  record.sales.push(sale());
  sendGrowerPayouts.mockReset();
});

describe("POST /payouts", () => {
  it("resends the same batch after a lost reply instead of paying again", async () => {
    sendGrowerPayouts.mockRejectedValueOnce(new TypeError("fetch failed")).mockResolvedValueOnce({ batchId: "B1", status: "PENDING" });

    const first = await call();
    expect(first.status).toBe(202);
    expect((await first.json()).payoutOutcome).toBe("unknown");
    expect(record.payouts).toHaveLength(1);
    expect(record.payouts[0].status).toBe("SENDING");

    const second = await call();
    expect(second.status).toBe(201);
    expect(record.payouts).toHaveLength(1);
    expect(record.payouts[0]).toMatchObject({ batchId: "B1", status: "PENDING" });

    // Both attempts used one batch id, which PayPal treats as one batch.
    const keys = sendGrowerPayouts.mock.calls.map((c) => c[0]);
    expect(keys[0]).toBe(keys[1]);
    expect(sendGrowerPayouts.mock.calls[0][1]).toEqual(sendGrowerPayouts.mock.calls[1][1]);

    // And once sent, nothing more is owed.
    const third = await call();
    expect(third.status).toBe(409);
    expect(sendGrowerPayouts).toHaveBeenCalledTimes(2);
  });

  it("treats a clear refusal as nothing sent, so the money is owed again", async () => {
    sendGrowerPayouts.mockRejectedValueOnce(new PayPalError("PayPal request failed (INSUFFICIENT_FUNDS).", 422));
    const res = await call();
    expect((await res.json()).payoutOutcome).toBe("rejected");
    expect(record.payouts[0].status).toBe("NOT_SENT");

    sendGrowerPayouts.mockResolvedValueOnce({ batchId: "B2", status: "PENDING" });
    expect((await call()).status).toBe(201);
    expect(record.payouts).toHaveLength(2);
    expect(sendGrowerPayouts.mock.calls[0][0]).not.toBe(sendGrowerPayouts.mock.calls[1][0]);
  });

  it("keeps a server error unresolved rather than guessing it failed", async () => {
    sendGrowerPayouts.mockRejectedValueOnce(new PayPalError("PayPal request failed (INTERNAL_SERVICE_ERROR).", 500));
    await call();
    expect(record.payouts[0].status).toBe("SENDING");
  });
});
