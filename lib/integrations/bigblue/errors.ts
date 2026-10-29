/**
 * @file Error taxonomy for the Bigblue integration.
 *
 * Route handlers map these classes to HTTP status codes and the `name` of each
 * class is written to logs as the failure `reason`. Both are part of the
 * operational contract: do not rename or duplicate these classes.
 *
 * @module lib/integrations/bigblue/errors
 */

/**
 * Transport-level or HTTP-level failure talking to the Bigblue Store API.
 *
 * `retryable` drives the webhook response: retryable errors return `503` so
 * the sender redelivers; permanent ones return `502` (or `409` for `412`).
 */
export class BigblueApiError extends Error {
  /**
   * @param message - Bigblue's error message, or a generic transport description.
   * @param status - HTTP status, or `null` for timeouts and network failures.
   * @param code - Bigblue error code, `"timeout"`, `"network_error"`, or `null`.
   * @param retryable - Whether repeating the same request may succeed.
   * @param retryAfterMs - Server-suggested back-off parsed from `Retry-After`.
   */
  constructor(
    message: string,
    readonly status: number | null,
    readonly code: string | null,
    readonly retryable: boolean,
    readonly retryAfterMs: number | null = null,
  ) {
    super(message);
    this.name = "BigblueApiError";
  }
}

/**
 * Bigblue answered, but the payload violates an invariant we rely on (shape,
 * totals, currency, or the update did not persist). Always treated as
 * retryable: the next delivery or reconciliation re-evaluates from scratch.
 */
export class InvalidBigblueResponseError extends Error {
  /**
   * @param message - Diagnostic description. May include the Bigblue order ID.
   */
  constructor(message: string) {
    super(message);
    this.name = "InvalidBigblueResponseError";
  }
}

/**
 * The Shopify order has not been imported into Bigblue yet. Expected right
 * after checkout; resolved by Shopify redelivery or the reconciliation cron.
 */
export class BigblueOrderNotReadyError extends Error {
  /**
   * @param externalIds - Every `external_id` that was searched for.
   */
  constructor(readonly externalIds: readonly string[]) {
    super(`Bigblue order for references ${externalIds.join(", ")} is not ready`);
    this.name = "BigblueOrderNotReadyError";
  }
}
