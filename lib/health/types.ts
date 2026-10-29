/**
 * @file Public contract of `GET /api/health`.
 *
 * Shared by the server check and the client status widget. Contains no
 * secrets: `detail` strings are user-facing (Spanish) and never include
 * credentials or raw upstream errors.
 *
 * @module lib/health/types
 */

/** Result of one integration check. */
export type IntegrationCheck = {
  /** Stable check identifier, used as React key. */
  id: "bigblue" | "shopify" | "products";
  /** Display name. */
  label: string;
  status: "ok" | "error";
  /** Human-readable explanation shown in the status tooltip. */
  detail: string;
};

/** Aggregated health report. */
export type IntegrationHealth = {
  /** `"ok"` only when every check is `"ok"`. */
  status: "ok" | "error";
  /** ISO timestamp of when the checks ran (may be up to 30 s old: cached). */
  checkedAt: string;
  checks: IntegrationCheck[];
};
