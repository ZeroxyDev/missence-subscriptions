type IntegrationEvent =
  | "already_adjusted"
  | "adjustment_detected"
  | "adjustment_planned"
  | "bigblue_not_ready"
  | "bigblue_order_found"
  | "bigblue_webhook_received"
  | "ignored_no_pair"
  | "invalid_shopify_payload"
  | "invalid_shopify_hmac"
  | "invalid_shopify_topic"
  | "shopify_order_event_received"
  | "manual_review_required"
  | "price_mismatch"
  | "price_verified"
  | "reconciliation_configuration_error"
  | "reconciliation_failed"
  | "reconciliation_finished"
  | "reconciliation_skipped"
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

  if (
    event === "update_failed" || event === "reconciliation_failed" ||
    event === "reconciliation_configuration_error" || event === "price_mismatch" ||
    event === "manual_review_required"
  ) {
    console.error("bigblue_subscription_adjustment", payload);
    return;
  }

  if (
    event === "invalid_shopify_hmac" ||
    event === "invalid_shopify_payload" ||
    event === "invalid_shopify_topic" ||
    event === "bigblue_not_ready" ||
    event === "update_not_persisted" ||
    event === "reconciliation_skipped"
  ) {
    console.warn("bigblue_subscription_adjustment", payload);
    return;
  }

  console.info("bigblue_subscription_adjustment", payload);
}
