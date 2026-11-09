import Link from "next/link";
import { Hero } from "@/components/hero/Hero";
import { Tilt } from "@/components/fx/Tilt";
import { Icon, type IconName } from "@/components/Icon";

const steps: { title: string; icon: IconName; body: string }[] = [
  {
    title: "Snap",
    icon: "camera",
    body: "Scan the stand's QR code and take one photo of what you're taking. Gemini reads the basket against this stand's own price list.",
  },
  {
    title: "Check",
    icon: "scan",
    body: "The list fills itself in. Fix anything with a tap. Prices come from the stand, never from the phone.",
  },
  {
    title: "Pay",
    icon: "shield",
    body: "PayPal or Venmo, in about ten seconds. No cash box for anyone to steal, and a receipt for the customer.",
  },
];

export default function Home() {
  return (
    <>
      <header className="site-header wrap row" style={{ justifyContent: "space-between" }}>
        <Link href="/" className="brand" aria-label="Candid home">
          Candid<span>.</span>
        </Link>
        <nav aria-label="Main" className="row top-nav">
          <a href="#how">How it works</a>
          <Link href="/owner/demo-maple-lane">Owner view</Link>
          <Link className="btn small" href="/owner/new">
            Set up a stand
          </Link>
        </nav>
      </header>

      <main id="main">
        <div className="wrap">
          <Hero />
        </div>

        <section id="how" className="wrap band stack" aria-labelledby="how-heading">
          <p className="eyebrow">How it works</p>
          <h2 id="how-heading">Ten seconds at the stand. A clear count at closing.</h2>
          <ol className="steps">
            {steps.map((step, i) => (
              <Tilt as="li" key={step.title} className="card step">
                <span className="step-icon" aria-hidden="true">
                  <Icon name={step.icon} size={26} />
                </span>
                <span className="step-num num" aria-hidden="true">
                  0{i + 1}
                </span>
                <h3>{step.title}</h3>
                <p className="muted">{step.body}</p>
              </Tilt>
            ))}
          </ol>
        </section>

        <section className="wrap band split" aria-labelledby="close-heading">
          <div className="stack">
            <p className="eyebrow">The closing check</p>
            <h2 id="close-heading">Know what went missing, not just what came in.</h2>
            <p className="muted">
              Photograph the shelf when you open and when you close. Candid counts what left and matches it against every PayPal payment, so
              you see the gap per item. It&rsquo;s a number for you, never an accusation, and no customer is ever photographed.
            </p>
            <Link className="btn secondary" href="/owner/demo-maple-lane">
              Open the demo owner view
            </Link>
          </div>
          <Tilt className="card close-demo" max={6}>
            <div className="close-line">
              <span>Left the shelf</span>
              <span className="num">19</span>
            </div>
            <div className="close-line">
              <span>Paid with PayPal or Venmo</span>
              <span className="num">17</span>
            </div>
            <div className="close-line alert">
              <span>
                <Icon name="alert" size={18} /> Honey left unpaid
              </span>
              <span className="num">2 · $18.00</span>
            </div>
            <p className="hint">Example figures.</p>
          </Tilt>
        </section>

        <section className="wrap band stack" aria-labelledby="built-heading">
          <p className="eyebrow">Under the hood</p>
          <h2 id="built-heading">Built on PayPal, end to end.</h2>
          <ul className="tag-cloud">
            {["JS SDK v6 buttons", "Venmo", "Orders v2 create & capture", "Catalog Products", "Payouts to growers", "Signed webhooks", "PayPal Server SDK", "Gemini vision"].map(
              (t) => (
                <li key={t}>{t}</li>
              ),
            )}
          </ul>
        </section>
      </main>

      <footer className="wrap site-footer">
        <p className="muted">Candid · PayPal AI Hackathon 2026 · Sandbox only, no real money. Demo stand and growers are fictional.</p>
      </footer>
    </>
  );
}
