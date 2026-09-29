import { getBigblueWebhookKey } from "@/config/server-env";
import { verifyBigblueWebhookUrlToken } from "@/lib/bigblue/webhook-auth";
import { isBigblueUrlVerificationBody, verifyBigblueWebhookHmac } from "@/lib/bigblue/verify-webhook";
import { logIntegrationEvent } from "@/lib/observability/integration-log";
import { runRecentBigblueReconciliation } from "@/lib/subscriptions/run-reconciliation";

export const runtime = "nodejs";
export const maxDuration = 60;

function authenticate(request: Request): Response | null {
  let key: string;
  try {
    key = getBigblueWebhookKey();
  } catch {
    logIntegrationEvent("reconciliation_configuration_error", { variable: "BIGBLUE_WEBHOOK_KEY" });
    return Response.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  const token = new URL(request.url).searchParams.get("token");
  if (!verifyBigblueWebhookUrlToken(token, key)) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET(request: Request): Promise<Response> {
  const rejected = authenticate(request);
  if (rejected) return rejected;

  const challenge = new URL(request.url).searchParams.get("challenge");
  if (challenge !== null && challenge.length <= 256) {
    return new Response(challenge, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request): Promise<Response> {
  const rejected = authenticate(request);
  if (rejected) return rejected;

  const rawBody = await request.text();
  const eventType = request.headers.get("x-bigblue-event-type");
  const signature = request.headers.get("x-bigblue-hmac-sha256");
  const sharedSecret = getBigblueWebhookKey();

  // Bigblue verifies the target URL with a signed (or token-authenticated)
  // JSON POST and requires the exact same JSON object in the response.
  if (eventType === "URL_VERIFICATION") {
    if (signature !== null && !verifyBigblueWebhookHmac(rawBody, signature, sharedSecret)) {
      return Response.json({ ok: false, error: "invalid_hmac" }, { status: 401 });
    }
    if (!isBigblueUrlVerificationBody(rawBody)) {
      return Response.json({ ok: false, error: "invalid_challenge" }, { status: 400 });
    }
    return new Response(rawBody, {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }

  if (eventType !== "ORDER_STATUS_UPDATE") {
    return Response.json({ ok: false, error: "invalid_event_type" }, { status: 400 });
  }
  if (!verifyBigblueWebhookHmac(rawBody, signature, sharedSecret)) {
    return Response.json({ ok: false, error: "invalid_hmac" }, { status: 401 });
  }

  // Every authenticated status event triggers an idempotent comparison with
  // Shopify, including if our UpdateOrder emits another status event.
  logIntegrationEvent("bigblue_webhook_received", { eventType: "order_status_update" });
  try {
    const summary = await runRecentBigblueReconciliation();
    return Response.json(
      { ok: summary.failed === 0, ...summary },
      { status: summary.failed === 0 ? 200 : 503, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    logIntegrationEvent("reconciliation_failed", {
      source: "bigblue_webhook",
      reason: error instanceof Error ? error.name : "unknown_error",
    });
    return Response.json(
      { ok: false, error: "reconciliation_failed" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
