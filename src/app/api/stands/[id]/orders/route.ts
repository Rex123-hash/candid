import { randomUUID } from "node:crypto";
import { assertSameOrigin, handleError, json, requireStand } from "@/lib/http";
import { createPayPalOrder } from "@/lib/paypal";
import { priceCart } from "@/lib/pricing";
import { indexOrder, updateStandRecord } from "@/lib/store";
import { CreateOrderSchema, type Sale } from "@/lib/types";

/** Prices the basket on the server and opens a PayPal order for exactly that amount. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { stand } = await requireStand((await params).id);
    const { lines: cart, method } = CreateOrderSchema.parse(await request.json());
    const { lines, totalCents } = priceCart(stand, cart);

    const saleId = randomUUID();
    const paypalOrderId = await createPayPalOrder(stand, { id: saleId, lines, totalCents });
    const sale: Sale = {
      id: saleId,
      standId: stand.id,
      lines,
      totalCents,
      method,
      status: "CREATED",
      paypalOrderId,
      captureRequestId: `capture-${saleId}`,
      createdAt: new Date().toISOString(),
    };
    await updateStandRecord(stand.id, (record) => {
      record.sales.push(sale);
    });
    await indexOrder(paypalOrderId, stand.id);
    return json({ orderId: paypalOrderId, totalCents }, 201);
  } catch (error) {
    return handleError(error);
  }
}
