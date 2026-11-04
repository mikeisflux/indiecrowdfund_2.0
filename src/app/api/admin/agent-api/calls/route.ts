import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { toolCatalog } from "@/lib/agent-api";

/** Recent Agent API calls plus the live tool catalog, for the admin page. */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const limit = Math.min(Math.max(Number(new URL(req.url).searchParams.get("limit") ?? 100) || 100, 1), 500);
  const since24h = new Date(Date.now() - 86_400_000);
  const [calls, last24h, failed24h] = await Promise.all([
    db.agentApiCall.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, tool: true, args: true, ok: true, statusCode: true, durationMs: true, error: true, resultSize: true, ip: true, createdAt: true, apiKey: { select: { name: true } } },
    }),
    db.agentApiCall.count({ where: { createdAt: { gte: since24h } } }),
    db.agentApiCall.count({ where: { createdAt: { gte: since24h }, ok: false } }),
  ]);
  return NextResponse.json({
    calls,
    stats: { last24h, failed24h },
    tools: toolCatalog().map((t) => ({ name: t.name, description: t.description, scope: t.scope, mutating: t.mutating })),
  });
}
