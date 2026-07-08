import { NextResponse } from "next/server";
import { serializeMetrics } from "@/lib/metrics";

/**
 * GET /api/metrics
 * Prometheus-compatible metrics endpoint.
 * Protected by a bearer token to prevent public access.
 */
export async function GET(req: Request) {
  // Require metrics token in production
  const metricsToken = process.env.METRICS_TOKEN;
  if (metricsToken) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${metricsToken}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const body = serializeMetrics();
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
        "Cache-Control": "no-cache, no-store",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to serialize metrics", details: String(error) }, { status: 500 });
  }
}
