/**
 * @file Structured, allow-listed integration logging.
 *
 * Every log line is `console.<level>("bigblue_subscription_adjustment", { event, ...context })`.
 * Hosting platforms (Vercel) index the JSON payload, so operators can filter
 * and alert on `event` and on the level. Both are an operational contract:
 * adding an event is safe, renaming one or changing its level breaks alerts.
 *
 * Privacy rule: contexts carry IDs, SKUs, quantities, amounts and error class
 * names only. Never log customer data, addresses, raw payloads or secrets.
 *
 * @module lib/observability/integration-log
 */

/** Log label shared by every integration event. */
const LOG_LABEL = "bigblue_subscription_adjustment";

/** Severity of an integration event. */
type LogLevel = "info" | "warn" | "error";

/**
 * Canonical event catalogue and the severity each one is logged at.
 *
 * - `error`: needs human attention or indicates a failed write.
 * - `warn`: rejected input or a transient condition that will be retried.
 * - `info`: normal progress.
 */
const EVENT_LEVELS = {
  already_adjusted: "info",
  adjustment_detected: "info",
  adjustment_planned: "info",
  bigblue_not_ready: "warn",
  bigblue_order_found: "info",
  bigblue_webhook_received: "info",
  ignored_no_pair: "info",
  invalid_shopify_payload: "warn",
  invalid_shopify_hmac: "warn",
  invalid_shopify_topic: "warn",
  shopify_order_event_received: "info",
  manual_review_required: "error",
  price_mismatch: "error",
  price_verified: "info",
  reconciliation_configuration_error: "error",
  reconciliation_failed: "error",
  reconciliation_finished: "info",
  reconciliation_skipped: "warn",
  update_failed: "error",
  update_not_persisted: "warn",
  update_verified: "info",
  updated: "info",
} as const satisfies Record<string, LogLevel>;

/** Name of a known integration event. */
export type IntegrationEvent = keyof typeof EVENT_LEVELS;

/** JSON-serialisable value allowed in a log context. */
type LogValue =
  | boolean
  | number
  | string
  | null
  | undefined
  | { readonly [key: string]: LogValue }
  | readonly LogValue[];

/** Additional structured fields attached to an event. */
export type LogContext = Record<string, LogValue>;

/**
 * Emits one structured integration event at its catalogued severity.
 *
 * @param event - Event name from the catalogue.
 * @param context - Log-safe structured fields (see the privacy rule above).
 * @returns Nothing.
 * @sideEffects Writes one line to `console.info`, `console.warn` or `console.error`.
 *
 * @example
 * ```ts
 * logIntegrationEvent("bigblue_not_ready", { shopifyOrderId: "8212586266951" });
 * ```
 */
export function logIntegrationEvent(
  event: IntegrationEvent,
  context: LogContext = {},
): void {
  const payload = {
    event,
    ...context,
  };

  console[EVENT_LEVELS[event]](LOG_LABEL, payload);
}
