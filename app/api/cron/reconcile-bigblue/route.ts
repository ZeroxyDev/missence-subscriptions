/**
 * @file `POST /api/cron/reconcile-bigblue` — scheduled reconciliation (required in production).
 *
 * Called by an external scheduler (e.g. every 5 minutes) with
 * `Authorization: Bearer <RECONCILIATION_CRON_SECRET>`. Re-applies the
 * first-shipment target to every recent order that Bigblue still has in
 * `PENDING`. Idempotent: when everything is correct, nothing is written.
 *
 * | Status | Meaning                                                      |
 * | ------ | ------------------------------------------------------------ |
 * | 200    | Every order reconciled (`{ ok: true, ...summary }`)          |
 * | 401    | Missing or wrong bearer secret                               |
 * | 503    | Not configured, Shopify search failed, or any order failed   |
 *
 * @module app/api/cron/reconcile-bigblue/route
 */

import { getReconciliationCronSecret } from "@/config/server-env";
import { isAuthorizedBearer, loadRequiredSecret } from "@/lib/http/request-auth";
import {
  reconciliationFailedResponse,
  reconciliationSummaryResponse,
  unauthorizedResponse,
} from "@/lib/http/responses";
import { logIntegrationEvent } from "@/lib/observability/integration-log";
import { describeErrorForLog } from "@/lib/shared/errors";
import { runRecentBigblueReconciliation } from "@/lib/subscriptions/application/run-reconciliation";

/** `node:crypto` is required for constant-time secret comparison. */
export const runtime = "nodejs";
/** A full reconciliation pass may take several Shopify and Bigblue round-trips. */
export const maxDuration = 60;

/**
 * Runs one reconciliation pass.
 *
 * @param request - Scheduler request with the bearer secret.
 * @returns The reconciliation summary or an error response.
 */
export async function POST(request: Request): Promise<Response> {
  const cronSecret = loadRequiredSecret(getReconciliationCronSecret, "RECONCILIATION_CRON_SECRET");
  if (!cronSecret.ok) return cronSecret.response;

  if (!isAuthorizedBearer(request.headers.get("authorization"), cronSecret.secret)) {
    return unauthorizedResponse();
  }

  try {
    return reconciliationSummaryResponse(await runRecentBigblueReconciliation());
  } catch (error) {
    logIntegrationEvent("reconciliation_failed", { reason: describeErrorForLog(error) });
    return reconciliationFailedResponse();
  }
}
