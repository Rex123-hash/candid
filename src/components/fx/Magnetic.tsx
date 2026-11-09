"use client";

import { useRef, type ReactNode } from "react";

/** Pulls its child toward the pointer when hovered. Mouse only; respects reduced motion via CSS. */
export function Magnetic({ children, strength = 0.3 }: { children: ReactNode; strength?: number }) {
  const ref = useRef<HTMLSpanElement>(null);

  function onMove(event: React.PointerEvent<HTMLSpanElement>) {
    const el = ref.current;
    if (!el || event.pointerType !== "mouse") return;
    const rect = el.getBoundingClientRect();
    const x = (event.clientX - rect.left - rect.width / 2) * strength;
    const y = (event.clientY - rect.top - rect.height / 2) * strength;
    el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }

  function onLeave() {
    if (ref.current) ref.current.style.transform = "";
  }

  return (
    <span ref={ref} className="magnetic" onPointerMove={onMove} onPointerLeave={onLeave}>
      {children}
    </span>
  );
}
