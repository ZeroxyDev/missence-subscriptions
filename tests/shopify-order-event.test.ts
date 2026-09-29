import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  InvalidShopifyOrderEventError,
  isShopifyOrderEventTopic,
  parseShopifyOrderEvent,
} from "@/lib/shopify/order-event";

describe("Shopify order update and edit events", () => {
  it("accepts only the two configured topics", () => {
    assert.equal(isShopifyOrderEventTopic("orders/updated"), true);
    assert.equal(isShopifyOrderEventTopic("orders/edited"), true);
    assert.equal(isShopifyOrderEventTopic("orders/create"), false);
    assert.equal(isShopifyOrderEventTopic("products/update"), false);
  });

  it("reads the order ID from each topic's distinct payload", () => {
    assert.equal(parseShopifyOrderEvent('{"id":8212568703303}', "orders/updated"), 8212568703303);
    assert.equal(parseShopifyOrderEvent('{"id":999,"order_edit":{"order_id":8212568703303}}', "orders/edited"), 8212568703303);
  });

  it("rejects malformed or ambiguous payloads", () => {
    assert.throws(() => parseShopifyOrderEvent("bad", "orders/updated"), InvalidShopifyOrderEventError);
    assert.throws(() => parseShopifyOrderEvent('{"id":"8212568703303"}', "orders/updated"), InvalidShopifyOrderEventError);
    assert.throws(() => parseShopifyOrderEvent('{"id":999}', "orders/edited"), InvalidShopifyOrderEventError);
    assert.throws(() => parseShopifyOrderEvent('{"order_edit":{"order_id":0}}', "orders/edited"), InvalidShopifyOrderEventError);
  });
});
