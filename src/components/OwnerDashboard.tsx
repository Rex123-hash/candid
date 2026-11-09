"use client";

import Link from "next/link";
import { useState } from "react";
import { api, formatCents } from "@/lib/client";
import type { StandSummary } from "@/lib/summary";
import { Icon } from "./Icon";
import { SalesGrid } from "./SalesGrid";
import { ShelfCheck } from "./ShelfCheck";

type Props = {
  stand: { id: string; slug: string; name: string; isDemo: boolean; items: { id: string; name: string; unit: string }[] };
  growers: { id: string; name: string }[];
  initial: StandSummary;
};

type Status = { message: string; tone: "info" | "error" | "success" } | null;

export function OwnerDashboard({ stand, growers, initial }: Props) {
  const [summary, setSummary] = useState<StandSummary>(initial);
  const [status, setStatus] = useState<Status>(null);
  const [paying, setPaying] = useState(false);
  const r = summary.reconciliation;
  const notify = (message: string, tone: "info" | "error" | "success") => setStatus({ message, tone });

  async function payGrowers() {
    setPaying(true);
    try {
      setSummary(await api<StandSummary>(`/api/stands/${stand.id}/payouts`, { body: {} }));
      notify("Payouts sent through PayPal.", "success");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Payouts failed.", "error");
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="stack" style={{ "--gap": "24px" } as React.CSSProperties}>
      <section aria-label="Today at a glance" className="stat-row">
        <div className="card stat">
          <p className="eyebrow">Taken today</p>
          <p className="stat-value num">{formatCents(summary.capturedCents)}</p>
          <p className="muted">
            {summary.capturedCount} payment{summary.capturedCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="card stat">
          <p className="eyebrow">Paid rate</p>
          <p className="stat-value num">{r?.paidRate == null ? "—" : `${Math.round(r.paidRate * 100)}%`}</p>
          <p className="muted">{r ? `${r.paidTotal} of ${r.leftTotal} items paid for` : "Needs opening and closing counts"}</p>
        </div>
        <div className={`card stat${r && r.unpaidTotal > 0 ? " stat-alert" : ""}`}>
          <p className="eyebrow">Left unpaid</p>
          <p className="stat-value num">{r ? formatCents(r.unpaidCents) : "—"}</p>
          <p className="muted">{r ? `${r.unpaidTotal} item${r.unpaidTotal === 1 ? "" : "s"}` : "Count the shelf at closing"}</p>
        </div>
      </section>

      <section className="card stack" aria-labelledby="shelf-heading">
        <div className="stack" style={{ "--gap": "4px" } as React.CSSProperties}>
          <h2 id="shelf-heading">Shelf check</h2>
          <p className="muted">
            Photograph the shelf when you open and again when you close. Candid counts what left and compares it with what was paid.
          </p>
        </div>
        <div className="shelf-grid">
          <div className="stack">
            <h3>Opening</h3>
            <p className="hint">{summary.open ? `Counted at ${new Date(summary.open.createdAt).toLocaleTimeString()}` : "Not counted yet"}</p>
            <ShelfCheck standId={stand.id} items={stand.items} kind="open" onStatus={notify} onSaved={(s) => setSummary(s as StandSummary)} />
          </div>
          <div className="stack">
            <h3>Closing</h3>
            <p className="hint">{summary.close ? `Counted at ${new Date(summary.close.createdAt).toLocaleTimeString()}` : "Not counted yet"}</p>
            {summary.open ? (
              <ShelfCheck standId={stand.id} items={stand.items} kind="close" onStatus={notify} onSaved={(s) => setSummary(s as StandSummary)} />
            ) : (
              <p className="muted">Do the opening count first.</p>
            )}
          </div>
        </div>

        {r ? (
          <div className="table-scroll">
            <table className="plain">
              <caption className="sr-only">What left the shelf compared with what was paid</caption>
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col" className="n">Opened</th>
                  <th scope="col" className="n">Closed</th>
                  <th scope="col" className="n">Left shelf</th>
                  <th scope="col" className="n">Paid</th>
                  <th scope="col">Result</th>
                </tr>
              </thead>
              <tbody>
                {r.lines.map((line) => (
                  <tr key={line.itemId}>
                    <th scope="row">{line.name}</th>
                    <td className="n num">{line.opened}</td>
                    <td className="n num">{line.closed}</td>
                    <td className="n num">{line.left}</td>
                    <td className="n num">{line.paid}</td>
                    <td>
                      {line.unpaid > 0 ? (
                        <span className="pill unpaid">
                          <Icon name="alert" size={15} /> {line.unpaid} unpaid · {formatCents(line.unpaidCents)}
                        </span>
                      ) : (
                        <span className="pill paid">
                          <Icon name="check" size={15} /> All paid
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="stack" aria-labelledby="sales-heading">
        <h2 id="sales-heading">Today&rsquo;s payments</h2>
        <SalesGrid sales={summary.sales} />
      </section>

      <section className="card stack" aria-labelledby="payout-heading">
        <h2 id="payout-heading">Pay the growers</h2>
        <p className="muted">Each grower gets the money for their own items, in one PayPal Payouts batch.</p>
        {summary.shares.length ? (
          <ul className="share-list">
            {summary.shares.map((share) => (
              <li key={share.growerId}>
                <span>{share.name}</span>
                <span className="num">{formatCents(share.cents)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="hint">{growers.length ? "Nothing new to pay out yet." : "This stand has no growers set up."}</p>
        )}
        <div className="row">
          <button type="button" className="btn" onClick={() => void payGrowers()} disabled={paying || summary.shares.length === 0}>
            {paying ? "Sending…" : "Send payouts"}
          </button>
        </div>
        {summary.payouts.length ? (
          <p className="hint">
            Last batch <span className="mono">{summary.payouts[0].batchId}</span> · {summary.payouts[0].status.toLowerCase()}
          </p>
        ) : null}
      </section>

      <section className="row" aria-label="Stand links">
        <Link className="btn secondary" href={`/owner/${stand.id}/sign`}>
          Print the QR sign
        </Link>
        <Link className="btn secondary" href={`/s/${stand.slug}`}>
          Open the customer page
        </Link>
      </section>

      <div role="status" aria-live="polite" className={status ? `notice ${status.tone === "error" ? "error" : status.tone === "success" ? "success" : ""}` : "sr-only"}>
        {status?.message ?? ""}
      </div>
    </div>
  );
}
