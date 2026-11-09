"use client";

import { useEffect, useRef, useState } from "react";
import { isSceneReady, SCENE_READY_EVENT } from "./chapters";

type Props = {
  reducedMotion: boolean;
  /** Called once, as the shutter starts to open. */
  onDone: () => void;
};

const MIN_SHOW_MS = 900; // long enough to read, short enough not to annoy
const MAX_WAIT_MS = 7000; // never hold the page hostage on a slow device

/**
 * A camera-viewfinder preloader. Brackets close in on the wordmark while a thin
 * line fills; when the fonts and the 3D stage's first frame are ready, the
 * screen opens like a shutter. Progress eases toward 90% while waiting and only
 * completes when the page is really ready.
 */
export function Preloader({ reducedMotion, onDone }: Props) {
  const [phase, setPhase] = useState<"loading" | "opening" | "gone">("loading");
  const [shown, setShown] = useState(0);
  const fill = useRef<HTMLSpanElement>(null);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    const start = performance.now();
    let ready = false;
    let value = 0;
    let raf = 0;

    const fontsReady = document.fonts?.ready ?? Promise.resolve();
    const sceneReady = new Promise<void>((resolve) => {
      if (isSceneReady()) resolve();
      else window.addEventListener(SCENE_READY_EVENT, () => resolve(), { once: true });
    });
    const timeout = new Promise<void>((resolve) => window.setTimeout(resolve, MAX_WAIT_MS));
    void Promise.race([Promise.all([fontsReady, sceneReady]), timeout]).then(() => (ready = true));

    // Keep the page still while the loader is up.
    const html = document.documentElement;
    html.classList.add("is-preloading");

    // Hard stop: even if animation frames are throttled (background tab, slow device),
    // the loader always finishes shortly after the readiness deadline.
    const force = window.setTimeout(() => {
      ready = true;
      value = 1;
      tick(performance.now());
    }, MAX_WAIT_MS + 1500);

    let finished = false;
    const tick = (now: number) => {
      if (finished) return;
      const elapsed = now - start;
      const target = ready && elapsed >= MIN_SHOW_MS ? 1 : Math.min(0.9, elapsed / 2200);
      value += (target - value) * (ready ? 0.18 : 0.08);
      if (ready && value > 0.995) value = 1;
      if (fill.current) fill.current.style.transform = `scaleX(${value})`;
      setShown(Math.round(value * 100));
      if (value === 1) {
        finished = true;
        window.clearTimeout(force);
        // The page's intro animation starts as the shutter begins to open.
        setPhase("opening");
        html.classList.remove("is-preloading");
        done.current();
        window.setTimeout(() => setPhase("gone"), reducedMotion ? 250 : 900);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(force);
      html.classList.remove("is-preloading");
    };
  }, [reducedMotion]);

  if (phase === "gone") return null;

  return (
    <div className={`preloader ${phase}${reducedMotion ? " calm" : ""}`} role="progressbar" aria-label="Loading Candid" aria-valuemin={0} aria-valuemax={100} aria-valuenow={shown}>
      <div className="pl-frame" aria-hidden="true">
        <i className="pl-c tl" />
        <i className="pl-c tr" />
        <i className="pl-c bl" />
        <i className="pl-c br" />
        <span className="pl-word">
          Candid<span>.</span>
        </span>
      </div>
      <div className="pl-track" aria-hidden="true">
        <span ref={fill} className="pl-fill" />
      </div>
      <div className="pl-meta" aria-hidden="true">
        <span className="num">{String(shown).padStart(3, "0")}</span>
        <span>{shown < 100 ? "Focusing" : "Ready"}</span>
      </div>
      <div className="pl-shutter top" aria-hidden="true" />
      <div className="pl-shutter bottom" aria-hidden="true" />
    </div>
  );
}
