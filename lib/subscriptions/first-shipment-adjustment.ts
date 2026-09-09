import { PRODUCT_PAIRS } from "@/config/subscription-product-pairs";
import type { ShopifyOrder, ShopifyOrderLineItem } from "@/lib/shopify/order";

export type FirstShipmentAdjustment =
  | {
      shouldAdjust: true;
      pair: (typeof PRODUCT_PAIRS)[number]["id"];
      shopifyOrderId: string;
      subscriptionSku: string;
      oneTimeSku: string;
      originalQuantity: number;
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

    const hasOneTimeProduct = order.line_items.some((lineItem) =>
      matchesProduct(lineItem, pair.oneTime),
    );

    if (subscriptionQuantity > 0 && hasOneTimeProduct) {
      return {
        shouldAdjust: true,
        pair: pair.id,
        shopifyOrderId: String(order.id),
        subscriptionSku: pair.subscription.sku,
        oneTimeSku: pair.oneTime.sku,
        originalQuantity: subscriptionQuantity,
        targetQuantity: Math.max(subscriptionQuantity - 1, 0),
      };
    }
  }

  return { shouldAdjust: false };
}

