/**
 * @file Authentication of inbound Shopify webhook deliveries.
 *
 * @see https://shopify.dev/docs/apps/build/webhooks/verify-deliveries
 * @module lib/integrations/shopify/webhook-signature
 */

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifies the `X-Shopify-Hmac-SHA256` header against the raw request body.
 *
 * Must run on the exact bytes received, before JSON parsing. The comparison
 * is constant-time; a signature of the wrong length is rejected up front
 * (length is not secret: it is always 32 bytes for SHA-256).
 *
 * @param rawBody - Raw request body as received.
 * @param providedHmac - Base64 header value, or `null` when absent.
 * @param secret - Shopify app client secret.
 * @returns `true` only for a matching signature.
 */
export function verifyShopifyWebhook(
  rawBody: string,
  providedHmac: string | null,
  secret: string,
): boolean {
  if (!providedHmac) {
    return false;
  }

  const expected = createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest();

  let provided: Buffer;

  try {
    provided = Buffer.from(providedHmac, "base64");
  } catch {
    return false;
  }

  return provided.length === expected.length && timingSafeEqual(provided, expected);
}
