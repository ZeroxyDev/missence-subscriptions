/**
 * @file Use case: re-apply the first-shipment target to a batch of orders.
 *
 * Reconciliation is the safety net behind the `orders/create` webhook. Bigblue
 * may import an order late or later overwrite our change with a resync from
 * Shopify; reconciliation compares each candidate against Shopify's current
 * state and re-applies the target while Bigblue still reports `PENDING`.
 * It is idempotent, so it can run as often as needed.
 *
 * Orders are processed sequentially to stay well within Bigblue rate limits
 * and to keep logs causally ordered. One failing order never aborts the batch.
 *
 * @module lib/subscriptions/application/reconcile-first-shipments
 */

import { BigblueOrderNotReadyError } from "@/lib/integrations/bigblue/errors";
import type { BigblueRequest } from "@/lib/integrations/bigblue/types";
import type { ReconciliationCandidate } from "@/lib/integrations/shopify/admin/order-mapper";
import { logIntegrationEvent } from "@/lib/observability/integration-log";
import { describeErrorForLog } from "@/lib/shared/errors";
import {
  BigblueOrderNotPendingError,
  processFirstShipmentAdjustment,
} from "@/lib/subscriptions/application/process-first-shipment";
import { detectFirstShipmentAdjustment } from "@/lib/subscriptions/domain/first-shipment-adjustment";

/** Counters returned to the caller and logged as `reconciliation_finished`. */
export type ReconciliationSummary = {
  /** Candidates received. */
  scanned: number;
  /** Candidates that are first-shipment orders eligible for processing. */
  matched: number;
  /** Orders written and verified in Bigblue. */
  updated: number;
  /** Orders already in the target state (no write). */
  alreadyAdjusted: number;
  /** Ineligible orders (cancelled, fulfilled, no pair, not pending, not imported). */
  skipped: number;
  /** Orders that errored and should be retried. */
  failed: number;
};

/** Options for {@link reconcileFirstShipments}. */
export type ReconcileOptions = {
  /**
   * Count a Bigblue order that is not imported yet as `failed` (so the caller
   * returns `503` and the sender redelivers) instead of `skipped`. Used by
   * event-driven triggers; the cron leaves it off and simply tries next cycle.
   */
  retryNotReady?: boolean;
};

/**
 * Reconciles each candidate against Bigblue and returns aggregate counters.
 *
 * Classification per candidate:
 * - cancelled or not `UNFULFILLED` in Shopify → `skipped`
 * - no configured pair → `skipped`
 * - Bigblue not pending, or not imported (unless `retryNotReady`) → `skipped`
 * - any other error → `failed`
 *
 * @param candidates - Orders read from the Shopify Admin API.
 * @param bigblueRequest - Bigblue RPC function.
 * @param options - See {@link ReconcileOptions}.
 * @returns The batch summary.
 * @sideEffects May update Bigblue orders; logs per-order outcomes and
 *   `reconciliation_finished`.
 */
export async function reconcileFirstShipments(
  candidates: readonly ReconciliationCandidate[],
  bigblueRequest: BigblueRequest,
  options: ReconcileOptions = {},
): Promise<ReconciliationSummary> {
  const summary: ReconciliationSummary = {
    scanned: candidates.length,
    matched: 0,
    updated: 0,
    alreadyAdjusted: 0,
    skipped: 0,
    failed: 0,
  };

  for (const candidate of candidates) {
    const { order } = candidate;
    if (candidate.cancelled || candidate.fulfillmentStatus !== "UNFULFILLED") {
      summary.skipped += 1;
      continue;
    }

    const adjustment = detectFirstShipmentAdjustment(order);
    if (!adjustment.shouldAdjust) {
      summary.skipped += 1;
      continue;
    }
    summary.matched += 1;

    try {
      const result = await processFirstShipmentAdjustment(
        bigblueRequest,
        order,
        adjustment,
        { requirePending: true },
      );
      if ("updated" in result) {
        summary.updated += 1;
      } else {
        summary.alreadyAdjusted += 1;
      }
    } catch (error) {
      if (error instanceof BigblueOrderNotReadyError && options.retryNotReady) {
        summary.failed += 1;
        logIntegrationEvent("reconciliation_failed", {
          shopifyOrderId: String(order.id),
          reason: "bigblue_not_ready",
        });
        continue;
      }
      if (error instanceof BigblueOrderNotReadyError || error instanceof BigblueOrderNotPendingError) {
        summary.skipped += 1;
        logIntegrationEvent("reconciliation_skipped", {
          shopifyOrderId: String(order.id),
          reason: error instanceof BigblueOrderNotReadyError ? "bigblue_not_ready" : "bigblue_not_pending",
        });
        continue;
      }

      summary.failed += 1;
      logIntegrationEvent("reconciliation_failed", {
        shopifyOrderId: String(order.id),
        reason: describeErrorForLog(error),
      });
    }
  }

  logIntegrationEvent("reconciliation_finished", summary);
  return summary;
}
