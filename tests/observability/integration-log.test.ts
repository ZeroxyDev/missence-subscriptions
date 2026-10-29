import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { logIntegrationEvent, type IntegrationEvent } from "@/lib/observability/integration-log";

/**
 * Severity contract relied on by log-based alerting. Changing an entry here
 * must be a deliberate, documented decision (see docs/operations/runbook.md).
 */
const EXPECTED_LEVELS: Record<IntegrationEvent, "info" | "warn" | "error"> = {
  already_adjusted: "info",
  adjustment_detected: "info",
  adjustment_planned: "info",
  bigblue_not_ready: "warn",
  bigblue_order_found: "info",
  bigblue_webhook_received: "info",
  ignored_no_pair: "info",
  invalid_shopify_payload: "warn",
  invalid_shopify_hmac: "warn",
  invalid_shopify_topic: "warn",
  shopify_order_event_received: "info",
  manual_review_required: "error",
  price_mismatch: "error",
  price_verified: "info",
  reconciliation_configuration_error: "error",
  reconciliation_failed: "error",
  reconciliation_finished: "info",
  reconciliation_skipped: "warn",
  update_failed: "error",
  update_not_persisted: "warn",
  update_verified: "info",
  updated: "info",
};

describe("logIntegrationEvent", () => {
  const original = { info: console.info, warn: console.warn, error: console.error };
  afterEach(() => Object.assign(console, original));

  for (const [event, level] of Object.entries(EXPECTED_LEVELS) as [IntegrationEvent, string][]) {
    it(`logs ${event} at ${level}`, () => {
      const calls: [string, unknown, unknown][] = [];
      for (const candidate of ["info", "warn", "error"] as const) {
        console[candidate] = (label: unknown, payload: unknown) => calls.push([candidate, label, payload]);
      }
      logIntegrationEvent(event, { shopifyOrderId: "1" });
      assert.deepEqual(calls, [[level, "bigblue_subscription_adjustment", { event, shopifyOrderId: "1" }]]);
    });
  }
});
