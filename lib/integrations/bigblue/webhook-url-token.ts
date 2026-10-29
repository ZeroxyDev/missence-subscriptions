/**
 * @file Scoped bearer token embedded in the private Bigblue webhook URL.
 *
 * Bigblue's dashboard only asks for a target URL. To allow authenticated
 * `GET` health probes of the receiver without exposing the reusable Bigblue
 * secret, we put a *derived* token in the URL instead: an HMAC of a fixed,
 * versioned context string. Leaking the URL therefore leaks only this token,
 * which cannot be used to sign webhooks.
 *
 * @module lib/integrations/bigblue/webhook-url-token
 */

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Domain-separation label for the derived token.
 *
 * Changing this value rotates the token and breaks every URL already
 * configured in Bigblue. Bump the `-vN` suffix only as a deliberate rotation.
 */
const TOKEN_CONTEXT = "missence-bigblue-order-status-url-v1";
/** Shape of a derived token: 32 bytes, lowercase hex. */
const TOKEN_PATTERN = /^[0-9a-f]{64}$/;

/**
 * Derives the URL token from the webhook key.
 *
 * @param webhookKey - `BIGBLUE_WEBHOOK_KEY`.
 * @returns A 64-character lowercase hex token.
 */
export function deriveBigblueWebhookUrlToken(webhookKey: string): string {
  return createHmac("sha256", webhookKey).update(TOKEN_CONTEXT).digest("hex");
}

/**
 * Verifies a token taken from the `?token=` query parameter.
 *
 * @param suppliedToken - Untrusted token from the request URL, or `null`.
 * @param webhookKey - `BIGBLUE_WEBHOOK_KEY`.
 * @returns `true` only for the exact derived token (constant-time comparison).
 */
export function verifyBigblueWebhookUrlToken(
  suppliedToken: string | null,
  webhookKey: string,
): boolean {
  if (!suppliedToken || !TOKEN_PATTERN.test(suppliedToken)) return false;
  const supplied = Buffer.from(suppliedToken, "hex");
  const expected = Buffer.from(deriveBigblueWebhookUrlToken(webhookKey), "hex");
  return timingSafeEqual(supplied, expected);
}
