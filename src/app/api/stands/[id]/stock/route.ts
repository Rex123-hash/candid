import { randomUUID } from "node:crypto";
import { assertSameOrigin, handleError, HttpError, json, requireOwner } from "@/lib/http";
import { updateStandRecord } from "@/lib/store";
import { summarise } from "@/lib/summary";
import { StockMoveSchema } from "@/lib/types";

/** Logs a stock change the shelf counts can't see: a restock, a removal, or a cash sale. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { stand } = await requireOwner((await params).id);
    const input = StockMoveSchema.parse(await request.json());
    if (!stand.items.some((i) => i.id === input.itemId)) throw new HttpError(400, "This stand doesn't sell that item.");

    const summary = await updateStandRecord(stand.id, (record) => {
      if (!record.shelfCounts.some((c) => c.kind === "open")) throw new HttpError(409, "Do the opening count first.");
      record.stockMoves = [
        ...(record.stockMoves ?? []),
        { id: randomUUID(), standId: stand.id, itemId: input.itemId, qty: input.qty, reason: input.reason, createdAt: new Date().toISOString() },
      ].slice(-500);
      return summarise(record);
    });
    return json(summary, 201);
  } catch (error) {
    return handleError(error);
  }
}

/** Removes one stock entry logged by mistake. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { stand } = await requireOwner((await params).id);
    const entry = new URL(request.url).searchParams.get("entry") ?? "";

    const summary = await updateStandRecord(stand.id, (record) => {
      const before = record.stockMoves?.length ?? 0;
      record.stockMoves = (record.stockMoves ?? []).filter((m) => m.id !== entry);
      if (record.stockMoves.length === before) throw new HttpError(404, "That entry was already removed.");
      return summarise(record);
    });
    return json(summary);
  } catch (error) {
    return handleError(error);
  }
}
