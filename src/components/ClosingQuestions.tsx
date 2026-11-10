"use client";

import { useState } from "react";
import { api, formatCents } from "@/lib/client";
import type { ClosingQuestion } from "@/lib/reconcile";
import type { StockReason } from "@/lib/types";
import { Icon } from "./Icon";

type Props = {
  standId: string;
  closeId: string;
  questions: ClosingQuestion[];
  onSaved: (summary: unknown) => void;
  onStatus: (message: string, tone: "info" | "error" | "success") => void;
};

const ANSWERS: { reason: StockReason; label: string }[] = [
  { reason: "cash", label: "Sold for cash" },
  { reason: "gift", label: "Given away" },
  { reason: "spoiled", label: "Spoiled or damaged" },
];

/**
 * Exception-driven closing: instead of a spreadsheet of the whole day, the
 * owner answers one question per gap. Each answer is a stock entry, so the
 * reconciliation updates straight away and shows what is still open.
 */
export function ClosingQuestions({ standId, closeId, questions, onSaved, onStatus }: Props) {
  const [busy, setBusy] = useState(false);
  const open = questions.filter((q) => !q.acknowledged);
  const noted = questions.filter((q) => q.acknowledged);

  async function log(q: ClosingQuestion, reason: StockReason, qty: number, said: string) {
    setBusy(true);
    try {
      onSaved(await api(`/api/stands/${standId}/stock`, { body: { itemId: q.itemId, qty, reason } }));
      onStatus(`${said} The check has been updated.`, "success");
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Couldn't save that answer.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function dontKnow(q: ClosingQuestion) {
    setBusy(true);
    try {
      onSaved(await api(`/api/stands/${standId}/questions`, { body: { closeId, itemId: q.itemId, kind: q.kind } }));
      onStatus(
        q.kind === "unexplained" ? `Noted: ${q.qty} × ${q.name} stays unexplained (${formatCents(q.cents)}).` : `Noted: ${q.name} left as counted.`,
        "info",
      );
    } catch (error) {
      onStatus(error instanceof Error ? error.message : "Couldn't save that answer.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="questions stack" aria-labelledby="questions-heading">
      <div className="questions-head">
        <h3 id="questions-heading">
          {open.length
            ? `${open.length} question${open.length === 1 ? "" : "s"} to close the day`
            : questions.length
              ? "Day closed"
              : "Day closed, nothing to ask"}
        </h3>
        <p className="muted">
          {open.length
            ? "Candid only asks about what doesn't add up. Each answer updates the check straight away."
            : noted.length
              ? "Everything has an answer. Gaps you couldn't explain stay on record as unexplained."
              : "Every item that left the shelf is explained by a payment or a stock entry."}
        </p>
      </div>

      {open.length ? (
        <ol className="question-list" role="list">
          {open.map((q) => (
            <QuestionCard key={`${q.itemId}:${q.kind}`} q={q} busy={busy} onLog={log} onDontKnow={dontKnow} />
          ))}
        </ol>
      ) : null}

      {noted.length ? (
        <ul className="noted-list" role="list" aria-label="Noted as unexplained">
          {noted.map((q) => (
            <li key={`${q.itemId}:${q.kind}`}>
              <Icon name="receipt" size={15} />
              {q.kind === "unexplained" ? (
                <span>
                  {q.qty} × {q.name}: unexplained, {formatCents(q.cents)}
                </span>
              ) : (
                <span>{q.name}: left as counted</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function QuestionCard({
  q,
  busy,
  onLog,
  onDontKnow,
}: {
  q: ClosingQuestion;
  busy: boolean;
  onLog: (q: ClosingQuestion, reason: StockReason, qty: number, said: string) => Promise<void>;
  onDontKnow: (q: ClosingQuestion) => Promise<void>;
}) {
  const [qty, setQty] = useState(q.qty);
  const amount = Math.min(Math.max(1, qty), q.qty);
  const headingId = `q-${q.itemId}-${q.kind}`;

  if (q.kind === "unexplained") {
    return (
      <li className="question-card" aria-labelledby={headingId}>
        <p id={headingId} className="question-title">
          <Icon name="alert" size={18} />
          <span>
            <b>
              {q.qty} × {q.name}
            </b>{" "}
            left the shelf with no payment or entry ({formatCents(q.cents)}). What happened?
          </span>
        </p>
        <div className="question-actions">
          {q.qty > 1 ? (
            <div className="qty-pick" role="group" aria-label={`How many of the ${q.qty}`}>
              <button type="button" className="icon-btn" onClick={() => setQty(amount - 1)} disabled={busy || amount <= 1} aria-label="One fewer">
                <Icon name="minus" size={16} />
              </button>
              <span className="num" aria-live="polite">
                {amount} of {q.qty}
              </span>
              <button type="button" className="icon-btn" onClick={() => setQty(amount + 1)} disabled={busy || amount >= q.qty} aria-label="One more">
                <Icon name="plus" size={16} />
              </button>
            </div>
          ) : null}
          {ANSWERS.map((a) => (
            <button
              key={a.reason}
              type="button"
              className="btn secondary small"
              disabled={busy}
              onClick={() => void onLog(q, a.reason, amount, `${amount} × ${q.name}: ${a.label.toLowerCase()}.`)}
            >
              {a.label}
            </button>
          ))}
          <button type="button" className="btn quiet small" disabled={busy} onClick={() => void onDontKnow(q)}>
            I don&rsquo;t know
          </button>
        </div>
      </li>
    );
  }

  const text =
    q.kind === "over"
      ? `${q.qty} more ${q.name.toLowerCase()} were paid for or logged than left the shelf. Did you restock during the day?`
      : `${q.qty} more ${q.name.toLowerCase()} on the shelf at closing than you opened with. Did you restock during the day?`;
  return (
    <li className="question-card review" aria-labelledby={headingId}>
      <p id={headingId} className="question-title">
        <Icon name="scan" size={18} />
        <span>{text}</span>
      </p>
      <div className="question-actions">
        <button type="button" className="btn secondary small" disabled={busy} onClick={() => void onLog(q, "restock", q.qty, `Logged a restock of ${q.qty} × ${q.name}.`)}>
          Yes, I restocked {q.qty}
        </button>
        <a className="btn secondary small" href="#closing-heading">
          Recount the shelf
        </a>
        <button type="button" className="btn quiet small" disabled={busy} onClick={() => void onDontKnow(q)}>
          Leave it as counted
        </button>
      </div>
    </li>
  );
}
