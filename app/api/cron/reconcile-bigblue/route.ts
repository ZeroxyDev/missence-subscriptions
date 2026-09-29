import { createHash, timingSafeEqual } from "node:crypto";

import {
  getReconciliationCronSecret,
} from "@/config/server-env";
import { logIntegrationEvent } from "@/lib/observability/integration-log";
import { runRecentBigblueReconciliation } from "@/lib/subscriptions/run-reconciliation";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(header: string | null, secret: string): boolean {
  if (!header?.startsWith("Bearer ")) return false;
  const supplied = createHash("sha256").update(header.slice(7)).digest();
  const expected = createHash("sha256").update(secret).digest();
  return timingSafeEqual(supplied, expected);
}

export async function POST(request: Request): Promise<Response> {
  let secret: string;
  try {
    secret = getReconciliationCronSecret();
  } catch {
    logIntegrationEvent("reconciliation_configuration_error", { variable: "RECONCILIATION_CRON_SECRET" });
    return Response.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  if (!authorized(request.headers.get("authorization"), secret)) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const summary = await runRecentBigblueReconciliation();
    return Response.json(
      { ok: summary.failed === 0, ...summary },
      { status: summary.failed === 0 ? 200 : 503, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    logIntegrationEvent("reconciliation_failed", {
      reason: error instanceof Error ? error.name : "unknown_error",
    });
    return Response.json(
      { ok: false, error: "reconciliation_failed" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
