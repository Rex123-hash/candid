"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, formatCents } from "@/lib/client";
import type { GrowerSettlement } from "@/lib/settlement";
import type { StandSummary } from "@/lib/summary";
import type { PayoutItemStatus } from "@/lib/types";
import { Icon } from "./Icon";
import { ClosingQuestions } from "./ClosingQuestions";
import { LocalTime } from "./LocalTime";
import { SalesGrid } from "./SalesGrid";
import { ShelfCheck } from "./ShelfCheck";
import { StockLog } from "./StockLog";

type Props = {
  stand: { id: string; slug: string; name: string; isDemo: boolean; items: { id: string; name: string; unit: string }[] };
  growers: { id: string; name: string }[];
  initial: StandSummary;
};

type Status = { message: string; tone: "info" | "error" | "success" } | null;
type StepState = "done" | "current" | "todo" | "skip";

/** Payout lines PayPal may still move on its own, so worth polling for. */
const MOVING: ReadonlySet<string> = new Set(["PENDING", "ONHOLD", "UNKNOWN"]);

export function OwnerDashboard({ stand, growers, initial }: Props) {
  const [summary, setSummary] = useState<StandSummary>(initial);
  const [status, setStatus] = useState<Status>(null);
  const [paying, setPaying] = useState(false);
  const [checking, setChecking] = useState(false);
  const r = summary.reconciliation;
  const notify = useCallback((message: string, tone: "info" | "error" | "success") => setStatus({ message, tone }), []);
  const nameOf = (id: string) => stand.items.find((i) => i.id === id)?.name ?? id;

  // Refresh every 10 seconds so a customer's payment shows up without reloading.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      api<StandSummary>(`/api/stands/${stand.id}/summary`)
        .then(setSummary)
        .catch(() => undefined);
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [stand.id]);

  const checkPayouts = useCallback(
    async (announce: boolean) => {
      setChecking(true);
      try {
        const next = await api<StandSummary>(`/api/stands/${stand.id}/payouts/status`, { body: {} });
        setSummary(next);
        if (announce) notify("Payout status updated from PayPal.", "success");
      } catch (error) {
        if (announce) notify(error instanceof Error ? error.message : "Couldn't reach PayPal.", "error");
      } finally {
        setChecking(false);
      }
    },
    [stand.id, notify],
  );

  // Ask PayPal about payouts that are still moving, on load and every 15 seconds while any are.
  const moving = summary.payouts.some((p) => p.lines.some((l) => !l.status || MOVING.has(l.status)));
  const anyUnsettled = summary.payouts.some((p) => p.lines.some((l) => !l.status || l.status !== "SUCCESS"));
  useEffect(() => {
    if (anyUnsettled) void checkPayouts(false);
    // Only on first load; polling below covers the rest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!moving) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void checkPayouts(false);
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [moving, checkPayouts]);

  async function payGrowers() {
    setPaying(true);
    try {
      const result = await api<StandSummary & { payoutOutcome?: "sent" | "rejected" | "unknown" }>(`/api/stands/${stand.id}/payouts`, { body: {} });
      setSummary(result);
      if (result.payoutOutcome === "rejected") notify("PayPal refused this payout, so nothing was sent. The money is still owed.", "error");
      else if (result.payoutOutcome === "unknown")
        notify("PayPal didn't confirm the payout. It is saved and won't be paid twice: press the button again to finish it.", "error");
      else notify("Payouts sent. Candid will show each grower's result as PayPal reports it.", "success");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Payouts failed.", "error");
    } finally {
      setPaying(false);
    }
  }

  const gaps = r ? r.unpaidTotal > 0 || r.needsReview.length > 0 : false;
  const unfinished = summary.payouts.find((p) => p.status === "SENDING");
  const openQuestions = summary.questions.filter((q) => !q.acknowledged).length;
  const steps: { label: string; state: StepState }[] = [
    { label: "Opening count", state: summary.open ? "done" : "current" },
    { label: "Log stock changes", state: !summary.open ? "todo" : summary.moves.length ? "done" : summary.close ? "skip" : "current" },
    { label: "Closing count", state: summary.close ? "done" : summary.open ? "current" : "todo" },
    { label: openQuestions ? `Answer ${openQuestions} question${openQuestions === 1 ? "" : "s"}` : "Answer the questions", state: !r ? "todo" : openQuestions ? "current" : "done" },
    {
      label: "Pay the growers",
      state: !growers.length
        ? "skip"
        : summary.shares.length
          ? r && !openQuestions
            ? "current"
            : "todo"
          : summary.settlements.some((s) => s.inFlightCents > 0)
            ? "current"
            : summary.settlements.some((s) => s.earnedCents > 0)
              ? "done"
              : "todo",
    },
  ];
  const onSaved = (s: unknown) => setSummary(s as StandSummary);

  return (
    <div className="stack" style={{ "--gap": "24px" } as React.CSSProperties}>
      <section aria-label="Today at a glance" className="stat-row">
        <div className="card stat">
          <p className="eyebrow">Taken today</p>
          <p className="stat-value num">{formatCents(summary.capturedCents)}</p>
          <p className="muted">
            {summary.capturedCount} PayPal or Venmo payment{summary.capturedCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="card stat">
          <p className="eyebrow">Paid rate</p>
          <p className="stat-value num">{r?.paidRate == null ? "—" : `${Math.round(r.paidRate * 100)}%`}</p>
          <p className="muted">{r ? `${r.paidTotal} of ${r.takenTotal} items paid for` : "Needs opening and closing counts"}</p>
        </div>
        <div className={`card stat${r && r.unpaidTotal > 0 ? " stat-alert" : ""}`}>
          <p className="eyebrow">Unexplained</p>
          <p className="stat-value num">{r ? formatCents(r.unpaidCents) : "—"}</p>
          <p className="muted">{r ? `${r.unpaidTotal} item${r.unpaidTotal === 1 ? "" : "s"} with no payment or entry` : "Count the shelf at closing"}</p>
        </div>
      </section>

      <nav aria-label="Closing the day" className="close-steps">
        <ol>
          {steps.map((step, index) => (
            <li key={step.label} className={`step-${step.state}`} aria-current={step.state === "current" ? "step" : undefined}>
              <span className="step-dot" aria-hidden="true">
                {step.state === "done" ? <Icon name="check" size={14} /> : index + 1}
              </span>
              <span>
                {step.label}
                <span className="sr-only">
                  {step.state === "done" ? ": done" : step.state === "current" ? ": next" : step.state === "skip" ? ": not needed" : ": later"}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </nav>

      <section className="card stack" aria-labelledby="shelf-heading">
        <div className="stack" style={{ "--gap": "4px" } as React.CSSProperties}>
          <h2 id="shelf-heading">Shelf check</h2>
          <p className="muted">
            Count the shelf when you open and when you close, by photo or by hand. Log anything the counts can&rsquo;t see. Candid compares what left the shelf with
            what was paid, and keeps whatever it can&rsquo;t explain in plain view.
          </p>
        </div>
        <div className="shelf-grid">
          <div className="stack">
            <h3>Opening</h3>
            <p className="hint">{summary.open ? <>Counted at <LocalTime iso={summary.open.createdAt} /></> : "Not counted yet"}</p>
            <ShelfCheck standId={stand.id} items={stand.items} kind="open" onStatus={notify} onSaved={onSaved} />
          </div>
          <div className="stack">
            <h3 id="closing-heading">Closing</h3>
            <p className="hint">{summary.close ? <>Counted at <LocalTime iso={summary.close.createdAt} /></> : "Not counted yet"}</p>
            {summary.open ? (
              <ShelfCheck standId={stand.id} items={stand.items} kind="close" onStatus={notify} onSaved={onSaved} />
            ) : (
              <p className="muted">Do the opening count first.</p>
            )}
          </div>
        </div>

        <div className="stack" style={{ "--gap": "10px" } as React.CSSProperties}>
          <h3>Stock changes</h3>
          <StockLog standId={stand.id} items={stand.items} moves={summary.moves} enabled={Boolean(summary.open)} onSaved={onSaved} onStatus={notify} />
        </div>

        {r ? (
          <>
            <div className={`close-summary${gaps ? " has-gaps" : ""}`} role="note" aria-label="What the closing check found">
              <Icon name={gaps ? "alert" : "check"} size={20} />
              <div className="stack" style={{ "--gap": "6px" } as React.CSSProperties}>
                <p>
                  <b>
                    {r.takenTotal} item{r.takenTotal === 1 ? "" : "s"} went to customers today.
                  </b>{" "}
                  {sum(r.lines.map((l) => Math.min(l.paid, l.taken)))} paid through PayPal or Venmo
                  {r.cashTotal ? `, ${r.cashTotal} you reported as cash` : ""}.
                  {sum(r.lines.map((l) => l.removed)) ? ` ${sum(r.lines.map((l) => l.removed))} spoiled or given away.` : ""}
                </p>
                {r.unpaidTotal ? (
                  <p>
                    {r.unpaidTotal} item{r.unpaidTotal === 1 ? "" : "s"} ({formatCents(r.unpaidCents)}) aren&rsquo;t explained by any payment or stock entry.
                    Whatever stays unexplained is counted as taken unpaid.
                  </p>
                ) : (
                  <p>Every item that left the shelf is accounted for.</p>
                )}
                {r.needsReview.length ? (
                  <p>
                    The numbers for {r.needsReview.map((id) => nameOf(id).toLowerCase()).join(" and ")} don&rsquo;t add up, usually a restock that wasn&rsquo;t logged
                    or a miscount.
                  </p>
                ) : null}
              </div>
            </div>

            {summary.close ? (
              <ClosingQuestions standId={stand.id} closeId={summary.close.id} questions={summary.questions} onSaved={onSaved} onStatus={notify} />
            ) : null}

            <div className="table-scroll">
              <table className="plain">
                <caption className="sr-only">What left the shelf compared with what was paid and logged</caption>
                <thead>
                  <tr>
                    <th scope="col">Item</th>
                    <th scope="col" className="n">Opened</th>
                    <th scope="col" className="n">Restocked</th>
                    <th scope="col" className="n">Closed</th>
                    <th scope="col" className="n">Left shelf</th>
                    <th scope="col" className="n">PayPal</th>
                    <th scope="col" className="n">Cash</th>
                    <th scope="col" className="n">Removed</th>
                    <th scope="col">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {r.lines.map((line) => (
                    <tr key={line.itemId}>
                      <th scope="row">{line.name}</th>
                      <td className="n num">{line.opened}</td>
                      <td className="n num">{line.added || ""}</td>
                      <td className="n num">{line.closed}</td>
                      <td className="n num">{line.left}</td>
                      <td className="n num">{line.paid}</td>
                      <td className="n num">{line.cash || ""}</td>
                      <td className="n num">{line.removed || ""}</td>
                      <td>
                        {line.unpaid > 0 ? (
                          <span className="pill unpaid">
                            <Icon name="alert" size={15} /> {line.unpaid} unexplained · {formatCents(line.unpaidCents)}
                          </span>
                        ) : line.overAccounted || line.unexpectedStock ? (
                          <span className="pill review">
                            <Icon name="scan" size={15} /> Recount
                          </span>
                        ) : (
                          <span className="pill paid">
                            <Icon name="check" size={15} /> Accounted for
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </section>

      <section className="stack" aria-labelledby="sales-heading">
        <h2 id="sales-heading">Today&rsquo;s payments</h2>
        <SalesGrid sales={summary.sales} />
      </section>

      <section className="card stack" aria-labelledby="payout-heading">
        <div className="stack" style={{ "--gap": "4px" } as React.CSSProperties}>
          <h2 id="payout-heading">Pay the growers</h2>
          <p className="muted">
            Each grower is paid for their own items through PayPal Payouts. A payout only counts as received when PayPal says so; one that fails is owed again.
          </p>
        </div>
        {summary.settlements.length ? (
          <div className="table-scroll">
            <table className="plain">
              <caption className="sr-only">What each grower has earned, received and is owed</caption>
              <thead>
                <tr>
                  <th scope="col">Grower</th>
                  <th scope="col" className="n">Earned</th>
                  <th scope="col" className="n">Received</th>
                  <th scope="col" className="n">On its way</th>
                  <th scope="col" className="n">Owed now</th>
                  <th scope="col">Last payout</th>
                </tr>
              </thead>
              <tbody>
                {summary.settlements.map((s) => (
                  <tr key={s.growerId}>
                    <th scope="row">{s.name}</th>
                    <td className="n num">{formatCents(s.earnedCents)}</td>
                    <td className="n num">{formatCents(s.paidCents)}</td>
                    <td className="n num">{s.inFlightCents ? formatCents(s.inFlightCents) : ""}</td>
                    <td className="n num">
                      <b>{formatCents(s.owedCents)}</b>
                    </td>
                    <td>
                      <PayoutPill settlement={s} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="hint">This stand isn&rsquo;t shared, so there are no growers to pay. Every sale goes straight to your PayPal balance.</p>
        )}
        {growers.length ? (
          <div className="row">
            <button type="button" className="btn" onClick={() => void payGrowers()} disabled={paying || (!unfinished && summary.shares.length === 0)}>
              {paying
                ? "Sending…"
                : unfinished
                  ? `Finish sending ${formatCents(unfinished.lines.reduce((t, l) => t + l.cents, 0))}`
                  : summary.shares.length
                    ? `Send ${formatCents(summary.shares.reduce((t, s) => t + s.cents, 0))} in payouts`
                    : "Nothing owed right now"}
            </button>
            {summary.payouts.length ? (
              <button type="button" className="btn secondary" onClick={() => void checkPayouts(true)} disabled={checking}>
                {checking ? "Checking…" : "Check with PayPal"}
              </button>
            ) : null}
          </div>
        ) : null}
        {summary.payouts.length ? (
          <p className="hint">
            Last batch <span className="mono">{summary.payouts[0].batchId || summary.payouts[0].id}</span> ·{" "}
            {summary.payouts[0].status === "SUCCESS"
              ? "processed by PayPal"
              : summary.payouts[0].status === "SENDING"
                ? "waiting for PayPal to confirm"
                : summary.payouts[0].status === "NOT_SENT"
                  ? "refused by PayPal, nothing sent"
                  : summary.payouts[0].status.toLowerCase()}
            {summary.payouts[0].checkedAt ? (
              <>
                {" "}
                · checked <LocalTime iso={summary.payouts[0].checkedAt} />
              </>
            ) : null}
          </p>
        ) : null}
        {summary.settlements.some((s) => s.lastStatus === "UNCLAIMED") ? (
          <p className="hint">
            &ldquo;Waiting to claim&rdquo; means the email has no PayPal account yet. PayPal holds the money for 30 days; if nobody claims it, it comes back
            and Candid shows it as owed again.
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

const PILL: Record<PayoutItemStatus, { text: string; tone: "paid" | "unpaid" | "pending" | "review"; icon: "check" | "alert" | "arrow" | "scan" }> = {
  SUCCESS: { text: "Received", tone: "paid", icon: "check" },
  PENDING: { text: "On its way", tone: "pending", icon: "arrow" },
  UNKNOWN: { text: "On its way", tone: "pending", icon: "arrow" },
  ONHOLD: { text: "On hold at PayPal", tone: "review", icon: "scan" },
  UNCLAIMED: { text: "Waiting for them to claim it", tone: "review", icon: "scan" },
  FAILED: { text: "Failed, owed again", tone: "unpaid", icon: "alert" },
  RETURNED: { text: "Returned, owed again", tone: "unpaid", icon: "alert" },
  BLOCKED: { text: "Blocked, owed again", tone: "unpaid", icon: "alert" },
  REFUNDED: { text: "Refunded, owed again", tone: "unpaid", icon: "alert" },
  REVERSED: { text: "Reversed, owed again", tone: "unpaid", icon: "alert" },
  DENIED: { text: "Denied, owed again", tone: "unpaid", icon: "alert" },
};

function PayoutPill({ settlement }: { settlement: GrowerSettlement }) {
  if (!settlement.lastStatus) return <span className="muted">Not paid yet</span>;
  const pill = PILL[settlement.lastStatus];
  return (
    <span className={`pill ${pill.tone}`} title={settlement.lastError ?? undefined}>
      <Icon name={pill.icon} size={15} /> {pill.text}
      {settlement.lastError && pill.tone === "unpaid" ? <span className="sr-only">: {settlement.lastError}</span> : null}
    </span>
  );
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}
