import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatMoney, toCents } from "@/lib/shared/money";

describe("toCents", () => {
  it("converts decimal strings and numbers exactly", () => {
    assert.equal(toCents("49.50"), 4950);
    assert.equal(toCents("12"), 1200);
    assert.equal(toCents("-0.01"), -1);
    assert.equal(toCents(0.1 + 0.2), 30);
    assert.equal(toCents(106), 10600);
  });

  it("rejects ambiguous or non-monetary input", () => {
    for (const value of ["1.005", "1e3", " 1", "", "abc", undefined, null, Number.NaN, Infinity, {}]) {
      assert.equal(toCents(value), null, String(value));
    }
  });
});

describe("formatMoney", () => {
  it("always renders two decimals", () => {
    assert.equal(formatMoney(49.5), "49.50");
    assert.equal(formatMoney(0), "0.00");
  });
});
