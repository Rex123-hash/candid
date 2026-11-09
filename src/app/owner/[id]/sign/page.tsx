import type { Metadata } from "next";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { PrintButton } from "@/components/PrintButton";
import { HttpError, requireOwner } from "@/lib/http";
import { formatCents } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "QR sign", robots: { index: false } };

/** A printable sign for the stand: QR code, prices and how to pay. */
export default async function SignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let record;
  try {
    record = await requireOwner(id);
  } catch (error) {
    return (
      <main id="main" className="wrap narrow" style={{ paddingBlock: 64 }}>
        <p className="notice error">{error instanceof HttpError ? error.message : "Not available."}</p>
      </main>
    );
  }
  const { stand } = record;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const url = `${proto}://${host}/s/${stand.slug}`;
  const qr = await QRCode.toDataURL(url, { margin: 1, width: 520, color: { dark: "#16130f", light: "#ffffff" } });

  return (
    <main id="main" className="sign-page">
      <article className="sign">
        <p className="eyebrow">Nobody at the till? No problem.</p>
        <h1>{stand.name}</h1>
        {/* eslint-disable-next-line @next/next/no-img-element -- data URL generated on the server */}
        <img src={qr} alt={`QR code that opens ${url}`} width={260} height={260} />
        <ol className="sign-steps">
          <li>Scan the code</li>
          <li>Snap what you take</li>
          <li>Pay with PayPal or Venmo</li>
        </ol>
        <ul className="sign-prices">
          {stand.items.map((item) => (
            <li key={item.id}>
              <span>{item.name}</span>
              <span className="num">
                {formatCents(item.priceCents)} / {item.unit}
              </span>
            </li>
          ))}
        </ul>
        <p className="muted mono sign-url">{url}</p>
      </article>
      <div className="no-print row" style={{ justifyContent: "center", marginTop: 24 }}>
        <PrintButton />
      </div>
    </main>
  );
}
