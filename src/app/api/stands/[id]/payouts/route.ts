import { randomUUID } from "node:crypto";
import { assertSameOrigin, handleError, HttpError, json, requireOwner } from "@/lib/http";
import { PayPalError, sendGrowerPayouts } from "@/lib/paypal";
import { applySendOutcome, newPayoutIntent, settle, unfinishedPayout, type SendOutcome } from "@/lib/settlement";
import { updateStandRecord } from "@/lib/store";
import { summarise } from "@/lib/summary";

/**
 * Pays each grower what they're owed in one Payouts batch, safely under retries:
 *
 * 1. The payout is saved (status SENDING) with a fixed batch id before PayPal is called.
 *    Its lines count as in flight, so the same money can't be put in a second batch.
 * 2. PayPal is called with that id as both sender_batch_id and PayPal-Request-Id,
 *    so a repeated request returns the original batch instead of paying again.
 * 3. The outcome is recorded. If PayPal's answer was lost, the payout stays SENDING
 *    and the next press resends the same batch rather than creating a new one.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { stand } = await requireOwner((await params).id);

    const intent = await updateStandRecord(stand.id, (record) => {
      const pending = unfinishedPayout(record.payouts);
      if (pending) return structuredClone(pending);
      const payable = settle(record.stand, record.sales, record.payouts).shares.filter((s) => s.email);
      if (payable.length === 0) throw new HttpError(409, "There's nothing new to pay out yet.");
      const created = newPayoutIntent(stand.id, `candid-${stand.id}-${randomUUID().slice(0, 8)}`, payable);
      record.payouts.push(created);
      return structuredClone(created);
    });

    let outcome: SendOutcome;
    try {
      const sent = await sendGrowerPayouts(intent.id, intent.lines, stand.name);
      outcome = { kind: "sent", batchId: sent.batchId, status: sent.status };
    } catch (error) {
      console.error("[candid] payout send failed", intent.id, error);
      outcome = isDefiniteRejection(error)
        ? { kind: "rejected", message: error instanceof Error ? error.message : "PayPal refused the payout." }
        : { kind: "unknown" };
    }

    const summary = await updateStandRecord(stand.id, (record) => {
      const saved = record.payouts.find((p) => p.id === intent.id);
      if (saved) applySendOutcome(saved, outcome);
      return summarise(record);
    });
    return json({ ...summary, payoutOutcome: outcome.kind }, outcome.kind === "sent" ? 201 : 202);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Only a clear "no" from PayPal means nothing was sent. Timeouts, network errors,
 * auth hiccups and server errors might have gone through, so they stay unresolved.
 */
function isDefiniteRejection(error: unknown): boolean {
  return error instanceof PayPalError && (error.status === 400 || error.status === 422);
}
