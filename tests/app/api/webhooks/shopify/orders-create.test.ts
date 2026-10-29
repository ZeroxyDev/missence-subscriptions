import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { POST } from "@/app/api/webhooks/shopify/orders-create/route";
import { PRODUCT_PAIRS } from "@/config/subscription-product-pairs";
import { calculateBigblueTotalCents } from "@/lib/integrations/bigblue/order-totals";
import type { BigblueOrder } from "@/lib/integrations/bigblue/types";
import {
  jsonResponse,
  readResponse,
  signWebhook,
  TEST_ENV,
  useRouteHarness,
} from "@/tests/support/route-harness";

const pair = PRODUCT_PAIRS[0];
const ENDPOINT = "https://app.test/api/webhooks/shopify/orders-create";

/** Shopify `orders/create` payload for a first shipment (1 subscription + 1 experience). */
function shopifyPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: 8212586266951,
    name: "#1047",
    created_at: "2026-09-28T16:54:30Z",
    taxes_included: true,
    total_price: "106.00",
    line_items: [
      {
        id: 1,
        sku: pair.subscription.sku,
        product_id: pair.subscription.productId,
        variant_id: pair.subscription.variantId,
        quantity: 1,
        price: "57.00",
        total_discount: "0.00",
        tax_lines: [{ price: "5.18" }],
      },
      {
        id: 2,
        sku: pair.experience.sku,
        product_id: pair.experience.productId,
        variant_id: pair.experience.variantId,
        quantity: 1,
        price: "49.00",
        total_discount: "0.00",
        tax_lines: [{ price: "8.50" }],
      },
    ],
    ...overrides,
  };
}

/** Bigblue's logistics copy of the same order before any adjustment. */
function unadjustedBigblueOrder(): BigblueOrder {
  const order: BigblueOrder = {
    id: "MISSS1001047",
    external_id: "#1047",
    additional_tax: "0",
    status: { code: "PENDING" },
    line_items: [
      { product: pair.subscription.sku, quantity: 1, unit_price: "51.82", unit_tax: "5.18", discount: "0" },
      { product: pair.experience.replacement.sku, quantity: 1, unit_price: "40.50", unit_tax: "8.50", discount: "0" },
    ],
  };
  return { ...order, total: (calculateBigblueTotalCents(order)! / 100).toFixed(2) };
}

function request(body: string, headers: Record<string, string | null> = {}): Request {
  const allHeaders: Record<string, string> = {};
  const defaults: Record<string, string | null> = {
    "x-shopify-hmac-sha256": signWebhook(body, TEST_ENV.SHOPIFY_WEBHOOK_SECRET),
    "x-shopify-topic": "orders/create",
    "x-shopify-webhook-id": "webhook-1",
    ...headers,
  };
  for (const [name, value] of Object.entries(defaults)) {
    if (value !== null) allHeaders[name] = value;
  }
  return new Request(ENDPOINT, { method: "POST", body, headers: allHeaders });
}

describe("POST /api/webhooks/shopify/orders-create", () => {
  const harness = useRouteHarness();

  /** Serves ListOrders/UpdateOrder from an in-memory Bigblue order. */
  /**
   * Serves ListOrders/UpdateOrder from an in-memory Bigblue order.
   *
   * `onUpdate` simulates Bigblue misbehaving after accepting a write:
   * `"drop"` keeps the original order, `"wrongTotal"` persists the lines but
   * reports a total one cent off.
   */
  function fakeBigblue(
    initial: BigblueOrder | null,
    failWith?: { status: number; body?: unknown },
    onUpdate: "persist" | "drop" | "wrongTotal" = "persist",
  ) {
    let current = initial === null ? null : structuredClone(initial);
    harness.routeFetch((url, init) => {
      const method = url.pathname.split("/").at(-1);
      if (failWith) return jsonResponse(failWith.body ?? {}, failWith.status);
      if (method === "ListOrders") return jsonResponse({ orders: current ? [current] : [] });
      assert.equal(method, "UpdateOrder");
      if (onUpdate === "drop") return jsonResponse({});
      const update = JSON.parse(String(init?.body)) as { order: BigblueOrder };
      const next = { ...update.order, status: { code: "PENDING" } } as BigblueOrder;
      const totalCents = calculateBigblueTotalCents(next)! + (onUpdate === "wrongTotal" ? 1 : 0);
      current = { ...next, total: (totalCents / 100).toFixed(2) };
      return jsonResponse({});
    });
    return () => current;
  }

  it("rejects an invalid HMAC with 401 before parsing", async () => {
    const result = await readResponse(await POST(request("{}", { "x-shopify-hmac-sha256": "bad" })));
    assert.deepEqual(result, { status: 401, body: { ok: false, error: "invalid_hmac" }, cacheControl: null });
    assert.deepEqual(harness.events(), [["warn", "invalid_shopify_hmac"]]);
  });

  it("rejects an unexpected topic with 400", async () => {
    const body = JSON.stringify(shopifyPayload());
    const result = await readResponse(await POST(request(body, { "x-shopify-topic": "orders/updated" })));
    assert.deepEqual(result, { status: 400, body: { ok: false, error: "invalid_topic" }, cacheControl: null });
    assert.deepEqual(harness.events(), [["warn", "invalid_shopify_topic"]]);
  });

  it("rejects a malformed order payload with 400", async () => {
    const body = JSON.stringify({ id: "not-a-number" });
    const result = await readResponse(await POST(request(body)));
    assert.deepEqual(result, { status: 400, body: { ok: false, error: "invalid_shopify_payload" }, cacheControl: null });
    assert.deepEqual(harness.events(), [["warn", "invalid_shopify_payload"]]);
  });

  it("ignores orders without a configured pair", async () => {
    const payload = shopifyPayload();
    const body = JSON.stringify({ ...payload, line_items: [payload.line_items[0]] });
    const result = await readResponse(await POST(request(body)));
    assert.deepEqual(result, {
      status: 200,
      body: { ok: true, ignored: true, reason: "no_matching_pair" },
      cacheControl: null,
    });
    assert.deepEqual(harness.events(), [["info", "ignored_no_pair"]]);
    assert.equal(harness.requests.length, 0);
  });

  it("returns 500 when the webhook secret is not configured", async () => {
    delete process.env.SHOPIFY_WEBHOOK_SECRET;
    const result = await readResponse(await POST(request("{}")));
    assert.deepEqual(result, {
      status: 500,
      body: { ok: false, retryable: true, error: "internal_error" },
      cacheControl: null,
    });
    assert.deepEqual(harness.events(), [["error", "update_failed"]]);
  });

  it("updates Bigblue and verifies the persisted order", async () => {
    const current = fakeBigblue(unadjustedBigblueOrder());
    const result = await readResponse(await POST(request(JSON.stringify(shopifyPayload()))));

    assert.deepEqual(result, {
      status: 200,
      body: {
        ok: true,
        updated: true,
        shopifyOrderId: "8212586266951",
        bigblueOrderId: "MISSS1001047",
        previousQuantity: 1,
        targetQuantity: 0,
      },
      cacheControl: null,
    });
    assert.deepEqual(harness.events(), [
      ["info", "adjustment_detected"],
      ["info", "bigblue_order_found"],
      ["info", "adjustment_planned"],
      ["info", "update_verified"],
      ["info", "price_verified"],
      ["info", "updated"],
    ]);
    assert.deepEqual(
      harness.requests.map((entry) => entry.url.pathname.split("/").at(-1)),
      ["ListOrders", "UpdateOrder", "ListOrders"],
    );
    assert.equal(current()?.total, "106.00");
    assert.equal(
      harness.requests[0].url.href,
      "https://api.bigblue.co/bigblue.storeapi.v1.PublicAPI/ListOrders",
    );
  });

  it("is idempotent once Bigblue already holds the target state", async () => {
    const current = fakeBigblue(unadjustedBigblueOrder());
    await POST(request(JSON.stringify(shopifyPayload())));
    const adjusted = current()!;
    harness.logs.length = 0;
    harness.requests.length = 0;
    fakeBigblue(adjusted);

    const result = await readResponse(await POST(request(JSON.stringify(shopifyPayload()))));
    assert.deepEqual(result, {
      status: 200,
      body: {
        ok: true,
        alreadyAdjusted: true,
        shopifyOrderId: "8212586266951",
        bigblueOrderId: "MISSS1001047",
        targetQuantity: 0,
      },
      cacheControl: null,
    });
    assert.deepEqual(harness.events(), [
      ["info", "adjustment_detected"],
      ["info", "bigblue_order_found"],
      ["info", "adjustment_planned"],
      ["info", "price_verified"],
      ["info", "already_adjusted"],
    ]);
    assert.equal(harness.requests.length, 1);
  });

  it("returns 503 when Bigblue has not imported the order yet", async () => {
    fakeBigblue(null);
    const result = await readResponse(await POST(request(JSON.stringify(shopifyPayload()))));
    assert.deepEqual(result, {
      status: 503,
      body: { ok: false, retryable: true, error: "bigblue_order_not_ready" },
      cacheControl: null,
    });
    assert.deepEqual(harness.events(), [["info", "adjustment_detected"], ["warn", "bigblue_not_ready"]]);
  });

  for (const [status, expectedStatus, retryable] of [
    [412, 409, false],
    [500, 503, true],
    [400, 502, false],
  ] as const) {
    it(`maps Bigblue HTTP ${status} to ${expectedStatus}`, async () => {
      fakeBigblue(null, { status, body: { code: "failed", msg: "nope" } });
      const result = await readResponse(await POST(request(JSON.stringify(shopifyPayload()))));
      assert.deepEqual(result, {
        status: expectedStatus,
        body: { ok: false, retryable, error: "bigblue_api_error" },
        cacheControl: null,
      });
      assert.deepEqual(harness.events(), [["info", "adjustment_detected"], ["error", "update_failed"]]);
      assert.equal(harness.logs[1].payload.bigblueStatus, status);
    });
  }

  it("returns 503 when the planned total cannot match Shopify", async () => {
    fakeBigblue(unadjustedBigblueOrder());
    const body = JSON.stringify(shopifyPayload({ total_price: "999.00" }));
    const result = await readResponse(await POST(request(body)));
    assert.deepEqual(result, {
      status: 503,
      body: { ok: false, retryable: true, error: "invalid_bigblue_response" },
      cacheControl: null,
    });
    assert.deepEqual(harness.events(), [
      ["info", "adjustment_detected"],
      ["info", "bigblue_order_found"],
      ["error", "price_mismatch"],
      ["error", "update_failed"],
    ]);
  });

  it("returns 503 when Bigblue accepts the update but does not keep it", async () => {
    fakeBigblue(unadjustedBigblueOrder(), undefined, "drop");
    const result = await readResponse(await POST(request(JSON.stringify(shopifyPayload()))));
    assert.deepEqual(result, {
      status: 503,
      body: { ok: false, retryable: true, error: "invalid_bigblue_response" },
      cacheControl: null,
    });
    // Totals still match, so no price_mismatch: only the lines were lost.
    assert.deepEqual(harness.events(), [
      ["info", "adjustment_detected"],
      ["info", "bigblue_order_found"],
      ["info", "adjustment_planned"],
      ["warn", "update_not_persisted"],
      ["error", "update_failed"],
    ]);
  });

  it("logs a persisted price mismatch before update_not_persisted", async () => {
    fakeBigblue(unadjustedBigblueOrder(), undefined, "wrongTotal");
    const result = await readResponse(await POST(request(JSON.stringify(shopifyPayload()))));
    assert.equal(result.status, 503);
    assert.deepEqual(harness.events(), [
      ["info", "adjustment_detected"],
      ["info", "bigblue_order_found"],
      ["info", "adjustment_planned"],
      ["error", "price_mismatch"],
      ["warn", "update_not_persisted"],
      ["error", "update_failed"],
    ]);
    assert.equal(harness.logs[3].payload.stage, "persisted");
    assert.equal(harness.logs[3].payload.reportedBigblueTotalCents, 10601);
  });
});
