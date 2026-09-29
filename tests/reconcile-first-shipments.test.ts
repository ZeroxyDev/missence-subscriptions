import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PRODUCT_PAIRS } from "@/config/subscription-product-pairs";
import type { BigblueRequest } from "@/lib/bigblue/client";
import { calculateBigblueTotalCents, type BigblueOrder, type UpdateOrderPayload } from "@/lib/bigblue/orders";
import type { ReconciliationCandidate } from "@/lib/shopify/admin-orders";
import { reconcileFirstShipments } from "@/lib/subscriptions/reconcile-first-shipments";

function candidate(pairIndex: 0 | 1, quantity: 1 | 2): ReconciliationCandidate {
  const pair = PRODUCT_PAIRS[pairIndex];
  const subscriptionPrice = pairIndex === 1 ? "74.00" : quantity === 1 ? "57.00" : "54.00";
  const experiencePrice = "49.00";
  return {
    cancelled: false,
    edited: false,
    fulfillmentStatus: "UNFULFILLED",
    order: {
      id: pairIndex === 1 ? 8212568703303 : 8212592460103,
      name: pairIndex === 1 ? "#1046" : "#1048",
      currency: "EUR",
      presentment_currency: "EUR",
      created_at: "2026-09-29T16:00:00Z",
      taxes_included: true,
      total_price: pairIndex === 1 ? "197.00" : quantity === 1 ? "106.00" : "157.00",
      presentment_total_price: pairIndex === 1 ? "197.00" : quantity === 1 ? "106.00" : "157.00",
      line_items: [
        {
          id: 1,
          product_id: pair.subscription.productId,
          variant_id: pair.subscription.variantId,
          sku: pair.subscription.sku,
          quantity,
          price: subscriptionPrice,
          total_discount: "0.00",
          tax_lines: [{ price: pairIndex === 1 ? "13.45" : quantity === 1 ? "5.18" : "9.82" }],
        },
        {
          id: 2,
          product_id: pair.experience.productId,
          variant_id: pair.experience.variantId,
          sku: pair.experience.sku,
          quantity: 1,
          price: experiencePrice,
          total_discount: "0.00",
          tax_lines: [{ price: "8.50" }],
        },
      ],
    },
  };
}

function fakeBigblue(initial: BigblueOrder) {
  function withTotal(order: BigblueOrder): BigblueOrder {
    const cents = calculateBigblueTotalCents(order);
    return cents === null ? order : { ...order, total: (cents / 100).toFixed(2) };
  }
  let current = structuredClone(withTotal(initial));
  let writes = 0;
  const request: BigblueRequest = async <TRequest, TResponse>(method: string, payload: TRequest) => {
    if (method === "ListOrders") return { orders: [structuredClone(current)] } as TResponse;
    assert.equal(method, "UpdateOrder");
    current = withTotal(structuredClone((payload as UpdateOrderPayload).order) as BigblueOrder);
    current.status = initial.status;
    writes += 1;
    return {} as TResponse;
  };
  return { request, current: () => current, writes: () => writes };
}

describe("delayed Bigblue reconciliation", () => {
  it("repairs a reverted Longeva 60-day order, including the extra cent, idempotently", async () => {
    const pair = PRODUCT_PAIRS[1];
    const bigblue = fakeBigblue({
      id: "MISSS1001046", external_id: "#1046", status: { code: "PENDING" }, currency: "EUR",
      additional_tax: "-0.01", shipping_price: "0", shipping_tax: "0",
      additional_discount: "0",
      line_items: [
        { product: pair.experience.replacement.sku, quantity: 1, unit_price: "40.50", unit_tax: "8.50", discount: "0" },
        { product: pair.subscription.sku, quantity: 2, unit_price: "67.28", unit_tax: "6.73", discount: "0" },
      ],
    });
    const orders = [candidate(1, 2)];

    const first = await reconcileFirstShipments(orders, bigblue.request);
    assert.equal(first.updated, 1);
    assert.equal(bigblue.current().line_items.find((item) => item.product === pair.subscription.sku)?.quantity, 1);
    assert.equal(bigblue.current().line_items.find((item) => item.product === pair.experience.replacement.sku)?.quantity, 1);
    assert.equal(bigblue.current().line_items.find((item) => item.product === pair.subscription.sku)?.unit_price, "67.28");
    assert.equal(bigblue.current().line_items.find((item) => item.product === pair.experience.replacement.sku)?.unit_tax, "15.22");
    assert.equal(bigblue.current().additional_tax, "0.00");
    assert.equal(bigblue.writes(), 1);

    const second = await reconcileFirstShipments(orders, bigblue.request);
    assert.equal(second.alreadyAdjusted, 1);
    assert.equal(bigblue.writes(), 1);
  });

  it("repairs a reverted Colageno 60-day order and does not touch cancelled orders", async () => {
    const pair = PRODUCT_PAIRS[0];
    const bigblue = fakeBigblue({
      id: "MISSS1001048", external_id: "#1048", status: { code: "PENDING" }, currency: "EUR",
      additional_tax: "0",
      line_items: [
        { product: pair.subscription.sku, quantity: 2, unit_price: "49.09", unit_tax: "4.91", discount: "0" },
        { product: pair.experience.replacement.sku, quantity: 1, unit_price: "40.50", unit_tax: "8.50", discount: "0" },
      ],
    });
    const cancelled = { ...candidate(0, 2), cancelled: true };
    const skipped = await reconcileFirstShipments([cancelled], bigblue.request);
    assert.equal(skipped.skipped, 1);
    assert.equal(bigblue.writes(), 0);

    const repaired = await reconcileFirstShipments([candidate(0, 2)], bigblue.request);
    assert.equal(repaired.updated, 1);
    assert.equal(bigblue.current().line_items.find((item) => item.product === pair.subscription.sku)?.quantity, 1);
    assert.equal(bigblue.writes(), 1);
  });

  it("does not update a Bigblue order that is no longer pending", async () => {
    const pair = PRODUCT_PAIRS[0];
    const bigblue = fakeBigblue({
      id: "MISSS1001048", external_id: "#1048", status: { code: "CANCELLED" }, currency: "EUR",
      line_items: [
        { product: pair.subscription.sku, quantity: 2 },
        { product: pair.experience.replacement.sku, quantity: 1 },
      ],
    });
    const result = await reconcileFirstShipments([candidate(0, 2)], bigblue.request);
    assert.equal(result.skipped, 1);
    assert.equal(bigblue.writes(), 0);
  });

  it("rechecks an edited Shopify order while Bigblue is still pending", async () => {
    const pair = PRODUCT_PAIRS[0];
    const bigblue = fakeBigblue({
      id: "MISSS1001048", external_id: "#1048", status: { code: "PENDING" }, currency: "EUR",
      additional_tax: "0",
      line_items: [
        { product: pair.subscription.sku, quantity: 2, unit_price: "49.09", unit_tax: "4.91", discount: "0" },
        { product: pair.experience.replacement.sku, quantity: 1, unit_price: "40.50", unit_tax: "8.50", discount: "0" },
      ],
    });
    const edited = { ...candidate(0, 2), edited: true };
    const result = await reconcileFirstShipments([edited], bigblue.request, { retryNotReady: true });
    assert.equal(result.updated, 1);
    assert.equal(bigblue.current().line_items.find((item) => item.product === pair.subscription.sku)?.quantity, 1);
  });

  it("marks a missing Bigblue order retryable for event delivery", async () => {
    const request: BigblueRequest = async () => ({ orders: [] }) as never;
    const result = await reconcileFirstShipments([candidate(0, 2)], request, { retryNotReady: true });
    assert.equal(result.failed, 1);
    assert.equal(result.skipped, 0);
  });
});
