import { growerShares, reconcile, type GrowerShare, type Reconciliation } from "./reconcile";
import type { PayoutRecord, Sale, ShelfCount, StandRecord } from "./types";

export type StandSummary = {
  sales: Sale[];
  capturedCents: number;
  capturedCount: number;
  open: ShelfCount | null;
  close: ShelfCount | null;
  reconciliation: Reconciliation | null;
  shares: GrowerShare[];
  payouts: PayoutRecord[];
};

/** The owner's view of the current day: from the latest opening count onwards. */
export function summarise(record: StandRecord): StandSummary {
  const open = latest(record.shelfCounts.filter((c) => c.kind === "open"));
  const close = open
    ? latest(record.shelfCounts.filter((c) => c.kind === "close" && Date.parse(c.createdAt) >= Date.parse(open.createdAt)))
    : null;
  const since = open ? Date.parse(open.createdAt) : 0;
  const sales = record.sales
    .filter((s) => Date.parse(s.createdAt) >= since && s.status !== "CREATED")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const captured = sales.filter((s) => s.status === "CAPTURED");
  const { shares } = growerShares(record.stand, record.sales, record.payouts);

  return {
    sales,
    capturedCents: captured.reduce((sum, s) => sum + s.totalCents, 0),
    capturedCount: captured.length,
    open,
    close,
    reconciliation: open && close ? reconcile(record.stand, open, close, record.sales) : null,
    shares,
    payouts: [...record.payouts].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
}

function latest<T extends { createdAt: string }>(items: T[]): T | null {
  return items.reduce<T | null>((best, item) => (!best || item.createdAt > best.createdAt ? item : best), null);
}
