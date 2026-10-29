/**
 * @file Client hook that polls `GET /api/health`.
 *
 * Separates data fetching from presentation so the status widget is a pure
 * function of `{ health, requestFailed }`.
 *
 * @module components/operations/integration-status/use-integration-health
 */

import { useEffect, useState } from "react";

import type { IntegrationHealth } from "@/lib/health/types";

/** Polling interval for the health endpoint. */
const REFRESH_INTERVAL_MS = 60_000;
/** Health endpoint path. */
const HEALTH_ENDPOINT = "/api/health";

/** State exposed by {@link useIntegrationHealth}. */
export type IntegrationHealthState = {
  /** Last successful report, or `null` before the first one arrives. */
  health: IntegrationHealth | null;
  /** `true` when the most recent request failed. */
  requestFailed: boolean;
};

/**
 * Minimal runtime check that a response looks like an {@link IntegrationHealth}.
 *
 * @param value - Parsed JSON body.
 * @returns `true` when `value.checks` is an array.
 */
function isIntegrationHealth(value: unknown): value is IntegrationHealth {
  if (typeof value !== "object" || value === null || !("checks" in value)) {
    return false;
  }

  return Array.isArray(value.checks);
}

/**
 * Fetches the health report on mount and every minute.
 *
 * Late responses after unmount are ignored and the interval is cleared.
 *
 * @returns The latest health state.
 * @sideEffects Issues `fetch` requests while mounted.
 */
export function useIntegrationHealth(): IntegrationHealthState {
  const [health, setHealth] = useState<IntegrationHealth | null>(null);
  const [requestFailed, setRequestFailed] = useState(false);

  useEffect(() => {
    let active = true;

    async function refreshHealth() {
      try {
        const response = await fetch(HEALTH_ENDPOINT, { cache: "no-store" });
        const value: unknown = await response.json();

        if (!response.ok || !isIntegrationHealth(value)) {
          throw new Error("Invalid health response");
        }

        if (active) {
          setHealth(value);
          setRequestFailed(false);
        }
      } catch {
        if (active) {
          setRequestFailed(true);
        }
      }
    }

    void refreshHealth();
    const interval = window.setInterval(refreshHealth, REFRESH_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  return { health, requestFailed };
}
