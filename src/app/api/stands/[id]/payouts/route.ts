import { randomUUID } from "node:crypto";
import { assertSameOrigin, handleError, HttpError, json, requireOwner } from "@/lib/http";
import { sendGrowerPayouts } from "@/lib/paypal";
import { senderItemId, settle } from "@/lib/settlement";
import { updateStandRecord } from "@/lib/store";
import { summarise } from "@/lib/summary";

/**
 * Pays each grower what they're owed (earned, minus what reached them, minus
 * what is still on its way) in one Payouts batch. Failed payouts are owed again.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { stand } = await requireOwner((await params).id);

    const summary = await updateStandRecord(stand.id, async (record) => {
      const { shares } = settle(record.stand, record.sales, record.payouts);
      const payable = shares.filter((s) => s.email);
      if (payable.length === 0) throw new HttpError(409, "There's nothing new to pay out yet.");
      const batchKey = `candid-${stand.id}-${randomUUID().slice(0, 8)}`;
      const { batchId, status } = await sendGrowerPayouts(batchKey, payable, record.stand.name);
      record.payouts.push({
        id: batchKey,
        standId: stand.id,
        batchId,
        status,
        lines: payable.map((share) => ({ ...share, senderItemId: senderItemId(batchKey, share.growerId), status: "PENDING" })),
        createdAt: new Date().toISOString(),
      });
      return summarise(record);
    });
    return json(summary, 201);
  } catch (error) {
    return handleError(error);
  }
}
