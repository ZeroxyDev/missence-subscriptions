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
import { detectFirstShipmentAdjustment } from "@/lib/subscriptions/first-shipment-adjustment";
import { processFirstShipmentAdjustment } from "@/lib/subscriptions/process-first-shipment";

export const runtime = "nodejs";
export const maxDuration = 30;

const SHOPIFY_TOPIC = "orders/create";

export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();
  const webhookId = request.headers.get("x-shopify-webhook-id") ?? undefined;

  try {
    const webhookSecret = getShopifyWebhookSecret();
    const hmac = request.headers.get("x-shopify-hmac-sha256");

    if (!verifyShopifyWebhook(rawBody, hmac, webhookSecret)) {
      logIntegrationEvent("invalid_shopify_hmac", { webhookId });
      return Response.json({ ok: false, error: "invalid_hmac" }, { status: 401 });
    }

    const topic = request.headers.get("x-shopify-topic");
    if (topic !== SHOPIFY_TOPIC) {
      return Response.json(
        { ok: false, error: "invalid_topic" },
        { status: 400 },
      );
    }

    const order = parseShopifyOrder(rawBody);
    const adjustment = detectFirstShipmentAdjustment(order);

    if (!adjustment.shouldAdjust) {
      logIntegrationEvent("ignored_no_pair", {
        shopifyOrderId: String(order.id),
        webhookId,
      });

      return Response.json({
        ok: true,
        ignored: true,
        reason: "no_matching_pair",
      });
    }

    const bigblueRequest = createBigblueClient({ apiKey: getBigblueApiKey() });
    const result = await processFirstShipmentAdjustment(
      bigblueRequest,
      order,
      adjustment,
    );

    return Response.json(result);
  } catch (error) {
    if (error instanceof InvalidShopifyOrderError) {
      return Response.json(
        { ok: false, error: "invalid_shopify_payload" },
        { status: 400 },
      );
    }

    if (error instanceof BigblueOrderNotReadyError) {
      logIntegrationEvent("bigblue_not_ready", {
        shopifyOrderId: error.shopifyOrderId,
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
        bigblueStatus: error.status,
        retryable: error.retryable,
        webhookId,
      });
      return Response.json(
        {
          ok: false,
          retryable: error.retryable,
          error: "bigblue_api_error",
        },
        { status: error.retryable ? 503 : 502 },
      );
    }

    if (error instanceof InvalidBigblueResponseError) {
      logIntegrationEvent("update_failed", {
        reason: "invalid_bigblue_response",
        webhookId,
      });
      return Response.json(
        { ok: false, retryable: true, error: "invalid_bigblue_response" },
        { status: 503 },
      );
    }

    logIntegrationEvent("update_failed", {
      reason: "unexpected_error",
      webhookId,
    });
    return Response.json(
      { ok: false, retryable: true, error: "internal_error" },
      { status: 500 },
    );
  }
}

