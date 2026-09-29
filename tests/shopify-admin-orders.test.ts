import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PRODUCT_PAIRS } from "@/config/subscription-product-pairs";
import {
  getReconciliationCandidate,
  listRecentExperienceOrders,
  parseReconciliationCandidate,
  ShopifyAdminOrdersError,
} from "@/lib/shopify/admin-orders";
import { detectFirstShipmentAdjustment } from "@/lib/subscriptions/first-shipment-adjustment";

const pair = PRODUCT_PAIRS[1];

function lineItem(
  id: number,
  product: { sku: string; productId: number; variantId: number | null },
  quantity: number,
  price: string,
  tax: string,
) {
  return {
    id: `gid://shopify/LineItem/${id}`,
    sku: product.sku,
    quantity,
    currentQuantity: quantity,
    product: { legacyResourceId: String(product.productId) },
    variant: { legacyResourceId: String(product.variantId) },
    originalUnitPriceSet: { shopMoney: { amount: price } },
    totalDiscountSet: { shopMoney: { amount: "0.00" } },
    taxLines: [{ priceSet: { shopMoney: { amount: tax } } }],
  };
}

function node() {
  return {
    legacyResourceId: "8212568703303",
    name: "#1046",
    currencyCode: "EUR",
    presentmentCurrencyCode: "EUR",
    createdAt: "2026-09-29T16:00:00Z",
    cancelledAt: null,
    edited: false,
    displayFulfillmentStatus: "UNFULFILLED",
    taxesIncluded: true,
    currentTotalPriceSet: {
      shopMoney: { amount: "197.00", currencyCode: "EUR" },
      presentmentMoney: { amount: "197.00", currencyCode: "EUR" },
    },
    lineItems: {
      pageInfo: { hasNextPage: false },
      nodes: [
        lineItem(1, pair.subscription, 2, "74.00", "13.45"),
        lineItem(2, pair.experience, 1, "49.00", "8.50"),
      ],
    },
  };
}

describe("Shopify Admin order reader", () => {
  it("maps GraphQL money and legacy IDs into the same adjustment as the webhook", () => {
    const candidate = parseReconciliationCandidate(node());
    const adjustment = detectFirstShipmentAdjustment(candidate.order);
    assert.equal(candidate.order.total_price, "197.00");
    assert.equal(candidate.order.currency, "EUR");
    assert.equal(candidate.order.presentment_currency, "EUR");
    assert.equal(candidate.order.presentment_total_price, "197.00");
    assert.equal(candidate.cancelled, false);
    assert.ok(adjustment.shouldAdjust);
    assert.equal(adjustment.targetQuantity, 1);
    assert.equal(adjustment.subscriptionPricing.unitPrice, "67.28");
    assert.equal(adjustment.experiencePricing.unitPrice, "107.77");
    assert.equal(adjustment.experiencePricing.unitTax, "15.22");
  });

  it("rejects truncated line items instead of adjusting from incomplete data", () => {
    const value = node();
    value.lineItems.pageInfo.hasNextPage = true;
    assert.throws(() => parseReconciliationCandidate(value), ShopifyAdminOrdersError);
  });

  it("uses current quantities, taxes and total after an order edit", () => {
    const value = node();
    value.edited = true;
    value.lineItems.nodes[0].currentQuantity = 1;
    value.currentTotalPriceSet.shopMoney.amount = "123.00";
    value.currentTotalPriceSet.presentmentMoney.amount = "123.00";
    const result = parseReconciliationCandidate(value);
    assert.equal(result.order.line_items[0].quantity, 1);
    assert.equal(result.order.line_items[0].tax_lines[0].price, "6.73");
    assert.equal(result.order.total_price, "123.00");
  });

  it("queries a bounded recent window for both experience SKUs and checks GraphQL errors", async () => {
    const requests: { url: string; body: { variables: { search: string } } }[] = [];
    const fetchImplementation: typeof fetch = async (input, init) => {
      requests.push({
        url: String(input),
        body: JSON.parse(String(init?.body)) as { variables: { search: string } },
      });
      return Response.json({
        data: {
          orders: {
            nodes: [node()],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      });
    };
    const result = await listRecentExperienceOrders({
      accessToken: "test-token",
      storeDomain: "example.myshopify.com",
      fetchImplementation,
      now: new Date("2026-09-29T16:30:00Z"),
    });

    assert.equal(result.length, 1);
    assert.match(requests[0].url, /admin\/api\/2026-07\/graphql\.json$/);
    assert.match(requests[0].body.variables.search, /created_at:>='2026-09-27T16:30:00.000Z'/);
    assert.match(requests[0].body.variables.search, /sku:"MISS-000000-0003-UP"/);
    assert.match(requests[0].body.variables.search, /sku:"MISS-000000-0004-UP"/);

    await assert.rejects(
      listRecentExperienceOrders({
        accessToken: "test-token",
        storeDomain: "example.myshopify.com",
        fetchImplementation: async () => Response.json({ errors: [{ message: "denied" }] }),
      }),
      ShopifyAdminOrdersError,
    );
  });

  it("fetches the current order by ID for update and edit events", async () => {
    const requests: { variables: { id: string }; query: string }[] = [];
    const fetchImplementation: typeof fetch = async (_input, init) => {
      requests.push(JSON.parse(String(init?.body)) as { variables: { id: string }; query: string });
      return Response.json({ data: { order: { ...node(), edited: true } } });
    };
    const result = await getReconciliationCandidate({
      orderId: 8212568703303,
      accessToken: "test-token",
      storeDomain: "example.myshopify.com",
      fetchImplementation,
    });
    assert.equal(requests[0].variables.id, "gid://shopify/Order/8212568703303");
    assert.match(requests[0].query, /order\(id: \$id\)/);
    assert.equal(result?.edited, true);
    assert.equal(result?.order.total_price, "197.00");

    await assert.rejects(
      getReconciliationCandidate({
        orderId: 123,
        accessToken: "test-token",
        storeDomain: "example.myshopify.com",
        fetchImplementation,
      }),
      /different order/,
    );
  });
});
