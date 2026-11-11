import { assertSameOrigin, handleError, HttpError, json, requireOwner } from "@/lib/http";
import { updateStandRecord } from "@/lib/store";
import { summarise } from "@/lib/summary";
import { AcknowledgeSchema } from "@/lib/types";

/**
 * Records the owner's "I don't know" for one closing question. The gap stays
 * counted as unexplained; this only notes that the owner has looked at it.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { stand } = await requireOwner((await params).id);
    const input = AcknowledgeSchema.parse(await request.json());

    const summary = await updateStandRecord(stand.id, (record) => {
      const current = summarise(record);
      if (!current.close || current.close.id !== input.closeId) throw new HttpError(409, "That closing count has been replaced. Reload the page.");
      const question = current.questions.find((q) => q.itemId === input.itemId && q.kind === input.kind);
      if (!question) throw new HttpError(409, "That question is already answered.");
      // The size comes from the server's own numbers, not the browser, so a stale page can't acknowledge a different gap.
      record.acknowledged = [
        ...(record.acknowledged ?? []).filter((a) => !(a.closeId === input.closeId && a.itemId === input.itemId && a.kind === input.kind)),
        { ...input, qty: question.qty, createdAt: new Date().toISOString() },
      ].slice(-300);
      return summarise(record);
    });
    return json(summary, 201);
  } catch (error) {
    return handleError(error);
  }
}
