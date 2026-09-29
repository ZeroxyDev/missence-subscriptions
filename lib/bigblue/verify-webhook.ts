import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyBigblueWebhookHmac(
  rawBody: string,
  providedHmac: string | null,
  sharedSecret: string,
): boolean {
  if (!providedHmac || !/^[A-Za-z0-9+/]+={0,2}$/.test(providedHmac)) {
    return false;
  }

  const expected = createHmac("sha256", sharedSecret).update(rawBody, "utf8").digest();
  const provided = Buffer.from(providedHmac, "base64");
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export function isBigblueUrlVerificationBody(rawBody: string): boolean {
  if (rawBody.length > 16_384) return false;
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return false;
  }
  return typeof payload === "object" && payload !== null && !Array.isArray(payload) &&
    Object.keys(payload).length === 1 &&
    "challenge" in payload &&
    typeof payload.challenge === "string" &&
    payload.challenge.length > 0 && payload.challenge.length <= 4_096;
}
