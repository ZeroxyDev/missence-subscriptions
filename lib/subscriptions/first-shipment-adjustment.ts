import { PRODUCT_PAIRS } from "@/config/subscription-product-pairs";
import type { ShopifyOrder, ShopifyOrderLineItem } from "@/lib/shopify/order";

type LinePricing = {
  unitPrice: string;
  unitTax: string;
  discount: string;
};

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
      experiencePricing: LinePricing;
      subscriptionPricing: LinePricing;
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

// Work in cents and put any unit-price rounding remainder into the line discount.
function getTotals(items: ShopifyOrderLineItem[], taxesIncluded: boolean) {
  return items.reduce((total, item) => {
    const tax = item.tax_lines.reduce(
      (sum, line) => sum + Math.round(Number(line.price) * 100), 0,
    );
    const price = Math.round(Number(item.price) * 100) * item.quantity;
    return {
      price: total.price + price - (taxesIncluded ? tax : 0),
      tax: total.tax + tax,
      discount: total.discount + Math.round(Number(item.total_discount) * 100),
    };
  }, { price: 0, tax: 0, discount: 0 });
}

function pricing(totals: { price: number; tax: number; discount: number }, quantity: number): LinePricing {
  if (quantity === 0) return { unitPrice: "0.00", unitTax: "0.00", discount: "0.00" };
  const unitPrice = Math.ceil(totals.price / quantity);
  const unitTax = Math.ceil(totals.tax / quantity);
  return {
    unitPrice: formatMoney(unitPrice / 100),
    unitTax: formatMoney(unitTax / 100),
    discount: formatMoney(
      (totals.discount +
        unitPrice * quantity - totals.price +
        unitTax * quantity - totals.tax) /
        100,
    ),
  };
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
    const subscriptionItems = order.line_items.filter((lineItem) => matchesProduct(lineItem, pair.subscription));
    const subscriptionQuantity = subscriptionItems
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
      const targetQuantity = Math.max(subscriptionQuantity - experienceQuantity, 0);
      const subscriptionTotals = getTotals(subscriptionItems, order.taxes_included !== false);
      const experienceTotals = getTotals(experienceItems, order.taxes_included !== false);
      const remaining = {
        price: Math.round(subscriptionTotals.price * targetQuantity / subscriptionQuantity),
        tax: Math.round(subscriptionTotals.tax * targetQuantity / subscriptionQuantity),
        discount: Math.round(subscriptionTotals.discount * targetQuantity / subscriptionQuantity),
      };
      const combined = {
        price: experienceTotals.price + subscriptionTotals.price - remaining.price,
        tax: experienceTotals.tax + subscriptionTotals.tax - remaining.tax,
        discount: experienceTotals.discount + subscriptionTotals.discount - remaining.discount,
      };
      return {
        shouldAdjust: true,
        pair: pair.id,
        shopifyOrderId: String(order.id),
        subscriptionSku: pair.subscription.sku,
        experienceSku: pair.experience.sku,
        experienceReplacementSku: pair.experience.replacement.sku,
        subscriptionQuantity,
        experienceQuantity,
        experiencePricing: pricing(combined, experienceQuantity),
        subscriptionPricing: pricing(remaining, targetQuantity),
        targetQuantity,
      };
    }
  }

  return { shouldAdjust: false };
}
