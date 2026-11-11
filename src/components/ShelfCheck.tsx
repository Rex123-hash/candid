"use client";

import { useState } from "react";
import { api, ApiError, photoToJpeg } from "@/lib/client";
import { Icon } from "./Icon";
import { PhotoButton } from "./PhotoButton";

type Item = { id: string; name: string; unit: string };
type Props = {
  standId: string;
  items: Item[];
  kind: "open" | "close";
  onSaved: (summary: unknown) => void;
  onStatus: (message: string, tone: "info" | "error" | "success") => void;
};

/** Why a count needs the owner's eyes before it is saved. */
type Flag = "unsure" | "unseen";

/** Photo, then AI shelf count, then the owner checks flagged numbers, then saved. */
export function ShelfCheck({ standId, items, kind, onSaved, onStatus }: Props) {
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [flags, setFlags] = useState<Record<string, Flag>>({});
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const label = kind === "open" ? "Opening count" : "Closing count";
  const zeroes = () => Object.fromEntries(items.map((i) => [i.id, 0]));

  function reset() {
    setCounts(null);
    setFlags({});
    setConfirmed(new Set());
    setNote("");
  }

  async function readShelf(file: File) {
    setBusy(true);
    onStatus(`Counting the shelf for your ${label.toLowerCase()}… This usually takes 5 to 15 seconds.`, "info");
    try {
      const image = await photoToJpeg(file, 1600);
      const result = await api<{ counts: { itemId: string; qty: number; confident: boolean }[]; note: string }>(
        `/api/stands/${standId}/shelf-photo`,
        { body: image },
      );
      const next = zeroes();
      const nextFlags: Record<string, Flag> = {};
      const seen = new Set<string>();
      for (const c of result.counts) {
        next[c.itemId] = c.qty;
        seen.add(c.itemId);
        if (!c.confident) nextFlags[c.itemId] = "unsure";
      }
      // An item the model didn't report could be hidden behind another one, not sold out.
      for (const item of items) if (!seen.has(item.id)) nextFlags[item.id] = "unseen";
      setCounts(next);
      setFlags(nextFlags);
      setConfirmed(new Set());
      setNote(result.note);
      const flagged = items.filter((i) => nextFlags[i.id]).map((i) => i.name);
      onStatus(
        flagged.length
          ? `Shelf counted. Check ${listOf(flagged)} before saving: the photo wasn't clear enough to be sure.`
          : "Shelf counted. Check the numbers, then save.",
        flagged.length ? "info" : "success",
      );
    } catch (error) {
      setCounts(counts ?? zeroes());
      onStatus(`${error instanceof ApiError || error instanceof Error ? error.message : "Counting failed."} Enter the counts by hand.`, "error");
    } finally {
      setBusy(false);
    }
  }

  function confirm(itemId: string, value = true) {
    setConfirmed((prev) => {
      const next = new Set(prev);
      if (value) next.add(itemId);
      else next.delete(itemId);
      return next;
    });
  }

  async function save() {
    if (!counts) return;
    const pending = items.filter((i) => flags[i.id] && !confirmed.has(i.id));
    if (pending.length) {
      onStatus(`Confirm the ${listOf(pending.map((i) => i.name.toLowerCase()))} count${pending.length === 1 ? "" : "s"} before saving.`, "error");
      document.getElementById(`${kind}-${pending[0].id}`)?.focus();
      return;
    }
    setBusy(true);
    try {
      onSaved(await api(`/api/stands/${standId}/shelf`, { body: { kind, counts } }));
      onStatus(`${label} saved.`, "success");
      reset();
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
          <button type="button" className="btn secondary small" onClick={() => setCounts(zeroes())}>
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
            {items.map((item) => {
              const flag = flags[item.id];
              const hintId = `${kind}-${item.id}-flag`;
              return (
                <div className={`field${flag && !confirmed.has(item.id) ? " field-flagged" : ""}`} key={item.id}>
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
                    aria-describedby={flag ? hintId : undefined}
                    onChange={(event) => {
                      setCounts({ ...counts, [item.id]: Math.max(0, Math.floor(Number(event.target.value) || 0)) });
                      if (flag) confirm(item.id); // typing a number is a confirmation
                    }}
                  />
                  {flag ? (
                    <div className="flag-note" id={hintId}>
                      <Icon name="alert" size={14} />
                      <span>{flag === "unsure" ? "Not sure about this count." : "Not seen in the photo. Is it really 0?"}</span>
                      <label className="confirm-check">
                        <input type="checkbox" checked={confirmed.has(item.id)} onChange={(e) => confirm(item.id, e.target.checked)} />
                        Looks right
                      </label>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </fieldset>
          {note ? <p className="hint">Note from the photo check: {note}</p> : null}
          <div className="row">
            <button type="submit" className="btn" disabled={busy}>
              Save {label.toLowerCase()}
            </button>
            <button type="button" className="btn secondary" onClick={reset} disabled={busy}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function listOf(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
