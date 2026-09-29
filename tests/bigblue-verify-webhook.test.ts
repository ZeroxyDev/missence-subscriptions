import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";

import {
  isBigblueUrlVerificationBody,
  verifyBigblueWebhookHmac,
} from "@/lib/bigblue/verify-webhook";

describe("Bigblue webhook protocol", () => {
  it("verifies the base64 HMAC of the exact request body", () => {
    const secret = "test-shared-secret";
    const body = '{"challenge":"abc123"}';
    const signature = createHmac("sha256", secret).update(body).digest("base64");
    assert.equal(verifyBigblueWebhookHmac(body, signature, secret), true);
    assert.equal(verifyBigblueWebhookHmac(`${body} `, signature, secret), false);
    assert.equal(verifyBigblueWebhookHmac(body, null, secret), false);
    assert.equal(verifyBigblueWebhookHmac(body, "invalid", secret), false);
  });

  it("accepts only a JSON challenge object for URL verification", () => {
    assert.equal(isBigblueUrlVerificationBody('{"challenge":"abc123"}'), true);
    assert.equal(isBigblueUrlVerificationBody('{"challenge":""}'), false);
    assert.equal(isBigblueUrlVerificationBody('{"challenge":"abc123","other":1}'), false);
    assert.equal(isBigblueUrlVerificationBody('{"event":"ORDER_STATUS_UPDATE"}'), false);
    assert.equal(isBigblueUrlVerificationBody("not json"), false);
  });
});
