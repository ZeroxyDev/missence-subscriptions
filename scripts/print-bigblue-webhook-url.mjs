/**
 * @file Prints the private Bigblue webhook URL (with its derived `?token=`).
 *
 * Usage:
 *
 * ```bash
 * node --env-file=.env --import tsx scripts/print-bigblue-webhook-url.mjs https://missence.vercel.app
 * ```
 *
 * The printed URL is a secret: anyone holding it can probe the receiver.
 * It never contains `BIGBLUE_WEBHOOK_KEY` itself, only a derived token.
 *
 * @module scripts/print-bigblue-webhook-url
 */

import { deriveBigblueWebhookUrlToken } from "../lib/integrations/bigblue/webhook-url-token.ts";

/** Path of the Bigblue webhook Route Handler. */
const WEBHOOK_PATH = "/api/webhooks/bigblue/order-status";

const key = process.env.BIGBLUE_WEBHOOK_KEY?.trim();
const baseUrl = process.argv[2];

if (!key || !baseUrl) {
  process.stderr.write("Uso: node --env-file=.env --import tsx scripts/print-bigblue-webhook-url.mjs https://tu-app.vercel.app\n");
  process.exitCode = 1;
} else {
  let url;
  try {
    url = new URL(baseUrl);
  } catch {
    process.stderr.write("La URL de la app no es válida.\n");
    process.exit(1);
  }
  // Only a bare HTTPS origin is accepted, so the token cannot leak into an unexpected path.
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    process.stderr.write("Usa solo el origen HTTPS de la app, sin rutas ni parámetros.\n");
    process.exit(1);
  }
  url.pathname = WEBHOOK_PATH;
  url.searchParams.set("token", deriveBigblueWebhookUrlToken(key));
  process.stdout.write(`${url.toString()}\n`);
}
