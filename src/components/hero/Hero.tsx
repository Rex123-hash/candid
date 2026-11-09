"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { formatCents } from "@/lib/client";
import { Icon } from "../Icon";
import type { SceneItemId } from "./StandScene";

const StandScene = dynamic(() => import("./StandScene"), {
  ssr: false,
  loading: () => <div className="scene scene-loading" aria-hidden="true" />,
});

const ITEMS: Record<SceneItemId, { name: string; short: string; cents: number }> = {
  eggs: { name: "Free-range eggs", short: "Eggs", cents: 600 },
  honey: { name: "Wildflower honey", short: "Honey", cents: 900 },
  tomatoes: { name: "Heirloom tomatoes", short: "Tomatoes", cents: 400 },
  sunflowers: { name: "Sunflower bunch", short: "Sunflowers", cents: 500 },
};

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const listener = (e: MediaQueryListEvent) => setReduced(e.matches);
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }, []);
  return reduced;
}

export function Hero() {
  const [basket, setBasket] = useState<Partial<Record<SceneItemId, number>>>({ eggs: 1, honey: 2 });
  const [hovered, setHovered] = useState<SceneItemId | null>(null);
  const [announce, setAnnounce] = useState("");
  const reducedMotion = usePrefersReducedMotion();

  const entries = (Object.keys(ITEMS) as SceneItemId[]).filter((id) => (basket[id] ?? 0) > 0);
  const total = entries.reduce((sum, id) => sum + (basket[id] ?? 0) * ITEMS[id].cents, 0);

  function add(id: SceneItemId) {
    setBasket((prev) => ({ ...prev, [id]: Math.min(9, (prev[id] ?? 0) + 1) }));
    setAnnounce(`Added ${ITEMS[id].name}.`);
  }

  return (
    <section className="hero" aria-labelledby="hero-heading">
      <div className="hero-copy">
        <p className="eyebrow">For farm stands &amp; honesty boxes</p>
        <h1 id="hero-heading">
          Snap what you take.
          <br />
          <span className="hero-accent">Pay. Go.</span>
        </h1>
        <p className="hero-lede">
          Candid is the checkout for stands with nobody at the till. One photo becomes a bill, PayPal or Venmo pays it, and the owner sees
          what left the shelf versus what was paid.
        </p>
        <div className="row">
          <Link className="btn" href="/s/maple-lane">
            Try the demo stand
          </Link>
          <Link className="btn secondary" href="/owner/demo-maple-lane">
            See the owner&rsquo;s view
          </Link>
        </div>
        <p className="hint">Sandbox demo. No real money moves.</p>
      </div>

      <div className="hero-stage">
        <StandScene onPick={add} highlight={hovered} onHover={setHovered} reducedMotion={reducedMotion} />

        <aside className="glass-receipt" aria-label="Try it: build a basket">
          <p className="eyebrow">Live receipt</p>
          <ul className="mini-lines">
            {entries.length === 0 ? <li className="muted">Tap an item on the stand</li> : null}
            {entries.map((id) => (
              <li key={id}>
                <span>
                  {basket[id]} × {ITEMS[id].name}
                </span>
                <span className="num">{formatCents((basket[id] ?? 0) * ITEMS[id].cents)}</span>
              </li>
            ))}
          </ul>
          <div className="mini-total">
            <span>Total</span>
            <span className="num">{formatCents(total)}</span>
          </div>
          <div className="chip-row" role="group" aria-label="Add an item">
            {(Object.keys(ITEMS) as SceneItemId[]).map((id) => (
              <button
                key={id}
                type="button"
                className={`chip${hovered === id ? " on" : ""}`}
                onClick={() => add(id)}
                onMouseEnter={() => setHovered(id)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(id)}
                onBlur={() => setHovered(null)}
              >
                <Icon name="plus" size={14} /> {ITEMS[id].short}
              </button>
            ))}
          </div>
          <button type="button" className="link-btn" onClick={() => setBasket({})} disabled={entries.length === 0}>
            Clear
          </button>
          <p className="sr-only" role="status" aria-live="polite">
            {announce}
          </p>
        </aside>
      </div>
    </section>
  );
}
