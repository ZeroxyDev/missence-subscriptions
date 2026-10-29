/**
 * @file List of individual integration checks shown inside the status card.
 *
 * @module components/operations/integration-status/integration-check-list
 */

import type { IntegrationCheck } from "@/lib/health/types";

/**
 * Renders one row per check: label and either "Correcto" or the error detail.
 *
 * @param props - Checks from the health report.
 * @returns A `<ul>`.
 */
export function IntegrationCheckList({ checks }: { checks: readonly IntegrationCheck[] }) {
  return (
    <ul className="space-y-3">
      {checks.map((check) => (
        <li key={check.id} className="flex items-start justify-between gap-4">
          <span>{check.label}</span>
          <span className="text-right text-missence-muted">
            {check.status === "error" ? check.detail : "Correcto"}
          </span>
        </li>
      ))}
    </ul>
  );
}
