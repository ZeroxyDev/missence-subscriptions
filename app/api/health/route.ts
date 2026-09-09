import { checkIntegrationHealth } from "@/lib/health/check-integration-health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const health = await checkIntegrationHealth();

  return Response.json(health, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
