import { randomUUID } from "node:crypto";
import { assertSameOrigin, handleError, HttpError, json, requireOwner } from "@/lib/http";
import { sendGrowerPayouts } from "@/lib/paypal";
import { growerShares } from "@/lib/reconcile";
import { updateStandRecord } from "@/lib/store";
import { summarise } from "@/lib/summary";

/** Pays each grower their share of captured sales not yet paid out, in one Payouts batch. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { stand } = await requireOwner((await params).id);

    const summary = await updateStandRecord(stand.id, async (record) => {
      const { shares, saleIds } = growerShares(record.stand, record.sales, record.payouts);
      if (shares.length === 0) throw new HttpError(409, "There's nothing new to pay out yet.");
      const batchKey = `candid-${stand.id}-${randomUUID().slice(0, 8)}`;
      const { batchId, status } = await sendGrowerPayouts(batchKey, shares, record.stand.name);
      record.payouts.push({
        id: batchKey,
        standId: stand.id,
        batchId,
        status,
        lines: shares,
        saleIds,
        createdAt: new Date().toISOString(),
      });
      return summarise(record);
    });
    return json(summary, 201);
  } catch (error) {
    return handleError(error);
  }
}
