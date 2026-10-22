/**
 * Renders one phrase in the Fraunces italic accent, the rest in the
 * surrounding heading font. Keeps the accessible text intact.
 */
export function AccentText({
  text,
  accent,
}: {
  text: string;
  accent: string;
}) {
  const at = accent ? text.indexOf(accent) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <em className="fe-accent">{accent}</em>
      {text.slice(at + accent.length)}
    </>
  );
}
