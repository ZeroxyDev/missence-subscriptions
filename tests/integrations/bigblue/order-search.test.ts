import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { findBigblueOrder } from "@/lib/integrations/bigblue/order-search";
import type { BigblueRequest } from "@/lib/integrations/bigblue/types";

describe("findBigblueOrder", () => {
  it("treats an empty object response as an empty page", async () => {
    const request = (async () => ({})) as BigblueRequest;

    const order = await findBigblueOrder(
      request,
      "123456789",
      "2026-09-09T10:00:00.000Z",
    );

    assert.equal(order, null);
  });

  it("paginates and matches external_id as a string", async () => {
    const pageTokens: string[] = [];
    const request: BigblueRequest = async <TRequest, TResponse>(
      method: string,
      payload: TRequest,
    ) => {
      assert.equal(method, "ListOrders");
      const listOrdersPayload = payload as {
        date_range: { from: string; to: string };
        page_token: string;
      };
      const token = listOrdersPayload.page_token;
      pageTokens.push(token);

      assert.match(
        listOrdersPayload.date_range.from,
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/,
      );
      assert.match(
        listOrdersPayload.date_range.to,
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/,
      );

      return (token === ""
        ? { orders: [], next_page_token: "next" }
        : {
            orders: [
              {
                id: "BGBL01234567",
                external_id: 123456789,
                line_items: [],
              },
            ],
            next_page_token: "",
          }) as TResponse;
    };

    const order = await findBigblueOrder(
      request,
      "123456789",
      "2026-09-09T10:00:00.000Z",
    );

    assert.equal(order?.id, "BGBL01234567");
    assert.deepEqual(pageTokens, ["", "next"]);
  });

  it("matches the Shopify order name used as Bigblue external_id", async () => {
    const request = (async () => ({
      orders: [
        {
          id: "MISSS1001026",
          external_id: "#1026",
          line_items: [],
        },
      ],
    })) as BigblueRequest;

    const order = await findBigblueOrder(
      request,
      ["#1026", "8146099044679"],
      "2026-09-11T10:29:38.000Z",
    );

    assert.equal(order?.id, "MISSS1001026");
    assert.equal(order?.external_id, "#1026");
  });
});
