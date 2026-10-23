"use client";

import { changeLabel, type ClosureCardData } from "@/lib/session-closure-card";
import "./session-flow.css";

/** End-of-session summary with a clear next step. */
export function SessionClosureCard({
  data,
  onNextSession,
}: {
  data: ClosureCardData;
  onNextSession?: () => void;
}) {
  const suds = changeLabel(data.sudsStart, data.sudsEnd);
  const voc = changeLabel(data.vocStart, data.vocEnd);
  return (
    <section
      className="session-closure-card agent-fade-up"
      aria-labelledby="session-closure-card-title"
      data-testid="session-closure-card"
    >
      <p className="session-closure-card-kicker">Session summary</p>
      <h2 id="session-closure-card-title" className="session-closure-card-title">
        {data.headline}
      </h2>
      {data.target ? (
        <p className="session-closure-card-target">
          <span>Target</span> {data.target}
        </p>
      ) : null}
      <dl className="session-closure-card-stats">
        <div>
          <dt>Sets done</dt>
          <dd>{data.setsDone}</dd>
        </div>
        {suds ? (
          <div>
            <dt>Disturbance (0-10)</dt>
            <dd>{suds}</dd>
          </div>
        ) : null}
        {voc ? (
          <div>
            <dt>Belief (1-7)</dt>
            <dd>{voc}</dd>
          </div>
        ) : null}
      </dl>
      <p className="session-closure-card-next">{data.nextStep}</p>
      {onNextSession ? (
        <button
          type="button"
          className="session-closure-card-cta"
          onClick={onNextSession}
          data-testid="session-closure-next"
        >
          {data.ctaLabel}
        </button>
      ) : null}
    </section>
  );
}
