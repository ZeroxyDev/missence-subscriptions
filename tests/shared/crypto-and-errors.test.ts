import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { secretsMatch } from "@/lib/shared/crypto";
import { describeErrorForLog } from "@/lib/shared/errors";

describe("secretsMatch", () => {
  it("matches identical secrets regardless of length", () => {
    assert.equal(secretsMatch("s3cret", "s3cret"), true);
    assert.equal(secretsMatch("s3cret", "s3cre"), false);
    assert.equal(secretsMatch("", "s3cret"), false);
    assert.equal(secretsMatch("a".repeat(1_000), "a"), false);
  });
});

describe("describeErrorForLog", () => {
  it("exposes only the error class name", () => {
    class CustomFailure extends Error {
      override name = "CustomFailure";
    }
    assert.equal(describeErrorForLog(new CustomFailure("customer@example.com")), "CustomFailure");
    assert.equal(describeErrorForLog(new TypeError("x")), "TypeError");
    assert.equal(describeErrorForLog("boom"), "unknown_error");
  });
});
