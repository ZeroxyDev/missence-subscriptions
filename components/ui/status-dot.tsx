/**
 * @file Small coloured dot that encodes a status.
 *
 * Generic UI primitive: no domain knowledge, server- and client-safe.
 *
 * @module components/ui/status-dot
 */

/** Visual states of a {@link StatusDot}. */
export type StatusTone = "pending" | "ok" | "error";

/** Background class per tone, using MISSENCE design tokens. */
const TONE_CLASS: Record<StatusTone, string> = {
  pending: "bg-missence-border",
  ok: "bg-missence-accent",
  error: "bg-missence-text",
};

/**
 * Renders a 6px status dot.
 *
 * @param props - `tone` selects the colour.
 * @returns A decorative `<span>`; pair it with a text label for accessibility.
 */
export function StatusDot({ tone }: { tone: StatusTone }) {
  return <span className={`size-1.5 rounded-full ${TONE_CLASS[tone]}`} />;
}
