import { PRODUCT_PAIRS } from "@/config/subscription-product-pairs";
import { parseShopifyOrder, type ShopifyOrder } from "@/lib/shopify/order";

const ADMIN_API_VERSION = "2026-07";
const PAGE_SIZE = 10;
const MAX_PAGES = 10;
const LOOKBACK_MS = 48 * 60 * 60 * 1_000;

const ORDER_FIELDS = `
        legacyResourceId
        name
        currencyCode
        presentmentCurrencyCode
        createdAt
        cancelledAt
        edited
        displayFulfillmentStatus
        taxesIncluded
        currentTotalPriceSet {
          shopMoney { amount currencyCode }
          presentmentMoney { amount currencyCode }
        }
        lineItems(first: 10) {
          pageInfo { hasNextPage }
          nodes {
            id
            sku
            quantity
            currentQuantity
            product { legacyResourceId }
            variant { legacyResourceId }
            originalUnitPriceSet { shopMoney { amount } }
            totalDiscountSet { shopMoney { amount } }
            taxLines { priceSet { shopMoney { amount } } }
          }
        }
`;

const ORDERS_QUERY = `
  query RecentExperienceOrders($search: String!, $after: String) {
    orders(first: ${PAGE_SIZE}, after: $after, query: $search, sortKey: CREATED_AT, reverse: true) {
      nodes { ${ORDER_FIELDS} }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const ORDER_QUERY = `
  query ExperienceOrder($id: ID!) {
    order(id: $id) { ${ORDER_FIELDS} }
  }
`;

export type ReconciliationCandidate = {
  order: ShopifyOrder;
  cancelled: boolean;
  edited: boolean;
  fulfillmentStatus: string;
};

export class ShopifyAdminOrdersError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShopifyAdminOrdersError";
  }
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ShopifyAdminOrdersError(`${path} must be an object`);
  }
  return value as Record<string, unknown>;
}

function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new ShopifyAdminOrdersError(`${path} must be an array`);
  }
  return value;
}

function legacyId(value: unknown, path: string): number {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new ShopifyAdminOrdersError(`${path} is invalid`);
  }
  return id;
}

function optionalLegacyId(value: unknown, path: string): number | null {
  return value === null ? null : legacyId(record(value, path).legacyResourceId, path);
}

function money(value: unknown, path: string, field = "shopMoney"): string {
  const amount = record(record(value, path)[field], `${path}.${field}`).amount;
  if (typeof amount !== "string" || !/^\d+(?:\.\d{1,2})?$/.test(amount)) {
    throw new ShopifyAdminOrdersError(`${path}.amount is invalid`);
  }
  return amount;
}

function currentLineMoney(amount: string, currentQuantity: number, originalQuantity: number): string {
  if (originalQuantity === 0) return "0.00";
  const cents = Math.round(Number(amount) * 100);
  return (Math.round(cents * currentQuantity / originalQuantity) / 100).toFixed(2);
}

export function parseReconciliationCandidate(value: unknown): ReconciliationCandidate {
  const node = record(value, "order");
  const totalPriceSet = record(node.currentTotalPriceSet, "order.currentTotalPriceSet");
  if (
    record(totalPriceSet.shopMoney, "order.currentTotalPriceSet.shopMoney").currencyCode !== node.currencyCode ||
    record(totalPriceSet.presentmentMoney, "order.currentTotalPriceSet.presentmentMoney").currencyCode !== node.presentmentCurrencyCode
  ) {
    throw new ShopifyAdminOrdersError("Order total currencies are inconsistent");
  }
  const lineItems = record(node.lineItems, "order.lineItems");
  const lineItemsPageInfo = record(lineItems.pageInfo, "order.lineItems.pageInfo");
  if (lineItemsPageInfo.hasNextPage !== false) {
    throw new ShopifyAdminOrdersError("Order has more than 10 line items");
  }

  const order = parseShopifyOrder(JSON.stringify({
    id: legacyId(node.legacyResourceId, "order.legacyResourceId"),
    name: node.name,
    currency: node.currencyCode,
    presentment_currency: node.presentmentCurrencyCode,
    presentment_total_price: money(totalPriceSet, "order.currentTotalPriceSet", "presentmentMoney"),
    created_at: node.createdAt,
    taxes_included: node.taxesIncluded,
    total_price: money(totalPriceSet, "order.currentTotalPriceSet"),
    line_items: array(lineItems.nodes, "order.lineItems.nodes").map((rawItem, index) => {
      const item = record(rawItem, `order.lineItems[${index}]`);
      if (
        !Number.isSafeInteger(item.quantity) || !Number.isSafeInteger(item.currentQuantity) ||
        Number(item.quantity) < 0 || Number(item.currentQuantity) < 0 ||
        Number(item.currentQuantity) > Number(item.quantity)
      ) {
        throw new ShopifyAdminOrdersError(`order.lineItems[${index}].quantity is invalid`);
      }
      const originalQuantity = Number(item.quantity);
      const currentQuantity = Number(item.currentQuantity);
      const match = typeof item.id === "string"
        ? /^gid:\/\/shopify\/LineItem\/(\d+)$/.exec(item.id)
        : null;
      if (!match) {
        throw new ShopifyAdminOrdersError(`order.lineItems[${index}].id is invalid`);
      }
      return {
        id: legacyId(match[1], `order.lineItems[${index}].id`),
        product_id: optionalLegacyId(item.product, `order.lineItems[${index}].product`),
        variant_id: optionalLegacyId(item.variant, `order.lineItems[${index}].variant`),
        sku: item.sku,
        quantity: currentQuantity,
        price: money(item.originalUnitPriceSet, `order.lineItems[${index}].originalUnitPriceSet`),
        total_discount: currentLineMoney(
          money(item.totalDiscountSet, `order.lineItems[${index}].totalDiscountSet`),
          currentQuantity,
          originalQuantity,
        ),
        tax_lines: array(item.taxLines, `order.lineItems[${index}].taxLines`).map((taxLine, taxIndex) => ({
          price: currentLineMoney(
            money(record(taxLine, `order.lineItems[${index}].taxLines[${taxIndex}]`).priceSet,
              `order.lineItems[${index}].taxLines[${taxIndex}].priceSet`),
            currentQuantity,
            originalQuantity,
          ),
        })),
      };
    }),
  }));

  if (node.cancelledAt !== null && typeof node.cancelledAt !== "string") {
    throw new ShopifyAdminOrdersError("order.cancelledAt is invalid");
  }
  if (typeof node.edited !== "boolean" || typeof node.displayFulfillmentStatus !== "string") {
    throw new ShopifyAdminOrdersError("order status is invalid");
  }
  return {
    order,
    cancelled: node.cancelledAt !== null,
    edited: node.edited,
    fulfillmentStatus: node.displayFulfillmentStatus,
  };
}

export async function getReconciliationCandidate({
  orderId,
  accessToken,
  storeDomain,
  fetchImplementation = fetch,
}: {
  orderId: number;
  accessToken: string;
  storeDomain: string;
  fetchImplementation?: typeof fetch;
}): Promise<ReconciliationCandidate | null> {
  if (!Number.isSafeInteger(orderId) || orderId <= 0) {
    throw new ShopifyAdminOrdersError("Order ID is invalid");
  }
  const response = await fetchImplementation(
    `https://${storeDomain}/admin/api/${ADMIN_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({
        query: ORDER_QUERY,
        variables: { id: `gid://shopify/Order/${orderId}` },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(2_000),
    },
  );
  if (!response.ok) {
    throw new ShopifyAdminOrdersError(`Shopify Admin HTTP ${response.status}`);
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ShopifyAdminOrdersError("Shopify Admin returned invalid JSON");
  }
  const root = record(body, "response");
  if (Array.isArray(root.errors) && root.errors.length > 0) {
    throw new ShopifyAdminOrdersError("Shopify Admin GraphQL query failed");
  }
  const node = record(root.data, "response.data").order;
  if (node === null) return null;
  const candidate = parseReconciliationCandidate(node);
  if (candidate.order.id !== orderId) {
    throw new ShopifyAdminOrdersError("Shopify Admin returned a different order");
  }
  return candidate;
}

export async function listRecentExperienceOrders({
  accessToken,
  storeDomain,
  fetchImplementation = fetch,
  now = new Date(),
}: {
  accessToken: string;
  storeDomain: string;
  fetchImplementation?: typeof fetch;
  now?: Date;
}): Promise<ReconciliationCandidate[]> {
  const since = new Date(now.getTime() - LOOKBACK_MS).toISOString();
  const skuTerms = PRODUCT_PAIRS.map((pair) => `sku:"${pair.experience.sku}"`);
  const search = `created_at:>='${since}' (${skuTerms.join(" OR ")})`;
  const result: ReconciliationCandidate[] = [];
  const seen = new Set<number>();
  let after: string | null = null;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const response = await fetchImplementation(
      `https://${storeDomain}/admin/api/${ADMIN_API_VERSION}/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({ query: ORDERS_QUERY, variables: { search, after } }),
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      },
    );

    if (!response.ok) {
      throw new ShopifyAdminOrdersError(`Shopify Admin HTTP ${response.status}`);
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new ShopifyAdminOrdersError("Shopify Admin returned invalid JSON");
    }
    const root = record(body, "response");
    if (Array.isArray(root.errors) && root.errors.length > 0) {
      throw new ShopifyAdminOrdersError("Shopify Admin GraphQL query failed");
    }
    const orders = record(record(root.data, "response.data").orders, "response.data.orders");
    for (const node of array(orders.nodes, "response.data.orders.nodes")) {
      const candidate = parseReconciliationCandidate(node);
      if (!seen.has(candidate.order.id)) {
        seen.add(candidate.order.id);
        result.push(candidate);
      }
    }
    const pageInfo = record(orders.pageInfo, "response.data.orders.pageInfo");
    if (pageInfo.hasNextPage === false) {
      return result;
    }
    if (pageInfo.hasNextPage !== true || typeof pageInfo.endCursor !== "string" || !pageInfo.endCursor) {
      throw new ShopifyAdminOrdersError("Shopify Admin pagination is invalid");
    }
    after = pageInfo.endCursor;
  }

  throw new ShopifyAdminOrdersError("Shopify Admin order search exceeded 100 orders");
}
