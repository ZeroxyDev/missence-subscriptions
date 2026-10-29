import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { toCents } from "@/lib/shared/money";
import { toUnitPricing } from "@/lib/subscriptions/domain/line-pricing";

describe("toUnitPricing", () => {
  it("returns zero pricing for zero units", () => {
    assert.deepEqual(toUnitPricing({ price: 1234, tax: 56, discount: 7 }, 0), {
      unitPrice: "0.00",
      unitTax: "0.00",
      discount: "0.00",
    });
  });

  it("reproduces the line total to the cent for awkward divisions", () => {
    for (const quantity of [1, 2, 3, 7]) {
      for (const totals of [
        { price: 10_000, tax: 2_100, discount: 0 },
        { price: 9_091, tax: 909, discount: 333 },
        { price: 1, tax: 1, discount: 0 },
      ]) {
        const pricing = toUnitPricing(totals, quantity);
        const lineTotal = quantity * (toCents(pricing.unitPrice)! + toCents(pricing.unitTax)!) - toCents(pricing.discount)!;
        assert.equal(lineTotal, totals.price + totals.tax - totals.discount, `${quantity} × ${JSON.stringify(totals)}`);
      }
    }
  });
});
