"use client";

import { useEffect, useRef } from "react";

/**
 * A camera-viewfinder cursor, fitting a product built on "snap a photo". Four
 * corner brackets trail the pointer; over a link or button they lock onto its
 * edges like autofocus, and a click fires a shutter flash. `data-cursor` on any
 * element shows a short label. Fine pointers only, off for reduced motion, and
 * the native cursor stays visible so nothing is lost if it lags.
 */
export function Cursor() {
  const frame = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)").matches;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const box = frame.current;
    const point = dot.current;
    if (!fine || calm || !box || !point) return;

    const IDLE = 30;
    let px = -100;
    let py = -100;
    // current and target rectangles of the bracket frame
    const cur = { x: px, y: py, w: IDLE, h: IDLE };
    const tgt = { ...cur };
    let locked: HTMLElement | null = null;
    let raf = 0;

    const selector = "a, button, label, input, select, textarea, [data-cursor], [role='button']";

    const move = (event: PointerEvent) => {
      px = event.clientX;
      py = event.clientY;
      box.dataset.visible = "true";
      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>(selector) ?? null;
      locked = target && target.dataset.cursor === undefined ? target : null;
      box.dataset.mode = locked ? "lock" : target?.dataset.cursor ? "label" : "idle";
      if (label.current) label.current.textContent = target?.dataset.cursor ?? "";
    };
    const leave = () => (box.dataset.visible = "false");
    const down = () => {
      box.dataset.shutter = "true";
      window.setTimeout(() => (box.dataset.shutter = "false"), 180);
    };

    const tick = () => {
      if (locked && locked.isConnected) {
        const r = locked.getBoundingClientRect();
        const pad = 8;
        tgt.x = r.left - pad + (px - (r.left + r.width / 2)) * 0.08;
        tgt.y = r.top - pad + (py - (r.top + r.height / 2)) * 0.08;
        tgt.w = r.width + pad * 2;
        tgt.h = r.height + pad * 2;
      } else {
        const size = box.dataset.mode === "label" ? 96 : IDLE;
        tgt.x = px - size / 2;
        tgt.y = py - size / 2;
        tgt.w = size;
        tgt.h = size;
      }
      const k = 0.22;
      cur.x += (tgt.x - cur.x) * k;
      cur.y += (tgt.y - cur.y) * k;
      cur.w += (tgt.w - cur.w) * k;
      cur.h += (tgt.h - cur.h) * k;
      box.style.transform = `translate3d(${cur.x}px, ${cur.y}px, 0)`;
      box.style.width = `${cur.w}px`;
      box.style.height = `${cur.h}px`;
      point.style.transform = `translate3d(${px}px, ${py}px, 0)`;
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerdown", down);
    document.documentElement.addEventListener("pointerleave", leave);
    raf = requestAnimationFrame(tick);
    document.documentElement.classList.add("has-viewfinder");
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", down);
      document.documentElement.removeEventListener("pointerleave", leave);
      document.documentElement.classList.remove("has-viewfinder");
    };
  }, []);

  return (
    <>
      <div ref={frame} className="vf" aria-hidden="true" data-visible="false" data-mode="idle">
        <i className="vf-c tl" />
        <i className="vf-c tr" />
        <i className="vf-c bl" />
        <i className="vf-c br" />
        <span ref={label} className="vf-label" />
      </div>
      <div ref={dot} className="vf-dot" aria-hidden="true" />
    </>
  );
}
