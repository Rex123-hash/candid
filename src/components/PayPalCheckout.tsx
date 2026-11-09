"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";

/**
 * PayPal JS SDK v6 one-time payments with PayPal and Venmo buttons. The server
 * creates the order from the basket (it prices it), and the server captures it.
 */

type PaymentSession = { start: (options: { presentationMode: "auto" }, orderPromise: Promise<{ orderId: string }>) => Promise<void> };
type SessionCallbacks = {
  onApprove: (data: { orderId: string }) => Promise<void>;
  onCancel: () => void;
  onError: (error: unknown) => void;
};
type SdkInstance = {
  findEligibleMethods: (options: { currencyCode: string }) => Promise<{ isEligible: (method: string) => boolean }>;
  createPayPalOneTimePaymentSession: (callbacks: SessionCallbacks) => PaymentSession;
  createVenmoOneTimePaymentSession: (callbacks: SessionCallbacks) => PaymentSession;
};

declare global {
  interface Window {
    paypal?: {
      createInstance: (options: { clientId: string; components: string[]; pageType: string }) => Promise<SdkInstance>;
    };
  }
}

declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "paypal-button": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & { type?: string };
      "venmo-button": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & { type?: string };
    }
  }
}

const SDK_URL = "https://www.sandbox.paypal.com/web-sdk/v6/core";
let sdkPromise: Promise<SdkInstance> | null = null;

function loadSdk(): Promise<SdkInstance> {
  sdkPromise ??= (async () => {
    const { clientId } = await api<{ clientId: string }>("/api/paypal/client-id");
    if (!window.paypal) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        script.src = SDK_URL;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("PayPal couldn't load. Check your connection."));
        document.head.appendChild(script);
      });
    }
    return window.paypal!.createInstance({ clientId, components: ["paypal-payments", "venmo-payments"], pageType: "checkout" });
  })();
  sdkPromise.catch(() => (sdkPromise = null));
  return sdkPromise;
}

export type PaidReceipt = { saleId: string; captureId: string; totalCents: number; capturedAt: string };

type Props = {
  standId: string;
  lines: { itemId: string; qty: number }[];
  disabled: boolean;
  onPaid: (receipt: PaidReceipt) => void;
  onStatus: (message: string, tone: "info" | "error") => void;
};

export function PayPalCheckout({ standId, lines, disabled, onPaid, onStatus }: Props) {
  const [sdk, setSdk] = useState<SdkInstance | null>(null);
  const [eligible, setEligible] = useState({ paypal: false, venmo: false });
  const [loadError, setLoadError] = useState<string | null>(null);
  // Keep the latest basket and callbacks without re-binding the SDK sessions.
  const latest = useRef({ lines, onPaid, onStatus });
  latest.current = { lines, onPaid, onStatus };

  useEffect(() => {
    let cancelled = false;
    loadSdk()
      .then(async (instance) => {
        const methods = await instance.findEligibleMethods({ currencyCode: "USD" });
        if (cancelled) return;
        setSdk(instance);
        setEligible({ paypal: methods.isEligible("paypal"), venmo: methods.isEligible("venmo") });
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "PayPal couldn't load.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function pay(method: "paypal" | "venmo") {
    if (!sdk || disabled) return;
    const callbacks: SessionCallbacks = {
      async onApprove({ orderId }) {
        latest.current.onStatus("Payment approved. Confirming with PayPal…", "info");
        try {
          const receipt = await api<PaidReceipt>(`/api/orders/${encodeURIComponent(orderId)}/capture`, { method: "POST", body: {} });
          latest.current.onPaid(receipt);
        } catch (error) {
          latest.current.onStatus(error instanceof Error ? error.message : "We couldn't confirm the payment.", "error");
        }
      },
      onCancel() {
        latest.current.onStatus("Payment cancelled. Nothing was charged.", "info");
      },
      onError() {
        latest.current.onStatus("PayPal hit a problem. Nothing was charged. Please try again.", "error");
      },
    };
    const session = method === "venmo" ? sdk.createVenmoOneTimePaymentSession(callbacks) : sdk.createPayPalOneTimePaymentSession(callbacks);
    // Start the order request without awaiting it, so the popup keeps the click's user activation.
    const orderPromise = api<{ orderId: string }>(`/api/stands/${standId}/orders`, {
      body: { lines: latest.current.lines, method },
    });
    orderPromise.catch((error: unknown) => {
      latest.current.onStatus(error instanceof Error ? error.message : "We couldn't start the payment.", "error");
    });
    try {
      await session.start({ presentationMode: "auto" }, orderPromise);
    } catch {
      // Order or popup errors are already reported through the callbacks above.
    }
  }

  if (loadError) return <p className="notice error">{loadError}</p>;
  if (!sdk) return <p className="muted">Loading PayPal…</p>;

  return (
    // The SDK's buttons are already keyboard- and screen-reader-accessible; `inert`
    // takes them out of the tab order while the basket is empty.
    <div className={`pay-buttons${disabled ? " is-disabled" : ""}`} inert={disabled}>
      {eligible.paypal ? <paypal-button type="pay" onClick={() => void pay("paypal")} /> : null}
      {eligible.venmo ? <venmo-button type="pay" onClick={() => void pay("venmo")} /> : null}
      {!eligible.paypal && !eligible.venmo ? <p className="notice error">No PayPal payment methods are available right now.</p> : null}
    </div>
  );
}
