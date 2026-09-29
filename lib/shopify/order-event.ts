export type ShopifyOrderEventTopic = "orders/updated" | "orders/edited";

export class InvalidShopifyOrderEventError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidShopifyOrderEventError";
  }
}

export function isShopifyOrderEventTopic(topic: string | null): topic is ShopifyOrderEventTopic {
  return topic === "orders/updated" || topic === "orders/edited";
}

export function parseShopifyOrderEvent(rawBody: string, topic: ShopifyOrderEventTopic): number {
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    throw new InvalidShopifyOrderEventError("Webhook body is not JSON");
  }
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    throw new InvalidShopifyOrderEventError("Webhook body must be an object");
  }
  const body = payload as Record<string, unknown>;
  let orderId: unknown;
  if (topic === "orders/updated") {
    orderId = body.id;
  } else {
    const orderEdit = body.order_edit;
    if (typeof orderEdit !== "object" || orderEdit === null || Array.isArray(orderEdit)) {
      throw new InvalidShopifyOrderEventError("Order edit is missing");
    }
    orderId = (orderEdit as Record<string, unknown>).order_id;
  }
  if (typeof orderId !== "number" || !Number.isSafeInteger(orderId) || orderId <= 0) {
    throw new InvalidShopifyOrderEventError("Order ID is invalid");
  }
  return orderId;
}
