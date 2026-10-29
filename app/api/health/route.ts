/**
 * @file `GET /api/health` — integration status for the operations page.
 *
 * Always answers `200`; the overall and per-check status are in the body.
 * Upstream probes are cached for 30 s server-side (see `checkIntegrationHealth`).
 *
 * @module app/api/health/route
 */

import { checkIntegrationHealth } from "@/lib/health/check-integration-health";
import { NO_STORE_HEADERS } from "@/lib/http/responses";

/** Health probes use Node APIs and server-only configuration. */
export const runtime = "nodejs";
/** Never prerender: the report must reflect live upstream state. */
export const dynamic = "force-dynamic";

/**
 * Returns the current integration health report.
 *
 * @returns A non-cacheable JSON {@link IntegrationHealth} response.
 */
export async function GET(): Promise<Response> {
  const health = await checkIntegrationHealth();

  return Response.json(health, {
    headers: NO_STORE_HEADERS,
  });
}
