import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";

import { verifyShopifyWebhook } from "@/lib/integrations/shopify/webhook-signature";

describe("verifyShopifyWebhook", () => {
  it("accepts a valid raw-body signature", () => {
    const body = '{"id":123}';
    const secret = "test-secret";
    const hmac = createHmac("sha256", secret)
      .update(body, "utf8")
      .digest("base64");

    assert.equal(verifyShopifyWebhook(body, hmac, secret), true);
  });

  it("rejects missing and invalid signatures", () => {
    assert.equal(verifyShopifyWebhook("{}", null, "secret"), false);
    assert.equal(verifyShopifyWebhook("{}", "invalid", "secret"), false);
  });
});
