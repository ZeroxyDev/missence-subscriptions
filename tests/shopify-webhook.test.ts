import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";

import { parseShopifyOrder } from "@/lib/shopify/order";
import { verifyShopifyWebhook } from "@/lib/shopify/verify-webhook";

describe("verifyShopifyWebhook", () => {
  it("accepts a valid raw-body signature", () => {
    const body = '{"id":123}';
    const secret = "test-secret";
    const hmac = createHmac("sha256", secret)
      .update(body, "utf8")
      .digest("base64");

    assert.equal(verifyShopifyWebhook(body, hmac, secret), true);
  });

  it("rejects missing and invalid signatures", () => {
    assert.equal(verifyShopifyWebhook("{}", null, "secret"), false);
    assert.equal(verifyShopifyWebhook("{}", "invalid", "secret"), false);
  });
});

describe("parseShopifyOrder", () => {
  it("parses the validated webhook subset", () => {
    const order = parseShopifyOrder(
      JSON.stringify({
        id: 123,
        name: "#1001",
        total_price: "48.00",
        created_at: "2026-09-09T10:00:00Z",
        line_items: [
          {
            id: 1,
            product_id: 10791019643207,
            variant_id: 53887845564743,
            sku: "MISS-000000-0002",
            quantity: 2,
            price: "25.00",
            total_discount: "2.00",
            tax_lines: [{ price: "4.20" }],
          },
        ],
      }),
    );

    assert.equal(order.id, 123);
    assert.equal(order.total_price, "48.00");
    assert.equal(order.line_items[0]?.product_id, 10791019643207);
    assert.equal(order.line_items[0]?.quantity, 2);
    assert.equal(order.line_items[0]?.price, "25.00");
    assert.equal(order.line_items[0]?.total_discount, "2.00");
    assert.deepEqual(order.line_items[0]?.tax_lines, [{ price: "4.20" }]);
  });

  it("rejects malformed payloads", () => {
    assert.throws(() => parseShopifyOrder("not-json"));
    assert.throws(() =>
      parseShopifyOrder(
        JSON.stringify({
          id: 123,
          created_at: "invalid",
          line_items: [],
        }),
      ),
    );
  });
});
