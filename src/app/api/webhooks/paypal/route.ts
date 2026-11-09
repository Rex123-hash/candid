import { valueToCents } from "@/lib/money";
import { verifyWebhook } from "@/lib/paypal";
import { confirmCaptureFromWebhook } from "@/lib/sales";

type CaptureEvent = {
  id?: string;
  event_type?: string;
  resource?: {
    id?: string;
    amount?: { value?: string };
    supplementary_data?: { related_ids?: { order_id?: string } };
  };
};

/**
 * PayPal webhook. Nothing in the body is trusted until PayPal itself confirms
 * the signature. Unverified or malformed events change no state.
 */
export async function POST(request: Request) {
  const raw = await request.text();
  if (raw.length > 200_000) return new Response(null, { status: 413 });

  let verified = false;
  try {
    verified = await verifyWebhook(request.headers, raw);
  } catch (error) {
    console.error("[candid] webhook verification error", error);
  }
  if (!verified) return new Response(null, { status: 400 });

  let event: CaptureEvent;
  try {
    event = JSON.parse(raw) as CaptureEvent;
  } catch {
    return new Response(null, { status: 400 });
  }

  if (event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
    const orderId = event.resource?.supplementary_data?.related_ids?.order_id;
    const captureId = event.resource?.id;
    const value = event.resource?.amount?.value;
    if (orderId && captureId && value) {
      try {
        await confirmCaptureFromWebhook(orderId, captureId, valueToCents(value));
      } catch (error) {
        console.error("[candid] webhook apply error", error);
        return new Response(null, { status: 500 }); // PayPal retries
      }
    }
  }
  return new Response(null, { status: 200 });
}
