"use client";

import { useState } from "react";
import { api, ApiError, photoToJpeg } from "@/lib/client";
import { PhotoButton } from "./PhotoButton";

type Item = { id: string; name: string; unit: string };
type Props = {
  standId: string;
  items: Item[];
  kind: "open" | "close";
  onSaved: (summary: unknown) => void;
  onStatus: (message: string, tone: "info" | "error" | "success") => void;
};

/** Photo → AI shelf count → owner corrects the numbers → saved. */
export function ShelfCheck({ standId, items, kind, onSaved, onStatus }: Props) {
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const label = kind === "open" ? "Opening count" : "Closing count";

  async function readShelf(file: File) {
    setBusy(true);
    onStatus(`Counting the shelf for your ${label.toLowerCase()}…`, "info");
    try {
      const image = await photoToJpeg(file, 1600);
      const result = await api<{ counts: { itemId: string; qty: number }[]; note: string }>(`/api/stands/${standId}/shelf-photo`, { body: image });
      const next = Object.fromEntries(items.map((i) => [i.id, 0]));
      for (const c of result.counts) next[c.itemId] = c.qty;
      setCounts(next);
      setNote(result.note);
      onStatus("Shelf counted. Check the numbers, then save.", "success");
    } catch (error) {
      setCounts(counts ?? Object.fromEntries(items.map((i) => [i.id, 0])));
      onStatus(`${error instanceof ApiError || error instanceof Error ? error.message : "Counting failed."} Enter the counts by hand.`, "error");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!counts) return;
    setBusy(true);
    try {
      onSaved(await api(`/api/stands/${standId}/shelf`, { body: { kind, counts } }));
      onStatus(`${label} saved.`, "success");
      setCounts(null);
      setNote("");
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Couldn't save the count.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <div className="row">
        <PhotoButton label={`Photo for ${label.toLowerCase()}`} busyLabel="Counting…" busy={busy} onPhoto={readShelf} variant={kind === "open" ? "secondary" : "primary"} />
        {!counts ? (
          <button type="button" className="btn secondary small" onClick={() => setCounts(Object.fromEntries(items.map((i) => [i.id, 0])))}>
            Enter by hand
          </button>
        ) : null}
      </div>
      {counts ? (
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <fieldset className="count-grid">
            <legend className="eyebrow">{label}</legend>
            {items.map((item) => (
              <div className="field" key={item.id}>
                <label htmlFor={`${kind}-${item.id}`}>
                  {item.name} <span className="muted">({item.unit})</span>
                </label>
                <input
                  id={`${kind}-${item.id}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={10000}
                  value={counts[item.id] ?? 0}
                  onChange={(event) => setCounts({ ...counts, [item.id]: Math.max(0, Math.floor(Number(event.target.value) || 0)) })}
                />
              </div>
            ))}
          </fieldset>
          {note ? <p className="hint">AI note: {note}</p> : null}
          <div className="row">
            <button type="submit" className="btn" disabled={busy}>
              Save {label.toLowerCase()}
            </button>
            <button type="button" className="btn secondary" onClick={() => setCounts(null)} disabled={busy}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
