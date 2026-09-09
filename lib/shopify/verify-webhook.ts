import { createHmac, timingSafeEqual } from "node:crypto";

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

