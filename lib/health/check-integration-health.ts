import "server-only";

import {
  getBigblueApiKey,
  getShopifyPrivateAccessToken,
  getShopifyStoreDomain,
  getShopifyWebhookSecret,
} from "@/config/server-env";
import { getShopifyStorefrontGraphqlUrl } from "@/config/shopify";
import { PRODUCT_PAIRS } from "@/config/subscription-product-pairs";
import { BigblueApiError, createBigblueClient } from "@/lib/bigblue/client";
import {
  formatBigblueDateTime,
  parseBigblueListOrdersResponse,
} from "@/lib/bigblue/orders";
import type {
  IntegrationCheck,
  IntegrationHealth,
} from "@/lib/health/types";

const HEALTH_CACHE_MS = 30_000;
const BIGBLUE_HEALTH_TIMEOUT_MS = 5_000;
const SHOPIFY_HEALTH_TIMEOUT_MS = 5_000;
const ONE_HOUR_MS = 60 * 60 * 1_000;

let cachedHealth:
  | { expiresAt: number; value: IntegrationHealth }
  | undefined;
let pendingHealth: Promise<IntegrationHealth> | undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function checkShopify(): Promise<IntegrationCheck> {
  let privateAccessToken: string;

  try {
    getShopifyWebhookSecret();
    privateAccessToken = getShopifyPrivateAccessToken();
  } catch {
    return {
      id: "shopify",
      label: "Shopify",
      status: "error",
      detail: "Falta configurar una credencial",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    SHOPIFY_HEALTH_TIMEOUT_MS,
  );

  try {
    const storeDomain = getShopifyStoreDomain();
    const response = await fetch(
      getShopifyStorefrontGraphqlUrl(storeDomain),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Shopify-Storefront-Private-Token": privateAccessToken,
        },
        body: JSON.stringify({ query: "query Health { shop { name } }" }),
        cache: "no-store",
        signal: controller.signal,
      },
    );
    const body: unknown = await response.json().catch(() => null);

    if (
      !response.ok ||
      !isRecord(body) ||
      !isRecord(body.data) ||
      !isRecord(body.data.shop)
    ) {
      return {
        id: "shopify",
        label: "Shopify",
        status: "error",
        detail:
          response.status === 401 || response.status === 403
            ? "El token privado no tiene acceso"
            : `La API respondió con estado ${response.status}`,
      };
    }

    return {
      id: "shopify",
      label: "Shopify",
      status: "ok",
      detail: "Conexión correcta",
    };
  } catch {
    return {
      id: "shopify",
      label: "Shopify",
      status: "error",
      detail: controller.signal.aborted
        ? "La API no respondió a tiempo"
        : "No se pudo conectar con la API",
    };
  } finally {
    clearTimeout(timeout);
  }
}

function checkProductRules(): IntegrationCheck {
  const identifiers = new Set(PRODUCT_PAIRS.map((pair) => pair.id));
  const valid =
    PRODUCT_PAIRS.length > 0 && identifiers.size === PRODUCT_PAIRS.length;

  return {
    id: "products",
    label: "Productos",
    status: valid ? "ok" : "error",
    detail: valid
      ? `${PRODUCT_PAIRS.length} reglas configuradas`
      : "La configuración necesita revisión",
  };
}

function getBigblueErrorDetail(error: unknown): string {
  if (!(error instanceof BigblueApiError)) {
    return "No se pudo comprobar la conexión";
  }

  if (error.code === "timeout") {
    return "La API no respondió a tiempo";
  }

  if (error.status === 401 || error.status === 403) {
    return "La API key no tiene acceso";
  }

  return error.status
    ? `La API respondió con estado ${error.status}`
    : "No se pudo conectar con la API";
}

async function checkBigblue(): Promise<IntegrationCheck> {
  try {
    const now = new Date();
    const request = createBigblueClient({
      apiKey: getBigblueApiKey(),
      timeoutMs: BIGBLUE_HEALTH_TIMEOUT_MS,
    });
    const response = await request("ListOrders", {
      date_range: {
        from: formatBigblueDateTime(new Date(now.getTime() - ONE_HOUR_MS)),
        to: formatBigblueDateTime(now),
      },
      page_token: "",
      page_size: 1,
    });

    parseBigblueListOrdersResponse(response);

    return {
      id: "bigblue",
      label: "Bigblue",
      status: "ok",
      detail: "Conexión correcta",
    };
  } catch (error) {
    return {
      id: "bigblue",
      label: "Bigblue",
      status: "error",
      detail: getBigblueErrorDetail(error),
    };
  }
}

async function runHealthChecks(): Promise<IntegrationHealth> {
  const [bigblue, shopify] = await Promise.all([
    checkBigblue(),
    checkShopify(),
  ]);
  const checks = [bigblue, shopify, checkProductRules()];

  return {
    status: checks.every((check) => check.status === "ok") ? "ok" : "error",
    checkedAt: new Date().toISOString(),
    checks,
  };
}

export async function checkIntegrationHealth(): Promise<IntegrationHealth> {
  const now = Date.now();

  if (cachedHealth && cachedHealth.expiresAt > now) {
    return cachedHealth.value;
  }

  if (!pendingHealth) {
    pendingHealth = runHealthChecks().then((value) => {
      cachedHealth = { expiresAt: Date.now() + HEALTH_CACHE_MS, value };
      pendingHealth = undefined;
      return value;
    });
  }

  return pendingHealth;
}
