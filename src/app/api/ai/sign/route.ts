import { readPriceSign } from "@/lib/ai";
import { assertSameOrigin, handleError, json } from "@/lib/http";
import { rateLimit } from "@/lib/ratelimit";
import { ImageSchema } from "@/lib/types";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    rateLimit(request, "sign", 10);
    const image = ImageSchema.parse(await request.json());
    return json(await readPriceSign(image));
  } catch (error) {
    return handleError(error);
  }
}
