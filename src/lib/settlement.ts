import { PAYOUT_ITEM_STATUSES, type PayoutItemStatus, type PayoutRecord, type Sale, type Stand } from "./types";

/** Money reached the grower. */
const PAID: ReadonlySet<PayoutItemStatus> = new Set(["SUCCESS"]);
/** Money never arrived or came back: it is owed again. */
const FAILED: ReadonlySet<PayoutItemStatus> = new Set(["FAILED", "RETURNED", "BLOCKED", "REFUNDED", "REVERSED", "DENIED"]);
// Everything else (PENDING, UNCLAIMED, ONHOLD, UNKNOWN, or no status yet) is in flight:
// not paid, but not owed again either, so a second payout can't double-pay.

export type GrowerShare = { growerId: string; name: string; email: string; cents: number };

export type GrowerSettlement = {
  growerId: string;
  name: string;
  /** Everything this grower's items have earned in captured sales. */
  earnedCents: number;
  /** Confirmed received by the grower. */
  paidCents: number;
  /** Sent and not settled yet: pending, unclaimed or on hold. */
  inFlightCents: number;
  /** Sent but failed or returned. Already counted in owedCents again. */
  failedCents: number;
  /** Earned, minus paid, minus in flight. What the next payout sends. */
  owedCents: number;
  /** Status of this grower's most recent payout line, if any. */
  lastStatus: PayoutItemStatus | null;
  lastError: string | null;
};

export function payoutState(status: PayoutItemStatus | undefined): "paid" | "failed" | "in-flight" {
  if (status && PAID.has(status)) return "paid";
  if (status && FAILED.has(status)) return "failed";
  return "in-flight";
}

/**
 * Works out, per grower, what they've earned, what has reached them, what is
 * still on its way and what is owed. Settlement is by amount, not by sale, so a
 * failed payout simply becomes owed again on the next run.
 */
export function settle(stand: Stand, sales: Sale[], payouts: PayoutRecord[]): { settlements: GrowerSettlement[]; shares: GrowerShare[] } {
  const ownerOf = new Map(stand.items.map((i) => [i.id, i.growerId]));
  const earned = new Map<string, number>();
  for (const sale of sales) {
    if (sale.status !== "CAPTURED") continue;
    for (const line of sale.lines) {
      const growerId = ownerOf.get(line.itemId);
      if (growerId) earned.set(growerId, (earned.get(growerId) ?? 0) + line.qty * line.unitCents);
    }
  }

  const ordered = [...payouts].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const settlements = stand.growers.map<GrowerSettlement>((grower) => {
    let paidCents = 0;
    let inFlightCents = 0;
    let failedCents = 0;
    let lastStatus: PayoutItemStatus | null = null;
    let lastError: string | null = null;
    for (const payout of ordered) {
      for (const line of payout.lines) {
        if (line.growerId !== grower.id) continue;
        const state = payoutState(line.status);
        if (state === "paid") paidCents += line.cents;
        else if (state === "failed") failedCents += line.cents;
        else inFlightCents += line.cents;
        lastStatus = line.status ?? "PENDING";
        lastError = line.error ?? null;
      }
    }
    const earnedCents = earned.get(grower.id) ?? 0;
    return {
      growerId: grower.id,
      name: grower.name,
      earnedCents,
      paidCents,
      inFlightCents,
      failedCents,
      owedCents: Math.max(0, earnedCents - paidCents - inFlightCents),
      lastStatus,
      lastError,
    };
  });

  const emailOf = new Map(stand.growers.map((g) => [g.id, g.paypalEmail]));
  const shares = settlements
    .filter((s) => s.owedCents > 0)
    .map((s) => ({ growerId: s.growerId, name: s.name, email: emailOf.get(s.growerId) ?? "", cents: s.owedCents }));
  return { settlements, shares };
}

/** Our id for one grower's line in a batch. PayPal echoes it back with that line's status. */
export function senderItemId(batchKey: string, growerId: string): string {
  return `${batchKey}-${growerId}`.slice(0, 63);
}

/**
 * A payout we have committed to but PayPal hasn't confirmed receiving yet.
 * It is saved before the request goes out, and its lines count as in flight,
 * so nothing else can pay the same money while the outcome is unknown.
 */
export const SENDING = "SENDING";
/** PayPal definitely refused the batch: nothing was sent, so the money is owed again. */
export const NOT_SENT = "NOT_SENT";

export function unfinishedPayout(payouts: PayoutRecord[]): PayoutRecord | undefined {
  return payouts.find((p) => p.status === SENDING);
}

export function newPayoutIntent(standId: string, batchKey: string, shares: GrowerShare[], now = new Date()): PayoutRecord {
  return {
    id: batchKey,
    standId,
    batchId: "",
    status: SENDING,
    lines: shares.map((s) => ({ ...s, senderItemId: senderItemId(batchKey, s.growerId) })),
    createdAt: now.toISOString(),
  };
}

export type SendOutcome = { kind: "sent"; batchId: string; status: string } | { kind: "rejected"; message: string } | { kind: "unknown" };

/** Records what happened to a payout we tried to send. An unknown outcome leaves it in SENDING for a safe retry. */
export function applySendOutcome(record: PayoutRecord, outcome: SendOutcome): void {
  if (record.status !== SENDING) return;
  if (outcome.kind === "sent") {
    record.batchId = outcome.batchId;
    record.status = outcome.status;
    for (const line of record.lines) line.status ??= "PENDING";
  } else if (outcome.kind === "rejected") {
    record.status = NOT_SENT;
    for (const line of record.lines) {
      line.status = "FAILED";
      line.error = outcome.message.slice(0, 200);
    }
  }
}

export type PayPalBatchView = {
  batch_header?: { batch_status?: string };
  items?: {
    payout_item_id?: string;
    transaction_status?: string;
    payout_item?: { sender_item_id?: string };
    errors?: { message?: string; name?: string };
  }[];
};

/** Copies PayPal's per-recipient status onto our payout lines. Returns true if anything changed. */
export function applyPayoutStatus(record: PayoutRecord, batch: PayPalBatchView, now = new Date()): boolean {
  let changed = false;
  const batchStatus = batch.batch_header?.batch_status;
  if (batchStatus && batchStatus !== record.status) {
    record.status = batchStatus;
    changed = true;
  }
  for (const item of batch.items ?? []) {
    // Records made before per-line ids were stored used the same rule, so the id can be rebuilt.
    const line = record.lines.find((l) => (l.senderItemId ?? senderItemId(record.id, l.growerId)) === item.payout_item?.sender_item_id);
    if (!line) continue;
    if (!line.senderItemId) {
      line.senderItemId = senderItemId(record.id, line.growerId);
      changed = true;
    }
    const status = toItemStatus(item.transaction_status);
    const error = item.errors?.message ?? item.errors?.name;
    if (line.status !== status || line.payoutItemId !== item.payout_item_id || (error && line.error !== error)) {
      line.status = status;
      line.payoutItemId = item.payout_item_id;
      if (error) line.error = error.slice(0, 200);
      changed = true;
    }
  }
  record.checkedAt = now.toISOString();
  return changed;
}

/**
 * A batch is worth asking PayPal about while any line could still change, however
 * old it is: unclaimed money comes back after 30 days and must become owed again.
 * Batches older than a day are checked at most hourly.
 */
export function needsStatusCheck(record: PayoutRecord, now = Date.now(), minGapMs = 15_000): boolean {
  if (!record.batchId) return false;
  const age = now - Date.parse(record.createdAt);
  const gap = age > 24 * 60 * 60_000 ? Math.max(minGapMs, 60 * 60_000) : minGapMs;
  if (record.checkedAt && now - Date.parse(record.checkedAt) < gap) return false;
  return record.lines.some((l) => payoutState(l.status) === "in-flight");
}

function toItemStatus(value: string | undefined): PayoutItemStatus {
  const upper = (value ?? "").toUpperCase();
  return (PAYOUT_ITEM_STATUSES as readonly string[]).includes(upper) ? (upper as PayoutItemStatus) : "UNKNOWN";
}
