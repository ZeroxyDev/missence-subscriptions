import { getBigblueApiKey, getShopifyWebhookSecret } from "@/config/server-env";
import { BigblueApiError, createBigblueClient } from "@/lib/bigblue/client";
import {
  BigblueOrderNotReadyError,
  InvalidBigblueResponseError,
} from "@/lib/bigblue/orders";
import { logIntegrationEvent } from "@/lib/observability/integration-log";
import {
  InvalidShopifyOrderError,
  parseShopifyOrder,
} from "@/lib/shopify/order";
import { verifyShopifyWebhook } from "@/lib/shopify/verify-webhook";
import {
  detectFirstShipmentAdjustment,
  getFirstShipmentDetectionDiagnostics,
} from "@/lib/subscriptions/first-shipment-adjustment";
import { processFirstShipmentAdjustment } from "@/lib/subscriptions/process-first-shipment";

export const runtime = "nodejs";
export const maxDuration = 30;

const SHOPIFY_TOPIC = "orders/create";
const WEBHOOK_PROCESSING_BUDGET_MS = 4_000;

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
      return Response.json({ ok: false, error: "invalid_hmac" }, { status: 401 });
    }

    const topic = request.headers.get("x-shopify-topic");
    if (topic !== SHOPIFY_TOPIC) {
      logIntegrationEvent("invalid_shopify_topic", {
        receivedTopic: topic,
        webhookId,
      });
      return Response.json(
        { ok: false, error: "invalid_topic" },
        { status: 400 },
      );
    }

    const order = parseShopifyOrder(rawBody);
    shopifyOrderId = String(order.id);
    const adjustment = detectFirstShipmentAdjustment(order);

    if (!adjustment.shouldAdjust) {
      logIntegrationEvent("ignored_no_pair", {
        shopifyOrderId,
        webhookId,
        ...getFirstShipmentDetectionDiagnostics(order),
      });

      return Response.json({
        ok: true,
        ignored: true,
        reason: "no_matching_pair",
      });
    }

    logIntegrationEvent("adjustment_detected", {
      shopifyOrderId,
      webhookId,
      pair: adjustment.pair,
      subscriptionSku: adjustment.subscriptionSku,
      subscriptionQuantity: adjustment.subscriptionQuantity,
      experienceSku: adjustment.experienceSku,
      experienceQuantity: adjustment.experienceQuantity,
      experienceReplacementSku: adjustment.experienceReplacementSku,
      targetQuantity: adjustment.targetQuantity,
    });

    const bigblueRequest = createBigblueClient({
      apiKey: getBigblueApiKey(),
      deadlineAtMs,
    });
    const result = await processFirstShipmentAdjustment(
      bigblueRequest,
      order,
      adjustment,
    );

    return Response.json(result);
  } catch (error) {
    if (error instanceof InvalidShopifyOrderError) {
      logIntegrationEvent("invalid_shopify_payload", {
        reason: error.message,
        shopifyOrderId,
        webhookId,
      });
      return Response.json(
        { ok: false, error: "invalid_shopify_payload" },
        { status: 400 },
      );
    }

    if (error instanceof BigblueOrderNotReadyError) {
      logIntegrationEvent("bigblue_not_ready", {
        shopifyOrderId,
        searchedExternalIds: error.externalIds,
        webhookId,
      });
      return Response.json(
        { ok: false, retryable: true, error: "bigblue_order_not_ready" },
        { status: 503 },
      );
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
      return Response.json(
        {
          ok: false,
          retryable: error.retryable,
          error: "bigblue_api_error",
        },
        { status: error.status === 412 ? 409 : error.retryable ? 503 : 502 },
      );
    }

    if (error instanceof InvalidBigblueResponseError) {
      logIntegrationEvent("update_failed", {
        reason: "invalid_bigblue_response",
        shopifyOrderId,
        webhookId,
      });
      return Response.json(
        { ok: false, retryable: true, error: "invalid_bigblue_response" },
        { status: 503 },
      );
    }

    logIntegrationEvent("update_failed", {
      reason: "unexpected_error",
      shopifyOrderId,
      webhookId,
    });
    return Response.json(
      { ok: false, retryable: true, error: "internal_error" },
      { status: 500 },
    );
  }
}
