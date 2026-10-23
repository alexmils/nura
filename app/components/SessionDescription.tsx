import "./session-header.css";

/**
 * Session title + description in the header: read-only on purpose. A thumb
 * aiming for the menu icon used to land in the description editor, so
 * nothing here is tappable; edit from the sidebar (long press, right-click
 * or the \u22ef button on a Recent item). Both lines are single-line with an
 * ellipsis; no description means no second line (no placeholder).
 */
export function SessionDescription({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  const note = description?.trim();
  return (
    <div className="workspace-title-block">
      <h1 className="workspace-title" title={title}>
        {title}
      </h1>
      {note ? (
        <p className="workspace-description" title={note}>
          {note}
        </p>
      ) : null}
    </div>
  );
}
