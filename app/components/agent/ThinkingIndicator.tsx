/**
 * Nura "guide is thinking" indicator.
 *
 * Ported from the LiveKit Agents UI registry (`@agents-ui/agent-chat-indicator`,
 * as used by `@agents-ui/agent-chat-transcript`): a single pulsing dot next to
 * a shimmering "Thinking…" label. Original: https://github.com/livekit/components-js
 * (packages/shadcn), Copyright LiveKit, Inc., licensed under Apache-2.0.
 * Changes: rewritten as a dependency-free component (CSS keyframes instead of
 * `motion`, no cva/shadcn Marker), restyled in the Nura palette, and made to
 * respect prefers-reduced-motion.
 */
import "./thinking-indicator.css";

export type ThinkingIndicatorProps = {
  /** Visible label next to the dot. Default "Thinking…". */
  label?: string;
  /** Show the visible label (the dot alone is announced via aria-label). */
  showLabel?: boolean;
  /** Show the pulsing dot. */
  showDot?: boolean;
  /** Dot size, mirroring the Agents UI sizes (12 / 16 / 24 px). */
  size?: "sm" | "md" | "lg";
  /** Announce as a live status region (turn off when a parent already does). */
  announce?: boolean;
  className?: string;
};

export function ThinkingIndicator({
  label = "Thinking\u2026",
  showLabel = true,
  showDot = true,
  size = "sm",
  announce = true,
  className = "",
}: ThinkingIndicatorProps) {
  return (
    <span
      className={`nura-thinking nura-thinking--${size}${className ? ` ${className}` : ""}`}
      data-slot="thinking-indicator"
      role={announce ? "status" : undefined}
      aria-live={announce ? "polite" : undefined}
      aria-label={showLabel ? undefined : label}
    >
      {showDot ? (
        <span className="nura-thinking-icon" aria-hidden="true">
          <span className="nura-thinking-dot" />
        </span>
      ) : null}
      {showLabel ? <span className="nura-thinking-label">{label}</span> : null}
    </span>
  );
}
