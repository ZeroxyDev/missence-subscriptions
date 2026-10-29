/**
 * @file Floating panel revealed on hover or keyboard focus of its group.
 *
 * Generic UI primitive. The trigger and the card must share a parent with the
 * Tailwind `group` class; the card becomes visible on `group-hover` and
 * `group-focus-within`, so it is reachable by keyboard without JavaScript.
 *
 * @module components/ui/hover-card
 */

import type { ReactNode } from "react";

/** Props of {@link HoverCard}. */
type HoverCardProps = {
  /** DOM id, referenced by the trigger's `aria-describedby`. */
  id: string;
  /** Small uppercase heading. */
  title: string;
  children: ReactNode;
};

/**
 * Renders the floating panel above its trigger (centred from `md` up).
 *
 * @param props - Id, heading and content.
 * @returns The panel element.
 */
export function HoverCard({ id, title, children }: HoverCardProps) {
  return (
    <div
      id={id}
      className="invisible absolute bottom-full left-0 z-20 mb-3 w-72 translate-y-1 rounded-missence-sm bg-missence-text p-4 text-missence-bg opacity-0 shadow-lg transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 md:left-1/2 md:-translate-x-1/2 md:group-hover:-translate-x-1/2 md:group-focus-within:-translate-x-1/2"
    >
      <p className="mb-3 text-[10px] uppercase tracking-[0.08em] text-missence-muted">
        {title}
      </p>
      {children}
    </div>
  );
}
