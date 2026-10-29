/**
 * @file Fake Shopify Admin and Bigblue upstreams shared by the reconciliation route tests.
 *
 * Provides a realistic first-shipment order as both an Admin GraphQL node and
 * its reverted Bigblue copy, plus a `fetch` router that serves them.
 */

import assert from "node:assert/strict";

import { PRODUCT_PAIRS } from "@/config/subscription-product-pairs";
import { calculateBigblueTotalCents } from "@/lib/integrations/bigblue/order-totals";
import type { BigblueOrder } from "@/lib/integrations/bigblue/types";
import { jsonResponse, TEST_ENV, type RouteHarness } from "@/tests/support/route-harness";

export const pair = PRODUCT_PAIRS[0];
export const ORDER_ID = 8212592460103;
export const ADMIN_URL = `https://${TEST_ENV.SHOPIFY_ADMIN_STORE_DOMAIN}/admin/api/2026-07/graphql.json`;

/** Shopify Admin GraphQL order node for a 2× subscription + 1× experience order. */
export function adminOrderNode(overrides: Record<string, unknown> = {}) {
  const lineItem = (
    id: number,
    product: { sku: string; productId: number; variantId: number | null },
    quantity: number,
    price: string,
    tax: string,
  ) => ({
    id: `gid://shopify/LineItem/${id}`,
    sku: product.sku,
    quantity,
    currentQuantity: quantity,
    product: { legacyResourceId: String(product.productId) },
    variant: { legacyResourceId: String(product.variantId) },
    originalUnitPriceSet: { shopMoney: { amount: price } },
    totalDiscountSet: { shopMoney: { amount: "0.00" } },
    taxLines: [{ priceSet: { shopMoney: { amount: tax } } }],
  });
  return {
    legacyResourceId: String(ORDER_ID),
    name: "#1048",
    currencyCode: "EUR",
    presentmentCurrencyCode: "EUR",
    createdAt: "2026-09-29T16:00:00Z",
    cancelledAt: null,
    edited: false,
    displayFulfillmentStatus: "UNFULFILLED",
    taxesIncluded: true,
    currentTotalPriceSet: {
      shopMoney: { amount: "157.00", currencyCode: "EUR" },
      presentmentMoney: { amount: "157.00", currencyCode: "EUR" },
    },
    lineItems: {
      pageInfo: { hasNextPage: false },
      nodes: [
        lineItem(1, pair.subscription, 2, "54.00", "9.82"),
        lineItem(2, pair.experience, 1, "49.00", "8.50"),
      ],
    },
    ...overrides,
  };
}

/** Bigblue copy of {@link adminOrderNode} reverted to the unadjusted quantities. */
export function revertedBigblueOrder(): BigblueOrder {
  const order: BigblueOrder = {
    id: "MISSS1001048",
    external_id: "#1048",
    status: { code: "PENDING" },
    currency: "EUR",
    additional_tax: "0",
    line_items: [
      { product: pair.subscription.sku, quantity: 2, unit_price: "49.09", unit_tax: "4.91", discount: "0" },
      { product: pair.experience.replacement.sku, quantity: 1, unit_price: "40.50", unit_tax: "8.50", discount: "0" },
    ],
  };
  return { ...order, total: (calculateBigblueTotalCents(order)! / 100).toFixed(2) };
}

/**
 * Routes outbound calls to a fake Shopify Admin API and a fake Bigblue API.
 *
 * @param admin - Response body (or HTTP status) for every Admin GraphQL call.
 * @param bigblue - Initial Bigblue order, `null` when not yet imported, or an HTTP status to fail with.
 */
export function fakeUpstreams(harness: RouteHarness, admin: unknown, bigblue: BigblueOrder | null | number) {
  let current = typeof bigblue === "object" && bigblue !== null ? structuredClone(bigblue) : null;
  let writes = 0;
  harness.routeFetch((url, init) => {
    if (url.href === ADMIN_URL) {
      return typeof admin === "number" ? jsonResponse({}, admin) : jsonResponse(admin);
    }
    if (typeof bigblue === "number") return jsonResponse({ code: "unavailable" }, bigblue);
    const method = url.pathname.split("/").at(-1);
    if (method === "ListOrders") return jsonResponse({ orders: current ? [current] : [] });
    assert.equal(method, "UpdateOrder");
    writes += 1;
    const next = { ...JSON.parse(String(init?.body)).order, status: { code: "PENDING" } } as BigblueOrder;
    current = { ...next, total: (calculateBigblueTotalCents(next)! / 100).toFixed(2) };
    return jsonResponse({});
  });
  return { writes: () => writes, current: () => current };
}

export const singleOrder = (node: unknown) => ({ data: { order: node } });
export const orderList = (nodes: unknown[]) => ({
  data: { orders: { nodes, pageInfo: { hasNextPage: false, endCursor: null } } },
});
export const EMPTY_SUMMARY = { scanned: 0, matched: 0, updated: 0, alreadyAdjusted: 0, skipped: 0, failed: 0 };
