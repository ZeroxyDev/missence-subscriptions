/**
 * @file Minimal, dependency-free HTTP client for the Bigblue Store API.
 *
 * Responsibilities:
 * - Authenticate every call with the API key as a bearer token.
 * - Enforce a per-request timeout *and* an optional absolute deadline shared
 *   by all calls of one webhook delivery (Shopify requires a reply within 5 s).
 * - Normalise every failure into a {@link BigblueApiError} with an explicit
 *   `retryable` flag, so callers never need to inspect raw `fetch` errors.
 *
 * It intentionally does not validate response bodies; that is the job of
 * `parsers.ts`, which turns `unknown` into typed objects.
 *
 * @module lib/integrations/bigblue/client
 */

import { BIGBLUE_CONFIG } from "@/config/bigblue";
import { BigblueApiError } from "@/lib/integrations/bigblue/errors";
import type { BigblueRequest } from "@/lib/integrations/bigblue/types";
import { isRecord } from "@/lib/shared/guards";

/** Construction options for {@link createBigblueClient}. */
type BigblueClientOptions = {
  /** Bigblue Store API key, sent as `Authorization: Bearer <apiKey>`. */
  apiKey: string;
  /** Override for tests; defaults to the production Store API. */
  baseUrl?: string;
  /**
   * Absolute epoch-ms deadline. Each request is capped at the remaining time,
   * so a sequence of calls can never exceed the caller's budget.
   */
  deadlineAtMs?: number;
  /** Injectable `fetch`, for tests. Resolved at call time, not import time. */
  fetchImplementation?: typeof fetch;
  /** Per-request timeout in milliseconds. */
  timeoutMs?: number;
};

/**
 * Parses an HTTP `Retry-After` header (delta-seconds or HTTP-date).
 *
 * @param value - Raw header value.
 * @returns Delay in milliseconds (never negative), or `null` when absent or invalid.
 */
function parseRetryAfter(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1_000;
  }

  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(date - Date.now(), 0);
}

/**
 * Extracts Bigblue's error `code` and message (`msg` or `message`) from an
 * error body of unknown shape.
 *
 * @param value - Parsed JSON error body.
 * @returns The code and message when present, otherwise `null`s.
 */
function getApiErrorDetails(value: unknown): {
  code: string | null;
  message: string | null;
} {
  if (!isRecord(value)) {
    return { code: null, message: null };
  }

  return {
    code: typeof value.code === "string" ? value.code : null,
    message:
      typeof value.msg === "string"
        ? value.msg
        : typeof value.message === "string"
          ? value.message
          : null,
  };
}

/**
 * Creates a Bigblue RPC function bound to one API key and time budget.
 *
 * Retryability rules:
 * - HTTP `408`, `429` and `5xx` → retryable.
 * - Invalid JSON with `429`/`5xx` → retryable; otherwise permanent.
 * - Timeout, exhausted deadline or network failure → retryable.
 * - Any other non-2xx → permanent.
 *
 * @param options - API key, time budget and test overrides.
 * @returns A {@link BigblueRequest} that POSTs JSON to `<baseUrl>/<method>`.
 *
 * @example
 * ```ts
 * const request = createBigblueClient({ apiKey, deadlineAtMs: Date.now() + 4_000 });
 * const raw = await request<ListOrdersRequest, unknown>("ListOrders", payload);
 * ```
 */
export function createBigblueClient({
  apiKey,
  baseUrl = BIGBLUE_CONFIG.storeApiBaseUrl,
  deadlineAtMs,
  fetchImplementation = fetch,
  timeoutMs = BIGBLUE_CONFIG.defaultTimeoutMs,
}: BigblueClientOptions): BigblueRequest {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");

  return async function bigblueRequest<TRequest, TResponse>(
    method: string,
    payload: TRequest,
  ): Promise<TResponse> {
    // Cap the per-request timeout by whatever is left of the shared deadline.
    const remainingMs = deadlineAtMs === undefined
      ? timeoutMs
      : Math.min(timeoutMs, deadlineAtMs - Date.now());
    if (remainingMs <= 0) {
      throw new BigblueApiError("Bigblue request deadline exceeded", null, "timeout", true);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), remainingMs);

    try {
      const response = await fetchImplementation(`${normalizedBaseUrl}/${method}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        cache: "no-store",
        signal: controller.signal,
      });

      const responseText = await response.text();
      let responseBody: unknown = null;

      if (responseText) {
        try {
          responseBody = JSON.parse(responseText);
        } catch {
          throw new BigblueApiError(
            "Bigblue returned invalid JSON",
            response.status,
            null,
            response.status === 429 || response.status >= 500,
          );
        }
      }

      if (!response.ok) {
        const details = getApiErrorDetails(responseBody);
        throw new BigblueApiError(
          details.message ?? `Bigblue request failed with HTTP ${response.status}`,
          response.status,
          details.code,
          response.status === 408 ||
            response.status === 429 ||
            response.status >= 500,
          parseRetryAfter(response.headers.get("retry-after")),
        );
      }

      return responseBody as TResponse;
    } catch (error) {
      if (error instanceof BigblueApiError) {
        throw error;
      }

      if (controller.signal.aborted) {
        throw new BigblueApiError(
          "Bigblue request timed out",
          null,
          "timeout",
          true,
        );
      }

      throw new BigblueApiError(
        "Bigblue network request failed",
        null,
        "network_error",
        true,
      );
    } finally {
      clearTimeout(timeout);
    }
  };
}
