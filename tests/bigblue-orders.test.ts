import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildUpdateOrderPayload,
  findBigblueOrder,
  planBigblueLineItemAdjustment,
  shouldClearRoundingAdditionalTax,
  type BigblueOrder,
} from "@/lib/bigblue/orders";
import type { BigblueRequest } from "@/lib/bigblue/client";

import { PRODUCT_PAIRS } from "@/config/subscription-product-pairs";
import { detectFirstShipmentAdjustment } from "@/lib/subscriptions/first-shipment-adjustment";

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

describe("buildUpdateOrderPayload", () => {
  it("wraps the mutable order and removes read-only response fields", () => {
    const order: BigblueOrder = {
      id: "BGBL01234567",
      external_id: "123456789",
      store: "shopify",
      submit_time: "2026-09-09T10:00:00Z",
      status: { code: "PENDING" },
      total: "42.00",
      currency: "EUR",
      language: "es",
      shipping_address: { country: "ES" },
      line_items: [{ product: "MISS-000000-0002", quantity: 2 }],
    };
    const lineItems = [{ product: "MISS-000000-0002", quantity: 1 }];

    const payload = buildUpdateOrderPayload(order, lineItems);

    assert.deepEqual(payload, {
      order: {
        id: "BGBL01234567",
        external_id: "123456789",
        language: "es",
        currency: "EUR",
        shipping_address: { country: "ES" },
        line_items: lineItems,
      },
    });
    assert.equal("status" in payload.order, false);
    assert.equal("total" in payload.order, false);
    assert.equal("store" in payload.order, false);
  });

  it("clears a one-cent tax remainder only when the planned total matches Shopify", () => {
    const order: BigblueOrder = {
      id: "MISSS1001046",
      external_id: "#1046",
      additional_tax: "-0.01",
      line_items: [],
    };
    const lines = [{ product: "MISS-000000-0003", quantity: 1,
      unit_price: "181.41", unit_tax: "15.59", discount: "0.00" }];

    assert.equal(shouldClearRoundingAdditionalTax(order, lines, "197.00"), true);
    assert.equal(shouldClearRoundingAdditionalTax(order, lines, "196.99"), false);
    assert.equal(shouldClearRoundingAdditionalTax(order, lines, undefined), false);
    assert.equal(
      buildUpdateOrderPayload(order, lines, true).order.additional_tax,
      "0.00",
    );
    assert.equal(buildUpdateOrderPayload(order, lines).order.additional_tax, "-0.01");
  });

  it("preserves material additional tax", () => {
    const order: BigblueOrder = {
      id: "MISSS1001046",
      external_id: "#1046",
      additional_tax: "1.25",
      line_items: [],
    };

    assert.equal(shouldClearRoundingAdditionalTax(order, [], "0.00"), false);
    assert.equal(
      buildUpdateOrderPayload(order, []).order.additional_tax,
      "1.25",
    );
  });
});

describe("findBigblueOrder", () => {
  it("treats an empty object response as an empty page", async () => {
    const request = (async () => ({})) as BigblueRequest;

    const order = await findBigblueOrder(
      request,
      "123456789",
      "2026-09-09T10:00:00.000Z",
    );

    assert.equal(order, null);
  });

  it("paginates and matches external_id as a string", async () => {
    const pageTokens: string[] = [];
    const request: BigblueRequest = async <TRequest, TResponse>(
      method: string,
      payload: TRequest,
    ) => {
      assert.equal(method, "ListOrders");
      const listOrdersPayload = payload as {
        date_range: { from: string; to: string };
        page_token: string;
      };
      const token = listOrdersPayload.page_token;
      pageTokens.push(token);

      assert.match(
        listOrdersPayload.date_range.from,
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/,
      );
      assert.match(
        listOrdersPayload.date_range.to,
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/,
      );

      return (token === ""
        ? { orders: [], next_page_token: "next" }
        : {
            orders: [
              {
                id: "BGBL01234567",
                external_id: 123456789,
                line_items: [],
              },
            ],
            next_page_token: "",
          }) as TResponse;
    };

    const order = await findBigblueOrder(
      request,
      "123456789",
      "2026-09-09T10:00:00.000Z",
    );

    assert.equal(order?.id, "BGBL01234567");
    assert.deepEqual(pageTokens, ["", "next"]);
  });

  it("matches the Shopify order name used as Bigblue external_id", async () => {
    const request = (async () => ({
      orders: [
        {
          id: "MISSS1001026",
          external_id: "#1026",
          line_items: [],
        },
      ],
    })) as BigblueRequest;

    const order = await findBigblueOrder(
      request,
      ["#1026", "8146099044679"],
      "2026-09-11T10:29:38.000Z",
    );

    assert.equal(order?.id, "MISSS1001026");
    assert.equal(order?.external_id, "#1026");
  });
});
