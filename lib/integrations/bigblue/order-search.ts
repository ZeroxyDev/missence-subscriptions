/**
 * @file Locating the Bigblue copy of a Shopify order.
 *
 * Bigblue has no "get by external ID" endpoint, so the order is found by
 * listing a narrow creation-time window around the Shopify `created_at` and
 * matching `external_id` client-side.
 *
 * @module lib/integrations/bigblue/order-search
 */

import { formatBigblueDateTime } from "@/lib/integrations/bigblue/datetime";
import {
  BigblueApiError,
  BigblueOrderNotReadyError,
  InvalidBigblueResponseError,
} from "@/lib/integrations/bigblue/errors";
import {
  parseBigblueListOrdersResponse,
  parseBigblueOrder,
} from "@/lib/integrations/bigblue/parsers";
import type {
  BigblueOrder,
  BigblueRequest,
  ListOrdersRequest,
} from "@/lib/integrations/bigblue/types";
import { isRecord } from "@/lib/shared/guards";
import { sleep as defaultSleep } from "@/lib/shared/async";

/** Half-width of the search window around the Shopify creation time. */
const ORDER_SEARCH_WINDOW_MS = 60 * 60 * 1_000;
/** Maximum page size accepted by `ListOrders`. */
const LIST_ORDERS_PAGE_SIZE = 100;
/** Hard pagination cap: protects against a server returning endless cursors. */
const MAX_LIST_ORDER_PAGES = 20;
/** Upper bound for honouring a server-sent `Retry-After`. */
const MAX_RETRY_AFTER_MS = 8_000;
/** Default back-off schedule for {@link findBigblueOrderWithRetry}. */
const DEFAULT_RETRY_DELAYS_MS = [0, 1_000, 2_000, 4_000, 8_000] as const;

/**
 * Builds a ±1 hour `ListOrders` window around an ISO timestamp.
 *
 * @param createdAt - Shopify order `created_at`.
 * @returns The `date_range` for `ListOrders`.
 */
function getDateRange(createdAt: string): ListOrdersRequest["date_range"] {
  const createdAtMs = Date.parse(createdAt);

  return {
    from: formatBigblueDateTime(new Date(createdAtMs - ORDER_SEARCH_WINDOW_MS)),
    to: formatBigblueDateTime(new Date(createdAtMs + ORDER_SEARCH_WINDOW_MS)),
  };
}

/**
 * Finds the Bigblue order whose `external_id` matches any of the given
 * Shopify references.
 *
 * Several references are accepted because Bigblue currently stores the
 * visible Shopify order name (`"#1047"`) but may store the numeric ID if the
 * store integration is reconfigured. Matching is done on string form.
 *
 * @param request - Bigblue RPC function.
 * @param externalIds - One or more candidate `external_id` values.
 * @param createdAt - Shopify `created_at`, used to bound the search window.
 * @returns The first matching order, or `null` if Bigblue does not have it yet.
 * @throws {BigblueApiError} On transport or HTTP failure.
 * @throws {InvalidBigblueResponseError} On a malformed response or when the
 *   pagination safety cap is exceeded.
 */
export async function findBigblueOrder(
  request: BigblueRequest,
  externalIds: string | readonly string[],
  createdAt: string,
): Promise<BigblueOrder | null> {
  const dateRange = getDateRange(createdAt);
  const expectedExternalIds = new Set(
    (typeof externalIds === "string" ? [externalIds] : externalIds).map(String),
  );
  let pageToken = "";

  for (let page = 0; page < MAX_LIST_ORDER_PAGES; page += 1) {
    const rawResponse = await request<ListOrdersRequest, unknown>("ListOrders", {
      date_range: dateRange,
      page_token: pageToken,
      page_size: LIST_ORDERS_PAGE_SIZE,
    });
    const response = parseBigblueListOrdersResponse(rawResponse);

    for (const rawOrder of response.orders) {
      if (
        isRecord(rawOrder) &&
        expectedExternalIds.has(String(rawOrder.external_id))
      ) {
        return parseBigblueOrder(rawOrder);
      }
    }

    if (!response.next_page_token) {
      return null;
    }

    pageToken = response.next_page_token;
  }

  throw new InvalidBigblueResponseError(
    "Bigblue ListOrders exceeded the pagination safety limit",
  );
}

/** Options for {@link findBigblueOrderWithRetry}. */
type FindWithRetryOptions = {
  /** Wait before each attempt; the array length is the attempt count. */
  delaysMs?: readonly number[];
  /** Injectable sleep, for tests. */
  sleep?: (milliseconds: number) => Promise<void>;
};

/**
 * {@link findBigblueOrder} with bounded back-off for orders that Bigblue has
 * not imported yet and for retryable API errors.
 *
 * Not used by the webhook routes, which must answer within Shopify's 5-second
 * limit and instead rely on Shopify redelivery plus the reconciliation cron.
 * Kept as a reusable primitive for longer-running callers.
 *
 * @param request - Bigblue RPC function.
 * @param externalIds - One or more candidate `external_id` values.
 * @param createdAt - Shopify `created_at`.
 * @param options - Back-off schedule and injectable sleep.
 * @returns The matching order.
 * @throws {BigblueOrderNotReadyError} When every attempt finds nothing.
 * @throws {BigblueApiError} Immediately on a non-retryable API error.
 */
export async function findBigblueOrderWithRetry(
  request: BigblueRequest,
  externalIds: string | readonly string[],
  createdAt: string,
  {
    delaysMs = DEFAULT_RETRY_DELAYS_MS,
    sleep = defaultSleep,
  }: FindWithRetryOptions = {},
): Promise<BigblueOrder> {
  let retryAfterMs = 0;

  for (const delayMs of delaysMs) {
    // Honour the larger of our schedule and the server's Retry-After hint.
    await sleep(Math.max(delayMs, retryAfterMs));
    retryAfterMs = 0;

    try {
      const order = await findBigblueOrder(
        request,
        externalIds,
        createdAt,
      );

      if (order) {
        return order;
      }
    } catch (error) {
      if (!(error instanceof BigblueApiError) || !error.retryable) {
        throw error;
      }

      retryAfterMs = Math.min(error.retryAfterMs ?? 0, MAX_RETRY_AFTER_MS);
    }
  }

  throw new BigblueOrderNotReadyError(
    typeof externalIds === "string" ? [externalIds] : externalIds,
  );
}
