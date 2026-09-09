import { PRODUCT_PAIRS } from "@/config/subscription-product-pairs";
import type { ShopifyOrder, ShopifyOrderLineItem } from "@/lib/shopify/order";

export type FirstShipmentAdjustment =
  | {
      shouldAdjust: true;
      pair: (typeof PRODUCT_PAIRS)[number]["id"];
      shopifyOrderId: string;
      subscriptionSku: string;
      experienceSku: string;
      subscriptionQuantity: number;
      experienceQuantity: number;
      targetQuantity: number;
    }
  | {
      shouldAdjust: false;
    };

function matchesProduct(
  lineItem: ShopifyOrderLineItem,
  product: { readonly sku: string; readonly variantId: number },
): boolean {
  return (
    lineItem.quantity > 0 &&
    lineItem.sku === product.sku &&
    lineItem.variant_id === product.variantId
  );
}

export function detectFirstShipmentAdjustment(
  order: ShopifyOrder,
): FirstShipmentAdjustment {
  for (const pair of PRODUCT_PAIRS) {
    const subscriptionQuantity = order.line_items
      .filter((lineItem) => matchesProduct(lineItem, pair.subscription))
      .reduce((total, lineItem) => total + lineItem.quantity, 0);

    const experienceQuantity = order.line_items
      .filter((lineItem) => matchesProduct(lineItem, pair.experience))
      .reduce((total, lineItem) => total + lineItem.quantity, 0);

    // The experience is only added to an initial checkout or a resubscription.
    // Its presence alongside the subscription identifies the first shipment.
    if (subscriptionQuantity > 0 && experienceQuantity > 0) {
      return {
        shouldAdjust: true,
        pair: pair.id,
        shopifyOrderId: String(order.id),
        subscriptionSku: pair.subscription.sku,
        experienceSku: pair.experience.sku,
        subscriptionQuantity,
        experienceQuantity,
        targetQuantity: Math.max(
          subscriptionQuantity - experienceQuantity,
          0,
        ),
      };
    }
  }

  return { shouldAdjust: false };
}
