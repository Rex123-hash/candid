/**
 * The landing page story. Each chapter owns an equal slice of the scroll, a
 * camera framing, and the copy that explains one part of Candid.
 */

export type Chapter = {
  id: string;
  kicker: string;
  title: string;
  body: string;
  /** Camera position and look-at target while this chapter is centred. */
  camera: [number, number, number];
  target: [number, number, number];
};

export const CHAPTERS: Chapter[] = [
  {
    id: "trust",
    kicker: "Roadside stands, honesty boxes",
    title: "Nobody's at the till.",
    body: "Farm stands, campus pantries and snack shelves all run on trust: take what you need and leave the money.",
    camera: [4.4, 2.9, 6.4],
    target: [0.2, 0.2, 0],
  },
  {
    id: "cashbox",
    kicker: "The problem",
    title: "The cash box is the weak spot.",
    body: "Cash boxes get stolen, most people carry no cash, and the owner never learns what went missing.",
    camera: [1.6, 1.4, 2.6],
    target: [0.9, 0.05, 0.15],
  },
  {
    id: "snap",
    kicker: "Step 1 · Snap",
    title: "One photo becomes the bill.",
    body: "Scan the stand's code and photograph your basket. Gemini reads it against this stand's own price list.",
    camera: [-1.9, 2.1, 3.9],
    target: [-0.3, 0.25, 0.1],
  },
  {
    id: "pay",
    kicker: "Step 2 · Pay",
    title: "PayPal or Venmo. Ten seconds.",
    body: "Check the list, tap to fix anything, then pay. Prices come from the stand, never from the phone.",
    camera: [0.2, 1.5, 3.4],
    target: [0, 0.4, 0],
  },
  {
    id: "count",
    kicker: "Step 3 · Close",
    title: "Know what went missing.",
    body: "At closing, one shelf photo is compared with every payment, so the owner sees the gap per item.",
    camera: [0.1, 5.2, 1.4],
    target: [0.1, -0.2, 0],
  },
  {
    id: "payout",
    kicker: "Step 4 · Share",
    title: "Every grower gets paid.",
    body: "Three neighbours, one stand. PayPal Payouts sends each grower the money for their own items.",
    camera: [3.6, 2.2, 4.2],
    target: [0, 0.9, 0],
  },
];

/** Scroll progress through the story, written by the scroll driver and read every frame. */
export const storyState = { progress: 0 };

/** Fired once, when the 3D stage has rendered its first frame. */
export const SCENE_READY_EVENT = "candid:scene-ready";
let sceneReady = false;

export function markSceneReady(): void {
  if (sceneReady) return;
  sceneReady = true;
  window.dispatchEvent(new Event(SCENE_READY_EVENT));
}

export function isSceneReady(): boolean {
  return sceneReady;
}

export function chapterAt(progress: number): number {
  return Math.min(CHAPTERS.length - 1, Math.max(0, Math.floor(progress * CHAPTERS.length)));
}

/** Position inside the current chapter, 0–1. */
export function chapterProgress(progress: number): number {
  const scaled = progress * CHAPTERS.length;
  return Math.min(1, Math.max(0, scaled - Math.floor(Math.min(scaled, CHAPTERS.length - 0.0001))));
}
