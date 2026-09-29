import type { BigblueRequest } from "@/lib/bigblue/client";
import { BigblueOrderNotReadyError } from "@/lib/bigblue/orders";
import { logIntegrationEvent } from "@/lib/observability/integration-log";
import type { ReconciliationCandidate } from "@/lib/shopify/admin-orders";
import { detectFirstShipmentAdjustment } from "@/lib/subscriptions/first-shipment-adjustment";
import {
  BigblueOrderNotPendingError,
  processFirstShipmentAdjustment,
} from "@/lib/subscriptions/process-first-shipment";

export type ReconciliationSummary = {
  scanned: number;
  matched: number;
  updated: number;
  alreadyAdjusted: number;
  skipped: number;
  failed: number;
};

export async function reconcileFirstShipments(
  candidates: readonly ReconciliationCandidate[],
  bigblueRequest: BigblueRequest,
  options: { retryNotReady?: boolean } = {},
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
        reason: error instanceof Error ? error.name : "unknown_error",
      });
    }
  }

  logIntegrationEvent("reconciliation_finished", summary);
  return summary;
}
