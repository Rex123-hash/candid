"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";

export type ScreenMode = "scan" | "pay";

const W = 400;
const H = 840;

/**
 * The phone's screen, drawn live onto a canvas texture. In "scan" mode it shows
 * the camera finding the stand's QR code with focus brackets and a sweeping scan
 * line; in "pay" mode it shows the Candid checkout with the total and a Paid tick.
 */
export function PhoneScreen({ mode, reducedMotion }: { mode: () => ScreenMode; reducedMotion: boolean }) {
  const { canvas, texture } = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 4;
    return { canvas: c, texture: t };
  }, []);

  useEffect(() => () => texture.dispose(), [texture]);

  useFrame((state) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const time = reducedMotion ? 1.2 : state.clock.elapsedTime;
    if (mode() === "scan") drawScan(ctx, time);
    else drawPay(ctx, time);
    texture.needsUpdate = true;
  });

  return <meshBasicMaterial map={texture} toneMapped={false} />;
}

// The same pseudo-random QR pattern as the stand's sign, so the phone "sees" it.
const QR = (() => {
  const cells: [number, number][] = [];
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let x = 0; x < 11; x++) {
    for (let y = 0; y < 11; y++) {
      const finder = (x < 3 && y < 3) || (x > 7 && y < 3) || (x < 3 && y > 7);
      if (finder ? !(x % 10 === 1 && y % 10 === 1) : rand() > 0.55) cells.push([x, y]);
    }
  }
  return cells;
})();

function drawScan(ctx: CanvasRenderingContext2D, t: number) {
  // camera feed: warm, slightly blurred stand behind the sign
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#3b2a1c");
  g.addColorStop(0.55, "#6b4a2c");
  g.addColorStop(1, "#2a1d13");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // the sign board with the QR code, gently drifting like a hand-held camera
  const dx = Math.sin(t * 1.3) * 6;
  const dy = Math.cos(t * 1.1) * 5;
  const board = 250;
  const bx = (W - board) / 2 + dx;
  const by = 250 + dy;
  ctx.fillStyle = "#f3ead8";
  roundRect(ctx, bx, by, board, board, 18);
  ctx.fill();
  const cell = 18;
  const qx = bx + (board - cell * 11) / 2;
  const qy = by + (board - cell * 11) / 2;
  ctx.fillStyle = "#16130f";
  for (const [x, y] of QR) ctx.fillRect(qx + x * cell, qy + y * cell, cell - 2, cell - 2);

  // focus brackets lock onto the code
  const lock = 0.5 + 0.5 * Math.sin(t * 2.2);
  const pad = 18 + lock * 10;
  brackets(ctx, bx - pad, by - pad, board + pad * 2, board + pad * 2, "#f5a524", 7);

  // sweeping scan line
  const sy = by + ((t * 160) % board);
  const sg = ctx.createLinearGradient(0, sy - 30, 0, sy + 4);
  sg.addColorStop(0, "rgba(245,165,36,0)");
  sg.addColorStop(1, "rgba(245,165,36,0.85)");
  ctx.fillStyle = sg;
  ctx.fillRect(bx - 6, sy - 30, board + 12, 34);

  // status bar and caption
  topBar(ctx);
  pill(ctx, W / 2, 640, "Scanning stand code…", "#120d09", "#f6efe4");
  ctx.fillStyle = "rgba(246,239,228,0.75)";
  ctx.font = "600 22px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Maple Lane Farm Stand", W / 2, 205);

  // shutter button
  ctx.beginPath();
  ctx.arc(W / 2, 760, 38, 0, Math.PI * 2);
  ctx.fillStyle = "#f6efe4";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(W / 2, 760, 30, 0, Math.PI * 2);
  ctx.strokeStyle = "#120d09";
  ctx.lineWidth = 4;
  ctx.stroke();
}

function drawPay(ctx: CanvasRenderingContext2D, t: number) {
  ctx.fillStyle = "#f7f5f0";
  ctx.fillRect(0, 0, W, H);
  topBar(ctx, "#16130f");

  ctx.textAlign = "left";
  ctx.fillStyle = "#5f574e";
  ctx.font = "600 20px sans-serif";
  ctx.fillText("MAPLE LANE FARM STAND", 34, 130);
  ctx.fillStyle = "#16130f";
  ctx.font = "800 40px sans-serif";
  ctx.fillText("Your basket", 34, 182);

  const lines: [string, string][] = [
    ["1 × Free-range eggs", "$6.00"],
    ["2 × Wildflower honey", "$18.00"],
  ];
  ctx.font = "500 24px sans-serif";
  lines.forEach(([name, price], i) => {
    const y = 260 + i * 70;
    ctx.fillStyle = "#16130f";
    ctx.textAlign = "left";
    ctx.fillText(name, 34, y);
    ctx.textAlign = "right";
    ctx.fillText(price, W - 34, y);
    ctx.strokeStyle = "#e4ddd2";
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(34, y + 26);
    ctx.lineTo(W - 34, y + 26);
    ctx.stroke();
    ctx.setLineDash([]);
  });
  ctx.font = "800 30px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Total", 34, 430);
  ctx.textAlign = "right";
  ctx.fillText("$24.00", W - 34, 430);

  // pay button that "presses" and turns into a confirmation
  const phase = (t % 4) / 4;
  const paid = phase > 0.45;
  const press = phase > 0.35 && phase < 0.45 ? 0.96 : 1;
  const bw = (W - 68) * press;
  const bx = (W - bw) / 2;
  ctx.fillStyle = paid ? "#1f6f46" : "#f5a524";
  roundRect(ctx, bx, 500, bw, 84, 42);
  ctx.fill();
  ctx.fillStyle = paid ? "#ffffff" : "#16130f";
  ctx.font = "800 28px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(paid ? "Paid" : "Pay $24.00", paid ? W / 2 - 18 : W / 2, 553);
  if (paid) {
    // drawn tick, no glyphs
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(W / 2 + 26, 543);
    ctx.lineTo(W / 2 + 36, 553);
    ctx.lineTo(W / 2 + 56, 531);
    ctx.stroke();
  }

  ctx.fillStyle = "#5f574e";
  ctx.font = "500 20px sans-serif";
  ctx.fillText(paid ? "Receipt sent · PayPal sandbox" : "PayPal or Venmo", W / 2, 630);
}

function topBar(ctx: CanvasRenderingContext2D, color = "#f6efe4") {
  ctx.fillStyle = color;
  ctx.font = "600 20px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("9:41", 34, 48);
  ctx.beginPath();
  roundRect(ctx, W / 2 - 60, 24, 120, 34, 17);
  ctx.fillStyle = "#000";
  ctx.fill();
}

function pill(ctx: CanvasRenderingContext2D, cx: number, cy: number, text: string, bg: string, fg: string) {
  ctx.font = "700 22px sans-serif";
  const w = ctx.measureText(text).width + 48;
  ctx.fillStyle = bg;
  roundRect(ctx, cx - w / 2, cy - 26, w, 52, 26);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.textAlign = "center";
  ctx.fillText(text, cx, cy + 8);
}

function brackets(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, width: number) {
  const l = 46;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, y + l);
  ctx.lineTo(x, y);
  ctx.lineTo(x + l, y);
  ctx.moveTo(x + w - l, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + l);
  ctx.moveTo(x + w, y + h - l);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + w - l, y + h);
  ctx.moveTo(x + l, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + h - l);
  ctx.stroke();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
