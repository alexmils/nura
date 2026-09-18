"use client";

type Props = {
  open: boolean;
  title?: string;
  onDoClosure: () => void;
  onLeaveAnyway: () => void;
  onCancel: () => void;
};

/**
 * Exit gate when leaving mid-processing or with an incomplete session.
 */
export function SessionClosureModal({
  open,
  title = "Session is not closed",
  onDoClosure,
  onLeaveAnyway,
  onCancel,
}: Props) {
  if (!open) return null;

  return (
    <div className="session-closure-overlay" role="presentation">
      <div
        className="session-closure-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-closure-title"
      >
        <h2 id="session-closure-title" className="session-closure-title">
          {title}
        </h2>
        <p className="session-closure-body">
          Leaving mid-set can leave material unfinished. A short close (about 2
          minutes), calm breathing or a containment image, helps you exit more
          safely.
        </p>
        <div className="session-closure-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={onDoClosure}
          >
            Do a short close
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={onLeaveAnyway}
          >
            Leave anyway
          </button>
          <button
            type="button"
            className="session-closure-cancel"
            onClick={onCancel}
          >
            Stay in session
          </button>
        </div>
      </div>
    </div>
  );
}

type ResumeProps = {
  open: boolean;
  onResume: () => void;
  onDismiss: () => void;
};

export function ResumeClosureBanner({
  open,
  onResume,
  onDismiss,
}: ResumeProps) {
  if (!open) return null;
  return (
    <div className="resume-closure-banner" role="status">
      <p>
        Your last session was not fully closed. Take a short containment step
        before continuing.
      </p>
      <div className="resume-closure-actions">
        <button type="button" className="btn-primary" onClick={onResume}>
          Finish closing
        </button>
        <button type="button" className="btn-secondary" onClick={onDismiss}>
          Not now
        </button>
      </div>
    </div>
  );
}
