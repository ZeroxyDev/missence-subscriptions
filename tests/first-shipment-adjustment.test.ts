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
const oneTime0004 = {
  sku: "MISS-000000-0004",
  variant_id: 10897754554695,
};
const subscription0001 = {
  sku: "MISS-000000-0001",
  variant_id: 10790886310215,
};
const oneTime0003 = {
  sku: "MISS-000000-0003",
  variant_id: 10897753637191,
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
          { ...oneTime0004, quantity: 1 },
          { ...subscription0002, quantity },
        ]),
      );

      assert.equal(result.shouldAdjust, true);
      if (result.shouldAdjust) {
        assert.equal(result.targetQuantity, targetQuantity);
        assert.equal(result.originalQuantity, quantity);
      }
    });
  }

  it("ignores a subscription renewal", () => {
    const result = detectFirstShipmentAdjustment(
      createOrder([{ ...subscription0002, quantity: 2 }]),
    );

    assert.deepEqual(result, { shouldAdjust: false });
  });

  it("ignores a one-time product without its subscription", () => {
    const result = detectFirstShipmentAdjustment(
      createOrder([{ ...oneTime0004, quantity: 1 }]),
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
          { ...oneTime0003, quantity: 1 },
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
        { ...oneTime0004, quantity: 1 },
        { ...subscription0002, variant_id: 999, quantity: 2 },
      ]),
    );

    assert.deepEqual(result, { shouldAdjust: false });
  });

  it("sums duplicate Shopify subscription lines deterministically", () => {
    const result = detectFirstShipmentAdjustment(
      createOrder([
        { ...oneTime0004, quantity: 1 },
        { ...subscription0002, quantity: 1 },
        { ...subscription0002, quantity: 2 },
      ]),
    );

    assert.equal(result.shouldAdjust, true);
    if (result.shouldAdjust) {
      assert.equal(result.originalQuantity, 3);
      assert.equal(result.targetQuantity, 2);
    }
  });
});

