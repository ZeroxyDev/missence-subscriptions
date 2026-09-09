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
  oneTimeSku: "MISS-000000-0004",
  originalQuantity: 2,
  targetQuantity: 1,
} as const;

describe("planBigblueLineItemAdjustment", () => {
  it("sets the absolute Shopify-derived target quantity", () => {
    const plan = planBigblueLineItemAdjustment(
      [
        { product: "MISS-000000-0004", quantity: 1, unit_price: "10.00" },
        { product: "MISS-000000-0002", quantity: 6, unit_price: "20.00" },
      ],
      adjustment,
    );

    assert.equal(plan.alreadyAdjusted, false);
    assert.equal(plan.previousQuantity, 6);
    assert.deepEqual(plan.lineItems, [
      { product: "MISS-000000-0004", quantity: 1, unit_price: "10.00" },
      { product: "MISS-000000-0002", quantity: 1, unit_price: "20.00" },
    ]);
  });

  it("does not update an order already at the target", () => {
    const plan = planBigblueLineItemAdjustment(
      [{ product: "MISS-000000-0002", quantity: 1 }],
      adjustment,
    );

    assert.equal(plan.alreadyAdjusted, true);
  });

  it("removes the subscription line when the target is zero", () => {
    const zeroAdjustment = {
      ...adjustment,
      originalQuantity: 1,
      targetQuantity: 0,
    };
    const plan = planBigblueLineItemAdjustment(
      [
        { product: "MISS-000000-0004", quantity: 1 },
        { product: "MISS-000000-0002", quantity: 1 },
      ],
      zeroAdjustment,
    );

    assert.equal(plan.alreadyAdjusted, false);
    assert.deepEqual(plan.lineItems, [
      { product: "MISS-000000-0004", quantity: 1 },
    ]);
  });

  it("treats an absent zero-target line as already adjusted", () => {
    const plan = planBigblueLineItemAdjustment(
      [{ product: "MISS-000000-0004", quantity: 1 }],
      { ...adjustment, originalQuantity: 1, targetQuantity: 0 },
    );

    assert.equal(plan.alreadyAdjusted, true);
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
  it("paginates and matches external_id as a string", async () => {
    const pageTokens: string[] = [];
    const request: BigblueRequest = async <TRequest, TResponse>(
      method: string,
      payload: TRequest,
    ) => {
      assert.equal(method, "ListOrders");
      const token = (payload as { page_token: string }).page_token;
      pageTokens.push(token);

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
});

