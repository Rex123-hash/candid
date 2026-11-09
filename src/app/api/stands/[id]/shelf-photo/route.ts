import { countShelf } from "@/lib/ai";
import { assertSameOrigin, handleError, json, requireOwner } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { ImageSchema } from "@/lib/types";

/** AI proposes shelf counts; the owner confirms them through the /shelf route. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    rateLimit(request, "shelf", 20);
    const { stand } = await requireOwner((await params).id);
    const image = ImageSchema.parse(await request.json());
    return json(await countShelf(stand, image));
  } catch (error) {
    return handleError(error);
  }
}
