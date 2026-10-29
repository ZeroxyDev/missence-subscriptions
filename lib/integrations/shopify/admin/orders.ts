/**
 * @file Reading current order state from the Shopify Admin GraphQL API.
 *
 * Used by every reconciliation path (cron, Bigblue webhook, Shopify order
 * events) to compare Bigblue against Shopify's *current* truth rather than a
 * possibly stale webhook payload.
 *
 * @module lib/integrations/shopify/admin/orders
 */

import { PRODUCT_PAIRS } from "@/config/subscription-product-pairs";
import { ShopifyAdminOrdersError } from "@/lib/integrations/shopify/admin/errors";
import { postAdminGraphql } from "@/lib/integrations/shopify/admin/graphql-client";
import {
  parseReconciliationCandidate,
  type ReconciliationCandidate,
} from "@/lib/integrations/shopify/admin/order-mapper";
import {
  ORDER_BY_ID_QUERY,
  ORDERS_PAGE_SIZE,
  RECENT_ORDERS_QUERY,
} from "@/lib/integrations/shopify/admin/queries";
import { readArray, readObject } from "@/lib/integrations/shopify/admin/response-readers";

/** Hard pagination cap for the reconciliation search. */
const MAX_PAGES = 10;
/** How far back the reconciliation looks for first-shipment orders. */
const LOOKBACK_MS = 48 * 60 * 60 * 1_000;
/** Timeout for a single-order read (webhook path, tight budget). */
const SINGLE_ORDER_TIMEOUT_MS = 2_000;
/** Timeout per search page (cron path, relaxed budget). */
const SEARCH_PAGE_TIMEOUT_MS = 10_000;

/** Credentials and test hooks shared by the Admin readers. */
type AdminReaderOptions = {
  /** Admin API token with `read_orders`. */
  accessToken: string;
  /** Permanent `*.myshopify.com` hostname. */
  storeDomain: string;
  /** Injectable `fetch`, for tests. */
  fetchImplementation?: typeof fetch;
};

/**
 * Reads one order's current state.
 *
 * @param options - Order ID, credentials and optional `fetch`.
 * @returns The candidate, or `null` when the Admin API does not (yet) return it.
 * @throws {ShopifyAdminOrdersError} On an invalid ID, API failure, malformed
 *   response, or when Shopify returns a different order than requested.
 */
export async function getReconciliationCandidate({
  orderId,
  accessToken,
  storeDomain,
  fetchImplementation = fetch,
}: AdminReaderOptions & { orderId: number }): Promise<ReconciliationCandidate | null> {
  if (!Number.isSafeInteger(orderId) || orderId <= 0) {
    throw new ShopifyAdminOrdersError("Order ID is invalid");
  }
  const root = await postAdminGraphql({
    storeDomain,
    accessToken,
    query: ORDER_BY_ID_QUERY,
    variables: { id: `gid://shopify/Order/${orderId}` },
    timeoutMs: SINGLE_ORDER_TIMEOUT_MS,
    fetchImplementation,
  });
  const node = readObject(root.data, "response.data").order;
  if (node === null) return null;
  const candidate = parseReconciliationCandidate(node);
  // Defence in depth: never act on an order other than the one requested.
  if (candidate.order.id !== orderId) {
    throw new ShopifyAdminOrdersError("Shopify Admin returned a different order");
  }
  return candidate;
}

/**
 * Lists orders from the last 48 hours that contain any configured experience
 * SKU, newest first, de-duplicated by order ID.
 *
 * The search is a coarse server-side prefilter; the exact SKU + product +
 * variant match is still performed by the domain detector.
 *
 * @param options - Credentials, optional `fetch` and a clock override for tests.
 * @returns All matching candidates (at most `ORDERS_PAGE_SIZE × MAX_PAGES`).
 * @throws {ShopifyAdminOrdersError} On API failure, malformed response,
 *   invalid pagination, or when the result exceeds the pagination cap.
 */
export async function listRecentExperienceOrders({
  accessToken,
  storeDomain,
  fetchImplementation = fetch,
  now = new Date(),
}: AdminReaderOptions & { now?: Date }): Promise<ReconciliationCandidate[]> {
  const since = new Date(now.getTime() - LOOKBACK_MS).toISOString();
  const skuTerms = PRODUCT_PAIRS.map((pair) => `sku:"${pair.experience.sku}"`);
  const search = `created_at:>='${since}' (${skuTerms.join(" OR ")})`;
  const result: ReconciliationCandidate[] = [];
  const seen = new Set<number>();
  let after: string | null = null;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const root = await postAdminGraphql({
      storeDomain,
      accessToken,
      query: RECENT_ORDERS_QUERY,
      variables: { search, after },
      timeoutMs: SEARCH_PAGE_TIMEOUT_MS,
      fetchImplementation,
    });
    const orders = readObject(readObject(root.data, "response.data").orders, "response.data.orders");
    for (const node of readArray(orders.nodes, "response.data.orders.nodes")) {
      const candidate = parseReconciliationCandidate(node);
      if (!seen.has(candidate.order.id)) {
        seen.add(candidate.order.id);
        result.push(candidate);
      }
    }
    const pageInfo = readObject(orders.pageInfo, "response.data.orders.pageInfo");
    if (pageInfo.hasNextPage === false) {
      return result;
    }
    if (pageInfo.hasNextPage !== true || typeof pageInfo.endCursor !== "string" || !pageInfo.endCursor) {
      throw new ShopifyAdminOrdersError("Shopify Admin pagination is invalid");
    }
    after = pageInfo.endCursor;
  }

  throw new ShopifyAdminOrdersError(
    `Shopify Admin order search exceeded ${ORDERS_PAGE_SIZE * MAX_PAGES} orders`,
  );
}
