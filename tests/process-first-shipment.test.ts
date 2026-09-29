import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PRODUCT_PAIRS } from "@/config/subscription-product-pairs";
import type { BigblueRequest } from "@/lib/bigblue/client";
import {
  calculateBigblueTotalCents,
  InvalidBigblueResponseError,
  type BigblueOrder,
  type UpdateOrderPayload,
} from "@/lib/bigblue/orders";
import type { ShopifyOrder } from "@/lib/shopify/order";
import { detectFirstShipmentAdjustment } from "@/lib/subscriptions/first-shipment-adjustment";
import { processFirstShipmentAdjustment } from "@/lib/subscriptions/process-first-shipment";

const pair = PRODUCT_PAIRS[0];

function shopifyOrder(subscriptionQuantity: 1 | 2): ShopifyOrder {
  return {
    id: subscriptionQuantity === 1 ? 8212586266951 : 8212592460103,
    name: subscriptionQuantity === 1 ? "#1047" : "#1048",
    created_at: "2026-09-28T16:54:30Z",
    taxes_included: true,
    total_price: subscriptionQuantity === 1 ? "106.00" : "157.00",
    line_items: [
      {
        id: 1,
        sku: pair.subscription.sku,
        product_id: pair.subscription.productId,
        variant_id: pair.subscription.variantId,
        quantity: subscriptionQuantity,
        price: subscriptionQuantity === 1 ? "57.00" : "54.00",
        total_discount: "0.00",
        tax_lines: [
          { price: subscriptionQuantity === 1 ? "5.18" : "9.82" },
        ],
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
  };
}

function bigblueOrder(subscriptionQuantity: 1 | 2): BigblueOrder {
  return {
    id: subscriptionQuantity === 1 ? "MISSS1001047" : "MISSS1001048",
    external_id: subscriptionQuantity === 1 ? "#1047" : "#1048",
    additional_tax: "0",
    line_items: [
      {
        product: pair.subscription.sku,
        quantity: subscriptionQuantity,
        unit_price: subscriptionQuantity === 1 ? "51.82" : "49.09",
        unit_tax: subscriptionQuantity === 1 ? "5.18" : "4.91",
        discount: "0",
      },
      {
        product: pair.experience.replacement.sku,
        quantity: 1,
        unit_price: "40.50",
        unit_tax: "8.50",
        discount: "0",
      },
    ],
  };
}

function fakeBigblue(
  initialOrder: BigblueOrder,
  overwriteUpdate = false,
  reportedTotalAfterUpdate?: string,
): { request: BigblueRequest; current: () => BigblueOrder; writes: () => number } {
  function withTotal(order: BigblueOrder): BigblueOrder {
    const total = calculateBigblueTotalCents(order);
    assert.notEqual(total, null);
    return { ...order, total: (total! / 100).toFixed(2) };
  }
  const originalOrder = withTotal(initialOrder);
  let currentOrder = structuredClone(originalOrder);
  let writes = 0;

  const request: BigblueRequest = async <TRequest, TResponse>(
    method: string,
    payload: TRequest,
  ) => {
    if (method === "ListOrders") {
      return { orders: [structuredClone(currentOrder)] } as TResponse;
    }

    assert.equal(method, "UpdateOrder");
    writes += 1;
    const update = payload as UpdateOrderPayload;
    currentOrder = overwriteUpdate
      ? structuredClone(originalOrder)
      : withTotal(structuredClone(update.order) as BigblueOrder);
    if (!overwriteUpdate && reportedTotalAfterUpdate) {
      currentOrder.total = reportedTotalAfterUpdate;
    }
    return {} as TResponse;
  };

  return { request, current: () => currentOrder, writes: () => writes };
}

describe("processFirstShipmentAdjustment", () => {
  for (const quantity of [1, 2] as const) {
    it(`persists the Colageno ${quantity === 1 ? 30 : 60}-day quantities`, async () => {
      const order = shopifyOrder(quantity);
      const adjustment = detectFirstShipmentAdjustment(order);
      assert.ok(adjustment.shouldAdjust);
      const bigblue = fakeBigblue(bigblueOrder(quantity));

      await processFirstShipmentAdjustment(bigblue.request, order, adjustment);

      const persisted = bigblue.current();
      assert.equal(persisted.additional_tax, "0");
      assert.equal(
        persisted.line_items.find(
          (item) => item.product === pair.subscription.sku,
        )?.quantity ?? 0,
        quantity - 1,
      );
      assert.equal(
        persisted.line_items.find(
          (item) => item.product === pair.experience.replacement.sku,
        )?.quantity,
        1,
      );
    });
  }

  it("fails retryably when Bigblue overwrites the update", async () => {
    const order = shopifyOrder(1);
    const adjustment = detectFirstShipmentAdjustment(order);
    assert.ok(adjustment.shouldAdjust);
    const bigblue = fakeBigblue(bigblueOrder(1), true);

    await assert.rejects(
      processFirstShipmentAdjustment(bigblue.request, order, adjustment),
      InvalidBigblueResponseError,
    );
  });

  it("clears the extra cent only when Shopify confirms the planned total", async () => {
    const longeva = PRODUCT_PAIRS[1];
    const order: ShopifyOrder = {
      id: 8212568703303,
      name: "#1046",
      created_at: "2026-09-28T16:46:41Z",
      taxes_included: true,
      total_price: "197.00",
      line_items: [
        {
          id: 1, sku: longeva.subscription.sku,
          product_id: longeva.subscription.productId,
          variant_id: longeva.subscription.variantId,
          quantity: 2, price: "74.00", total_discount: "0.00",
          tax_lines: [{ price: "13.46" }],
        },
        {
          id: 2, sku: longeva.experience.sku,
          product_id: longeva.experience.productId,
          variant_id: longeva.experience.variantId,
          quantity: 1, price: "49.00", total_discount: "0.00",
          tax_lines: [{ price: "8.50" }],
        },
      ],
    };
    const adjustment = detectFirstShipmentAdjustment(order);
    assert.ok(adjustment.shouldAdjust);
    const bigblue = fakeBigblue({
      id: "MISSS1001046",
      external_id: "#1046",
      additional_tax: "-0.01",
      line_items: [
        { product: longeva.subscription.sku, quantity: 2,
          unit_price: "67.28", unit_tax: "6.73", discount: "0" },
        { product: longeva.experience.replacement.sku, quantity: 1,
          unit_price: "40.50", unit_tax: "8.50", discount: "0" },
      ],
    });

    await processFirstShipmentAdjustment(bigblue.request, order, adjustment);

    assert.equal(bigblue.current().additional_tax, "0.00");
    assert.equal(bigblue.current().line_items.reduce((total, item) =>
      total + item.quantity * (Number(item.unit_price) + Number(item.unit_tax)) - Number(item.discount), 0), 197);
    assert.equal(bigblue.current().total, "197.00");
  });

  it("refuses to send an update if the planned Bigblue total differs from Shopify", async () => {
    const order = shopifyOrder(2);
    const adjustment = detectFirstShipmentAdjustment(order);
    assert.ok(adjustment.shouldAdjust);
    const initial = bigblueOrder(2);
    initial.additional_tax = "0.02";
    const bigblue = fakeBigblue(initial);

    await assert.rejects(
      processFirstShipmentAdjustment(bigblue.request, order, adjustment),
      /Planned Bigblue total does not match Shopify/,
    );
    assert.equal(bigblue.writes(), 0);
  });

  it("does not claim success if Bigblue reports an extra cent after UpdateOrder", async () => {
    const order = shopifyOrder(2);
    const adjustment = detectFirstShipmentAdjustment(order);
    assert.ok(adjustment.shouldAdjust);
    const bigblue = fakeBigblue(bigblueOrder(2), false, "157.01");

    await assert.rejects(
      processFirstShipmentAdjustment(bigblue.request, order, adjustment),
      /did not preserve the adjustment/,
    );
    assert.equal(bigblue.writes(), 1);
  });

  it("retries a price correction when lines are already adjusted but Bigblue reports an extra cent", async () => {
    const order = shopifyOrder(2);
    const adjustment = detectFirstShipmentAdjustment(order);
    assert.ok(adjustment.shouldAdjust);
    const initial = bigblueOrder(2);
    initial.line_items = [
      {
        product: pair.subscription.sku,
        quantity: 1,
        unit_price: adjustment.subscriptionPricing.unitPrice,
        unit_tax: adjustment.subscriptionPricing.unitTax,
        discount: adjustment.subscriptionPricing.discount,
      },
      {
        product: pair.experience.replacement.sku,
        quantity: 1,
        unit_price: adjustment.experiencePricing.unitPrice,
        unit_tax: adjustment.experiencePricing.unitTax,
        discount: adjustment.experiencePricing.discount,
      },
    ];
    const bigblue = fakeBigblue(initial);
    bigblue.current().total = "157.01";

    const result = await processFirstShipmentAdjustment(bigblue.request, order, adjustment);

    assert.equal(result.ok, true);
    assert.equal(bigblue.writes(), 1);
    assert.equal(bigblue.current().total, "157.00");
  });

  it("rejects a currency mismatch before modifying Bigblue", async () => {
    const order = { ...shopifyOrder(2), currency: "EUR" };
    const adjustment = detectFirstShipmentAdjustment(order);
    assert.ok(adjustment.shouldAdjust);
    const bigblue = fakeBigblue({ ...bigblueOrder(2), currency: "USD" });

    await assert.rejects(
      processFirstShipmentAdjustment(bigblue.request, order, adjustment),
      /currency does not match Shopify/,
    );
    assert.equal(bigblue.writes(), 0);
  });

  it("rejects a customer-facing amount that differs from Shopify's shop total", async () => {
    const order = {
      ...shopifyOrder(2),
      currency: "EUR",
      presentment_currency: "EUR",
      presentment_total_price: "157.01",
    };
    const adjustment = detectFirstShipmentAdjustment(order);
    assert.ok(adjustment.shouldAdjust);
    const bigblue = fakeBigblue({ ...bigblueOrder(2), currency: "EUR" });

    await assert.rejects(
      processFirstShipmentAdjustment(bigblue.request, order, adjustment),
      /Customer-facing total cannot be matched/,
    );
    assert.equal(bigblue.writes(), 0);
  });
});
