import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  GET as bigblueGet,
  POST as bigbluePost,
} from "@/app/api/webhooks/bigblue/order-status/route";
import { deriveBigblueWebhookUrlToken } from "@/lib/integrations/bigblue/webhook-url-token";
import {
  readResponse,
  signWebhook,
  TEST_ENV,
  useRouteHarness,
} from "@/tests/support/route-harness";
import {
  EMPTY_SUMMARY,
  fakeUpstreams,
  orderList,
} from "@/tests/support/upstream-fakes";

describe("/api/webhooks/bigblue/order-status", () => {
  const harness = useRouteHarness();
  const ENDPOINT = "https://app.test/api/webhooks/bigblue/order-status";

  function post(body: string, headers: Record<string, string>): Request {
    return new Request(ENDPOINT, { method: "POST", body, headers });
  }

  it("rejects GET requests without the derived URL token", async () => {
    const result = await readResponse(await bigblueGet(new Request(`${ENDPOINT}?token=${"0".repeat(64)}`)));
    assert.deepEqual(result, { status: 401, body: { ok: false, error: "unauthorized" }, cacheControl: null });
  });

  it("echoes the GET challenge for an authenticated URL", async () => {
    const token = deriveBigblueWebhookUrlToken(TEST_ENV.BIGBLUE_WEBHOOK_KEY);
    const response = await bigblueGet(new Request(`${ENDPOINT}?token=${token}&challenge=abc`));
    assert.equal(response.headers.get("content-type"), "text/plain; charset=utf-8");
    assert.deepEqual(await readResponse(response), { status: 200, body: "abc", cacheControl: "no-store" });

    const ping = await readResponse(await bigblueGet(new Request(`${ENDPOINT}?token=${token}`)));
    assert.deepEqual(ping, { status: 200, body: { ok: true }, cacheControl: "no-store" });
  });

  it("returns 503 when the webhook key is not configured", async () => {
    delete process.env.BIGBLUE_WEBHOOK_KEY;
    const result = await readResponse(await bigbluePost(post("{}", { "x-bigblue-event-type": "ORDER_STATUS_UPDATE" })));
    assert.deepEqual(result, { status: 503, body: { ok: false, error: "not_configured" }, cacheControl: null });
    assert.deepEqual(harness.events(), [["error", "reconciliation_configuration_error"]]);
  });

  it("echoes an unsigned URL_VERIFICATION challenge verbatim", async () => {
    const body = '{"challenge":"verify-me"}';
    const response = await bigbluePost(post(body, { "x-bigblue-event-type": "URL_VERIFICATION" }));
    assert.equal(response.headers.get("content-type"), "application/json");
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(await response.text(), body);
    assert.equal(harness.requests.length, 0);
  });

  it("rejects a URL_VERIFICATION with a wrong signature or body", async () => {
    const badSignature = await readResponse(
      await bigbluePost(post('{"challenge":"x"}', { "x-bigblue-event-type": "URL_VERIFICATION", "x-bigblue-hmac-sha256": "AAAA" })),
    );
    assert.deepEqual(badSignature, { status: 401, body: { ok: false, error: "invalid_hmac" }, cacheControl: null });

    const badBody = await readResponse(
      await bigbluePost(post('{"challenge":"x","extra":1}', { "x-bigblue-event-type": "URL_VERIFICATION" })),
    );
    assert.deepEqual(badBody, { status: 400, body: { ok: false, error: "invalid_challenge" }, cacheControl: null });
  });

  it("rejects unknown event types and unsigned status updates", async () => {
    const unknown = await readResponse(await bigbluePost(post("{}", { "x-bigblue-event-type": "INVENTORY_UPDATE" })));
    assert.deepEqual(unknown, { status: 400, body: { ok: false, error: "invalid_event_type" }, cacheControl: null });

    const unsigned = await readResponse(await bigbluePost(post("{}", { "x-bigblue-event-type": "ORDER_STATUS_UPDATE" })));
    assert.deepEqual(unsigned, { status: 401, body: { ok: false, error: "invalid_hmac" }, cacheControl: null });
  });

  it("runs the reconciliation for a signed status update", async () => {
    fakeUpstreams(harness, orderList([]), null);
    const body = '{"order":"MISSS1001048"}';
    const result = await readResponse(
      await bigbluePost(
        post(body, {
          "x-bigblue-event-type": "ORDER_STATUS_UPDATE",
          "x-bigblue-hmac-sha256": signWebhook(body, TEST_ENV.BIGBLUE_WEBHOOK_KEY),
        }),
      ),
    );
    assert.deepEqual(result, { status: 200, body: { ok: true, ...EMPTY_SUMMARY }, cacheControl: "no-store" });
    assert.deepEqual(harness.events(), [["info", "bigblue_webhook_received"], ["info", "reconciliation_finished"]]);
  });

  it("returns 503 when the reconciliation cannot run", async () => {
    fakeUpstreams(harness, 500, null);
    const body = "{}";
    const result = await readResponse(
      await bigbluePost(
        post(body, {
          "x-bigblue-event-type": "ORDER_STATUS_UPDATE",
          "x-bigblue-hmac-sha256": signWebhook(body, TEST_ENV.BIGBLUE_WEBHOOK_KEY),
        }),
      ),
    );
    assert.deepEqual(result, { status: 503, body: { ok: false, error: "reconciliation_failed" }, cacheControl: "no-store" });
    assert.deepEqual(harness.events(), [["info", "bigblue_webhook_received"], ["error", "reconciliation_failed"]]);
    assert.deepEqual(harness.logs[1].payload, {
      event: "reconciliation_failed",
      source: "bigblue_webhook",
      reason: "ShopifyAdminOrdersError",
    });
  });
});
