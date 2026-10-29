/**
 * @file Canonical JSON responses shared by the Route Handlers.
 *
 * Status codes are chosen for the *sender's retry semantics*, not only for
 * REST purity: Shopify and Bigblue redeliver on `5xx`, so every transient
 * condition answers `503`, and every permanent rejection answers `4xx`.
 *
 * Note the caching policy: reconciliation endpoints set `Cache-Control:
 * no-store`; Shopify webhook endpoints historically do not. Preserve this
 * per-endpoint behaviour (it is pinned by the route tests).
 *
 * @module lib/http/responses
 */

import type { ReconciliationSummary } from "@/lib/subscriptions/application/reconcile-first-shipments";

/** Disables caching at every layer (browser, CDN, Next.js). */
export const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

/** Options for {@link jsonError}. */
type JsonErrorOptions = {
  /** HTTP status code. */
  status: number;
  /** When set, tells the sender whether redelivering may succeed. */
  retryable?: boolean;
  /** Extra response headers. */
  headers?: HeadersInit;
};

/**
 * Builds the standard error envelope `{ ok: false, retryable?, error }`.
 *
 * @param error - Stable, machine-readable error code (e.g. `"invalid_hmac"`).
 * @param options - Status, retryability and headers.
 * @returns A JSON `Response`.
 */
export function jsonError(error: string, { status, retryable, headers }: JsonErrorOptions): Response {
  return Response.json(
    { ok: false, ...(retryable === undefined ? {} : { retryable }), error },
    { status, ...(headers === undefined ? {} : { headers }) },
  );
}

/**
 * `401` for a missing or wrong bearer/URL token.
 *
 * @returns A JSON `Response`.
 */
export function unauthorizedResponse(): Response {
  return jsonError("unauthorized", { status: 401 });
}

/**
 * `503` for a required secret that is not configured on the server.
 *
 * @returns A JSON `Response`.
 */
export function notConfiguredResponse(): Response {
  return jsonError("not_configured", { status: 503 });
}

/**
 * Translates a reconciliation summary into a response: `200` when every
 * order succeeded, `503` otherwise so the caller retries.
 *
 * @param summary - Batch summary.
 * @returns A non-cacheable JSON `Response` containing `ok` and the summary counters.
 */
export function reconciliationSummaryResponse(summary: ReconciliationSummary): Response {
  return Response.json(
    { ok: summary.failed === 0, ...summary },
    { status: summary.failed === 0 ? 200 : 503, headers: NO_STORE_HEADERS },
  );
}

/**
 * `503` when the reconciliation could not run at all.
 *
 * @returns A non-cacheable JSON `Response`.
 */
export function reconciliationFailedResponse(): Response {
  return jsonError("reconciliation_failed", { status: 503, headers: NO_STORE_HEADERS });
}
