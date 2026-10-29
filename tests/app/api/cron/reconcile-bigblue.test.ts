import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { POST as cronPost } from "@/app/api/cron/reconcile-bigblue/route";
import {
  readResponse,
  TEST_ENV,
  useRouteHarness,
} from "@/tests/support/route-harness";
import {
  EMPTY_SUMMARY,
  adminOrderNode,
  fakeUpstreams,
  orderList,
  revertedBigblueOrder,
} from "@/tests/support/upstream-fakes";

describe("POST /api/cron/reconcile-bigblue", () => {
  const harness = useRouteHarness();

  function request(authorization?: string): Request {
    return new Request("https://app.test/api/cron/reconcile-bigblue", {
      method: "POST",
      headers: authorization ? { authorization } : {},
    });
  }

  it("returns 503 when the cron secret is not configured", async () => {
    delete process.env.RECONCILIATION_CRON_SECRET;
    const result = await readResponse(await cronPost(request("Bearer x")));
    assert.deepEqual(result, { status: 503, body: { ok: false, error: "not_configured" }, cacheControl: null });
    assert.deepEqual(harness.events(), [["error", "reconciliation_configuration_error"]]);
  });

  it("rejects a missing or wrong bearer token", async () => {
    for (const header of [undefined, "Bearer wrong", TEST_ENV.RECONCILIATION_CRON_SECRET]) {
      const result = await readResponse(await cronPost(request(header)));
      assert.deepEqual(result, { status: 401, body: { ok: false, error: "unauthorized" }, cacheControl: null });
    }
  });

  it("repairs reverted orders and reports the summary", async () => {
    const upstream = fakeUpstreams(harness, orderList([adminOrderNode()]), revertedBigblueOrder());
    const result = await readResponse(await cronPost(request(`Bearer ${TEST_ENV.RECONCILIATION_CRON_SECRET}`)));
    assert.deepEqual(result, {
      status: 200,
      body: { ok: true, ...EMPTY_SUMMARY, scanned: 1, matched: 1, updated: 1 },
      cacheControl: "no-store",
    });
    assert.equal(upstream.writes(), 1);
  });

  it("returns 503 with the summary when an order fails", async () => {
    fakeUpstreams(harness, orderList([adminOrderNode()]), 500);
    const result = await readResponse(await cronPost(request(`Bearer ${TEST_ENV.RECONCILIATION_CRON_SECRET}`)));
    assert.deepEqual(result, {
      status: 503,
      body: { ok: false, ...EMPTY_SUMMARY, scanned: 1, matched: 1, failed: 1 },
      cacheControl: "no-store",
    });
    assert.deepEqual(harness.events(), [["error", "reconciliation_failed"], ["info", "reconciliation_finished"]]);
  });

  it("returns 503 when the Shopify Admin API fails", async () => {
    fakeUpstreams(harness, 500, null);
    const result = await readResponse(await cronPost(request(`Bearer ${TEST_ENV.RECONCILIATION_CRON_SECRET}`)));
    assert.deepEqual(result, { status: 503, body: { ok: false, error: "reconciliation_failed" }, cacheControl: "no-store" });
  });
});
