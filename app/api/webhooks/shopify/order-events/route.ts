import {
  getBigblueApiKey,
  getShopifyAdminAccessToken,
  getShopifyAdminStoreDomain,
  getShopifyWebhookSecret,
} from "@/config/server-env";
import { createBigblueClient } from "@/lib/bigblue/client";
import { logIntegrationEvent } from "@/lib/observability/integration-log";
import { getReconciliationCandidate } from "@/lib/shopify/admin-orders";
import {
  InvalidShopifyOrderEventError,
  isShopifyOrderEventTopic,
  parseShopifyOrderEvent,
} from "@/lib/shopify/order-event";
import { verifyShopifyWebhook } from "@/lib/shopify/verify-webhook";
import { detectFirstShipmentAdjustment } from "@/lib/subscriptions/first-shipment-adjustment";
import { reconcileFirstShipments } from "@/lib/subscriptions/reconcile-first-shipments";

export const runtime = "nodejs";
export const maxDuration = 30;

const WEBHOOK_PROCESSING_BUDGET_MS = 4_000;

export async function POST(request: Request): Promise<Response> {
  const deadlineAtMs = Date.now() + WEBHOOK_PROCESSING_BUDGET_MS;
  const rawBody = await request.text();
  const webhookId = request.headers.get("x-shopify-webhook-id") ?? undefined;
  const topic = request.headers.get("x-shopify-topic");
  let orderId: number | undefined;

  try {
    if (!verifyShopifyWebhook(rawBody, request.headers.get("x-shopify-hmac-sha256"), getShopifyWebhookSecret())) {
      logIntegrationEvent("invalid_shopify_hmac", { webhookId });
      return Response.json({ ok: false, error: "invalid_hmac" }, { status: 401 });
    }
    if (!isShopifyOrderEventTopic(topic)) {
      logIntegrationEvent("invalid_shopify_topic", { webhookId, receivedTopic: topic });
      return Response.json({ ok: false, error: "invalid_topic" }, { status: 400 });
    }

    const storeDomain = getShopifyAdminStoreDomain();
    if (request.headers.get("x-shopify-shop-domain") !== storeDomain) {
      logIntegrationEvent("invalid_shopify_payload", { webhookId, reason: "shop_domain_mismatch" });
      return Response.json({ ok: false, error: "invalid_shop_domain" }, { status: 401 });
    }

    orderId = parseShopifyOrderEvent(rawBody, topic);
    logIntegrationEvent("shopify_order_event_received", { webhookId, topic, shopifyOrderId: String(orderId) });

    const candidate = await getReconciliationCandidate({
      orderId,
      accessToken: getShopifyAdminAccessToken(),
      storeDomain,
    });
    if (!candidate) {
      throw new Error("Shopify order is not yet available from Admin API");
    }

    if (candidate.cancelled || candidate.fulfillmentStatus !== "UNFULFILLED") {
      logIntegrationEvent("reconciliation_skipped", {
        shopifyOrderId: String(orderId),
        topic,
        reason: candidate.cancelled ? "shopify_cancelled" : "shopify_not_unfulfilled",
      });
      return Response.json({ ok: true, skipped: true, reason: candidate.cancelled ? "cancelled" : "not_unfulfilled" });
    }

    if (!detectFirstShipmentAdjustment(candidate.order).shouldAdjust) {
      if (candidate.edited) {
        logIntegrationEvent("manual_review_required", {
          shopifyOrderId: String(orderId),
          topic,
          reason: "edited_order_no_longer_matches_pair",
        });
      }
      return Response.json({ ok: true, skipped: true, reason: "no_matching_pair", manualReview: candidate.edited });
    }

    const summary = await reconcileFirstShipments(
      [candidate],
      createBigblueClient({ apiKey: getBigblueApiKey(), deadlineAtMs }),
      { retryNotReady: true },
    );
    if (summary.failed > 0) {
      return Response.json({ ok: false, retryable: true, error: "reconciliation_failed" }, { status: 503 });
    }
    return Response.json({ ok: true, ...summary });
  } catch (error) {
    if (error instanceof InvalidShopifyOrderEventError) {
      logIntegrationEvent("invalid_shopify_payload", { webhookId, topic, reason: error.message });
      return Response.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }
    logIntegrationEvent("reconciliation_failed", {
      webhookId,
      topic,
      shopifyOrderId: orderId === undefined ? undefined : String(orderId),
      reason: error instanceof Error ? error.name : "unknown_error",
    });
    return Response.json({ ok: false, retryable: true, error: "reconciliation_failed" }, { status: 503 });
  }
}
