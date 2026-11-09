import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { Tilt } from "@/components/fx/Tilt";
import { Icon, type IconName } from "@/components/Icon";

export const metadata: Metadata = { title: "Try Candid" };

const DOORS: { href: string; icon: IconName; kicker: string; title: string; body: string; cta: string }[] = [
  {
    href: "/s/maple-lane",
    icon: "camera",
    kicker: "Be the customer",
    title: "Maple Lane Farm Stand",
    body: "Snap a basket (or tap to add items), then pay with PayPal or Venmo in the sandbox.",
    cta: "Open the stand",
  },
  {
    href: "/owner/demo-maple-lane",
    icon: "scan",
    kicker: "Be the owner",
    title: "Closing check & payouts",
    body: "Count the shelf, see what left unpaid, browse today's payments and pay the three growers.",
    cta: "Open the owner view",
  },
  {
    href: "/owner/new",
    icon: "receipt",
    kicker: "Start your own",
    title: "Set up a stand",
    body: "Photograph a price sign. Get a stand, PayPal catalog products and a printable QR sign.",
    cta: "Set up a stand",
  },
];

export default function AppHome() {
  return (
    <>
      <AppHeader backHref="/" backLabel="Home" />
      <main id="main" className="wrap stack app-home" style={{ "--gap": "32px", paddingBottom: 64 } as React.CSSProperties}>
        <div className="stack" style={{ "--gap": "10px" } as React.CSSProperties}>
          <p className="eyebrow">Welcome in</p>
          <h1>Pick a side of the stand.</h1>
          <p className="muted app-lede">Everything here runs on the PayPal sandbox with fictional growers, so try anything.</p>
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
                <Link href={door.href} className="btn door-link">
                  {door.cta} <Icon name="arrow" size={18} />
                </Link>
              </Tilt>
            </li>
          ))}
        </ul>
        <section className="card stack how-card" aria-labelledby="judge-heading">
          <h2 id="judge-heading">Judging tip</h2>
          <p className="muted">
            Open the stand on your phone and the owner view on your laptop. Pay on the phone with the sandbox buyer account, then watch the payment arrive in the owner&rsquo;s table.
          </p>
        </section>
      </main>
    </>
  );
}
