import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  deriveBigblueWebhookUrlToken,
  verifyBigblueWebhookUrlToken,
} from "@/lib/bigblue/webhook-auth";

describe("Bigblue webhook URL authentication", () => {
  it("accepts only the derived scoped token", () => {
    const key = "test-bigblue-webhook-key";
    const token = deriveBigblueWebhookUrlToken(key);
    assert.match(token, /^[0-9a-f]{64}$/);
    assert.equal(verifyBigblueWebhookUrlToken(token, key), true);
    assert.equal(verifyBigblueWebhookUrlToken(key, key), false);
    assert.equal(verifyBigblueWebhookUrlToken(token, "another-key"), false);
    assert.equal(verifyBigblueWebhookUrlToken(null, key), false);
  });
});
