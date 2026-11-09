import { readBasket } from "@/lib/ai";
import { assertSameOrigin, handleError, json, requireStand } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { ImageSchema } from "@/lib/types";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    rateLimit(request, "basket", 30);
    const { stand } = await requireStand((await params).id);
    const image = ImageSchema.parse(await request.json());
    return json(await readBasket(stand, image));
  } catch (error) {
    return handleError(error);
  }
}
