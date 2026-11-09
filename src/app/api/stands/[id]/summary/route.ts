import { handleError, json, requireOwner } from "@/lib/http";
import { summarise } from "@/lib/summary";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    return json(summarise(await requireOwner((await params).id)));
  } catch (error) {
    return handleError(error);
  }
}
