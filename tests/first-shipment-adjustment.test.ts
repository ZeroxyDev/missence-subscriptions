import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ShopifyOrder } from "@/lib/shopify/order";
import { detectFirstShipmentAdjustment } from "@/lib/subscriptions/first-shipment-adjustment";

type LineItemInput = Pick<
  ShopifyOrder["line_items"][number],
  "quantity" | "sku" | "variant_id"
>;

function createOrder(lineItems: LineItemInput[]): ShopifyOrder {
  return {
    id: 123456789,
    created_at: "2026-09-09T10:00:00.000Z",
    line_items: lineItems.map((lineItem, index) => ({
      id: index + 1,
      ...lineItem,
    })),
  };
}

const subscription0002 = {
  sku: "MISS-000000-0002",
  variant_id: 10791019643207,
};
const experience0004 = {
  sku: "MISS-000000-0004-UP",
  variant_id: 10987479859527,
};
const subscription0001 = {
  sku: "MISS-000000-0001",
  variant_id: 10790886310215,
};
const experience0003 = {
  sku: "MISS-000000-0003-UP",
  variant_id: 10987460002119,
};

describe("detectFirstShipmentAdjustment", () => {
  for (const [quantity, targetQuantity] of [
    [1, 0],
    [2, 1],
    [6, 5],
  ] as const) {
    it(`sets target ${targetQuantity} for pair 0002/0004 at quantity ${quantity}`, () => {
      const result = detectFirstShipmentAdjustment(
        createOrder([
          { ...experience0004, quantity: 1 },
          { ...subscription0002, quantity },
        ]),
      );

      assert.equal(result.shouldAdjust, true);
      if (result.shouldAdjust) {
        assert.equal(result.targetQuantity, targetQuantity);
        assert.equal(result.subscriptionQuantity, quantity);
        assert.equal(result.experienceQuantity, 1);
      }
    });
  }

  it("ignores a subscription renewal", () => {
    const result = detectFirstShipmentAdjustment(
      createOrder([{ ...subscription0002, quantity: 2 }]),
    );

    assert.deepEqual(result, { shouldAdjust: false });
  });

  it("ignores an experience without its subscription", () => {
    const result = detectFirstShipmentAdjustment(
      createOrder([{ ...experience0004, quantity: 1 }]),
    );

    assert.deepEqual(result, { shouldAdjust: false });
  });

  for (const [quantity, targetQuantity] of [
    [1, 0],
    [3, 2],
  ] as const) {
    it(`adjusts pair 0001/0003 from ${quantity} to ${targetQuantity}`, () => {
      const result = detectFirstShipmentAdjustment(
        createOrder([
          { ...experience0003, quantity: 1 },
          { ...subscription0001, quantity },
        ]),
      );

      assert.equal(result.shouldAdjust, true);
      if (result.shouldAdjust) {
        assert.equal(result.targetQuantity, targetQuantity);
      }
    });
  }

  it("requires both the SKU and variant ID", () => {
    const result = detectFirstShipmentAdjustment(
      createOrder([
        { ...experience0004, quantity: 1 },
        { ...subscription0002, variant_id: 999, quantity: 2 },
      ]),
    );

    assert.deepEqual(result, { shouldAdjust: false });
  });

  it("sums duplicate Shopify subscription lines deterministically", () => {
    const result = detectFirstShipmentAdjustment(
      createOrder([
        { ...experience0004, quantity: 1 },
        { ...subscription0002, quantity: 1 },
        { ...subscription0002, quantity: 2 },
      ]),
    );

    assert.equal(result.shouldAdjust, true);
    if (result.shouldAdjust) {
      assert.equal(result.subscriptionQuantity, 3);
      assert.equal(result.targetQuantity, 2);
    }
  });

  it("subtracts one subscription unit for every experience unit", () => {
    const result = detectFirstShipmentAdjustment(
      createOrder([
        { ...experience0004, quantity: 2 },
        { ...subscription0002, quantity: 3 },
      ]),
    );

    assert.equal(result.shouldAdjust, true);
    if (result.shouldAdjust) {
      assert.equal(result.experienceQuantity, 2);
      assert.equal(result.subscriptionQuantity, 3);
      assert.equal(result.targetQuantity, 1);
    }
  });

  it("never produces a negative target quantity", () => {
    const result = detectFirstShipmentAdjustment(
      createOrder([
        { ...experience0004, quantity: 2 },
        { ...subscription0002, quantity: 1 },
      ]),
    );

    assert.equal(result.shouldAdjust, true);
    if (result.shouldAdjust) {
      assert.equal(result.targetQuantity, 0);
    }
  });
});
