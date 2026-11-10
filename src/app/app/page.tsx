import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { Tilt } from "@/components/fx/Tilt";
import { Icon, type IconName } from "@/components/Icon";

export const metadata: Metadata = { title: "Try Candid" };

const DOORS: { href: string; icon: IconName; kicker: string; title: string; body: string; sees: string[]; cta: string }[] = [
  {
    href: "/s/maple-lane",
    icon: "camera",
    kicker: "Be the customer",
    title: "Maple Lane Farm Stand",
    body: "You've just picked up eggs and honey from a stand with nobody around. This is the page the stand's QR code opens.",
    sees: ["Snap your basket and watch the list fill itself in", "Fix anything with a tap before you pay", "Pay with PayPal or Venmo and get a receipt"],
    cta: "Open the stand",
  },
  {
    href: "/owner/demo-maple-lane",
    icon: "scan",
    kicker: "Be the owner",
    title: "Close a shared stand",
    body: "It's the end of the day at Maple Lane. Three neighbours share the stand, and the money has to reach each of them.",
    sees: ["Count the shelf from a photo; unclear counts are flagged for you", "Answer a question only where the day doesn't add up", "Pay each grower and watch whether PayPal says it arrived"],
    cta: "Open the owner view",
  },
  {
    href: "/owner/new",
    icon: "receipt",
    kicker: "Start your own",
    title: "Set up a stand",
    body: "Got a chalkboard or a cardboard price sign? That's all Candid needs to get you going.",
    sees: ["Photograph the sign and get your price list", "Each item becomes a PayPal catalog product", "Print a QR sign for your stand"],
    cta: "Set up a stand",
  },
];

const LOOP: { title: string; body: string }[] = [
  { title: "Open the stand on your phone", body: "Or in a second browser tab. It's the same page a customer reaches by scanning the sign." },
  { title: "Snap or tap your basket", body: "Take a photo of anything on hand, or add eggs and honey with the + buttons." },
  { title: "Pay with a sandbox buyer", body: "When PayPal asks you to log in, use a sandbox Personal account. No real money moves." },
  { title: "Watch it land", body: "Keep the owner view open. Your payment appears in today's table within about ten seconds." },
  { title: "Close the day", body: "Count the shelf at opening and closing. Candid asks one question per gap: sold for cash, given away, restocked, or unknown." },
  { title: "Pay the growers", body: "Send one Payouts batch, then follow each grower's payment: received, on its way, unclaimed or owed again." },
];

const PRINCIPLES: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "camera",
    title: "The photo only fills the form",
    body: "Gemini reads the basket against this stand's own price list. The customer always sees the list and can change it before anything is charged.",
  },
  {
    icon: "receipt",
    title: "Prices come from the stand",
    body: "The phone sends item names and quantities, never prices. The server works out the total, and PayPal is asked for exactly that amount.",
  },
  {
    icon: "shield",
    title: "PayPal confirms every sale",
    body: "A sale only counts as paid once PayPal says the capture is complete, and asking twice can never charge twice.",
  },
];

export default function AppHome() {
  return (
    <>
      <AppHeader backHref="/" backLabel="Home" />
      <main id="main" className="wrap stack app-home" style={{ "--gap": "48px", paddingBottom: 72 } as React.CSSProperties}>
        <div className="stack" style={{ "--gap": "12px" } as React.CSSProperties}>
          <p className="eyebrow">Welcome in</p>
          <h1>Pick a side of the stand.</h1>
          <p className="muted app-lede">
            Every honesty stand has two people in it: the passer-by who takes what they need, and the grower who comes back at closing.
            Try both. Everything here runs on PayPal&rsquo;s sandbox with a fictional stand, so nothing costs real money.
          </p>
        </div>

        <ul className="doors" role="list">
          {DOORS.map((door) => (
            <li key={door.href}>
              <Tilt className="card door">
                <span className="step-icon" aria-hidden="true">
                  <Icon name={door.icon} size={26} />
                </span>
                <p className="eyebrow">{door.kicker}</p>
                <h2>{door.title}</h2>
                <p className="muted">{door.body}</p>
                <ul className="door-sees" aria-label="What you'll see">
                  {door.sees.map((line) => (
                    <li key={line}>
                      <Icon name="check" size={16} />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
                <Link href={door.href} className="btn door-link">
                  {door.cta} <Icon name="arrow" size={18} />
                </Link>
              </Tilt>
            </li>
          ))}
        </ul>

        <section className="card loop-card" aria-labelledby="loop-heading">
          <div className="stack" style={{ "--gap": "8px" } as React.CSSProperties}>
            <p className="eyebrow">Two minutes, start to finish</p>
            <h2 id="loop-heading">Try the whole loop</h2>
            <p className="muted">The best way to see Candid is to be both people at once: customer on your phone, owner on your laptop.</p>
          </div>
          <ol className="loop">
            {LOOP.map((step, i) => (
              <li key={step.title}>
                <span className="loop-num num" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3>{step.title}</h3>
                  <p className="muted">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="stack" aria-labelledby="how-heading" style={{ "--gap": "20px" } as React.CSSProperties}>
          <div className="stack" style={{ "--gap": "8px" } as React.CSSProperties}>
            <p className="eyebrow">Under the hood</p>
            <h2 id="how-heading">Built so trust doesn&rsquo;t have to be blind</h2>
          </div>
          <ul className="principles" role="list">
            {PRINCIPLES.map((p) => (
              <li key={p.title} className="principle">
                <span className="principle-icon" aria-hidden="true">
                  <Icon name={p.icon} size={22} />
                </span>
                <h3>{p.title}</h3>
                <p className="muted">{p.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <p className="hint app-foot">Sandbox only. Maple Lane Farm Stand and its growers are fictional.</p>
      </main>
    </>
  );
}
