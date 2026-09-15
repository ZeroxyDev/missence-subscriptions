import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ShopifyOrder } from "@/lib/shopify/order";
import { detectFirstShipmentAdjustment } from "@/lib/subscriptions/first-shipment-adjustment";

type LineItemInput = Pick<
  ShopifyOrder["line_items"][number],
  "product_id" | "quantity" | "sku" | "variant_id"
> &
  Partial<
    Pick<
      ShopifyOrder["line_items"][number],
      "price" | "tax_lines" | "total_discount"
    >
  >;

function createOrder(lineItems: LineItemInput[]): ShopifyOrder {
  return {
    id: 123456789,
    created_at: "2026-09-09T10:00:00.000Z",
    line_items: lineItems.map((lineItem, index) => ({
      id: index + 1,
      price: "10.00",
      total_discount: "0.00",
      tax_lines: [],
      ...lineItem,
    })),
  };
}

const subscription0002 = {
  sku: "MISS-000000-0002",
  product_id: 10791019643207,
  variant_id: 53887845564743,
};
const experience0004 = {
  sku: "MISS-000000-0004-UP",
  product_id: 10987479859527,
  variant_id: 54579708854599,
};
const subscription0001 = {
  sku: "MISS-000000-0001",
  product_id: 10790886310215,
  variant_id: 54328475517255,
};
const experience0003 = {
  sku: "MISS-000000-0003-UP",
  product_id: 10987460002119,
  variant_id: 54579583025479,
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
        assert.equal(result.experienceReplacementSku, "MISS-000000-0004");
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

  it("requires the SKU, product ID and configured variant ID", () => {
    const result = detectFirstShipmentAdjustment(
      createOrder([
        { ...experience0004, quantity: 1 },
        { ...subscription0002, variant_id: 999, quantity: 2 },
      ]),
    );

    assert.deepEqual(result, { shouldAdjust: false });
  });

  it("rejects a matching SKU with a different product ID", () => {
    const result = detectFirstShipmentAdjustment(
      createOrder([
        { ...experience0003, quantity: 1 },
        { ...subscription0001, product_id: 999, quantity: 2 },
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

  it("keeps the Shopify financial values for a missing Bigblue source line", () => {
    const result = detectFirstShipmentAdjustment(
      createOrder([
        {
          ...experience0004,
          quantity: 2,
          price: "12.50",
          total_discount: "3.00",
          tax_lines: [{ price: "5.00" }],
        },
        { ...subscription0002, quantity: 3 },
      ]),
    );

    assert.equal(result.shouldAdjust, true);
    if (result.shouldAdjust) {
      assert.deepEqual(result.experiencePricing, {
        unitPrice: "22.50",
        unitTax: "2.50",
        discount: "3.00",
      });
    }
  });

  it("transfers proportional discounts and taxes with the included doypack", () => {
    const result = detectFirstShipmentAdjustment(createOrder([
      { ...subscription0001, quantity: 2, price: "74.00", total_discount: "8.00", tax_lines: [{ price: "20.00" }] },
      { ...experience0003, quantity: 1, price: "49.00", total_discount: "3.00", tax_lines: [{ price: "7.00" }] },
    ]));
    assert.ok(result.shouldAdjust);
    assert.deepEqual(result.subscriptionPricing, { unitPrice: "74.00", unitTax: "10.00", discount: "4.00" });
    assert.deepEqual(result.experiencePricing, { unitPrice: "123.00", unitTax: "17.00", discount: "7.00" });
  });

  it("converts tax-exclusive Shopify prices to gross Bigblue prices", () => {
    const result = detectFirstShipmentAdjustment({
      ...createOrder([
        { ...subscription0001, quantity: 1, price: "100.00", tax_lines: [{ price: "21.00" }] },
        { ...experience0003, quantity: 1, price: "10.00", tax_lines: [{ price: "2.10" }] },
      ]),
      taxes_included: false,
    });
    assert.ok(result.shouldAdjust);
    assert.deepEqual(result.experiencePricing, { unitPrice: "133.10", unitTax: "23.10", discount: "0.00" });
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
