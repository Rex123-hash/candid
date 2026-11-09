import { beforeEach, describe, expect, it, vi } from "vitest";
import { demoStandRecord } from "@/lib/demo";
import type { Sale, StandRecord } from "@/lib/types";

// In-memory stand of record, so capture logic is tested without PayPal or disk.
let record: StandRecord;
const capturePayPalOrder = vi.fn();
const getPayPalOrderStatus = vi.fn();

vi.mock("@/lib/store", () => ({
  standIdForOrder: async (orderId: string) => (orderId.startsWith("ORDER") ? record.stand.id : null),
  updateStandRecord: async <T>(_id: string, change: (r: StandRecord) => T | Promise<T>) => change(record),
}));
vi.mock("@/lib/paypal", () => ({
  capturePayPalOrder: (...args: unknown[]) => capturePayPalOrder(...args),
  getPayPalOrderStatus: (...args: unknown[]) => getPayPalOrderStatus(...args),
}));

const { captureSale, confirmCaptureFromWebhook } = await import("@/lib/sales");

function newSale(): Sale {
  return {
    id: "s1",
    standId: record.stand.id,
    lines: [{ itemId: "eggs", name: "Free-range eggs", qty: 1, unitCents: 600 }],
    totalCents: 600,
    method: "venmo",
    status: "CREATED",
    paypalOrderId: "ORDER1",
    captureRequestId: "capture-s1",
    createdAt: new Date().toISOString(),
  };
}

beforeEach(() => {
  record = demoStandRecord();
  record.sales.push(newSale());
  capturePayPalOrder.mockReset();
  getPayPalOrderStatus.mockReset();
  getPayPalOrderStatus.mockResolvedValue("APPROVED");
});

describe("captureSale", () => {
  it("marks a sale paid only after PayPal confirms the capture", async () => {
    capturePayPalOrder.mockResolvedValue({ ok: true, captureId: "CAP1" });
    const result = await captureSale("ORDER1");
    expect(result.state).toBe("paid");
    expect(record.sales[0]).toMatchObject({ status: "CAPTURED", captureId: "CAP1" });
  });

  it("never calls PayPal twice for a sale that is already captured", async () => {
    capturePayPalOrder.mockResolvedValue({ ok: true, captureId: "CAP1" });
    await captureSale("ORDER1");
    await captureSale("ORDER1");
    expect(capturePayPalOrder).toHaveBeenCalledTimes(1);
  });

  it("reuses the same request id so PayPal can de-duplicate retries", async () => {
    capturePayPalOrder.mockResolvedValue({ ok: false, reason: "declined", retryable: true });
    await captureSale("ORDER1");
    await captureSale("ORDER1");
    const ids = capturePayPalOrder.mock.calls.map(([sale]) => (sale as Sale).captureRequestId);
    expect(new Set(ids)).toEqual(new Set(["capture-s1"]));
    expect(record.sales[0].status).toBe("CREATED");
  });

  it("flags a sale for attention on a non-retryable failure, without marking it paid", async () => {
    capturePayPalOrder.mockResolvedValue({ ok: false, reason: "Captured amount doesn't match", retryable: false });
    const result = await captureSale("ORDER1");
    expect(result.state).toBe("failed");
    expect(record.sales[0].status).toBe("ATTENTION");
  });

  it("never captures or flags an order the buyer didn't approve (cancelled popup)", async () => {
    getPayPalOrderStatus.mockResolvedValue("PAYER_ACTION_REQUIRED");
    expect((await captureSale("ORDER1")).state).toBe("not-approved");
    expect(capturePayPalOrder).not.toHaveBeenCalled();
    expect(record.sales[0].status).toBe("CREATED");
  });

  it("recovers a capture whose reply was lost (order already COMPLETED)", async () => {
    getPayPalOrderStatus.mockResolvedValue("COMPLETED");
    capturePayPalOrder.mockResolvedValue({ ok: true, captureId: "CAP2" });
    expect((await captureSale("ORDER1")).state).toBe("paid");
    expect(record.sales[0].captureId).toBe("CAP2");
  });

  it("rejects unknown orders", async () => {
    expect((await captureSale("NOPE")).state).toBe("unknown-order");
  });
});

describe("confirmCaptureFromWebhook", () => {
  it("confirms a matching capture", async () => {
    expect(await confirmCaptureFromWebhook("ORDER1", "CAP9", 600)).toBe("updated");
    expect(record.sales[0].status).toBe("CAPTURED");
  });

  it("is a no-op when delivered twice", async () => {
    await confirmCaptureFromWebhook("ORDER1", "CAP9", 600);
    expect(await confirmCaptureFromWebhook("ORDER1", "CAP9", 600)).toBe("ignored");
  });

  it("flags an amount mismatch instead of marking the sale paid", async () => {
    await confirmCaptureFromWebhook("ORDER1", "CAP9", 100);
    expect(record.sales[0].status).toBe("ATTENTION");
  });
});
