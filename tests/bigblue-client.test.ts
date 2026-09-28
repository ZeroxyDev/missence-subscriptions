import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { BigblueApiError, createBigblueClient } from "@/lib/bigblue/client";

describe("createBigblueClient deadline", () => {
  it("does not start a request after the webhook deadline", async () => {
    let requested = false;
    const client = createBigblueClient({
      apiKey: "test",
      deadlineAtMs: Date.now() - 1,
      fetchImplementation: (async () => {
        requested = true;
        return new Response("{}");
      }) as typeof fetch,
    });

    await assert.rejects(client("ListOrders", {}), (error: unknown) =>
      error instanceof BigblueApiError && error.code === "timeout" && error.retryable);
    assert.equal(requested, false);
  });
});
