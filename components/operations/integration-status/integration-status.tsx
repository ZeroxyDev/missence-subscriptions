"use client";

/**
 * @file Footer widget showing live integration health.
 *
 * Composes the polling hook with generic UI primitives: a status dot with a
 * label, and a hover/focus card listing each check. Copy is in Spanish
 * (user-facing).
 *
 * @module components/operations/integration-status/integration-status
 */

import { IntegrationCheckList } from "@/components/operations/integration-status/integration-check-list";
import { useIntegrationHealth } from "@/components/operations/integration-status/use-integration-health";
import { HoverCard } from "@/components/ui/hover-card";
import { StatusDot, type StatusTone } from "@/components/ui/status-dot";

/** DOM id linking the trigger to its description card. */
const DETAIL_ID = "integration-status-detail";

/** Label shown next to the dot for each tone. */
const STATUS_LABEL: Record<StatusTone, string> = {
  pending: "Comprobando estado",
  ok: "Todo funciona con normalidad",
  error: "Hay una incidencia",
};

/**
 * Live integration status indicator.
 *
 * States: checking (neutral dot) → healthy (accent dot) or incident (dark dot).
 *
 * @returns The status button and its tooltip.
 */
export function IntegrationStatus() {
  const { health, requestFailed } = useIntegrationHealth();

  const tone: StatusTone = health === null && !requestFailed
    ? "pending"
    : requestFailed || health?.status === "error"
      ? "error"
      : "ok";

  return (
    <div className="group relative order-3 col-span-2 md:order-none md:col-span-1 md:justify-self-center">
      <button
        type="button"
        className="flex items-center gap-2 text-left"
        aria-live="polite"
        aria-describedby={DETAIL_ID}
      >
        <StatusDot tone={tone} />
        <span>{STATUS_LABEL[tone]}</span>
      </button>

      <HoverCard id={DETAIL_ID} title="Estado de la integración">
        {requestFailed ? (
          <p>No se pudo consultar el estado.</p>
        ) : health ? (
          <IntegrationCheckList checks={health.checks} />
        ) : (
          <p>Comprobando conexiones…</p>
        )}
      </HoverCard>
    </div>
  );
}
