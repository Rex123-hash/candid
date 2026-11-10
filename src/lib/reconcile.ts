import type { Sale, ShelfCount, Stand, StockMove } from "./types";

export type ReconcileLine = {
  itemId: string;
  name: string;
  opened: number;
  /** Restocked during the day. */
  added: number;
  closed: number;
  /** Physically left the shelf: opened + added - closed. Never negative. */
  left: number;
  /** Spoiled or given away: left the shelf without being sold. */
  removed: number;
  /** Taken by customers: left - removed. */
  taken: number;
  /** Confirmed by PayPal (captured PayPal or Venmo sales). */
  paid: number;
  /** Reported by the owner as cash sales. Not confirmed by anyone. */
  cash: number;
  /** Taken with no payment, cash report or removal to explain it. Never negative. */
  unpaid: number;
  unpaidCents: number;
  /** More was accounted for (paid, cash, removed) than left the shelf: a miscount or a missing restock entry. */
  overAccounted: number;
  /** More on the shelf at closing than opening plus restocks: an unlogged restock or a miscount. */
  unexpectedStock: number;
};

export type Reconciliation = {
  lines: ReconcileLine[];
  leftTotal: number;
  takenTotal: number;
  /** Items taken that a payment (PayPal or reported cash) covers. */
  paidTotal: number;
  cashTotal: number;
  unpaidTotal: number;
  unpaidCents: number;
  /** Share of items customers took that were paid for, 0 to 1. null when customers took nothing. */
  paidRate: number | null;
  /** Lines whose numbers don't add up and are worth a recount. */
  needsReview: string[];
};

/**
 * Compares opening and closing shelf counts with what happened in between:
 * captured sales, and the owner's stock log (restocks, removals, cash sales).
 * Whatever is still unexplained is reported as unpaid; nothing is guessed away.
 */
export function reconcile(stand: Stand, open: ShelfCount, close: ShelfCount, sales: Sale[], moves: StockMove[] = []): Reconciliation {
  const from = Date.parse(open.createdAt);
  const to = Date.parse(close.createdAt);

  const paidByItem = new Map<string, number>();
  for (const sale of sales) {
    const at = Date.parse(sale.capturedAt ?? sale.createdAt);
    if (sale.status !== "CAPTURED" || at < from || at > to) continue;
    for (const line of sale.lines) bump(paidByItem, line.itemId, line.qty);
  }

  // Stock entries count from the opening count on, including ones logged after
  // closing: an owner who remembers a gift after seeing the result can explain it.
  const added = new Map<string, number>();
  const removed = new Map<string, number>();
  const cash = new Map<string, number>();
  for (const move of moves) {
    if (Date.parse(move.createdAt) < from) continue;
    const target = move.reason === "restock" ? added : move.reason === "cash" ? cash : removed;
    bump(target, move.itemId, move.qty);
  }

  const lines = stand.items.map<ReconcileLine>((item) => {
    const opened = open.counts[item.id] ?? 0;
    const closed = close.counts[item.id] ?? 0;
    const restocked = added.get(item.id) ?? 0;
    const gone = removed.get(item.id) ?? 0;
    const paid = paidByItem.get(item.id) ?? 0;
    const cashSold = cash.get(item.id) ?? 0;
    const expectedMax = opened + restocked;
    const left = Math.max(0, expectedMax - closed);
    const taken = Math.max(0, left - gone);
    const unpaid = Math.max(0, taken - paid - cashSold);
    return {
      itemId: item.id,
      name: item.name,
      opened,
      added: restocked,
      closed,
      left,
      removed: gone,
      taken,
      paid,
      cash: cashSold,
      unpaid,
      unpaidCents: unpaid * item.priceCents,
      overAccounted: Math.max(0, gone + paid + cashSold - left),
      unexpectedStock: Math.max(0, closed - expectedMax),
    };
  });

  const takenTotal = sum(lines.map((l) => l.taken));
  const unpaidTotal = sum(lines.map((l) => l.unpaid));
  return {
    lines,
    leftTotal: sum(lines.map((l) => l.left)),
    takenTotal,
    paidTotal: takenTotal - unpaidTotal,
    cashTotal: sum(lines.map((l) => l.cash)),
    unpaidTotal,
    unpaidCents: sum(lines.map((l) => l.unpaidCents)),
    paidRate: takenTotal === 0 ? null : (takenTotal - unpaidTotal) / takenTotal,
    needsReview: lines.filter((l) => l.overAccounted > 0 || l.unexpectedStock > 0).map((l) => l.itemId),
  };
}

function bump(map: Map<string, number>, key: string, by: number) {
  map.set(key, (map.get(key) ?? 0) + by);
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}
