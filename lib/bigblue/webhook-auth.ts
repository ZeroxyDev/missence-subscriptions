import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_CONTEXT = "missence-bigblue-order-status-url-v1";

// Bigblue's UI only asks for a target URL. Use a derived, scoped bearer token
// in that URL rather than exposing the reusable Bigblue webhook secret itself.
export function deriveBigblueWebhookUrlToken(webhookKey: string): string {
  return createHmac("sha256", webhookKey).update(TOKEN_CONTEXT).digest("hex");
}

export function verifyBigblueWebhookUrlToken(
  suppliedToken: string | null,
  webhookKey: string,
): boolean {
  if (!suppliedToken || !/^[0-9a-f]{64}$/.test(suppliedToken)) return false;
  const supplied = Buffer.from(suppliedToken, "hex");
  const expected = Buffer.from(deriveBigblueWebhookUrlToken(webhookKey), "hex");
  return timingSafeEqual(supplied, expected);
}
