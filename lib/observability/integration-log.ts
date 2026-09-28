type IntegrationEvent =
  | "already_adjusted"
  | "adjustment_detected"
  | "adjustment_planned"
  | "bigblue_not_ready"
  | "bigblue_order_found"
  | "ignored_no_pair"
  | "invalid_shopify_payload"
  | "invalid_shopify_hmac"
  | "invalid_shopify_topic"
  | "update_failed"
  | "update_not_persisted"
  | "update_verified"
  | "updated";

type LogValue =
  | boolean
  | number
  | string
  | null
  | undefined
  | { readonly [key: string]: LogValue }
  | readonly LogValue[];

type LogContext = Record<string, LogValue>;

export function logIntegrationEvent(
  event: IntegrationEvent,
  context: LogContext = {},
): void {
  const payload = {
    event,
    ...context,
  };

  if (event === "update_failed") {
    console.error("bigblue_subscription_adjustment", payload);
    return;
  }

  if (
    event === "invalid_shopify_hmac" ||
    event === "invalid_shopify_payload" ||
    event === "invalid_shopify_topic" ||
    event === "bigblue_not_ready" ||
    event === "update_not_persisted"
  ) {
    console.warn("bigblue_subscription_adjustment", payload);
    return;
  }

  console.info("bigblue_subscription_adjustment", payload);
}
