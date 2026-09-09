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
  });

  const plan = planBigblueLineItemAdjustment(
    bigblueOrder.line_items,
    adjustment,
  );

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
    originalQuantity: adjustment.originalQuantity,
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

