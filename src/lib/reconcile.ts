import type { PayoutRecord, Sale, ShelfCount, Stand } from "./types";

export type ReconcileLine = {
  itemId: string;
  name: string;
  opened: number;
  closed: number;
  left: number;
  paid: number;
  /** Items that left the shelf without a captured payment. Never negative. */
  unpaid: number;
  unpaidCents: number;
};

export type Reconciliation = {
  lines: ReconcileLine[];
  leftTotal: number;
  paidTotal: number;
  unpaidTotal: number;
  unpaidCents: number;
  /** Share of items taken that were paid for, 0–1. null when nothing left the shelf. */
  paidRate: number | null;
};

/** Compares opening and closing shelf counts with captured sales made in between. */
export function reconcile(stand: Stand, open: ShelfCount, close: ShelfCount, sales: Sale[]): Reconciliation {
  const from = Date.parse(open.createdAt);
  const to = Date.parse(close.createdAt);
  const paidByItem = new Map<string, number>();

  for (const sale of sales) {
    const at = Date.parse(sale.capturedAt ?? sale.createdAt);
    if (sale.status !== "CAPTURED" || at < from || at > to) continue;
    for (const line of sale.lines) paidByItem.set(line.itemId, (paidByItem.get(line.itemId) ?? 0) + line.qty);
  }

  const lines = stand.items.map<ReconcileLine>((item) => {
    const opened = open.counts[item.id] ?? 0;
    const closed = close.counts[item.id] ?? 0;
    const left = Math.max(0, opened - closed);
    const paid = paidByItem.get(item.id) ?? 0;
    const unpaid = Math.max(0, left - paid);
    return { itemId: item.id, name: item.name, opened, closed, left, paid, unpaid, unpaidCents: unpaid * item.priceCents };
  });

  const leftTotal = sum(lines.map((l) => l.left));
  const paidTotal = sum(lines.map((l) => Math.min(l.paid, l.left)));
  const unpaidTotal = sum(lines.map((l) => l.unpaid));
  return {
    lines,
    leftTotal,
    paidTotal,
    unpaidTotal,
    unpaidCents: sum(lines.map((l) => l.unpaidCents)),
    paidRate: leftTotal === 0 ? null : paidTotal / leftTotal,
  };
}

export type GrowerShare = { growerId: string; name: string; email: string; cents: number };

/** Splits captured, not-yet-paid-out sales between growers by who owns each item. */
export function growerShares(stand: Stand, sales: Sale[], payouts: PayoutRecord[]): { shares: GrowerShare[]; saleIds: string[] } {
  const paidOut = new Set(payouts.flatMap((p) => p.saleIds));
  const owner = new Map(stand.items.map((i) => [i.id, i.growerId]));
  const totals = new Map<string, number>();
  const saleIds: string[] = [];

  for (const sale of sales) {
    if (sale.status !== "CAPTURED" || paidOut.has(sale.id)) continue;
    saleIds.push(sale.id);
    for (const line of sale.lines) {
      const growerId = owner.get(line.itemId);
      if (!growerId) continue;
      totals.set(growerId, (totals.get(growerId) ?? 0) + line.qty * line.unitCents);
    }
  }

  const shares = stand.growers
    .map((g) => ({ growerId: g.id, name: g.name, email: g.paypalEmail, cents: totals.get(g.id) ?? 0 }))
    .filter((s) => s.cents > 0);
  return { shares, saleIds };
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}
