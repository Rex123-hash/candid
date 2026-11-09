import "server-only";
import { capturePayPalOrder, getPayPalOrderStatus } from "./paypal";
import { standIdForOrder, updateStandRecord } from "./store";
import type { Sale } from "./types";

export type CaptureResult =
  | { state: "paid"; sale: Sale }
  | { state: "not-approved" }
  | { state: "failed"; reason: string; retryable: boolean }
  | { state: "unknown-order" };

/**
 * Captures a sale exactly once. A sale already marked CAPTURED (by an earlier
 * request or the webhook) is returned as-is without calling PayPal again.
 */
export async function captureSale(orderId: string): Promise<CaptureResult> {
  const standId = await standIdForOrder(orderId);
  if (!standId) return { state: "unknown-order" };

  return updateStandRecord(standId, async (record) => {
    const sale = record.sales.find((s) => s.paypalOrderId === orderId);
    if (!sale) return { state: "unknown-order" } as const;
    if (sale.status === "CAPTURED") return { state: "paid", sale } as const;

    // Ask PayPal first, so a cancelled or abandoned checkout is never captured or
    // flagged. COMPLETED means an earlier capture went through but its reply was lost:
    // capturing again with the same request id returns that same capture.
    const status = await getPayPalOrderStatus(sale.paypalOrderId);
    if (status !== "APPROVED" && status !== "COMPLETED") return { state: "not-approved" } as const;

    const outcome = await capturePayPalOrder(sale, record.stand.currency);
    if (outcome.ok) {
      sale.status = "CAPTURED";
      sale.captureId = outcome.captureId;
      sale.capturedAt = new Date().toISOString();
      delete sale.attentionReason;
      return { state: "paid", sale } as const;
    }
    if (!outcome.retryable) {
      sale.status = "ATTENTION";
      sale.attentionReason = outcome.reason;
    }
    return { state: "failed", reason: outcome.reason, retryable: outcome.retryable } as const;
  });
}

/** Applies a verified PAYMENT.CAPTURE.COMPLETED webhook. Never downgrades a sale. */
export async function confirmCaptureFromWebhook(orderId: string, captureId: string, valueCents: number): Promise<"updated" | "ignored"> {
  const standId = await standIdForOrder(orderId);
  if (!standId) return "ignored";
  return updateStandRecord(standId, (record) => {
    const sale = record.sales.find((s) => s.paypalOrderId === orderId);
    if (!sale || sale.status === "CAPTURED") return "ignored" as const;
    if (sale.totalCents !== valueCents) {
      sale.status = "ATTENTION";
      sale.attentionReason = "PayPal reported a different amount than the basket total.";
      return "updated" as const;
    }
    sale.status = "CAPTURED";
    sale.captureId = captureId;
    sale.capturedAt = new Date().toISOString();
    return "updated" as const;
  });
}
