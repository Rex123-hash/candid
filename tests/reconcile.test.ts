import { describe, expect, it } from "vitest";
import { sanitiseCounts } from "@/lib/ai";
import { demoStandRecord } from "@/lib/demo";
import { closingQuestions, reconcile } from "@/lib/reconcile";
import { applyPayoutStatus, needsStatusCheck, senderItemId, settle } from "@/lib/settlement";
import type { PayoutItemStatus, PayoutLine, PayoutRecord, Sale, ShelfCount, StockMove } from "@/lib/types";

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

  it("never reports negative losses, and flags counts that don't add up", () => {
    const sales = [sale("c", "2026-11-12T11:00:00.000Z", [["tomatoes", 3]])];
    const tomatoes = reconcile(stand, open, close, sales).lines.find((l) => l.itemId === "tomatoes")!;
    expect(tomatoes).toMatchObject({ left: 0, unpaid: 0, overAccounted: 3, unexpectedStock: 1 });
  });

  it("returns a null paid rate when nothing left the shelf", () => {
    expect(reconcile(stand, open, open, []).paidRate).toBeNull();
  });
});

describe("reconcile with the stock log", () => {
  const o = count("open", "2026-11-12T08:00:00.000Z", { honey: 10 });
  const c = count("close", "2026-11-12T18:00:00.000Z", { honey: 5 });
  const eight = [sale("h", "2026-11-12T12:00:00.000Z", [["honey", 8]])];
  const honey = (moves: StockMove[]) => reconcile(stand, o, c, eight, moves).lines.find((l) => l.itemId === "honey")!;

  it("counts restocks, so a gap hidden by restocking still shows", () => {
    // Open 10, add 5, close 5: ten jars left, eight were paid, two are unexplained.
    expect(honey([move("restock", 5)])).toMatchObject({ added: 5, left: 10, taken: 10, paid: 8, unpaid: 2, unpaidCents: 1800 });
    // Without the restock entry the same day looks fine, but the extra jars are flagged for a recount.
    expect(honey([])).toMatchObject({ left: 5, unpaid: 0, overAccounted: 3 });
  });

  it("lets removals and cash sales explain a gap, and keeps the rest unexplained", () => {
    const line = honey([move("restock", 5), move("gift", 1)]);
    expect(line).toMatchObject({ removed: 1, taken: 9, unpaid: 1 });
    expect(honey([move("restock", 5), move("gift", 1), move("cash", 1)])).toMatchObject({ cash: 1, unpaid: 0, overAccounted: 0 });
  });

  it("ignores entries from before the opening count but keeps ones logged after closing", () => {
    expect(honey([move("restock", 5, "2026-11-12T07:00:00.000Z")]).added).toBe(0);
    expect(honey([move("restock", 5), move("cash", 2, "2026-11-12T19:30:00.000Z")]).unpaid).toBe(0);
  });

  it("reports paid rate against what customers took, not what was thrown away", () => {
    const r = reconcile(stand, o, c, eight, [move("restock", 5), move("spoiled", 2)]);
    expect(r.takenTotal).toBe(8);
    expect(r.paidRate).toBe(1);
  });
});

describe("closingQuestions", () => {
  const o = count("open", "2026-11-12T08:00:00.000Z", { honey: 10, eggs: 12, tomatoes: 4 });
  const c = { ...count("close", "2026-11-12T18:00:00.000Z", { honey: 5, eggs: 7, tomatoes: 6 }), id: "close-1" };
  const paid = [sale("h", "2026-11-12T12:00:00.000Z", [["honey", 7], ["eggs", 5]])];

  it("asks one question per gap, money first, and nothing about lines that add up", () => {
    const r = reconcile(stand, o, c, paid, [move("restock", 5)]);
    const qs = closingQuestions(stand, r, c.id);
    expect(qs.map((q) => [q.itemId, q.kind, q.qty, q.cents])).toEqual([
      ["honey", "unexplained", 3, 2700],
      ["tomatoes", "surplus", 2, 0],
    ]);
  });

  it("asks about over-accounted items instead of hiding them", () => {
    const r = reconcile(stand, o, c, paid, []);
    expect(closingQuestions(stand, r, c.id).find((q) => q.itemId === "honey")).toMatchObject({ kind: "over", qty: 2 });
  });

  it("keeps an 'I don't know' answer on record without explaining the gap away", () => {
    const r = reconcile(stand, o, c, paid, [move("restock", 5)]);
    const acks = [
      { closeId: c.id, itemId: "honey", kind: "unexplained" as const, createdAt: "2026-11-12T18:05:00.000Z" },
      { closeId: "an-older-close", itemId: "tomatoes", kind: "surplus" as const, createdAt: "2026-11-11T18:05:00.000Z" },
    ];
    const qs = closingQuestions(stand, r, c.id, acks);
    expect(qs.map((q) => [q.itemId, q.acknowledged])).toEqual([
      ["tomatoes", false],
      ["honey", true],
    ]);
    expect(r.unpaidTotal).toBe(3);
  });
});

describe("settle", () => {
  const sales = [
    sale("a", "2026-11-12T10:00:00.000Z", [["eggs", 1], ["honey", 1]]),
    sale("b", "2026-11-12T11:00:00.000Z", [["sunflowers", 2]]),
    sale("c", "2026-11-12T12:00:00.000Z", [["eggs", 1]], "CREATED"),
  ];
  const owed = (payouts: PayoutRecord[]) => Object.fromEntries(settle(stand, sales, payouts).settlements.map((s) => [s.growerId, s.owedCents]));

  it("splits captured sales by whose item it was", () => {
    expect(owed([])).toEqual({ "g-rosa": 600, "g-tom": 900, "g-ana": 1000 });
    expect(settle(stand, sales, []).shares.map((s) => s.growerId)).toEqual(["g-rosa", "g-tom", "g-ana"]);
  });

  it("never double-pays money that is received or still on its way", () => {
    const p = payout([line("g-rosa", 600, "SUCCESS"), line("g-tom", 900, "PENDING"), line("g-ana", 1000, "UNCLAIMED")]);
    expect(owed([p])).toEqual({ "g-rosa": 0, "g-tom": 0, "g-ana": 0 });
    const s = settle(stand, sales, [p]).settlements.find((x) => x.growerId === "g-tom")!;
    expect(s).toMatchObject({ paidCents: 0, inFlightCents: 900, lastStatus: "PENDING" });
  });

  it("makes a failed or returned payout owed again", () => {
    const p = payout([line("g-rosa", 600, "FAILED", "Receiver unregistered"), line("g-tom", 900, "RETURNED")]);
    const result = settle(stand, sales, [p]);
    expect(owed([p])).toMatchObject({ "g-rosa": 600, "g-tom": 900 });
    expect(result.settlements[0]).toMatchObject({ failedCents: 600, lastStatus: "FAILED", lastError: "Receiver unregistered" });
  });

  it("treats lines saved before status tracking as still in flight", () => {
    expect(owed([payout([{ growerId: "g-rosa", name: "Rosa", email: "r@x.test", cents: 600 }])])["g-rosa"]).toBe(0);
  });
});

describe("payout status from PayPal", () => {
  it("copies each recipient's status onto the matching line", () => {
    const record = payout([
      { ...line("g-rosa", 600, "PENDING"), senderItemId: senderItemId("batch-1", "g-rosa") },
      { ...line("g-tom", 900, "PENDING"), senderItemId: senderItemId("batch-1", "g-tom") },
    ]);
    const changed = applyPayoutStatus(record, {
      batch_header: { batch_status: "SUCCESS" },
      items: [
        { payout_item_id: "I1", transaction_status: "SUCCESS", payout_item: { sender_item_id: "batch-1-g-rosa" } },
        { payout_item_id: "I2", transaction_status: "unclaimed", payout_item: { sender_item_id: "batch-1-g-tom" } },
        { payout_item_id: "I3", transaction_status: "SUCCESS", payout_item: { sender_item_id: "someone-else" } },
      ],
    });
    expect(changed).toBe(true);
    expect(record.status).toBe("SUCCESS");
    expect(record.lines.map((l) => [l.status, l.payoutItemId])).toEqual([
      ["SUCCESS", "I1"],
      ["UNCLAIMED", "I2"],
    ]);
  });

  it("only checks batches that can still change, and not too often", () => {
    const now = Date.parse("2026-11-12T12:00:00.000Z");
    const base = { ...payout([line("g-rosa", 600, "PENDING")]), createdAt: "2026-11-12T11:00:00.000Z" };
    expect(needsStatusCheck(base, now)).toBe(true);
    expect(needsStatusCheck({ ...base, checkedAt: "2026-11-12T11:59:55.000Z" }, now)).toBe(false);
    expect(needsStatusCheck({ ...base, lines: [line("g-rosa", 600, "SUCCESS")] }, now)).toBe(false);
    expect(needsStatusCheck({ ...base, createdAt: "2026-10-01T00:00:00.000Z" }, now)).toBe(false);
  });
});

function move(reason: StockMove["reason"], qty: number, at = "2026-11-12T13:00:00.000Z"): StockMove {
  return { id: `${reason}-${qty}-${at}`, standId: stand.id, itemId: "honey", qty, reason, createdAt: at };
}

function line(growerId: string, cents: number, status: PayoutItemStatus, error?: string): PayoutLine {
  return { growerId, name: growerId, email: `${growerId}@x.test`, cents, status, ...(error ? { error } : {}) };
}

function payout(lines: PayoutLine[]): PayoutRecord {
  return { id: "batch-1", standId: stand.id, batchId: "B1", status: "PENDING", lines, createdAt: "2026-11-12T19:00:00.000Z" };
}

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
