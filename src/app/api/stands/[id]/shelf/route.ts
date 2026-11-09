import { randomUUID } from "node:crypto";
import { assertSameOrigin, handleError, json, requireOwner } from "@/lib/http";
import { updateStandRecord } from "@/lib/store";
import { summarise } from "@/lib/summary";
import { ShelfCountSchema } from "@/lib/types";

/** Saves owner-confirmed shelf counts (opening or closing) and returns the updated day. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { stand } = await requireOwner((await params).id);
    const input = ShelfCountSchema.parse(await request.json());
    const known = new Set(stand.items.map((i) => i.id));
    const counts = Object.fromEntries(Object.entries(input.counts).filter(([id]) => known.has(id)));

    const summary = await updateStandRecord(stand.id, (record) => {
      record.shelfCounts.push({
        id: randomUUID(),
        standId: stand.id,
        kind: input.kind,
        counts,
        notes: "",
        createdAt: new Date().toISOString(),
      });
      record.shelfCounts = record.shelfCounts.slice(-60);
      return summarise(record);
    });
    return json(summary, 201);
  } catch (error) {
    return handleError(error);
  }
}
