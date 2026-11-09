"use client";

import { useEffect, useRef } from "react";

/**
 * A soft ring cursor that trails the pointer, grows over interactive elements and
 * shows a short label from `data-cursor` (e.g. "Scan" over the 3D stand). Only on
 * fine pointers with motion allowed; touch, keyboard and reduced-motion users keep
 * the normal cursor. The native cursor stays visible, so nothing is lost if it lags.
 */
export function Cursor() {
  const ring = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)").matches;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const el = ring.current;
    if (!fine || calm || !el) return;

    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let cx = x;
    let cy = y;
    let frame = 0;

    const move = (event: PointerEvent) => {
      x = event.clientX;
      y = event.clientY;
      el.dataset.visible = "true";
      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>("a, button, label, [data-cursor], input, select");
      el.dataset.mode = target ? (target.dataset.cursor ? "label" : "hover") : "idle";
      if (label.current) label.current.textContent = target?.dataset.cursor ?? "";
    };
    const leave = () => (el.dataset.visible = "false");
    const down = () => (el.dataset.pressed = "true");
    const up = () => (el.dataset.pressed = "false");

    const tick = () => {
      cx += (x - cx) * 0.2;
      cy += (y - cy) * 0.2;
      el.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
      frame = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", leave);
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", leave);
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
    };
  }, []);

  return (
    <div ref={ring} className="cursor-ring" aria-hidden="true" data-visible="false" data-mode="idle">
      <span ref={label} className="cursor-label" />
    </div>
  );
}
