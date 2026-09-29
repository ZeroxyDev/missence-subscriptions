import { deriveBigblueWebhookUrlToken } from "../lib/bigblue/webhook-auth.ts";

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
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    process.stderr.write("Usa solo el origen HTTPS de la app, sin rutas ni parámetros.\n");
    process.exit(1);
  }
  url.pathname = "/api/webhooks/bigblue/order-status";
  url.searchParams.set("token", deriveBigblueWebhookUrlToken(key));
  process.stdout.write(`${url.toString()}\n`);
}
