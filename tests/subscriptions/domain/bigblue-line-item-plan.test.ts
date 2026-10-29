import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { planBigblueLineItemAdjustment } from "@/lib/subscriptions/domain/bigblue-line-item-plan";

import { PRODUCT_PAIRS } from "@/config/subscription-product-pairs";
import { detectFirstShipmentAdjustment } from "@/lib/subscriptions/domain/first-shipment-adjustment";

const replacementEnabled = { replaceExperienceSku: true };

describe("planBigblueLineItemAdjustment", () => {
  for (const [pairIndex, quantity, price, expectedTotal] of [
    [1, 2, "74.00", 197],
    [0, 2, "54.00", 157],
    [0, 1, "57.00", 106],
    [1, 1, "78.00", 127],
  ] as const) {
    for (const source of ["original", "replacement", "missing"] as const) {
      it(`preserves ${expectedTotal} euros with ${source} experience`, () => {
        const pair = PRODUCT_PAIRS[pairIndex];
        const order = {
          id: 1, created_at: "2026-09-14T09:00:00Z",
          line_items: [
            { id: 1, sku: pair.subscription.sku, product_id: pair.subscription.productId,
              variant_id: pair.subscription.variantId, quantity, price, total_discount: "0.00", tax_lines: [] },
            { id: 2, sku: pair.experience.sku, product_id: pair.experience.productId,
              variant_id: pair.experience.variantId, quantity: 1, price: "49.00", total_discount: "0.00", tax_lines: [] },
          ],
        };
        const adjustment = detectFirstShipmentAdjustment(order);
        assert.ok(adjustment.shouldAdjust);
        const items = [
          { product: pair.subscription.sku, quantity, unit_price: price },
          ...(source === "missing" ? [] : [{ product: source === "original" ? pair.experience.sku : pair.experience.replacement.sku,
            quantity: 1, unit_price: "1.00", custom_field: "preserved" }]),
        ];
        const plan = planBigblueLineItemAdjustment(items, adjustment, replacementEnabled);
        assert.equal(plan.alreadyAdjusted, false);
        assert.equal(plan.lineItems.reduce((sum, item) => sum + item.quantity * Number(item.unit_price) - Number(item.discount), 0), expectedTotal);
        assert.equal(plan.lineItems.find(item => item.product === pair.subscription.sku)?.quantity ?? 0, quantity - 1);
        const experience = plan.lineItems.find(item => item.product === pair.experience.replacement.sku);
        assert.equal(experience?.quantity, 1);
        assert.equal(Number(experience?.unit_price), 49 + Number(price));
        if (source !== "missing") assert.equal(experience?.custom_field, "preserved");
        const retry = planBigblueLineItemAdjustment(plan.lineItems, adjustment, replacementEnabled);
        assert.equal(retry.alreadyAdjusted, true);
        assert.deepEqual(retry.lineItems, plan.lineItems);
      });
    }
  }

  it("produces the correct net Bigblue prices for Longeva 60 days", () => {
    const pair = PRODUCT_PAIRS[1];
    const adjustment = detectFirstShipmentAdjustment({
      id: 1,
      created_at: "2026-09-16T10:06:05Z",
      taxes_included: true,
      line_items: [
        { id: 1, sku: pair.subscription.sku, product_id: pair.subscription.productId,
          variant_id: pair.subscription.variantId, quantity: 2, price: "74.00", total_discount: "0.00",
          tax_lines: [{ price: "13.46" }] },
        { id: 2, sku: pair.experience.sku, product_id: pair.experience.productId,
          variant_id: pair.experience.variantId, quantity: 1, price: "49.00", total_discount: "0.00",
          tax_lines: [{ price: "8.50" }] },
      ],
    });
    assert.ok(adjustment.shouldAdjust);

    const plan = planBigblueLineItemAdjustment([
      { product: pair.experience.replacement.sku, quantity: 1, unit_price: "40.50", unit_tax: "8.50", discount: "0.00" },
      { product: pair.subscription.sku, quantity: 2, unit_price: "67.27", unit_tax: "6.73", discount: "0.00" },
    ], adjustment, replacementEnabled);

    assert.deepEqual(plan.lineItems, [
      { product: pair.experience.replacement.sku, quantity: 1, unit_price: "107.77", unit_tax: "15.23", discount: "0.00" },
      { product: pair.subscription.sku, quantity: 1, unit_price: "67.27", unit_tax: "6.73", discount: "0.00" },
    ]);
    assert.equal(plan.lineItems.reduce((sum, item) =>
      sum + item.quantity * (Number(item.unit_price) + Number(item.unit_tax)) - Number(item.discount), 0), 197);
  });

  for (const [pairIndex, subscriptionPrice, subscriptionTax, expectedTotal] of [
    [1, "78.00", "7.09", 127],
    [0, "57.00", "5.18", 106],
  ] as const) {
    it(`removes the doypack and preserves ${expectedTotal} euros for 30 days`, () => {
      const pair = PRODUCT_PAIRS[pairIndex];
      const adjustment = detectFirstShipmentAdjustment({
        id: 3,
        created_at: "2026-09-16T10:12:37Z",
        taxes_included: true,
        line_items: [
          { id: 1, sku: pair.subscription.sku, product_id: pair.subscription.productId,
            variant_id: pair.subscription.variantId, quantity: 1, price: subscriptionPrice, total_discount: "0.00",
            tax_lines: [{ price: subscriptionTax }] },
          { id: 2, sku: pair.experience.sku, product_id: pair.experience.productId,
            variant_id: pair.experience.variantId, quantity: 1, price: "49.00", total_discount: "0.00",
            tax_lines: [{ price: "8.50" }] },
        ],
      });
      assert.ok(adjustment.shouldAdjust);

      const plan = planBigblueLineItemAdjustment([
        { product: pair.experience.replacement.sku, quantity: 1 },
        { product: pair.subscription.sku, quantity: 1 },
      ], adjustment, replacementEnabled);

      assert.equal(plan.lineItems.some((item) => item.product === pair.subscription.sku), false);
      assert.equal(plan.lineItems.reduce((sum, item) =>
        sum + item.quantity * (Number(item.unit_price) + Number(item.unit_tax)) - Number(item.discount), 0), expectedTotal);
    });
  }

  it("corrects Colageno 60 days using the Shopify experience quantity", () => {
    const pair = PRODUCT_PAIRS[0];
    const adjustment = detectFirstShipmentAdjustment({
      id: 2,
      created_at: "2026-09-16T10:12:37Z",
      taxes_included: true,
      line_items: [
        { id: 1, sku: pair.subscription.sku, product_id: pair.subscription.productId,
          variant_id: pair.subscription.variantId, quantity: 2, price: "54.00", total_discount: "0.00", tax_lines: [] },
        { id: 2, sku: pair.experience.sku, product_id: pair.experience.productId,
          variant_id: pair.experience.variantId, quantity: 1, price: "49.00", total_discount: "0.00", tax_lines: [] },
      ],
    });
    assert.ok(adjustment.shouldAdjust);

    const plan = planBigblueLineItemAdjustment([
      { product: pair.experience.replacement.sku, quantity: 2 },
      { product: pair.subscription.sku, quantity: 1 },
    ], adjustment, replacementEnabled);

    assert.equal(plan.lineItems.find((item) => item.product === pair.experience.replacement.sku)?.quantity, 1);
    assert.equal(plan.lineItems.find((item) => item.product === pair.subscription.sku)?.quantity, 1);
    assert.equal(plan.lineItems.reduce((sum, item) =>
      sum + item.quantity * (Number(item.unit_price) + Number(item.unit_tax)) - Number(item.discount), 0), 157);
  });

  it("keeps two real experiences and removes their two included doypacks", () => {
    const pair = PRODUCT_PAIRS[0];
    const adjustment = detectFirstShipmentAdjustment({
      id: 4,
      created_at: "2026-09-16T10:12:37Z",
      taxes_included: true,
      line_items: [
        { id: 1, sku: pair.subscription.sku, product_id: pair.subscription.productId,
          variant_id: pair.subscription.variantId, quantity: 2, price: "54.00", total_discount: "0.00", tax_lines: [] },
        { id: 2, sku: pair.experience.sku, product_id: pair.experience.productId,
          variant_id: pair.experience.variantId, quantity: 2, price: "49.00", total_discount: "0.00", tax_lines: [] },
      ],
    });
    assert.ok(adjustment.shouldAdjust);

    const plan = planBigblueLineItemAdjustment([
      { product: pair.experience.sku, quantity: 2 },
      { product: pair.subscription.sku, quantity: 2 },
    ], adjustment, replacementEnabled);

    assert.equal(plan.lineItems.find((item) => item.product === pair.experience.replacement.sku)?.quantity, 2);
    assert.equal(plan.lineItems.some((item) => item.product === pair.subscription.sku), false);
    assert.equal(plan.lineItems.reduce((sum, item) =>
      sum + item.quantity * (Number(item.unit_price) + Number(item.unit_tax)) - Number(item.discount), 0), 206);
  });
});
