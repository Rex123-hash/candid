"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError, formatCents, photoToJpeg } from "@/lib/client";
import type { PublicStand } from "@/lib/public";
import { Icon } from "./Icon";
import { PayPalCheckout, type PaidReceipt } from "./PayPalCheckout";
import { PhotoButton } from "./PhotoButton";
import { QuantityList } from "./QuantityList";

type BasketReading = { lines: { itemId: string; qty: number; confident: boolean }[]; notInCatalog: string[] };
type Status = { message: string; tone: "info" | "error" | "success" } | null;

export function StandCheckout({ stand }: { stand: PublicStand }) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [unsure, setUnsure] = useState<Set<string>>(new Set());
  const [reading, setReading] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [receipt, setReceipt] = useState<PaidReceipt | null>(null);
  const receiptHeading = useRef<HTMLHeadingElement>(null);

  // If PayPal redirected back here (no popup), finish the payment from the URL's order token.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const outcome = params.get("paypal");
    if (!outcome) return;
    window.history.replaceState(null, "", window.location.pathname);
    if (outcome !== "return" || !token) {
      setStatus({ message: "Payment cancelled. Nothing was charged.", tone: "info" });
      return;
    }
    setStatus({ message: "Confirming your payment with PayPal…", tone: "info" });
    api<PaidReceipt>(`/api/orders/${encodeURIComponent(token)}/capture`, { method: "POST", body: {} })
      .then((paid) => {
        setReceipt(paid);
        setStatus({ message: `Paid ${formatCents(paid.totalCents)}. Thank you!`, tone: "success" });
      })
      .catch((error: unknown) => setStatus({ message: error instanceof Error ? error.message : "We couldn't confirm the payment.", tone: "error" }));
  }, []);

  const lines = useMemo(
    () => Object.entries(quantities).filter(([, qty]) => qty > 0).map(([itemId, qty]) => ({ itemId, qty })),
    [quantities],
  );
  const totalCents = lines.reduce((sum, line) => sum + line.qty * (stand.items.find((i) => i.id === line.itemId)?.priceCents ?? 0), 0);
  const itemCount = lines.reduce((sum, line) => sum + line.qty, 0);

  async function readPhoto(file: File) {
    setReading(true);
    setStatus({ message: "Reading your photo…", tone: "info" });
    try {
      const image = await photoToJpeg(file);
      const result = await api<BasketReading>(`/api/stands/${stand.id}/basket`, { body: image });
      const next: Record<string, number> = {};
      for (const line of result.lines) next[line.itemId] = line.qty;
      setQuantities(next);
      setUnsure(new Set(result.lines.filter((l) => !l.confident).map((l) => l.itemId)));
      const found = result.lines.reduce((s, l) => s + l.qty, 0);
      const extra = result.notInCatalog.length ? ` We also saw ${result.notInCatalog.join(", ")}, which this stand doesn't sell.` : "";
      setStatus(
        found > 0
          ? { message: `We counted ${found} item${found === 1 ? "" : "s"}. Check the list, fix anything wrong, then pay.${extra}`, tone: "success" }
          : { message: `We couldn't spot anything from this stand. Add your items below.${extra}`, tone: "info" },
      );
    } catch (error) {
      const message = error instanceof ApiError || error instanceof Error ? error.message : "We couldn't read that photo.";
      setStatus({ message: `${message} You can still add items below.`, tone: "error" });
    } finally {
      setReading(false);
    }
  }

  function setQty(itemId: string, qty: number) {
    setQuantities((prev) => ({ ...prev, [itemId]: qty }));
    setUnsure((prev) => {
      if (!prev.has(itemId)) return prev;
      const next = new Set(prev);
      next.delete(itemId);
      return next;
    });
  }

  if (receipt) {
    return (
      <section className="card stack receipt" aria-labelledby="receipt-heading">
        <p className="pill paid">
          <Icon name="check" size={16} /> Paid
        </p>
        <h2 id="receipt-heading" ref={receiptHeading} tabIndex={-1}>
          Thank you. You&rsquo;re all set.
        </h2>
        <p className="receipt-total num">{formatCents(receipt.totalCents)}</p>
        <dl className="receipt-meta">
          <div>
            <dt>Paid to</dt>
            <dd>{stand.name}</dd>
          </div>
          <div>
            <dt>PayPal capture</dt>
            <dd className="mono">{receipt.captureId}</dd>
          </div>
          <div>
            <dt>Time</dt>
            <dd>{new Date(receipt.capturedAt).toLocaleString()}</dd>
          </div>
        </dl>
        <p className="muted">Enjoy your {itemCount === 1 ? "item" : "things"}. You can close this page.</p>
        <button
          type="button"
          className="btn secondary"
          onClick={() => {
            setReceipt(null);
            setQuantities({});
            setStatus(null);
          }}
        >
          Start a new basket
        </button>
      </section>
    );
  }

  return (
    <div className="stack" style={{ "--gap": "20px" } as React.CSSProperties}>
      <section className="card stack" aria-labelledby="snap-heading">
        <h2 id="snap-heading">1. Snap what you&rsquo;re taking</h2>
        <p className="muted">Lay your items out and take one photo. We&rsquo;ll fill in the list for you.</p>
        <PhotoButton label="Take a photo of your basket" busyLabel="Reading photo…" busy={reading} onPhoto={readPhoto} variant="yolk" />
      </section>

      <section className="card stack" aria-labelledby="check-heading">
        <h2 id="check-heading">2. Check your list</h2>
        <QuantityList items={stand.items} quantities={quantities} onChange={setQty} unsure={unsure} />
        <div className="total-row">
          <span>Total</span>
          <span className="num total-value">{formatCents(totalCents)}</span>
        </div>
      </section>

      <section className="card stack" aria-labelledby="pay-heading">
        <h2 id="pay-heading">3. Pay and go</h2>
        {itemCount === 0 ? <p className="muted">Add at least one item to pay.</p> : null}
        <PayPalCheckout
          standId={stand.id}
          lines={lines}
          disabled={itemCount === 0}
          onStatus={(message, tone) => setStatus({ message, tone })}
          onPaid={(paid) => {
            setReceipt(paid);
            setStatus({ message: `Paid ${formatCents(paid.totalCents)}. Thank you!`, tone: "success" });
            requestAnimationFrame(() => receiptHeading.current?.focus());
          }}
        />
        <p className="hint">Sandbox demo: no real money moves. Prices are set by the stand, not your phone.</p>
      </section>

      <div role="status" aria-live="polite" className={status ? `notice ${status.tone === "error" ? "error" : status.tone === "success" ? "success" : ""}` : "sr-only"}>
        {status?.message ?? ""}
      </div>
    </div>
  );
}
