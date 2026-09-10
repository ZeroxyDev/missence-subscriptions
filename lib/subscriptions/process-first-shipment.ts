import { FULFILLMENT_SETTINGS } from "@/config/fulfillment-settings";
import type { BigblueRequest } from "@/lib/bigblue/client";
import {
  buildUpdateOrderPayload,
  findBigblueOrderWithRetry,
  planBigblueLineItemAdjustment,
  updateBigblueOrder,
} from "@/lib/bigblue/orders";
import { logIntegrationEvent } from "@/lib/observability/integration-log";
import type { ShopifyOrder } from "@/lib/shopify/order";
import type { FirstShipmentAdjustment } from "@/lib/subscriptions/first-shipment-adjustment";

type ActionableAdjustment = Extract<
  FirstShipmentAdjustment,
  { shouldAdjust: true }
>;

function summarizeBigblueLineItems(
  lineItems: readonly { product: string; quantity: number }[],
) {
  return lineItems.map(({ product, quantity }) => ({ product, quantity }));
}

export type FirstShipmentResult =
  | {
      ok: true;
      alreadyAdjusted: true;
      shopifyOrderId: string;
      bigblueOrderId: string;
      targetQuantity: number;
    }
  | {
      ok: true;
      updated: true;
      shopifyOrderId: string;
      bigblueOrderId: string;
      previousQuantity: number;
      targetQuantity: number;
    };

export async function processFirstShipmentAdjustment(
  request: BigblueRequest,
  order: ShopifyOrder,
  adjustment: ActionableAdjustment,
): Promise<FirstShipmentResult> {
  const bigblueOrder = await findBigblueOrderWithRetry(
    request,
    adjustment.shopifyOrderId,
    order.created_at,
  );

  logIntegrationEvent("bigblue_order_found", {
    shopifyOrderId: adjustment.shopifyOrderId,
    bigblueOrderId: bigblueOrder.id,
    pair: adjustment.pair,
    status:
      typeof bigblueOrder.status === "object" &&
      bigblueOrder.status !== null &&
      "code" in bigblueOrder.status &&
      typeof bigblueOrder.status.code === "string"
        ? bigblueOrder.status.code
        : undefined,
    lineItems: summarizeBigblueLineItems(bigblueOrder.line_items),
  });

  const plan = planBigblueLineItemAdjustment(
    bigblueOrder.line_items,
    adjustment,
    FULFILLMENT_SETTINGS,
  );

  logIntegrationEvent("adjustment_planned", {
    shopifyOrderId: adjustment.shopifyOrderId,
    bigblueOrderId: bigblueOrder.id,
    pair: adjustment.pair,
    replacementEnabled: FULFILLMENT_SETTINGS.replaceExperienceSku,
    previousQuantity: plan.previousQuantity,
    targetQuantity: adjustment.targetQuantity,
    alreadyAdjusted: plan.alreadyAdjusted,
    before: summarizeBigblueLineItems(bigblueOrder.line_items),
    after: summarizeBigblueLineItems(plan.lineItems),
  });

  if (plan.alreadyAdjusted) {
    logIntegrationEvent("already_adjusted", {
      shopifyOrderId: adjustment.shopifyOrderId,
      bigblueOrderId: bigblueOrder.id,
      pair: adjustment.pair,
      subscriptionSku: adjustment.subscriptionSku,
      targetQuantity: adjustment.targetQuantity,
    });

    return {
      ok: true,
      alreadyAdjusted: true,
      shopifyOrderId: adjustment.shopifyOrderId,
      bigblueOrderId: bigblueOrder.id,
      targetQuantity: adjustment.targetQuantity,
    };
  }

  const payload = buildUpdateOrderPayload(bigblueOrder, plan.lineItems);
  await updateBigblueOrder(request, payload);

  logIntegrationEvent("updated", {
    shopifyOrderId: adjustment.shopifyOrderId,
    bigblueOrderId: bigblueOrder.id,
    pair: adjustment.pair,
    subscriptionSku: adjustment.subscriptionSku,
    subscriptionQuantity: adjustment.subscriptionQuantity,
    experienceQuantity: adjustment.experienceQuantity,
    experienceSkuReplacement: FULFILLMENT_SETTINGS.replaceExperienceSku,
    experienceReplacementSku: adjustment.experienceReplacementSku,
    previousQuantity: plan.previousQuantity,
    targetQuantity: adjustment.targetQuantity,
  });

  return {
    ok: true,
    updated: true,
    shopifyOrderId: adjustment.shopifyOrderId,
    bigblueOrderId: bigblueOrder.id,
    previousQuantity: plan.previousQuantity,
    targetQuantity: adjustment.targetQuantity,
  };
}
