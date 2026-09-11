import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildUpdateOrderPayload,
  findBigblueOrder,
  planBigblueLineItemAdjustment,
  type BigblueOrder,
} from "@/lib/bigblue/orders";
import type { BigblueRequest } from "@/lib/bigblue/client";

const adjustment = {
  shouldAdjust: true,
  pair: "MISS_0002_0004",
  shopifyOrderId: "123456789",
  subscriptionSku: "MISS-000000-0002",
  experienceSku: "MISS-000000-0004-UP",
  experienceReplacementSku: "MISS-000000-0004",
  subscriptionQuantity: 2,
  experienceQuantity: 1,
  experiencePricing: {
    unitPrice: "10.00",
    unitTax: "2.10",
    discount: "1.00",
  },
  targetQuantity: 1,
} as const;

const replacementDisabled = { replaceExperienceSku: false } as const;
const replacementEnabled = { replaceExperienceSku: true } as const;

describe("planBigblueLineItemAdjustment", () => {
  it("sets the absolute Shopify-derived target quantity", () => {
    const plan = planBigblueLineItemAdjustment(
      [
        { product: "MISS-000000-0004-UP", quantity: 1, unit_price: "10.00" },
        { product: "MISS-000000-0002", quantity: 6, unit_price: "20.00" },
      ],
      adjustment,
      replacementDisabled,
    );

    assert.equal(plan.alreadyAdjusted, false);
    assert.equal(plan.previousQuantity, 6);
    assert.deepEqual(plan.lineItems, [
      { product: "MISS-000000-0004-UP", quantity: 1, unit_price: "10.00" },
      { product: "MISS-000000-0002", quantity: 1, unit_price: "20.00" },
    ]);
  });

  it("does not update an order already at the target", () => {
    const plan = planBigblueLineItemAdjustment(
      [{ product: "MISS-000000-0002", quantity: 1 }],
      adjustment,
      replacementDisabled,
    );

    assert.equal(plan.alreadyAdjusted, true);
  });

  it("removes the subscription line when the target is zero", () => {
    const zeroAdjustment = {
      ...adjustment,
      subscriptionQuantity: 1,
      targetQuantity: 0,
    };
    const plan = planBigblueLineItemAdjustment(
      [
        { product: "MISS-000000-0004-UP", quantity: 1 },
        { product: "MISS-000000-0002", quantity: 1 },
      ],
      zeroAdjustment,
      replacementDisabled,
    );

    assert.equal(plan.alreadyAdjusted, false);
    assert.deepEqual(plan.lineItems, [
      { product: "MISS-000000-0004-UP", quantity: 1 },
    ]);
  });

  it("treats an absent zero-target line as already adjusted", () => {
    const plan = planBigblueLineItemAdjustment(
      [{ product: "MISS-000000-0004-UP", quantity: 1 }],
      { ...adjustment, subscriptionQuantity: 1, targetQuantity: 0 },
      replacementDisabled,
    );

    assert.equal(plan.alreadyAdjusted, true);
  });

  it("replaces an arbitrary configured experience SKU and preserves its values", () => {
    const arbitrarySkuAdjustment = {
      ...adjustment,
      experienceSku: "EXPERIENCE-SUMMER-2026",
      experienceReplacementSku: "FULFILLMENT-PACK-A",
    };
    const plan = planBigblueLineItemAdjustment(
      [
        {
          product: "EXPERIENCE-SUMMER-2026",
          quantity: 1,
          unit_price: "17.95",
          unit_tax: "3.77",
          discount: "2.50",
          custom_field: "preserved",
        },
        { product: "MISS-000000-0002", quantity: 2 },
      ],
      arbitrarySkuAdjustment,
      replacementEnabled,
    );

    assert.equal(plan.alreadyAdjusted, false);
    assert.deepEqual(plan.lineItems, [
      {
        product: "FULFILLMENT-PACK-A",
        quantity: 1,
        unit_price: "17.95",
        unit_tax: "3.77",
        discount: "2.50",
        custom_field: "preserved",
      },
      { product: "MISS-000000-0002", quantity: 1 },
    ]);
  });

  it("creates the replacement with Shopify values when the source is absent", () => {
    const plan = planBigblueLineItemAdjustment(
      [{ product: "MISS-000000-0002", quantity: 2 }],
      adjustment,
      replacementEnabled,
    );

    assert.equal(plan.alreadyAdjusted, false);
    assert.deepEqual(plan.lineItems, [
      { product: "MISS-000000-0002", quantity: 1 },
      {
        product: "MISS-000000-0004",
        quantity: 1,
        unit_price: "10.00",
        unit_tax: "2.10",
        discount: "1.00",
      },
    ]);
  });

  it("is idempotent when the replacement and target quantity already exist", () => {
    const lineItems = [
      { product: "MISS-000000-0004", quantity: 1, unit_price: "17.95" },
      { product: "MISS-000000-0002", quantity: 1 },
    ];
    const plan = planBigblueLineItemAdjustment(
      lineItems,
      adjustment,
      replacementEnabled,
    );

    assert.equal(plan.alreadyAdjusted, true);
    assert.deepEqual(plan.lineItems, lineItems);
  });

  it("coalesces source and replacement lines without duplicating quantity", () => {
    const plan = planBigblueLineItemAdjustment(
      [
        { product: "MISS-000000-0004-UP", quantity: 1, unit_price: "17.95" },
        { product: "MISS-000000-0004", quantity: 1, unit_price: "17.95" },
        { product: "MISS-000000-0002", quantity: 2 },
      ],
      adjustment,
      replacementEnabled,
    );

    assert.deepEqual(plan.lineItems, [
      { product: "MISS-000000-0004", quantity: 1, unit_price: "17.95" },
      { product: "MISS-000000-0002", quantity: 1 },
    ]);
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
