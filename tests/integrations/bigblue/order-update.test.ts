import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { shouldClearRoundingAdditionalTax } from "@/lib/integrations/bigblue/order-totals";
import { buildUpdateOrderPayload } from "@/lib/integrations/bigblue/order-update";
import type { BigblueOrder } from "@/lib/integrations/bigblue/types";

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
