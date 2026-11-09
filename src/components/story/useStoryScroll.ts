"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { useEffect, useState } from "react";

gsap.registerPlugin(ScrollTrigger);

export function usePrefersReducedMotion(): boolean {
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

let lenis: Lenis | null = null;

/** Smooth scrolling (Lenis) kept in sync with GSAP ScrollTrigger. Off for reduced motion. */
export function useSmoothScroll(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis?.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(tick);
      lenis?.destroy();
      lenis = null;
    };
  }, [enabled]);
}

/** Scrolls to an element or y position, smoothly when Lenis is running. */
export function scrollToY(y: number): void {
  if (lenis) lenis.scrollTo(y, { duration: 1.2 });
  else window.scrollTo({ top: y, behavior: "auto" });
}

export { gsap, ScrollTrigger };
