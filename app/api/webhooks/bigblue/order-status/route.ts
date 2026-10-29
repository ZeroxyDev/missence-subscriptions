/**
 * @file `/api/webhooks/bigblue/order-status` — Bigblue *Order Status Update* webhook.
 *
 * - `POST URL_VERIFICATION`: Bigblue's registration handshake. The exact JSON
 *   challenge is echoed back; no order data is touched.
 * - `POST ORDER_STATUS_UPDATE`: HMAC-authenticated trigger for the idempotent
 *   store-wide reconciliation (including events caused by our own updates).
 * - `GET ?token=…[&challenge=…]`: authenticated liveness probe using the
 *   derived URL token (see `webhook-url-token.ts`).
 *
 * Status events are not documented to fire on line-item reverts, so this
 * webhook complements, but does not replace, the reconciliation cron.
 *
 * @module app/api/webhooks/bigblue/order-status/route
 */

import { getBigblueWebhookKey } from "@/config/server-env";
import { loadRequiredSecret } from "@/lib/http/request-auth";
import {
  jsonError,
  NO_STORE_HEADERS,
  reconciliationFailedResponse,
  reconciliationSummaryResponse,
  unauthorizedResponse,
} from "@/lib/http/responses";
import { verifyBigblueWebhookUrlToken } from "@/lib/integrations/bigblue/webhook-url-token";
import {
  isBigblueUrlVerificationBody,
  verifyBigblueWebhookHmac,
} from "@/lib/integrations/bigblue/webhook-signature";
import { logIntegrationEvent } from "@/lib/observability/integration-log";
import { describeErrorForLog } from "@/lib/shared/errors";
import { runRecentBigblueReconciliation } from "@/lib/subscriptions/application/run-reconciliation";

/** `node:crypto` is required for HMAC verification. */
export const runtime = "nodejs";
/** A full reconciliation pass may take several Shopify and Bigblue round-trips. */
export const maxDuration = 60;

/** Name reported in logs when the shared secret is missing. */
const WEBHOOK_KEY_VARIABLE = "BIGBLUE_WEBHOOK_KEY";
/** Longest GET challenge echoed back. */
const MAX_GET_CHALLENGE_LENGTH = 256;

/**
 * Liveness probe for the private webhook URL.
 *
 * @param request - Request carrying `?token=` and optionally `?challenge=`.
 * @returns The challenge as plain text, `{ ok: true }`, or an auth error.
 */
export async function GET(request: Request): Promise<Response> {
  const key = loadRequiredSecret(getBigblueWebhookKey, WEBHOOK_KEY_VARIABLE);
  if (!key.ok) return key.response;

  const params = new URL(request.url).searchParams;
  if (!verifyBigblueWebhookUrlToken(params.get("token"), key.secret)) {
    return unauthorizedResponse();
  }

  const challenge = params.get("challenge");
  if (challenge !== null && challenge.length <= MAX_GET_CHALLENGE_LENGTH) {
    return new Response(challenge, {
      headers: { "Content-Type": "text/plain; charset=utf-8", ...NO_STORE_HEADERS },
    });
  }
  return Response.json({ ok: true }, { headers: NO_STORE_HEADERS });
}

/**
 * Handles URL verification and status-update deliveries.
 *
 * @param request - Incoming webhook request.
 * @returns The HTTP response for Bigblue.
 */
export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();
  const eventType = request.headers.get("x-bigblue-event-type");
  const signature = request.headers.get("x-bigblue-hmac-sha256");
  const key = loadRequiredSecret(getBigblueWebhookKey, WEBHOOK_KEY_VARIABLE);
  if (!key.ok) return key.response;

  // Bigblue verifies the URL with a JSON POST and requires that exact JSON in
  // the response. This branch never accesses Shopify or Bigblue order data.
  // The handshake may be unsigned; if a signature is present it must be valid.
  if (eventType === "URL_VERIFICATION") {
    if (signature !== null && !verifyBigblueWebhookHmac(rawBody, signature, key.secret)) {
      return jsonError("invalid_hmac", { status: 401 });
    }
    if (!isBigblueUrlVerificationBody(rawBody)) {
      return jsonError("invalid_challenge", { status: 400 });
    }
    return new Response(rawBody, {
      status: 200,
      headers: { "Content-Type": "application/json", ...NO_STORE_HEADERS },
    });
  }

  if (eventType !== "ORDER_STATUS_UPDATE") {
    return jsonError("invalid_event_type", { status: 400 });
  }
  if (!verifyBigblueWebhookHmac(rawBody, signature, key.secret)) {
    return jsonError("invalid_hmac", { status: 401 });
  }

  // Every authenticated status event triggers an idempotent comparison with
  // Shopify, including events emitted by our own UpdateOrder calls.
  logIntegrationEvent("bigblue_webhook_received", { eventType: "order_status_update" });
  try {
    return reconciliationSummaryResponse(await runRecentBigblueReconciliation());
  } catch (error) {
    logIntegrationEvent("reconciliation_failed", {
      source: "bigblue_webhook",
      reason: describeErrorForLog(error),
    });
    return reconciliationFailedResponse();
  }
}
