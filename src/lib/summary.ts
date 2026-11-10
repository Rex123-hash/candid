import { closingQuestions, reconcile, type ClosingQuestion, type Reconciliation } from "./reconcile";
import { settle, type GrowerSettlement, type GrowerShare } from "./settlement";
import type { PayoutRecord, Sale, ShelfCount, StandRecord, StockMove } from "./types";

export type StandSummary = {
  sales: Sale[];
  capturedCents: number;
  capturedCount: number;
  open: ShelfCount | null;
  close: ShelfCount | null;
  /** The owner's stock log since the opening count. */
  moves: StockMove[];
  reconciliation: Reconciliation | null;
  /** The gaps the owner still has to answer for, one question each. */
  questions: ClosingQuestion[];
  /** What each grower is owed right now: the next payout. */
  shares: GrowerShare[];
  settlements: GrowerSettlement[];
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
  const moves = open
    ? (record.stockMoves ?? []).filter((m) => Date.parse(m.createdAt) >= since).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : [];
  const { settlements, shares } = settle(record.stand, record.sales, record.payouts);
  const reconciliation = open && close ? reconcile(record.stand, open, close, record.sales, moves) : null;

  return {
    sales,
    capturedCents: captured.reduce((sum, s) => sum + s.totalCents, 0),
    capturedCount: captured.length,
    open,
    close,
    moves,
    reconciliation,
    questions: reconciliation && close ? closingQuestions(record.stand, reconciliation, close.id, record.acknowledged) : [],
    shares,
    settlements,
    payouts: [...record.payouts].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
}

function latest<T extends { createdAt: string }>(items: T[]): T | null {
  return items.reduce<T | null>((best, item) => (!best || item.createdAt > best.createdAt ? item : best), null);
}
