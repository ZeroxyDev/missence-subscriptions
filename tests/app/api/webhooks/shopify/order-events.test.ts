import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { POST as orderEventsPost } from "@/app/api/webhooks/shopify/order-events/route";
import {
  readResponse,
  signWebhook,
  TEST_ENV,
  useRouteHarness,
} from "@/tests/support/route-harness";
import {
  EMPTY_SUMMARY,
  ORDER_ID,
  adminOrderNode,
  fakeUpstreams,
  revertedBigblueOrder,
  singleOrder,
} from "@/tests/support/upstream-fakes";

describe("POST /api/webhooks/shopify/order-events", () => {
  const harness = useRouteHarness();

  function request(payload: unknown, headers: Record<string, string> = {}): Request {
    const body = JSON.stringify(payload);
    return new Request("https://app.test/api/webhooks/shopify/order-events", {
      method: "POST",
      body,
      headers: {
        "x-shopify-hmac-sha256": signWebhook(body, TEST_ENV.SHOPIFY_WEBHOOK_SECRET),
        "x-shopify-topic": "orders/updated",
        "x-shopify-shop-domain": TEST_ENV.SHOPIFY_ADMIN_STORE_DOMAIN,
        "x-shopify-webhook-id": "webhook-2",
        ...headers,
      },
    });
  }

  it("rejects an invalid HMAC with 401", async () => {
    const result = await readResponse(await orderEventsPost(request({ id: ORDER_ID }, { "x-shopify-hmac-sha256": "bad" })));
    assert.deepEqual(result, { status: 401, body: { ok: false, error: "invalid_hmac" }, cacheControl: null });
    assert.deepEqual(harness.events(), [["warn", "invalid_shopify_hmac"]]);
  });

  it("rejects an unsupported topic with 400", async () => {
    const result = await readResponse(await orderEventsPost(request({ id: ORDER_ID }, { "x-shopify-topic": "orders/create" })));
    assert.deepEqual(result, { status: 400, body: { ok: false, error: "invalid_topic" }, cacheControl: null });
    assert.deepEqual(harness.events(), [["warn", "invalid_shopify_topic"]]);
  });

  it("rejects a delivery from another shop with 401", async () => {
    const result = await readResponse(
      await orderEventsPost(request({ id: ORDER_ID }, { "x-shopify-shop-domain": "other.myshopify.com" })),
    );
    assert.deepEqual(result, { status: 401, body: { ok: false, error: "invalid_shop_domain" }, cacheControl: null });
    assert.deepEqual(harness.events(), [["warn", "invalid_shopify_payload"]]);
  });

  it("rejects a payload without a valid order id with 400", async () => {
    const result = await readResponse(await orderEventsPost(request({ id: "x" })));
    assert.deepEqual(result, { status: 400, body: { ok: false, error: "invalid_payload" }, cacheControl: null });
    assert.deepEqual(harness.events(), [["warn", "invalid_shopify_payload"]]);
  });

  it("returns 503 while the order is not yet visible in the Admin API", async () => {
    fakeUpstreams(harness, singleOrder(null), null);
    const result = await readResponse(await orderEventsPost(request({ id: ORDER_ID })));
    assert.deepEqual(result, {
      status: 503,
      body: { ok: false, retryable: true, error: "reconciliation_failed" },
      cacheControl: null,
    });
    assert.deepEqual(harness.events(), [["info", "shopify_order_event_received"], ["error", "reconciliation_failed"]]);
    assert.equal(harness.logs[1].payload.reason, "Error");
  });

  it("skips cancelled orders without touching Bigblue", async () => {
    fakeUpstreams(harness, singleOrder(adminOrderNode({ cancelledAt: "2026-09-29T17:00:00Z" })), null);
    const result = await readResponse(await orderEventsPost(request({ id: ORDER_ID })));
    assert.deepEqual(result, { status: 200, body: { ok: true, skipped: true, reason: "cancelled" }, cacheControl: null });
    assert.deepEqual(harness.events(), [["info", "shopify_order_event_received"], ["warn", "reconciliation_skipped"]]);
  });

  it("flags edited orders that no longer match a pair for manual review", async () => {
    const node = adminOrderNode({ edited: true });
    node.lineItems.nodes = [node.lineItems.nodes[0]];
    fakeUpstreams(harness, singleOrder(node), null);
    const result = await readResponse(
      await orderEventsPost(request({ order_edit: { order_id: ORDER_ID } }, { "x-shopify-topic": "orders/edited" })),
    );
    assert.deepEqual(result, {
      status: 200,
      body: { ok: true, skipped: true, reason: "no_matching_pair", manualReview: true },
      cacheControl: null,
    });
    assert.deepEqual(harness.events(), [["info", "shopify_order_event_received"], ["error", "manual_review_required"]]);
  });

  it("repairs a reverted Bigblue order", async () => {
    const upstream = fakeUpstreams(harness, singleOrder(adminOrderNode()), revertedBigblueOrder());
    const result = await readResponse(await orderEventsPost(request({ id: ORDER_ID })));
    assert.deepEqual(result, {
      status: 200,
      body: { ok: true, ...EMPTY_SUMMARY, scanned: 1, matched: 1, updated: 1 },
      cacheControl: null,
    });
    assert.equal(upstream.writes(), 1);
    assert.deepEqual(harness.events(), [
      ["info", "shopify_order_event_received"],
      ["info", "bigblue_order_found"],
      ["info", "adjustment_planned"],
      ["info", "update_verified"],
      ["info", "price_verified"],
      ["info", "updated"],
      ["info", "reconciliation_finished"],
    ]);
  });

  it("asks Shopify to retry when Bigblue has not imported the order", async () => {
    fakeUpstreams(harness, singleOrder(adminOrderNode()), null);
    const result = await readResponse(await orderEventsPost(request({ id: ORDER_ID })));
    assert.deepEqual(result, {
      status: 503,
      body: { ok: false, retryable: true, error: "reconciliation_failed" },
      cacheControl: null,
    });
    assert.deepEqual(harness.events(), [
      ["info", "shopify_order_event_received"],
      ["error", "reconciliation_failed"],
      ["info", "reconciliation_finished"],
    ]);
  });
});
