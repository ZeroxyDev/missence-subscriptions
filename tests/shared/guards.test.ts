import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isRecord } from "@/lib/shared/guards";

describe("isRecord", () => {
  it("accepts plain objects only", () => {
    assert.equal(isRecord({}), true);
    assert.equal(isRecord({ a: 1 }), true);
    for (const value of [null, undefined, [], "x", 1, true]) {
      assert.equal(isRecord(value), false, String(value));
    }
  });
});
