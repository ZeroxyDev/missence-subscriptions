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
  console.info("bigblue_subscription_adjustment", {
    event,
    ...context,
  });
}

