import { assertSameOrigin, handleError, json } from "@/lib/http";
import { captureSale } from "@/lib/sales";

export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    assertSameOrigin(request);
    const result = await captureSale((await params).orderId);
    if (result.state === "unknown-order") return json({ error: "We couldn't find that order." }, 404);
    if (result.state === "not-approved") return json({ error: "Payment wasn't approved in PayPal. Nothing was charged.", notApproved: true }, 409);
    if (result.state === "failed") return json({ error: result.reason, retryable: result.retryable }, 402);
    const { sale } = result;
    return json({
      saleId: sale.id,
      captureId: sale.captureId,
      totalCents: sale.totalCents,
      lines: sale.lines,
      capturedAt: sale.capturedAt,
    });
  } catch (error) {
    return handleError(error);
  }
}
