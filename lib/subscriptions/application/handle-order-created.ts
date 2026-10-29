/**
 * @file Use case: react to a verified Shopify `orders/create` delivery.
 *
 * This is the fast path. It runs inside Shopify's 5-second webhook window
 * and adjusts Bigblue immediately when possible; anything it cannot finish is
 * surfaced as a retryable error so Shopify redelivers, with reconciliation as
 * the final safety net.
 *
 * @module lib/subscriptions/application/handle-order-created
 */

import type { BigblueRequest } from "@/lib/integrations/bigblue/types";
import type { ShopifyOrder } from "@/lib/integrations/shopify/order";
import { logIntegrationEvent } from "@/lib/observability/integration-log";
import {
  processFirstShipmentAdjustment,
  type FirstShipmentResult,
} from "@/lib/subscriptions/application/process-first-shipment";
import {
  detectFirstShipmentAdjustment,
  getFirstShipmentDetectionDiagnostics,
} from "@/lib/subscriptions/domain/first-shipment-adjustment";

/** Outcome of {@link handleOrderCreated}. */
export type OrderCreatedOutcome =
  | { kind: "ignored" }
  | { kind: "processed"; result: FirstShipmentResult };

/** Input of {@link handleOrderCreated}. */
export type OrderCreatedInput = {
  /** HMAC-verified, parsed order. */
  order: ShopifyOrder;
  /** `X-Shopify-Webhook-Id`, for log correlation. */
  webhookId: string | undefined;
  /**
   * Lazily creates the Bigblue client. Deferred so that orders without a
   * configured pair never require Bigblue credentials.
   */
  createBigblueRequest: () => BigblueRequest;
};

/**
 * Detects whether a new order is a first shipment and, if so, adjusts Bigblue.
 *
 * @param input - Order, correlation ID and Bigblue client factory.
 * @returns `ignored` for orders without a configured pair, otherwise the
 *   processing result.
 * @throws Everything {@link processFirstShipmentAdjustment} throws, plus
 *   `EnvironmentConfigurationError` from the client factory.
 * @sideEffects Logs `ignored_no_pair` (with diagnostics) or `adjustment_detected`;
 *   may update Bigblue.
 */
export async function handleOrderCreated({
  order,
  webhookId,
  createBigblueRequest,
}: OrderCreatedInput): Promise<OrderCreatedOutcome> {
  const shopifyOrderId = String(order.id);
  const adjustment = detectFirstShipmentAdjustment(order);

  if (!adjustment.shouldAdjust) {
    logIntegrationEvent("ignored_no_pair", {
      shopifyOrderId,
      webhookId,
      ...getFirstShipmentDetectionDiagnostics(order),
    });
    return { kind: "ignored" };
  }

  logIntegrationEvent("adjustment_detected", {
    shopifyOrderId,
    webhookId,
    pair: adjustment.pair,
    subscriptionSku: adjustment.subscriptionSku,
    subscriptionQuantity: adjustment.subscriptionQuantity,
    experienceSku: adjustment.experienceSku,
    experienceQuantity: adjustment.experienceQuantity,
    experienceReplacementSku: adjustment.experienceReplacementSku,
    targetQuantity: adjustment.targetQuantity,
  });

  const result = await processFirstShipmentAdjustment(
    createBigblueRequest(),
    order,
    adjustment,
  );
  return { kind: "processed", result };
}
