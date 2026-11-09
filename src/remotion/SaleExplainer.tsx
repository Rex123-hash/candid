import { AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion";

/**
 * "A sale in twelve seconds": the explainer shown on the landing page and reused
 * in the demo video. 1280×720 at 30fps, 360 frames. No external assets.
 */

export const EXPLAINER = { width: 1280, height: 720, fps: 30, durationInFrames: 360 } as const;

const C = {
  night: "#120d09",
  panel: "#1d1611",
  cream: "#f6efe4",
  muted: "#b9ab98",
  amber: "#f5a524",
  ember: "#e8622a",
  red: "#ef6a4f",
};

const font = "'Schibsted Grotesk', 'Atkinson Hyperlegible', system-ui, sans-serif";
const mono = "'JetBrains Mono', ui-monospace, monospace";

export function SaleExplainer() {
  return (
    <AbsoluteFill style={{ background: `radial-gradient(90% 70% at 70% 20%, #2a1d12 0%, ${C.night} 65%)`, fontFamily: font, color: C.cream }}>
      <Sequence durationInFrames={90}>
        <SnapScene />
      </Sequence>
      <Sequence from={90} durationInFrames={90}>
        <ReceiptScene />
      </Sequence>
      <Sequence from={180} durationInFrames={90}>
        <CountScene />
      </Sequence>
      <Sequence from={270} durationInFrames={90}>
        <PayoutScene />
      </Sequence>
    </AbsoluteFill>
  );
}

function useEnter(delay = 0) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping: 18, stiffness: 140 } });
}

function Caption({ step, title }: { step: string; title: string }) {
  const enter = useEnter(0);
  return (
    <div style={{ position: "absolute", left: 80, top: 70, opacity: enter, transform: `translateY(${(1 - enter) * 24}px)` }}>
      <div style={{ fontFamily: mono, fontSize: 20, letterSpacing: 3, color: C.amber, textTransform: "uppercase" }}>{step}</div>
      <div style={{ fontSize: 58, fontWeight: 800, letterSpacing: -1.5, marginTop: 10 }}>{title}</div>
    </div>
  );
}

function SnapScene() {
  const frame = useCurrentFrame();
  const flash = interpolate(frame, [28, 32, 44], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const boxes = [
    { x: 520, y: 300, w: 230, h: 140, label: "Eggs · $6.00", at: 46 },
    { x: 790, y: 270, w: 160, h: 190, label: "Honey × 2 · $18.00", at: 56 },
  ];
  return (
    <AbsoluteFill>
      <Caption step="Step 1 · Snap" title="One photo becomes the bill." />
      {/* phone frame */}
      <div style={{ position: "absolute", left: 470, top: 210, width: 540, height: 420, borderRadius: 36, border: `3px solid ${C.cream}33`, background: C.panel }}>
        <Brackets />
      </div>
      {boxes.map((b) => {
        const t = interpolate(frame, [b.at, b.at + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <div key={b.label} style={{ position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h, border: `3px solid ${C.amber}`, borderRadius: 14, opacity: t, transform: `scale(${0.9 + t * 0.1})` }}>
            <div style={{ position: "absolute", top: -44, left: 0, background: C.amber, color: C.night, fontWeight: 800, fontSize: 22, padding: "6px 12px", borderRadius: 10, whiteSpace: "nowrap" }}>{b.label}</div>
          </div>
        );
      })}
      <AbsoluteFill style={{ background: "#fff", opacity: flash * 0.85 }} />
    </AbsoluteFill>
  );
}

function Brackets() {
  const s = 46;
  const style = (pos: React.CSSProperties): React.CSSProperties => ({ position: "absolute", width: s, height: s, borderColor: C.cream, borderStyle: "solid", borderWidth: 0, ...pos });
  return (
    <>
      <div style={style({ left: 24, top: 24, borderLeftWidth: 4, borderTopWidth: 4, borderTopLeftRadius: 12 })} />
      <div style={style({ right: 24, top: 24, borderRightWidth: 4, borderTopWidth: 4, borderTopRightRadius: 12 })} />
      <div style={style({ left: 24, bottom: 24, borderLeftWidth: 4, borderBottomWidth: 4, borderBottomLeftRadius: 12 })} />
      <div style={style({ right: 24, bottom: 24, borderRightWidth: 4, borderBottomWidth: 4, borderBottomRightRadius: 12 })} />
    </>
  );
}

function ReceiptScene() {
  const frame = useCurrentFrame();
  const lines = [
    ["1 × Free-range eggs", "$6.00"],
    ["2 × Wildflower honey", "$18.00"],
  ];
  const press = interpolate(frame, [48, 54, 60], [1, 0.94, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const stamp = useEnter(62);
  return (
    <AbsoluteFill>
      <Caption step="Step 2 · Pay" title="PayPal or Venmo. Ten seconds." />
      <div style={{ position: "absolute", left: 640, top: 210, width: 480, padding: 36, borderRadius: 28, background: "#fbf7f0", color: "#16130f", boxShadow: "0 30px 80px #0008" }}>
        {lines.map(([name, price], i) => {
          const t = interpolate(frame, [8 + i * 10, 18 + i * 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div key={name} style={{ display: "flex", justifyContent: "space-between", fontSize: 28, padding: "12px 0", borderBottom: "2px dashed #e4ddd2", opacity: t, transform: `translateX(${(1 - t) * -20}px)` }}>
              <span>{name}</span>
              <span style={{ fontFamily: mono }}>{price}</span>
            </div>
          );
        })}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 34, fontWeight: 800, padding: "18px 0 22px" }}>
          <span>Total</span>
          <span style={{ fontFamily: mono }}>$24.00</span>
        </div>
        <div style={{ height: 70, borderRadius: 999, background: C.amber, display: "grid", placeItems: "center", fontSize: 28, fontWeight: 800, transform: `scale(${press})` }}>Pay $24.00</div>
        <div style={{ position: "absolute", right: -30, top: -34, transform: `rotate(-12deg) scale(${stamp})`, opacity: stamp, border: `5px solid ${C.ember}`, color: C.ember, fontSize: 40, fontWeight: 800, padding: "6px 22px", borderRadius: 14, background: "#fbf7f0" }}>PAID</div>
      </div>
    </AbsoluteFill>
  );
}

function CountScene() {
  const frame = useCurrentFrame();
  const bars = [
    { label: "Left the shelf", value: 19, color: C.cream },
    { label: "Paid", value: 17, color: C.amber },
    { label: "Unpaid", value: 2, color: C.red },
  ];
  return (
    <AbsoluteFill>
      <Caption step="Step 3 · Close" title="Know what went missing." />
      <div style={{ position: "absolute", left: 80, right: 80, top: 260, display: "grid", gap: 34 }}>
        {bars.map((bar, i) => {
          const t = interpolate(frame, [10 + i * 8, 40 + i * 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const shown = Math.round(bar.value * t);
          return (
            <div key={bar.label} style={{ display: "grid", gridTemplateColumns: "260px 1fr 120px", alignItems: "center", gap: 24, fontSize: 30 }}>
              <span style={{ color: C.muted }}>{bar.label}</span>
              <div style={{ height: 26, borderRadius: 13, background: "#ffffff12" }}>
                <div style={{ width: `${(bar.value / 19) * 100 * t}%`, height: "100%", borderRadius: 13, background: bar.color }} />
              </div>
              <span style={{ fontFamily: mono, fontSize: 44, textAlign: "right", color: bar.color }}>{shown}</span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

function PayoutScene() {
  const frame = useCurrentFrame();
  const growers = [
    { name: "Rosa", items: "Eggs", amount: "$12.00" },
    { name: "Tom", items: "Honey", amount: "$18.00" },
    { name: "Ana", items: "Flowers", amount: "$9.00" },
  ];
  return (
    <AbsoluteFill>
      <Caption step="Step 4 · Share" title="Every grower gets paid." />
      <div style={{ position: "absolute", left: 80, right: 80, top: 300, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 30 }}>
        {growers.map((g, i) => {
          const t = interpolate(frame, [8 + i * 10, 26 + i * 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div key={g.name} style={{ padding: 32, borderRadius: 28, background: C.panel, border: `2px solid ${C.amber}55`, opacity: t, transform: `translateY(${(1 - t) * 40}px)` }}>
              <div style={{ fontSize: 24, color: C.muted }}>{g.items}</div>
              <div style={{ fontSize: 44, fontWeight: 800, marginTop: 6 }}>{g.name}</div>
              <div style={{ fontFamily: mono, fontSize: 40, color: C.amber, marginTop: 16 }}>{g.amount}</div>
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: 80, bottom: 70, fontSize: 26, color: C.muted, opacity: interpolate(frame, [40, 55], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
        One PayPal Payouts batch. Sandbox demo, fictional growers.
      </div>
    </AbsoluteFill>
  );
}
