import { assertSameOrigin, handleError, json, requireOwner } from "@/lib/http";
import { getPayoutBatch } from "@/lib/paypal";
import { applyPayoutStatus, needsStatusCheck } from "@/lib/settlement";
import { updateStandRecord } from "@/lib/store";
import { summarise } from "@/lib/summary";

/**
 * Asks PayPal how each grower's payout is doing and records it. A failed or
 * returned payout becomes owed again; nothing is assumed paid until PayPal says SUCCESS.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { stand } = await requireOwner((await params).id);

    const summary = await updateStandRecord(stand.id, async (record) => {
      const due = record.payouts.filter((p) => needsStatusCheck(p)).slice(-5);
      for (const payout of due) {
        try {
          applyPayoutStatus(payout, await getPayoutBatch(payout.batchId));
        } catch (error) {
          // Leave the line as it was; the next check tries again.
          console.error("[candid] payout status check failed", payout.batchId, error);
        }
      }
      return summarise(record);
    });
    return json(summary);
  } catch (error) {
    return handleError(error);
  }
}
