/**
 * @file Parsing of Shopify order-change webhooks (`orders/updated`, `orders/edited`).
 *
 * These payloads are only used to learn *which* order changed. The current
 * state is always re-read from the Admin API, because `orders/edited` carries
 * only the delta and `orders/updated` may be stale by the time it arrives.
 *
 * @module lib/integrations/shopify/order-event
 */

import { isRecord } from "@/lib/shared/guards";

/** Topics accepted by the order-events endpoint. */
export type ShopifyOrderEventTopic = "orders/updated" | "orders/edited";

/** The event payload does not identify a valid order. */
export class InvalidShopifyOrderEventError extends Error {
  /**
   * @param message - Which part of the payload is invalid.
   */
  constructor(message: string) {
    super(message);
    this.name = "InvalidShopifyOrderEventError";
  }
}

/**
 * Narrows the `X-Shopify-Topic` header to a supported order-event topic.
 *
 * @param topic - Header value, or `null` when absent.
 * @returns `true` for `orders/updated` and `orders/edited`.
 */
export function isShopifyOrderEventTopic(topic: string | null): topic is ShopifyOrderEventTopic {
  return topic === "orders/updated" || topic === "orders/edited";
}

/**
 * Extracts the order ID from an order-event payload.
 *
 * - `orders/updated`: the payload is the order, so the ID is `id`.
 * - `orders/edited`: the payload is an order edit, so the ID is `order_edit.order_id`.
 *
 * @param rawBody - HMAC-verified raw body.
 * @param topic - Verified topic.
 * @returns A positive safe-integer order ID.
 * @throws {InvalidShopifyOrderEventError} On invalid JSON or a missing/invalid ID.
 */
export function parseShopifyOrderEvent(rawBody: string, topic: ShopifyOrderEventTopic): number {
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    throw new InvalidShopifyOrderEventError("Webhook body is not JSON");
  }
  if (!isRecord(payload)) {
    throw new InvalidShopifyOrderEventError("Webhook body must be an object");
  }
  let orderId: unknown;
  if (topic === "orders/updated") {
    orderId = payload.id;
  } else {
    const orderEdit = payload.order_edit;
    if (!isRecord(orderEdit)) {
      throw new InvalidShopifyOrderEventError("Order edit is missing");
    }
    orderId = orderEdit.order_id;
  }
  if (typeof orderId !== "number" || !Number.isSafeInteger(orderId) || orderId <= 0) {
    throw new InvalidShopifyOrderEventError("Order ID is invalid");
  }
  return orderId;
}
