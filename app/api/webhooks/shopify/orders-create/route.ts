/**
 * @file `POST /api/webhooks/shopify/orders-create` — Shopify `orders/create` webhook.
 *
 * Fast path of the integration: verifies the delivery, detects first-shipment
 * orders and adjusts the Bigblue logistics copy within Shopify's 5-second
 * response window.
 *
 * | Status | Body `error`               | Meaning                                       |
 * | ------ | -------------------------- | --------------------------------------------- |
 * | 200    | –                          | Ignored, already adjusted, or updated         |
 * | 400    | `invalid_topic`            | Wrong `X-Shopify-Topic`                       |
 * | 400    | `invalid_shopify_payload`  | Body is not a valid order                     |
 * | 401    | `invalid_hmac`             | Signature check failed                        |
 * | 409    | `bigblue_api_error`        | Bigblue `412` (order no longer editable)      |
 * | 502    | `bigblue_api_error`        | Permanent Bigblue error                       |
 * | 503    | (various, `retryable`)     | Transient: Shopify should redeliver           |
 * | 500    | `internal_error`           | Unexpected failure (incl. missing config)     |
 *
 * @module app/api/webhooks/shopify/orders-create/route
 */

import { getBigblueApiKey, getShopifyWebhookSecret } from "@/config/server-env";
import { jsonError } from "@/lib/http/responses";
import { createBigblueClient } from "@/lib/integrations/bigblue/client";
import {
  BigblueApiError,
  BigblueOrderNotReadyError,
  InvalidBigblueResponseError,
} from "@/lib/integrations/bigblue/errors";
import {
  InvalidShopifyOrderError,
  parseShopifyOrder,
} from "@/lib/integrations/shopify/order";
import { verifyShopifyWebhook } from "@/lib/integrations/shopify/webhook-signature";
import { logIntegrationEvent } from "@/lib/observability/integration-log";
import { handleOrderCreated } from "@/lib/subscriptions/application/handle-order-created";

/** `node:crypto` is required for HMAC verification. */
export const runtime = "nodejs";
/** Platform ceiling; the handler itself budgets {@link WEBHOOK_PROCESSING_BUDGET_MS}. */
export const maxDuration = 30;

/** The only topic this endpoint accepts. */
const SHOPIFY_TOPIC = "orders/create";
/** Shared deadline for all Bigblue calls; leaves headroom under Shopify's 5 s limit. */
const WEBHOOK_PROCESSING_BUDGET_MS = 4_000;

/**
 * Maps a processing failure to a logged HTTP response.
 *
 * @param error - Caught error.
 * @param context - Correlation fields for the log line.
 * @returns The response to send to Shopify.
 * @sideEffects Logs one warning/error event.
 */
function toErrorResponse(
  error: unknown,
  context: { shopifyOrderId: string | undefined; webhookId: string | undefined },
): Response {
  const { shopifyOrderId, webhookId } = context;

  if (error instanceof InvalidShopifyOrderError) {
    logIntegrationEvent("invalid_shopify_payload", { reason: error.message, shopifyOrderId, webhookId });
    return jsonError("invalid_shopify_payload", { status: 400 });
  }

  if (error instanceof BigblueOrderNotReadyError) {
    logIntegrationEvent("bigblue_not_ready", {
      shopifyOrderId,
      searchedExternalIds: error.externalIds,
      webhookId,
    });
    return jsonError("bigblue_order_not_ready", { status: 503, retryable: true });
  }

  if (error instanceof BigblueApiError) {
    logIntegrationEvent("update_failed", {
      bigblueCode: error.code,
      bigblueMessage: error.message,
      bigblueStatus: error.status,
      retryable: error.retryable,
      shopifyOrderId,
      webhookId,
    });
    // 412 = precondition failed (order no longer editable): a conflict, not an outage.
    return jsonError("bigblue_api_error", {
      status: error.status === 412 ? 409 : error.retryable ? 503 : 502,
      retryable: error.retryable,
    });
  }

  if (error instanceof InvalidBigblueResponseError) {
    logIntegrationEvent("update_failed", { reason: "invalid_bigblue_response", shopifyOrderId, webhookId });
    return jsonError("invalid_bigblue_response", { status: 503, retryable: true });
  }

  logIntegrationEvent("update_failed", { reason: "unexpected_error", shopifyOrderId, webhookId });
  return jsonError("internal_error", { status: 500, retryable: true });
}

/**
 * Handles one `orders/create` delivery.
 *
 * Order of checks: HMAC on the raw body → topic → payload parsing → business logic.
 *
 * @param request - Incoming webhook request.
 * @returns The HTTP response for Shopify.
 */
export async function POST(request: Request): Promise<Response> {
  const deadlineAtMs = Date.now() + WEBHOOK_PROCESSING_BUDGET_MS;
  const rawBody = await request.text();
  const webhookId = request.headers.get("x-shopify-webhook-id") ?? undefined;
  let shopifyOrderId: string | undefined;

  try {
    const webhookSecret = getShopifyWebhookSecret();
    const hmac = request.headers.get("x-shopify-hmac-sha256");

    if (!verifyShopifyWebhook(rawBody, hmac, webhookSecret)) {
      logIntegrationEvent("invalid_shopify_hmac", { webhookId });
      return jsonError("invalid_hmac", { status: 401 });
    }

    const topic = request.headers.get("x-shopify-topic");
    if (topic !== SHOPIFY_TOPIC) {
      logIntegrationEvent("invalid_shopify_topic", { receivedTopic: topic, webhookId });
      return jsonError("invalid_topic", { status: 400 });
    }

    const order = parseShopifyOrder(rawBody);
    shopifyOrderId = String(order.id);

    const outcome = await handleOrderCreated({
      order,
      webhookId,
      createBigblueRequest: () => createBigblueClient({ apiKey: getBigblueApiKey(), deadlineAtMs }),
    });

    if (outcome.kind === "ignored") {
      return Response.json({ ok: true, ignored: true, reason: "no_matching_pair" });
    }
    return Response.json(outcome.result);
  } catch (error) {
    return toErrorResponse(error, { shopifyOrderId, webhookId });
  }
}
