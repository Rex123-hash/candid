"use client";

import { useGSAP } from "@gsap/react";
import { SplitText } from "gsap/SplitText";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "../Icon";
import { Magnetic } from "../fx/Magnetic";
import { CHAPTERS, chapterAt, storyState } from "./chapters";
import { ExplainerPlayer } from "./ExplainerPlayer";
import { Preloader } from "./Preloader";
import { gsap, scrollToY, ScrollTrigger, setScrollLocked, usePrefersReducedMotion, useSmoothScroll } from "./useStoryScroll";

gsap.registerPlugin(SplitText);

const StoryScene = dynamic(() => import("./StoryScene"), { ssr: false, loading: () => <div className="story-canvas" aria-hidden="true" /> });

const USE_CASES = [
  { title: "Farm stands", body: "Eggs, honey and flowers by the road. The classic honesty box, without the box.", icon: "receipt" as const },
  { title: "Campus pantries", body: "Students take what they need and pay what they can, with a record for the organisers.", icon: "shield" as const },
  { title: "Office snack shelves", body: "No vending machine, no float to count. Snacks paid for in seconds.", icon: "scan" as const },
  { title: "Bake sales & markets", body: "Step away from the table without losing a sale.", icon: "sparkle" as const },
  { title: "Co-op stands", body: "Several growers share one stand; each gets their own share every night.", icon: "split" as const },
];

const PAYPAL = [
  ["JS SDK v6", "PayPal and Venmo buttons with one-time payment sessions."],
  ["Orders v2", "Created and captured on the server, priced from the stand's catalog."],
  ["Venmo", "The way most farm-stand customers already pay, now with a receipt."],
  ["Catalog Products", "Every stand item registered as a PayPal product at setup."],
  ["Payouts", "One batch pays each grower for their own items."],
  ["Webhooks", "Captures confirmed only after PayPal verifies the signature."],
] as const;

export function Story() {
  const root = useRef<HTMLDivElement>(null);
  const story = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const slider = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  useSmoothScroll(!reducedMotion);

  // Hold scrolling until the preloader's shutter has opened.
  useEffect(() => {
    window.scrollTo(0, 0);
    setScrollLocked(!loaded);
  }, [loaded]);

  // The headline reveal waits for the preloader, so it plays where people can see it.
  useGSAP(
    () => {
      if (!loaded || reducedMotion) return;
      const split = SplitText.create(".hero-title", { type: "words,chars", mask: "words" });
      gsap.from(split.chars, { yPercent: 110, duration: 1, ease: "expo.out", stagger: 0.025 });
      gsap.from(".chapter-trust .hero-fade", { opacity: 0, y: 24, duration: 1, ease: "power3.out", stagger: 0.12, delay: 0.45 });
      gsap.from(".night-header", { opacity: 0, y: -16, duration: 0.8, ease: "power3.out", delay: 0.3 });
      return () => split.revert();
    },
    { scope: root, dependencies: [loaded, reducedMotion] },
  );

  useGSAP(
    () => {
      // The 3D story: scroll progress drives the camera and the chapter copy.
      ScrollTrigger.create({
        trigger: story.current,
        start: "top top",
        end: "bottom bottom",
        onUpdate: (self) => {
          storyState.progress = self.progress;
          setActive(chapterAt(self.progress));
        },
      });

      if (reducedMotion) return;

      // Horizontal use-case slider, pinned while it scrolls sideways.
      const el = track.current;
      if (el && slider.current) {
        gsap.to(el, {
          x: () => -(el.scrollWidth - window.innerWidth + 64),
          ease: "none",
          scrollTrigger: { trigger: slider.current, start: "top top", end: "bottom bottom", scrub: 0.6, invalidateOnRefresh: true },
        });
      }

      // Section reveals.
      gsap.utils.toArray<HTMLElement>(".reveal").forEach((node) => {
        gsap.from(node, { opacity: 0, y: 48, duration: 1, ease: "power3.out", scrollTrigger: { trigger: node, start: "top 85%" } });
      });
      gsap.utils.toArray<HTMLElement>(".api-card").forEach((node, i) => {
        gsap.from(node, { opacity: 0, y: 40, rotateX: -18, duration: 0.9, ease: "power3.out", delay: (i % 3) * 0.08, scrollTrigger: { trigger: node, start: "top 90%" } });
      });
    },
    { scope: root, dependencies: [reducedMotion] },
  );

  function goToChapter(index: number) {
    const section = story.current;
    if (!section) return;
    const top = section.getBoundingClientRect().top + window.scrollY;
    const span = section.offsetHeight - window.innerHeight;
    scrollToY(top + span * ((index + 0.5) / CHAPTERS.length));
  }

  return (
    <div ref={root} className="night">
      <Preloader reducedMotion={reducedMotion} onDone={() => setLoaded(true)} />
      <header className="night-header">
        <Link href="/" className="brand night-brand" aria-label="Candid home">
          Candid<span>.</span>
        </Link>
        <nav aria-label="Main" className="night-nav">
          <a href="#where">Where it works</a>
          <a href="#watch">Watch a sale</a>
          <a href="#paypal">Built on PayPal</a>
          <Magnetic>
            <Link href="/app" className="btn yolk small">
              Enter Candid <Icon name="arrow" size={16} />
            </Link>
          </Magnetic>
        </nav>
      </header>

      <main id="main">
        <section ref={story} className="story" style={{ height: `${CHAPTERS.length * 110 + 40}vh` }} aria-label="How Candid works, in six steps">
          <div className="story-sticky">
            <StoryScene reducedMotion={reducedMotion} />
            <div className="story-vignette" aria-hidden="true" />

            {CHAPTERS.map((chapter, i) => (
              <article key={chapter.id} className={`chapter chapter-${chapter.id}${active === i ? " is-active" : ""}`} aria-hidden={active !== i}>
                <p className="chapter-kicker hero-fade">{chapter.kicker}</p>
                {i === 0 ? (
                  <h1 className="hero-title">{chapter.title}</h1>
                ) : (
                  <h2 className="chapter-title">{chapter.title}</h2>
                )}
                <p className="chapter-body hero-fade">{chapter.body}</p>
                {i === 0 ? (
                  <div className="row hero-fade">
                    <Magnetic>
                      <Link href="/app" className="btn yolk">
                        Enter Candid <Icon name="arrow" size={18} />
                      </Link>
                    </Magnetic>
                    <button type="button" className="btn ghost" onClick={() => goToChapter(1)}>
                      See how it works
                    </button>
                  </div>
                ) : null}
                {chapter.id === "snap" ? (
                  <ul className="scan-chips" aria-label="What Gemini found in the photo">
                    <li>
                      <Icon name="scan" size={16} /> Eggs · <span className="num">$6.00</span>
                    </li>
                    <li>
                      <Icon name="scan" size={16} /> Honey × 2 · <span className="num">$18.00</span>
                    </li>
                  </ul>
                ) : null}
                {chapter.id === "pay" ? (
                  <div className="story-receipt">
                    <p>
                      <span>1 × Free-range eggs</span> <span className="num">$6.00</span>
                    </p>
                    <p>
                      <span>2 × Wildflower honey</span> <span className="num">$18.00</span>
                    </p>
                    <p className="tot">
                      <span>Total</span> <span className="num">$24.00</span>
                    </p>
                    <span className="paid-stamp">Paid</span>
                  </div>
                ) : null}
                {chapter.id === "payout" ? (
                  <ul className="grower-chips" aria-label="Payout per grower">
                    <li>
                      <span>Rosa · eggs</span> <span className="num">$12.00</span>
                    </li>
                    <li>
                      <span>Tom · honey</span> <span className="num">$18.00</span>
                    </li>
                    <li>
                      <span>Ana · flowers</span> <span className="num">$9.00</span>
                    </li>
                  </ul>
                ) : null}
                {chapter.id === "count" ? (
                  <dl className="count-stats">
                    <div>
                      <dt>Left the shelf</dt>
                      <dd className="num">19</dd>
                    </div>
                    <div>
                      <dt>Paid</dt>
                      <dd className="num">17</dd>
                    </div>
                    <div className="unpaid">
                      <dt>To ask about</dt>
                      <dd className="num">2 honey · $18</dd>
                    </div>
                  </dl>
                ) : null}
              </article>
            ))}

            <nav className="story-rail" aria-label="Story chapters">
              <ol>
                {CHAPTERS.map((chapter, i) => (
                  <li key={chapter.id}>
                    <button type="button" className={active === i ? "on" : ""} onClick={() => goToChapter(i)} aria-current={active === i ? "step" : undefined}>
                      <span className="rail-num num">0{i + 1}</span>
                      <span className="rail-label">{chapter.kicker.replace(/^Step \d · /, "")}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </nav>

            <p className={`scroll-cue${active === 0 ? "" : " hide"}`} aria-hidden="true">
              <span /> Scroll
            </p>
          </div>
        </section>

        <section id="where" ref={slider} className="slider" style={{ height: "300vh" }} aria-labelledby="where-heading">
          <div className="slider-sticky">
            <div className="slider-head">
              <p className="eyebrow night-eyebrow">Where it works</p>
              <h2 id="where-heading">Anywhere the till is empty.</h2>
            </div>
            <div ref={track} className="slider-track">
              {USE_CASES.map((useCase, i) => (
                <article key={useCase.title} className="use-card">
                  <span className="use-num num">0{i + 1}</span>
                  <span className="use-icon" aria-hidden="true">
                    <Icon name={useCase.icon} size={30} />
                  </span>
                  <h3>{useCase.title}</h3>
                  <p>{useCase.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="watch" className="night-band reveal" aria-labelledby="watch-heading">
          <div className="wrap split-night">
            <div className="stack">
              <p className="eyebrow night-eyebrow">Watch a sale</p>
              <h2 id="watch-heading">Twelve seconds, start to finish.</h2>
              <p className="night-muted">From the photo to the payment to the owner&rsquo;s closing count. Rendered live in your browser with Remotion.</p>
            </div>
            <ExplainerPlayer />
          </div>
        </section>

        <section id="paypal" className="night-band" aria-labelledby="paypal-heading">
          <div className="wrap stack">
            <p className="eyebrow night-eyebrow reveal">Under the hood</p>
            <h2 id="paypal-heading" className="reveal">
              Built on PayPal, end to end.
            </h2>
            <ul className="api-grid">
              {PAYPAL.map(([name, body]) => (
                <li key={name} className="api-card">
                  <h3>{name}</h3>
                  <p>{body}</p>
                </li>
              ))}
            </ul>
            <p className="night-muted reveal">Plus Gemini on Google Cloud Vertex AI to read basket, shelf and price-sign photos. The AI only proposes; a person always confirms.</p>
          </div>
        </section>

        <section className="night-band cta reveal" aria-labelledby="cta-heading">
          <div className="wrap stack cta-inner">
            <h2 id="cta-heading">Leave the stand. Still get paid.</h2>
            <Magnetic strength={0.5}>
              <Link href="/app" className="btn yolk big">
                Enter Candid <Icon name="arrow" size={22} />
              </Link>
            </Magnetic>
            <p className="night-muted">Sandbox demo. No real money moves.</p>
          </div>
        </section>
      </main>

      <footer className="night-footer wrap">
        <p>Candid · PayPal AI Hackathon 2026 · Sandbox only. The demo stand and its growers are fictional.</p>
      </footer>
    </div>
  );
}
