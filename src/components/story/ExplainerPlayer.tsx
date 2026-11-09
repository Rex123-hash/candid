"use client";

import { Player } from "@remotion/player";
import { useEffect, useState } from "react";
import { EXPLAINER, SaleExplainer } from "@/remotion/SaleExplainer";

/**
 * The Remotion explainer, played live in the page. It loops silently and
 * pauses for reduced-motion users, who get a play button instead.
 */
export function ExplainerPlayer() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches), []);

  return (
    <figure className="explainer">
      <Player
        component={SaleExplainer}
        durationInFrames={EXPLAINER.durationInFrames}
        fps={EXPLAINER.fps}
        compositionWidth={EXPLAINER.width}
        compositionHeight={EXPLAINER.height}
        style={{ width: "100%", aspectRatio: "16 / 9", borderRadius: 24, overflow: "hidden" }}
        autoPlay={!reduced}
        loop
        controls={reduced}
        clickToPlay={false}
        acknowledgeRemotionLicense
      />
      <figcaption className="night-muted">
        A sale in four steps: snap the basket, pay $24.00, the closing count finds 2 unpaid jars of honey, and three growers are paid their share.
      </figcaption>
    </figure>
  );
}
