/**
 * @file Use case: react to a verified Shopify `orders/updated` or `orders/edited` delivery.
 *
 * The event only tells us *which* order changed. Its current state is re-read
 * from the Admin API (using `currentQuantity` and `currentTotalPriceSet`) and
 * reconciled against Bigblue while Bigblue still reports `PENDING`.
 *
 * @module lib/subscriptions/application/handle-order-event
 */

import { getShopifyAdminAccessToken } from "@/config/server-env";
import type { BigblueRequest } from "@/lib/integrations/bigblue/types";
import { getReconciliationCandidate } from "@/lib/integrations/shopify/admin/orders";
import type { ShopifyOrderEventTopic } from "@/lib/integrations/shopify/order-event";
import { logIntegrationEvent } from "@/lib/observability/integration-log";
import {
  reconcileFirstShipments,
  type ReconciliationSummary,
} from "@/lib/subscriptions/application/reconcile-first-shipments";
import { detectFirstShipmentAdjustment } from "@/lib/subscriptions/domain/first-shipment-adjustment";

/** Outcome of {@link handleOrderEvent}. */
export type OrderEventOutcome =
  | { kind: "skipped"; reason: "cancelled" | "not_unfulfilled" }
  | { kind: "no_matching_pair"; manualReview: boolean }
  | { kind: "reconciled"; summary: ReconciliationSummary };

/** Input of {@link handleOrderEvent}. */
export type OrderEventInput = {
  /** Order ID extracted from the verified payload. */
  orderId: number;
  /** Verified webhook topic. */
  topic: ShopifyOrderEventTopic;
  /** Permanent `*.myshopify.com` hostname (already checked against the delivery). */
  storeDomain: string;
  /** Lazily creates the Bigblue client, only when there is something to reconcile. */
  createBigblueRequest: () => BigblueRequest;
};

/**
 * Re-reads the changed order from Shopify and reconciles Bigblue.
 *
 * Shopify-side guards:
 * - cancelled or no longer `UNFULFILLED` → skipped, Bigblue untouched;
 * - no configured pair → skipped; if the order was *edited*, the edit removed
 *   the pair and there is no safe automatic transformation, so manual review
 *   is requested.
 *
 * A Bigblue order that is not imported yet counts as `failed`, so the caller
 * answers `503` and Shopify redelivers.
 *
 * @param input - Order reference, store and Bigblue client factory.
 * @returns The outcome to translate into an HTTP response.
 * @throws {Error} When the Admin API does not return the order yet (retryable).
 * @throws {ShopifyAdminOrdersError} When the Admin API call fails.
 * @throws {EnvironmentConfigurationError} When a credential is missing.
 * @sideEffects Reads Shopify, may update Bigblue, emits log events.
 */
export async function handleOrderEvent({
  orderId,
  topic,
  storeDomain,
  createBigblueRequest,
}: OrderEventInput): Promise<OrderEventOutcome> {
  const candidate = await getReconciliationCandidate({
    orderId,
    accessToken: getShopifyAdminAccessToken(),
    storeDomain,
  });
  if (!candidate) {
    // Plain `Error` on purpose: its name ("Error") is the logged reason
    // operators already filter on for this transient condition.
    throw new Error("Shopify order is not yet available from Admin API");
  }

  if (candidate.cancelled || candidate.fulfillmentStatus !== "UNFULFILLED") {
    logIntegrationEvent("reconciliation_skipped", {
      shopifyOrderId: String(orderId),
      topic,
      reason: candidate.cancelled ? "shopify_cancelled" : "shopify_not_unfulfilled",
    });
    return { kind: "skipped", reason: candidate.cancelled ? "cancelled" : "not_unfulfilled" };
  }

  if (!detectFirstShipmentAdjustment(candidate.order).shouldAdjust) {
    if (candidate.edited) {
      logIntegrationEvent("manual_review_required", {
        shopifyOrderId: String(orderId),
        topic,
        reason: "edited_order_no_longer_matches_pair",
      });
    }
    return { kind: "no_matching_pair", manualReview: candidate.edited };
  }

  const summary = await reconcileFirstShipments(
    [candidate],
    createBigblueRequest(),
    { retryNotReady: true },
  );
  return { kind: "reconciled", summary };
}
