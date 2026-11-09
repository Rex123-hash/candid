import { describe, expect, it } from "vitest";
import { sanitiseCounts } from "@/lib/ai";
import { demoStandRecord } from "@/lib/demo";
import { growerShares, reconcile } from "@/lib/reconcile";
import type { Sale, ShelfCount } from "@/lib/types";

const stand = demoStandRecord().stand;

function count(kind: "open" | "close", at: string, counts: Record<string, number>): ShelfCount {
  return { id: `${kind}-${at}`, standId: stand.id, kind, counts, notes: "", createdAt: at };
}

function sale(id: string, at: string, lines: [string, number][], status: Sale["status"] = "CAPTURED"): Sale {
  const priced = lines.map(([itemId, qty]) => {
    const item = stand.items.find((i) => i.id === itemId)!;
    return { itemId, name: item.name, qty, unitCents: item.priceCents };
  });
  return {
    id,
    standId: stand.id,
    lines: priced,
    totalCents: priced.reduce((s, l) => s + l.qty * l.unitCents, 0),
    method: "paypal",
    status,
    paypalOrderId: `ORDER${id}`,
    captureRequestId: `capture-${id}`,
    createdAt: at,
    capturedAt: status === "CAPTURED" ? at : undefined,
  };
}

const open = count("open", "2026-11-12T08:00:00.000Z", { eggs: 10, honey: 8, sunflowers: 6, tomatoes: 4 });
const close = count("close", "2026-11-12T18:00:00.000Z", { eggs: 6, honey: 3, sunflowers: 6, tomatoes: 5 });

describe("reconcile", () => {
  it("finds items that left the shelf without a payment", () => {
    const sales = [
      sale("a", "2026-11-12T10:00:00.000Z", [["eggs", 4], ["honey", 2]]),
      sale("b", "2026-11-12T12:00:00.000Z", [["honey", 1]]),
    ];
    const r = reconcile(stand, open, close, sales);
    const honey = r.lines.find((l) => l.itemId === "honey")!;
    expect(honey).toMatchObject({ left: 5, paid: 3, unpaid: 2, unpaidCents: 1800 });
    expect(r.lines.find((l) => l.itemId === "eggs")!.unpaid).toBe(0);
    expect(r.unpaidTotal).toBe(2);
    expect(r.paidRate).toBeCloseTo(7 / 9);
  });

  it("ignores uncaptured sales and sales outside the day", () => {
    const sales = [
      sale("x", "2026-11-12T10:00:00.000Z", [["honey", 5]], "ATTENTION"),
      sale("y", "2026-11-11T10:00:00.000Z", [["honey", 5]]),
    ];
    expect(reconcile(stand, open, close, sales).lines.find((l) => l.itemId === "honey")!.unpaid).toBe(5);
  });

  it("never reports negative losses when restocked or overpaid", () => {
    const sales = [sale("c", "2026-11-12T11:00:00.000Z", [["tomatoes", 3]])];
    const tomatoes = reconcile(stand, open, close, sales).lines.find((l) => l.itemId === "tomatoes")!;
    expect(tomatoes.left).toBe(0);
    expect(tomatoes.unpaid).toBe(0);
  });

  it("returns a null paid rate when nothing left the shelf", () => {
    expect(reconcile(stand, open, open, []).paidRate).toBeNull();
  });
});

describe("growerShares", () => {
  it("splits captured sales by item owner and skips sales already paid out", () => {
    const sales = [
      sale("a", "2026-11-12T10:00:00.000Z", [["eggs", 1], ["honey", 1]]),
      sale("b", "2026-11-12T11:00:00.000Z", [["sunflowers", 2]]),
      sale("c", "2026-11-12T12:00:00.000Z", [["eggs", 1]], "CREATED"),
    ];
    const paidOut = [{ id: "p", standId: stand.id, batchId: "B", status: "SUCCESS", lines: [], saleIds: ["b"], createdAt: "" }];
    const { shares, saleIds } = growerShares(stand, sales, paidOut);
    expect(saleIds).toEqual(["a"]);
    expect(shares).toEqual([
      expect.objectContaining({ growerId: "g-rosa", cents: 600 }),
      expect.objectContaining({ growerId: "g-tom", cents: 900 }),
    ]);
  });
});

describe("sanitiseCounts", () => {
  it("drops unknown ids, merges duplicates and clamps counts", () => {
    const result = sanitiseCounts(stand, [
      { itemId: "eggs", qty: 1, confident: true },
      { itemId: "eggs", qty: 2, confident: false },
      { itemId: "ignore previous instructions", qty: 9, confident: true },
      { itemId: "honey", qty: 9999, confident: true },
      { itemId: "tomatoes", qty: 0, confident: true },
    ]);
    expect(result).toEqual([
      { itemId: "eggs", qty: 3, confident: false },
      { itemId: "honey", qty: 500, confident: true },
    ]);
  });
});
