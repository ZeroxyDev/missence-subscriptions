import { cancel, intro, log, outro } from "@clack/prompts";

import { PRODUCT_PAIRS } from "@/config/subscription-product-pairs";
import { BigblueApiError, createBigblueClient } from "@/lib/bigblue/client";
import {
  formatBigblueDateTime,
  parseBigblueOrder,
  parseBigblueListOrdersResponse,
} from "@/lib/bigblue/orders";
import type { ShopifyOrder } from "@/lib/shopify/order";
import { detectFirstShipmentAdjustment } from "@/lib/subscriptions/first-shipment-adjustment";

const ONE_DAY_MS = 24 * 60 * 60 * 1_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function checkDetectionRules(): void {
  for (const [index, pair] of PRODUCT_PAIRS.entries()) {
    const combinedOrder: ShopifyOrder = {
      id: 90_000_000 + index,
      created_at: new Date().toISOString(),
      line_items: [
        {
          id: 1,
          sku: pair.subscription.sku,
          product_id: pair.subscription.productId,
          variant_id: pair.subscription.variantId,
          quantity: 3,
          price: "20.00",
          total_discount: "0.00",
          tax_lines: [],
        },
        {
          id: 2,
          sku: pair.experience.sku,
          product_id: pair.experience.productId,
          variant_id: pair.experience.variantId,
          quantity: 2,
          price: "10.00",
          total_discount: "0.00",
          tax_lines: [],
        },
      ],
    };
    const adjustment = detectFirstShipmentAdjustment(combinedOrder);

    if (
      !adjustment.shouldAdjust ||
      adjustment.pair !== pair.id ||
      adjustment.experienceQuantity !== 2 ||
      adjustment.targetQuantity !== 1
    ) {
      throw new Error(`La detección local falló para ${pair.id}`);
    }

    const renewal = detectFirstShipmentAdjustment({
      ...combinedOrder,
      line_items: [combinedOrder.line_items[0]],
    });

    if (renewal.shouldAdjust) {
      throw new Error(`Una renovación aislada activó la regla ${pair.id}`);
    }
  }
}

async function checkBigblueConnection(): Promise<{
  visibleOrders: number;
  validatedOrder: boolean;
}> {
  const apiKey = process.env.BIGBLUE_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("Falta BIGBLUE_API_KEY en .env");
  }

  const now = new Date();
  const request = createBigblueClient({ apiKey, timeoutMs: 10_000 });
  const response = await request("ListOrders", {
    date_range: {
      from: formatBigblueDateTime(new Date(now.getTime() - ONE_DAY_MS)),
      to: formatBigblueDateTime(now),
    },
    page_token: "",
    page_size: 100,
  });

  const { orders } = parseBigblueListOrdersResponse(response);

  const orderWithExternalId = orders.find(
    (order) =>
      isRecord(order) &&
      (typeof order.external_id === "string" ||
        typeof order.external_id === "number"),
  );

  if (orderWithExternalId) {
    parseBigblueOrder(orderWithExternalId);
  }

  return {
    visibleOrders: orders.length,
    validatedOrder: orderWithExternalId !== undefined,
  };
}

async function main(): Promise<void> {
  intro("MISSENCE · dry-run Bigblue");
  log.info("Modo de solo lectura: no se llamará a UpdateOrder");

  checkDetectionRules();
  log.success(`${PRODUCT_PAIRS.length} reglas de detección comprobadas`);

  const { visibleOrders, validatedOrder } = await checkBigblueConnection();
  log.success("Autenticación y ListOrders de Bigblue correctos");
  log.info(
    visibleOrders > 0
      ? `Bigblue devolvió ${visibleOrders} pedido(s) reciente(s); sus datos no se muestran`
      : "No hay pedidos en la muestra de las últimas 24 horas",
  );
  if (validatedOrder) {
    log.success("La estructura real del pedido coincide con el parser");
  } else if (visibleOrders > 0) {
    log.warn("La muestra no contiene pedidos con referencia externa");
  }

  outro("Dry-run completado sin modificar pedidos");
}

main().catch((error: unknown) => {
  if (error instanceof BigblueApiError) {
    cancel(
      `Bigblue rechazó la consulta (${error.status ?? "sin estado"}, ${error.code ?? "sin código"}): ${error.message}`,
    );
  } else {
    cancel(error instanceof Error ? error.message : "Error desconocido");
  }

  process.exitCode = 1;
});
