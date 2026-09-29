import { getBigblueWebhookKey } from "@/config/server-env";
import { verifyBigblueWebhookUrlToken } from "@/lib/bigblue/webhook-auth";
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

  // Only Order Status Update is configured for this URL. Its payload format is
  // not needed: every accepted event triggers a fresh comparison with Shopify.
  // The reconciliation itself is idempotent, including if our UpdateOrder emits
  // another status event.
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
