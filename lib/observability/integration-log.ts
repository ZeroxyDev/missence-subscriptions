type IntegrationEvent =
  | "already_adjusted"
  | "bigblue_not_ready"
  | "bigblue_order_found"
  | "ignored_no_pair"
  | "invalid_shopify_hmac"
  | "update_failed"
  | "updated";

type LogContext = Record<
  string,
  boolean | number | string | null | undefined
>;

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

  if (event === "invalid_shopify_hmac" || event === "bigblue_not_ready") {
    console.warn("bigblue_subscription_adjustment", payload);
    return;
  }

  console.info("bigblue_subscription_adjustment", payload);
}
