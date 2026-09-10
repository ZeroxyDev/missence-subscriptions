import { PRODUCT_PAIRS } from "@/config/subscription-product-pairs";
import type { ShopifyOrder, ShopifyOrderLineItem } from "@/lib/shopify/order";

export type FirstShipmentAdjustment =
  | {
      shouldAdjust: true;
      pair: (typeof PRODUCT_PAIRS)[number]["id"];
      shopifyOrderId: string;
      subscriptionSku: string;
      experienceSku: string;
      experienceReplacementSku: string;
      subscriptionQuantity: number;
      experienceQuantity: number;
      experiencePricing: {
        unitPrice: string;
        unitTax: string;
        discount: string;
      };
      targetQuantity: number;
    }
  | {
      shouldAdjust: false;
    };

function matchesProduct(
  lineItem: ShopifyOrderLineItem,
  product: {
    readonly sku: string;
    readonly productId: number;
    readonly variantId: number | null;
  },
): boolean {
  return (
    lineItem.quantity > 0 &&
    lineItem.sku === product.sku &&
    lineItem.product_id === product.productId &&
    (product.variantId === null || lineItem.variant_id === product.variantId)
  );
}

function formatMoney(value: number): string {
  return value.toFixed(2);
}

function summarizeLineItem(lineItem: ShopifyOrderLineItem) {
  return {
    sku: lineItem.sku,
    productId: lineItem.product_id,
    variantId: lineItem.variant_id,
    quantity: lineItem.quantity,
  };
}

export function getFirstShipmentDetectionDiagnostics(order: ShopifyOrder) {
  return {
    lineItems: order.line_items.map(summarizeLineItem),
    pairChecks: PRODUCT_PAIRS.map((pair) => ({
      pair: pair.id,
      subscription: {
        expected: pair.subscription,
        sameSku: order.line_items
          .filter((lineItem) => lineItem.sku === pair.subscription.sku)
          .map(summarizeLineItem),
      },
      experience: {
        expected: pair.experience,
        sameSku: order.line_items
          .filter((lineItem) => lineItem.sku === pair.experience.sku)
          .map(summarizeLineItem),
      },
    })),
  };
}

export function detectFirstShipmentAdjustment(
  order: ShopifyOrder,
): FirstShipmentAdjustment {
  for (const pair of PRODUCT_PAIRS) {
    const subscriptionQuantity = order.line_items
      .filter((lineItem) => matchesProduct(lineItem, pair.subscription))
      .reduce((total, lineItem) => total + lineItem.quantity, 0);

    const experienceItems = order.line_items.filter((lineItem) =>
      matchesProduct(lineItem, pair.experience),
    );
    const experienceQuantity = experienceItems
      .reduce((total, lineItem) => total + lineItem.quantity, 0);

    // The experience is only added to an initial checkout or a resubscription.
    // Its presence alongside the subscription identifies the first shipment.
    const experienceItem = experienceItems[0];

    if (
      subscriptionQuantity > 0 &&
      experienceQuantity > 0 &&
      experienceItem
    ) {
      return {
        shouldAdjust: true,
        pair: pair.id,
        shopifyOrderId: String(order.id),
        subscriptionSku: pair.subscription.sku,
        experienceSku: pair.experience.sku,
        experienceReplacementSku: pair.experience.replacement.sku,
        subscriptionQuantity,
        experienceQuantity,
        experiencePricing: {
          unitPrice: experienceItem.price,
          unitTax: formatMoney(
            experienceItems.reduce(
              (total, lineItem) =>
                total +
                lineItem.tax_lines.reduce(
                  (lineTax, taxLine) => lineTax + Number(taxLine.price),
                  0,
                ),
              0,
            ) / experienceQuantity,
          ),
          discount: formatMoney(
            experienceItems.reduce(
              (total, lineItem) => total + Number(lineItem.total_discount),
              0,
            ),
          ),
        },
        targetQuantity: Math.max(
          subscriptionQuantity - experienceQuantity,
          0,
        ),
      };
    }
  }

  return { shouldAdjust: false };
}
