import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { GET as healthGet } from "@/app/api/health/route";
import {
  readResponse,
  useRouteHarness,
} from "@/tests/support/route-harness";
import {
  fakeUpstreams,
} from "@/tests/support/upstream-fakes";

describe("GET /api/health", () => {
  const harness = useRouteHarness();

  it("reports each integration check without caching", async () => {
    fakeUpstreams(harness, null, null);
    const result = await readResponse(await healthGet());
    assert.equal(result.status, 200);
    assert.equal(result.cacheControl, "no-store");
    const body = result.body as { status: string; checkedAt: string; checks: unknown[] };
    assert.equal(body.status, "error");
    assert.ok(!Number.isNaN(Date.parse(body.checkedAt)));
    assert.deepEqual(body.checks, [
      { id: "bigblue", label: "Bigblue", status: "ok", detail: "Conexión correcta" },
      { id: "shopify", label: "Shopify", status: "error", detail: "Falta configurar una credencial" },
      { id: "products", label: "Productos", status: "ok", detail: "2 reglas configuradas" },
    ]);
  });
});
