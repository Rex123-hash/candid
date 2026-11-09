import type { Metadata } from "next";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { AppHeader } from "@/components/AppHeader";
import { Icon, type IconName } from "@/components/Icon";
import { PrintButton } from "@/components/PrintButton";
import { HttpError, requireOwner } from "@/lib/http";
import { formatCents } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "QR sign", robots: { index: false } };

const STEPS: { icon: IconName; text: string }[] = [
  { icon: "scan", text: "Scan the code" },
  { icon: "camera", text: "Snap what you take" },
  { icon: "shield", text: "Pay with PayPal or Venmo" },
];

/**
 * The public address printed on signs. SITE_URL (the deployed site) wins, so a
 * sign printed from a laptop never carries a localhost link.
 */
async function siteOrigin(): Promise<string> {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** A printable sign for the stand: QR code to the stand's checkout page, prices and how to pay. */
export default async function SignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let record;
  try {
    record = await requireOwner(id);
  } catch (error) {
    return (
      <>
        <AppHeader backHref="/app" backLabel="All demos" narrow />
        <main id="main" className="wrap narrow" style={{ paddingBlock: 32 }}>
          <p className="notice error">{error instanceof HttpError ? error.message : "Not available."}</p>
        </main>
      </>
    );
  }
  const { stand } = record;
  const origin = await siteOrigin();
  const url = `${origin}/s/${stand.slug}`;
  const isLocal = /localhost|127\.0\.0\.1/.test(origin);
  const qr = await QRCode.toDataURL(url, { margin: 1, width: 520, color: { dark: "#16130f", light: "#ffffff" } });

  return (
    <>
      <AppHeader backHref={`/owner/${stand.id}`} backLabel="Owner view" className="no-print" />
      <main id="main" className="sign-page">
        <article className="sign">
          <p className="eyebrow">Nobody at the till? No problem.</p>
          <h1>{stand.name}</h1>
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL generated on the server */}
          <img src={qr} alt={`QR code that opens this stand's checkout at ${url}`} width={260} height={260} />
          <ol className="sign-steps">
            {STEPS.map((step, i) => (
              <li key={step.text}>
                <span className="sign-step-num num" aria-hidden="true">
                  {i + 1}
                </span>
                <Icon name={step.icon} size={18} />
                <span>{step.text}</span>
              </li>
            ))}
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
        <div className="no-print stack sign-actions">
          <PrintButton />
          {isLocal ? (
            <p className="hint">
              This preview links to your computer (localhost). On the live site, the code opens the public stand page from any phone.
            </p>
          ) : null}
        </div>
      </main>
    </>
  );
}
