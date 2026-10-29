/**
 * @file Authentication of inbound Bigblue webhook deliveries.
 *
 * @module lib/integrations/bigblue/webhook-signature
 */

import { createHmac, timingSafeEqual } from "node:crypto";

import { isRecord } from "@/lib/shared/guards";

/** Strict standard-alphabet base64 (Node's decoder silently skips invalid characters). */
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;
/** Upper bound on a verification body; anything larger is not a challenge. */
const MAX_VERIFICATION_BODY_LENGTH = 16_384;
/** Upper bound on the challenge string we are willing to echo back. */
const MAX_CHALLENGE_LENGTH = 4_096;

/**
 * Verifies the `X-Bigblue-Hmac-SHA256` header against the raw request body.
 *
 * Must be called with the exact bytes received, *before* JSON parsing, since
 * re-serialising would change the signed content.
 *
 * @param rawBody - Raw request body as received.
 * @param providedHmac - Base64 signature header value, or `null` if absent.
 * @param sharedSecret - Bigblue app *Shared secret* (`BIGBLUE_WEBHOOK_KEY`).
 * @returns `true` only for a well-formed, matching signature (constant-time comparison).
 */
export function verifyBigblueWebhookHmac(
  rawBody: string,
  providedHmac: string | null,
  sharedSecret: string,
): boolean {
  if (!providedHmac || !BASE64_PATTERN.test(providedHmac)) {
    return false;
  }

  const expected = createHmac("sha256", sharedSecret).update(rawBody, "utf8").digest();
  const provided = Buffer.from(providedHmac, "base64");
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

/**
 * Recognises Bigblue's URL-verification handshake body: exactly
 * `{"challenge": "<non-empty string>"}` and nothing else.
 *
 * The strict shape check matters because the route echoes this body back
 * verbatim; it must never reflect arbitrary content.
 *
 * @param rawBody - Raw request body.
 * @returns `true` when the body is a well-formed, bounded challenge.
 */
export function isBigblueUrlVerificationBody(rawBody: string): boolean {
  if (rawBody.length > MAX_VERIFICATION_BODY_LENGTH) return false;
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return false;
  }
  return isRecord(payload) &&
    Object.keys(payload).length === 1 &&
    typeof payload.challenge === "string" &&
    payload.challenge.length > 0 && payload.challenge.length <= MAX_CHALLENGE_LENGTH;
}
