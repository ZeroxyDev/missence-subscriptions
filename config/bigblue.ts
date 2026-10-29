/**
 * @file Static Bigblue Store API configuration (no secrets).
 *
 * @module config/bigblue
 */

/** Bigblue Store API settings. */
export const BIGBLUE_CONFIG = {
  /** RPC-style base URL; the method name is appended as the last path segment. */
  storeApiBaseUrl: "https://api.bigblue.co/bigblue.storeapi.v1.PublicAPI",
  /** Default per-request timeout. Webhooks additionally pass a shared deadline. */
  defaultTimeoutMs: 2_000,
} as const;
