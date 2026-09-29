import {
  getBigblueApiKey,
  getShopifyAdminAccessToken,
  getShopifyAdminStoreDomain,
} from "@/config/server-env";
import { createBigblueClient } from "@/lib/bigblue/client";
import { listRecentExperienceOrders } from "@/lib/shopify/admin-orders";
import {
  reconcileFirstShipments,
  type ReconciliationSummary,
} from "@/lib/subscriptions/reconcile-first-shipments";

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
