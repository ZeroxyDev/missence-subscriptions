/**
 * @file `POST /api/webhooks/shopify/order-events` — Shopify `orders/updated` and `orders/edited`.
 *
 * Re-reads the changed order from the Admin API and reconciles Bigblue while
 * it is still `PENDING`. Complements, but does not replace, the cron: it
 * cannot detect a Bigblue-side revert that leaves Shopify unchanged.
 *
 * | Status | Body                                        | Meaning                              |
 * | ------ | ------------------------------------------- | ------------------------------------ |
 * | 200    | `{ ok: true, skipped, reason }`             | Cancelled, fulfilled or no pair      |
 * | 200    | `{ ok: true, ...summary }`                  | Reconciled                           |
 * | 400    | `invalid_topic` / `invalid_payload`         | Rejected delivery                    |
 * | 401    | `invalid_hmac` / `invalid_shop_domain`      | Authentication failed                |
 * | 503    | `reconciliation_failed` (`retryable`)       | Transient: Shopify should redeliver  |
 *
 * @module app/api/webhooks/shopify/order-events/route
 */

import {
  getBigblueApiKey,
  getShopifyAdminStoreDomain,
  getShopifyWebhookSecret,
} from "@/config/server-env";
import { jsonError } from "@/lib/http/responses";
import { createBigblueClient } from "@/lib/integrations/bigblue/client";
import {
  InvalidShopifyOrderEventError,
  isShopifyOrderEventTopic,
  parseShopifyOrderEvent,
} from "@/lib/integrations/shopify/order-event";
import { verifyShopifyWebhook } from "@/lib/integrations/shopify/webhook-signature";
import { logIntegrationEvent } from "@/lib/observability/integration-log";
import { describeErrorForLog } from "@/lib/shared/errors";
import { handleOrderEvent } from "@/lib/subscriptions/application/handle-order-event";

/** `node:crypto` is required for HMAC verification. */
export const runtime = "nodejs";
/** Platform ceiling; the handler itself budgets {@link WEBHOOK_PROCESSING_BUDGET_MS}. */
export const maxDuration = 30;

/** Shared deadline for Bigblue calls; leaves headroom under Shopify's 5 s limit. */
const WEBHOOK_PROCESSING_BUDGET_MS = 4_000;

/**
 * `503` asking Shopify to redeliver.
 *
 * @returns A JSON `Response`.
 */
function retryableFailure(): Response {
  return jsonError("reconciliation_failed", { status: 503, retryable: true });
}

/**
 * Handles one `orders/updated` or `orders/edited` delivery.
 *
 * Order of checks: HMAC → topic → shop domain → payload → business logic.
 *
 * @param request - Incoming webhook request.
 * @returns The HTTP response for Shopify.
 */
export async function POST(request: Request): Promise<Response> {
  const deadlineAtMs = Date.now() + WEBHOOK_PROCESSING_BUDGET_MS;
  const rawBody = await request.text();
  const webhookId = request.headers.get("x-shopify-webhook-id") ?? undefined;
  const topic = request.headers.get("x-shopify-topic");
  let orderId: number | undefined;

  try {
    if (!verifyShopifyWebhook(rawBody, request.headers.get("x-shopify-hmac-sha256"), getShopifyWebhookSecret())) {
      logIntegrationEvent("invalid_shopify_hmac", { webhookId });
      return jsonError("invalid_hmac", { status: 401 });
    }
    if (!isShopifyOrderEventTopic(topic)) {
      logIntegrationEvent("invalid_shopify_topic", { webhookId, receivedTopic: topic });
      return jsonError("invalid_topic", { status: 400 });
    }

    // A valid HMAC proves the app secret, not the shop: pin the shop explicitly.
    const storeDomain = getShopifyAdminStoreDomain();
    if (request.headers.get("x-shopify-shop-domain") !== storeDomain) {
      logIntegrationEvent("invalid_shopify_payload", { webhookId, reason: "shop_domain_mismatch" });
      return jsonError("invalid_shop_domain", { status: 401 });
    }

    orderId = parseShopifyOrderEvent(rawBody, topic);
    logIntegrationEvent("shopify_order_event_received", { webhookId, topic, shopifyOrderId: String(orderId) });

    const outcome = await handleOrderEvent({
      orderId,
      topic,
      storeDomain,
      createBigblueRequest: () => createBigblueClient({ apiKey: getBigblueApiKey(), deadlineAtMs }),
    });

    switch (outcome.kind) {
      case "skipped":
        return Response.json({ ok: true, skipped: true, reason: outcome.reason });
      case "no_matching_pair":
        return Response.json({ ok: true, skipped: true, reason: "no_matching_pair", manualReview: outcome.manualReview });
      case "reconciled":
        return outcome.summary.failed > 0
          ? retryableFailure()
          : Response.json({ ok: true, ...outcome.summary });
    }
  } catch (error) {
    if (error instanceof InvalidShopifyOrderEventError) {
      logIntegrationEvent("invalid_shopify_payload", { webhookId, topic, reason: error.message });
      return jsonError("invalid_payload", { status: 400 });
    }
    logIntegrationEvent("reconciliation_failed", {
      webhookId,
      topic,
      shopifyOrderId: orderId === undefined ? undefined : String(orderId),
      reason: describeErrorForLog(error),
    });
    return retryableFailure();
  }
}
