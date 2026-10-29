/**
 * @file Shared harness for Route Handler characterization tests.
 *
 * Route tests exercise the real `app/api/**` handlers end to end with an
 * in-memory `fetch`, a controlled environment and captured console output.
 * They pin the externally observable contract of each endpoint (status code,
 * JSON body, `Cache-Control` header and the sequence of structured log events)
 * so that internal refactors cannot silently change behaviour that Shopify,
 * Bigblue, the external scheduler or log-based alerting depend on.
 *
 * This file lives outside the `tests/*.test.ts` glob on purpose: it is a
 * support module, not a test suite.
 */

import { createHmac } from "node:crypto";
import { afterEach, beforeEach } from "node:test";

/** Log severities emitted by `logIntegrationEvent`. */
export type CapturedLogLevel = "info" | "warn" | "error";

/** A single structured log line captured from the console. */
export type CapturedLog = {
  level: CapturedLogLevel;
  event: string;
  payload: Record<string, unknown>;
};

/** Handler signature used by the fake `fetch` router. */
export type FetchRoute = (url: URL, init: RequestInit | undefined) => Response | Promise<Response>;

/** Environment variables every route test starts from. */
export const TEST_ENV = {
  SHOPIFY_WEBHOOK_SECRET: "test-shopify-webhook-secret",
  SHOPIFY_ACCESS_TOKEN: "test-shopify-admin-token",
  SHOPIFY_ADMIN_STORE_DOMAIN: "missence-test.myshopify.com",
  BIGBLUE_API_KEY: "test-bigblue-api-key",
  BIGBLUE_WEBHOOK_KEY: "test-bigblue-webhook-key",
  RECONCILIATION_CRON_SECRET: "test-reconciliation-cron-secret",
} as const;

/** Every variable the application reads; cleared before each test. */
const MANAGED_ENV_NAMES = [
  ...Object.keys(TEST_ENV),
  "SHOPIFY_WEBHOOK_KEY",
  "SHOPIFY_ADMIN_ACCESS_TOKEN",
  "SHOPIFY_STORE_DOMAIN",
  "SHOPIFY_PRIVATE_ACCESS_TOKEN",
  "SHOPIFY_PUBLIC_ACCESS_TOKEN",
] as const;

/** Mutable state shared by the hooks registered in {@link useRouteHarness}. */
export type RouteHarness = {
  /** Structured log lines captured during the current test. */
  logs: CapturedLog[];
  /** Requests received by the fake `fetch`, in call order. */
  requests: { url: URL; body: unknown }[];
  /** Replaces the fake `fetch` router for the current test. */
  routeFetch: (route: FetchRoute) => void;
  /** Returns `[level, event]` tuples, convenient for sequence assertions. */
  events: () => [CapturedLogLevel, string][];
};

/**
 * Registers `beforeEach`/`afterEach` hooks that isolate a Route Handler test:
 * a deterministic environment, a fake global `fetch` and captured console logs.
 *
 * @returns Live harness state for the enclosing `describe` block.
 */
export function useRouteHarness(): RouteHarness {
  const originalFetch = globalThis.fetch;
  const originalConsole = { info: console.info, warn: console.warn, error: console.error };
  const savedEnv = new Map<string, string | undefined>();
  let route: FetchRoute = (url) => {
    throw new Error(`Unexpected outbound request to ${url.href}`);
  };

  const harness: RouteHarness = {
    logs: [],
    requests: [],
    routeFetch: (next) => {
      route = next;
    },
    events: () => harness.logs.map((log) => [log.level, log.event]),
  };

  beforeEach(() => {
    harness.logs.length = 0;
    harness.requests.length = 0;
    route = (url) => {
      throw new Error(`Unexpected outbound request to ${url.href}`);
    };

    for (const name of MANAGED_ENV_NAMES) {
      savedEnv.set(name, process.env[name]);
      delete process.env[name];
    }
    Object.assign(process.env, TEST_ENV);

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
      harness.requests.push({ url, body });
      return route(url, init);
    }) as typeof fetch;

    for (const level of ["info", "warn", "error"] as const) {
      console[level] = (_label: unknown, payload: unknown) => {
        const record = payload as Record<string, unknown>;
        harness.logs.push({ level, event: String(record.event), payload: record });
      };
    }
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    Object.assign(console, originalConsole);
    for (const [name, value] of savedEnv) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  });

  return harness;
}

/**
 * Computes the base64 HMAC-SHA256 signature Shopify and Bigblue send with
 * every webhook delivery.
 *
 * @param body - Exact raw request body.
 * @param secret - Shared signing secret.
 */
export function signWebhook(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body, "utf8").digest("base64");
}

/** Builds a JSON `Response` for the fake `fetch` router. */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Reads the status, parsed body and caching header of a handler response.
 *
 * @param response - Response returned by a Route Handler.
 */
export async function readResponse(response: Response): Promise<{
  status: number;
  body: unknown;
  cacheControl: string | null;
}> {
  const text = await response.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // Non-JSON bodies (e.g. the plain-text GET challenge) are returned raw.
  }
  return { status: response.status, body, cacheControl: response.headers.get("cache-control") };
}
