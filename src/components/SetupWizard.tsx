"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError, photoToJpeg } from "@/lib/client";
import { Icon } from "./Icon";
import { PhotoButton } from "./PhotoButton";

type Draft = { key: string; name: string; price: string; unit: string; lookFor: string; growerId: string };
type GrowerDraft = { id: string; name: string; email: string };
type Status = { message: string; tone: "info" | "error" | "success" } | null;

let nextKey = 0;
let nextGrower = 1;
const blank = (): Draft => ({ key: `row-${nextKey++}`, name: "", price: "", unit: "each", lookFor: "", growerId: "" });
const blankGrower = (): GrowerDraft => ({ id: `g-${nextGrower++}`, name: "", email: "" });
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function priceToCents(input: string): number | null {
  const cleaned = input.trim().replace(/^\$/, "");
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, fraction = ""] = cleaned.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

/** Owner setup: price sign photo → editable catalog → stand created with PayPal products. */
export function SetupWizard() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [rows, setRows] = useState<Draft[]>([blank()]);
  const [growers, setGrowers] = useState<GrowerDraft[]>([]);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function readSign(file: File) {
    setReading(true);
    setStatus({ message: "Reading your price sign… This usually takes 5 to 15 seconds.", tone: "info" });
    try {
      const image = await photoToJpeg(file, 1600);
      const { items } = await api<{ items: { name: string; priceCents: number; unit: string; lookFor: string }[] }>("/api/ai/sign", { body: image });
      if (items.length === 0) {
        setStatus({ message: "We couldn't find any prices on that sign. Add your items below.", tone: "info" });
        return;
      }
      setRows(
        items.map((item) => ({
          key: `row-${nextKey++}`,
          name: item.name,
          price: (item.priceCents / 100).toFixed(2),
          unit: item.unit || "each",
          lookFor: item.lookFor,
          growerId: "",
        })),
      );
      setStatus({ message: `Found ${items.length} item${items.length === 1 ? "" : "s"}. Check names and prices before saving.`, tone: "success" });
    } catch (error) {
      setStatus({ message: `${error instanceof ApiError || error instanceof Error ? error.message : "Reading failed."}`, tone: "error" });
    } finally {
      setReading(false);
    }
  }

  function update(key: string, patch: Partial<Draft>) {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function updateGrower(id: string, patch: Partial<GrowerDraft>) {
    setGrowers((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  }

  function removeGrower(id: string) {
    setGrowers((prev) => prev.filter((g) => g.id !== id));
    // Their items go back to the owner rather than pointing at nobody.
    setRows((prev) => prev.map((row) => (row.growerId === id ? { ...row, growerId: "" } : row)));
  }

  const namedRows = rows.filter((row) => row.name.trim());
  const growerLabel = (g: GrowerDraft, index: number) => g.name.trim() || `Grower ${index + 1}`;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (name.trim().length < 2) nextErrors.name = "Give your stand a name.";
    const items = rows
      .filter((row) => row.name.trim() || row.price.trim())
      .map((row) => {
        const priceCents = priceToCents(row.price);
        if (!row.name.trim()) nextErrors[`${row.key}-name`] = "Add a name.";
        if (priceCents === null || priceCents === 0) nextErrors[`${row.key}-price`] = "Use a price like 6 or 4.50.";
        return {
          name: row.name.trim(),
          priceCents: priceCents ?? 0,
          unit: row.unit.trim() || "each",
          lookFor: row.lookFor.trim(),
          growerId: row.growerId || null,
        };
      });
    if (items.length === 0) nextErrors.items = "Add at least one item.";
    const seenEmails = new Set<string>();
    for (const grower of growers) {
      if (!grower.name.trim()) nextErrors[`${grower.id}-name`] = "Add the grower's name.";
      const email = grower.email.trim().toLowerCase();
      if (!EMAIL.test(email)) nextErrors[`${grower.id}-email`] = "Use the email of their PayPal account.";
      else if (seenEmails.has(email)) nextErrors[`${grower.id}-email`] = "Another grower already uses this email.";
      seenEmails.add(email);
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setStatus({ message: "A few things need fixing before we can save.", tone: "error" });
      const first = Object.keys(nextErrors)[0];
      document.getElementById(first === "items" ? "add-item" : `f-${first}`)?.focus();
      return;
    }

    setSaving(true);
    try {
      const { id, catalogSynced } = await api<{ id: string; catalogSynced: boolean }>("/api/stands", {
        body: {
          name: name.trim(),
          location: location.trim(),
          items,
          growers: growers.map((g) => ({ id: g.id, name: g.name.trim(), paypalEmail: g.email.trim() })),
        },
      });
      if (!catalogSynced) setStatus({ message: "Stand saved. PayPal catalog sync will retry later.", tone: "info" });
      router.push(`/owner/${id}`);
    } catch (error) {
      setStatus({ message: error instanceof Error ? error.message : "Couldn't save the stand.", tone: "error" });
      setSaving(false);
    }
  }

  const describedBy = (field: string) => (errors[field] ? `e-${field}` : undefined);

  return (
    <form className="stack" style={{ "--gap": "20px" } as React.CSSProperties} onSubmit={submit} noValidate>
      <section className="card stack" aria-labelledby="sign-heading">
        <h2 id="sign-heading">1. Photograph your price sign</h2>
        <p className="muted">Chalkboard, cardboard, printed: we read the items and prices for you. You can also type them in.</p>
        <PhotoButton label="Take a photo of the sign" busyLabel="Reading sign…" busy={reading} onPhoto={readSign} variant="yolk" />
      </section>

      <section className="card stack" aria-labelledby="items-heading">
        <h2 id="items-heading">2. Check your items</h2>
        {rows.map((row, index) => (
          <fieldset key={row.key} className="item-row">
            <legend className="sr-only">Item {index + 1}</legend>
            <div className="field">
              <label htmlFor={`f-${row.key}-name`}>Item</label>
              <input
                id={`f-${row.key}-name`}
                type="text"
                value={row.name}
                maxLength={60}
                onChange={(e) => update(row.key, { name: e.target.value })}
                aria-invalid={Boolean(errors[`${row.key}-name`]) || undefined}
                aria-describedby={describedBy(`${row.key}-name`)}
              />
              {errors[`${row.key}-name`] ? <p id={`e-${row.key}-name`} className="field-error">{errors[`${row.key}-name`]}</p> : null}
            </div>
            <div className="field">
              <label htmlFor={`f-${row.key}-price`}>Price ($)</label>
              <input
                id={`f-${row.key}-price`}
                type="text"
                inputMode="decimal"
                value={row.price}
                onChange={(e) => update(row.key, { price: e.target.value })}
                aria-invalid={Boolean(errors[`${row.key}-price`]) || undefined}
                aria-describedby={describedBy(`${row.key}-price`)}
              />
              {errors[`${row.key}-price`] ? <p id={`e-${row.key}-price`} className="field-error">{errors[`${row.key}-price`]}</p> : null}
            </div>
            <div className="field">
              <label htmlFor={`f-${row.key}-unit`}>Sold per</label>
              <input id={`f-${row.key}-unit`} type="text" value={row.unit} maxLength={20} onChange={(e) => update(row.key, { unit: e.target.value })} />
            </div>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== row.key) : [blank()]))}
              aria-label={`Remove ${row.name || `item ${index + 1}`}`}
            >
              <Icon name="close" size={18} />
            </button>
          </fieldset>
        ))}
        {errors.items ? <p className="field-error">{errors.items}</p> : null}
        <div className="row">
          <button id="add-item" type="button" className="btn secondary small" onClick={() => setRows((prev) => [...prev, blank()])}>
            <Icon name="plus" size={16} /> Add an item
          </button>
        </div>
      </section>

      <section className="card stack" aria-labelledby="growers-heading">
        <h2 id="growers-heading">3. Sharing the stand? (optional)</h2>
        <p className="muted">
          If neighbours sell their produce here too, add them. Candid pays each grower for their own items through PayPal Payouts. Items you
          grow yourself stay in your PayPal balance.
        </p>
        {growers.map((grower, index) => (
          <fieldset key={grower.id} className="item-row grower-row">
            <legend className="sr-only">{growerLabel(grower, index)}</legend>
            <div className="field">
              <label htmlFor={`f-${grower.id}-name`}>Grower</label>
              <input
                id={`f-${grower.id}-name`}
                type="text"
                value={grower.name}
                maxLength={60}
                autoComplete="off"
                onChange={(e) => updateGrower(grower.id, { name: e.target.value })}
                aria-invalid={Boolean(errors[`${grower.id}-name`]) || undefined}
                aria-describedby={describedBy(`${grower.id}-name`)}
              />
              {errors[`${grower.id}-name`] ? <p id={`e-${grower.id}-name`} className="field-error">{errors[`${grower.id}-name`]}</p> : null}
            </div>
            <div className="field">
              <label htmlFor={`f-${grower.id}-email`}>PayPal email (sandbox)</label>
              <input
                id={`f-${grower.id}-email`}
                type="email"
                inputMode="email"
                autoComplete="off"
                value={grower.email}
                maxLength={254}
                onChange={(e) => updateGrower(grower.id, { email: e.target.value })}
                aria-invalid={Boolean(errors[`${grower.id}-email`]) || undefined}
                aria-describedby={describedBy(`${grower.id}-email`)}
              />
              {errors[`${grower.id}-email`] ? <p id={`e-${grower.id}-email`} className="field-error">{errors[`${grower.id}-email`]}</p> : null}
            </div>
            <button type="button" className="icon-btn" onClick={() => removeGrower(grower.id)} aria-label={`Remove ${growerLabel(grower, index)}`}>
              <Icon name="close" size={18} />
            </button>
          </fieldset>
        ))}
        <div className="row">
          <button type="button" className="btn secondary small" onClick={() => setGrowers((prev) => (prev.length < 10 ? [...prev, blankGrower()] : prev))}>
            <Icon name="plus" size={16} /> Add a grower
          </button>
        </div>

        {growers.length && namedRows.length ? (
          <div className="stack" style={{ "--gap": "10px" } as React.CSSProperties}>
            <h3 className="eyebrow">Who grows what</h3>
            <ul className="owner-map" role="list">
              {namedRows.map((row) => (
                <li key={row.key}>
                  <label htmlFor={`f-${row.key}-grower`}>{row.name.trim()}</label>
                  <select id={`f-${row.key}-grower`} value={row.growerId} onChange={(e) => update(row.key, { growerId: e.target.value })}>
                    <option value="">You (the stand owner)</option>
                    {growers.map((g, index) => (
                      <option key={g.id} value={g.id}>
                        {growerLabel(g, index)}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
            <div className="payout-preview" aria-live="polite">
              <p className="eyebrow">Who gets paid for what</p>
              <ul role="list">
                {growers.map((g, index) => {
                  const theirs = namedRows.filter((row) => row.growerId === g.id).map((row) => row.name.trim());
                  return (
                    <li key={g.id}>
                      <Icon name="split" size={16} />
                      <span>
                        <b>{growerLabel(g, index)}</b> {theirs.length ? `is paid for ${theirs.join(", ")}` : "has no items yet"}
                      </span>
                    </li>
                  );
                })}
                <li>
                  <Icon name="receipt" size={16} />
                  <span>
                    <b>You</b>{" "}
                    {namedRows.some((row) => !row.growerId)
                      ? `keep ${namedRows.filter((row) => !row.growerId).map((row) => row.name.trim()).join(", ")}`
                      : "keep nothing: every item belongs to a grower"}
                  </span>
                </li>
              </ul>
            </div>
          </div>
        ) : null}
      </section>

      <section className="card stack" aria-labelledby="stand-heading">
        <h2 id="stand-heading">4. Name your stand</h2>
        <div className="field">
          <label htmlFor="f-name">Stand name</label>
          <input
            id="f-name"
            type="text"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={Boolean(errors.name) || undefined}
            aria-describedby={describedBy("name")}
          />
          {errors.name ? <p id="e-name" className="field-error">{errors.name}</p> : null}
        </div>
        <div className="field">
          <label htmlFor="f-location">Where is it? (optional)</label>
          <input id="f-location" type="text" value={location} maxLength={80} onChange={(e) => setLocation(e.target.value)} />
        </div>
        <div className="row">
          <button type="submit" className="btn" disabled={saving}>
            {saving ? "Creating your stand…" : "Create my stand"}
          </button>
        </div>
        <p className="hint">Each item becomes a product in your PayPal catalog. This device becomes the owner&rsquo;s device.</p>
      </section>

      <div role="status" aria-live="polite" className={status ? `notice ${status.tone === "error" ? "error" : status.tone === "success" ? "success" : ""}` : "sr-only"}>
        {status?.message ?? ""}
      </div>
    </form>
  );
}
