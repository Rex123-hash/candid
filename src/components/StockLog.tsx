"use client";

import { useState } from "react";
import { api } from "@/lib/client";
import type { StockMove, StockReason } from "@/lib/types";
import { Icon } from "./Icon";
import { LocalTime } from "./LocalTime";

type Item = { id: string; name: string; unit: string };
type Props = {
  standId: string;
  items: Item[];
  moves: StockMove[];
  enabled: boolean;
  onSaved: (summary: unknown) => void;
  onStatus: (message: string, tone: "info" | "error" | "success") => void;
};

export const REASON_LABELS: Record<StockReason, { option: string; past: string; sign: "+" | "-" | "$" }> = {
  restock: { option: "Restocked (added to the shelf)", past: "restocked", sign: "+" },
  spoiled: { option: "Spoiled or damaged", past: "spoiled or damaged", sign: "-" },
  gift: { option: "Given away", past: "given away", sign: "-" },
  cash: { option: "Sold for cash", past: "sold for cash", sign: "$" },
};

/**
 * The owner's stock log: what the two shelf counts can't see on their own.
 * Restocks, removals and cash sales explain a gap; anything left unexplained stays visible.
 */
export function StockLog({ standId, items, moves, enabled, onSaved, onStatus }: Props) {
  const [itemId, setItemId] = useState(items[0]?.id ?? "");
  const [qty, setQty] = useState("1");
  const [reason, setReason] = useState<StockReason>("restock");
  const [busy, setBusy] = useState(false);
  const nameOf = (id: string) => items.find((i) => i.id === id)?.name ?? id;

  async function add(event: React.FormEvent) {
    event.preventDefault();
    const amount = Number(qty);
    if (!Number.isInteger(amount) || amount < 1 || amount > 1000) {
      onStatus("Use a whole number between 1 and 1000.", "error");
      document.getElementById("stock-qty")?.focus();
      return;
    }
    setBusy(true);
    try {
      onSaved(await api(`/api/stands/${standId}/stock`, { body: { itemId, qty: amount, reason } }));
      onStatus(`Logged: ${amount} × ${nameOf(itemId)}, ${REASON_LABELS[reason].past}.`, "success");
      setQty("1");
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Couldn't log that.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function undo(move: StockMove) {
    setBusy(true);
    try {
      onSaved(await api(`/api/stands/${standId}/stock?entry=${encodeURIComponent(move.id)}`, { method: "DELETE" }));
      onStatus(`Removed the entry for ${move.qty} ${nameOf(move.itemId).toLowerCase()}.`, "success");
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Couldn't remove that entry.", "error");
    } finally {
      setBusy(false);
    }
  }

  if (!enabled) return <p className="muted">Do the opening count first, then log restocks, removals and cash sales here.</p>;

  return (
    <div className="stack">
      <form className="stock-form" onSubmit={add} id="stock-log">
        <div className="field">
          <label htmlFor="stock-item">Item</label>
          <select id="stock-item" value={itemId} onChange={(e) => setItemId(e.target.value)}>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="stock-qty">How many</label>
          <input id="stock-qty" type="number" inputMode="numeric" min={1} max={1000} value={qty} onChange={(e) => setQty(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="stock-reason">What happened</label>
          <select id="stock-reason" value={reason} onChange={(e) => setReason(e.target.value as StockReason)}>
            {(Object.keys(REASON_LABELS) as StockReason[]).map((key) => (
              <option key={key} value={key}>
                {REASON_LABELS[key].option}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn secondary small" disabled={busy}>
          <Icon name="plus" size={16} /> Log it
        </button>
      </form>

      {moves.length ? (
        <ul className="move-list" role="list" aria-label="Stock changes since opening">
          {moves.map((move) => (
            <li key={move.id}>
              <span className={`move-sign ${move.reason}`} aria-hidden="true">
                {REASON_LABELS[move.reason].sign}
              </span>
              <span>
                <b className="num">{move.qty}</b> &times; {nameOf(move.itemId)}, {REASON_LABELS[move.reason].past}
                {move.reason === "cash" ? <span className="muted"> (your report, not confirmed by PayPal)</span> : null}
              </span>
              <span className="muted num"><LocalTime iso={move.createdAt} short /></span>
              <button type="button" className="link-btn" onClick={() => void undo(move)} disabled={busy}>
                Undo<span className="sr-only">: {move.qty} {nameOf(move.itemId)} {REASON_LABELS[move.reason].past}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="hint">Nothing logged since opening. Restocked the honey, or sold a dozen eggs for cash? Log it so the closing check adds up.</p>
      )}
    </div>
  );
}
