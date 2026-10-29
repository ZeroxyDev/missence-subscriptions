/**
 * @file Composition root for the periodic, store-wide reconciliation.
 *
 * Wires real credentials and clients into {@link reconcileFirstShipments}.
 * Shared by the cron endpoint and the Bigblue status webhook.
 *
 * @module lib/subscriptions/application/run-reconciliation
 */

import {
  getBigblueApiKey,
  getShopifyAdminAccessToken,
  getShopifyAdminStoreDomain,
} from "@/config/server-env";
import { createBigblueClient } from "@/lib/integrations/bigblue/client";
import { listRecentExperienceOrders } from "@/lib/integrations/shopify/admin/orders";
import {
  reconcileFirstShipments,
  type ReconciliationSummary,
} from "@/lib/subscriptions/application/reconcile-first-shipments";

/**
 * Reconciles every first-shipment order created in the last 48 hours.
 *
 * @returns The batch summary.
 * @throws {EnvironmentConfigurationError} When a required credential is missing.
 * @throws {ShopifyAdminOrdersError} When the Shopify order search fails.
 * @sideEffects Reads Shopify, may update Bigblue, emits log events.
 */
export async function runRecentBigblueReconciliation(): Promise<ReconciliationSummary> {
  const candidates = await listRecentExperienceOrders({
    accessToken: getShopifyAdminAccessToken(),
    storeDomain: getShopifyAdminStoreDomain(),
  });
  return reconcileFirstShipments(
    candidates,
    createBigblueClient({ apiKey: getBigblueApiKey() }),
  );
}
