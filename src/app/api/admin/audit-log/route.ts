import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET - Admin audit trail and sign-in events.
//   ?view=audit  (default)  &action=&actor=&target=&days=&page=
//   ?view=logins            &email=&ip=&failed=1&days=&page=
export async function GET(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const q = req.nextUrl.searchParams;
  const view = q.get("view") === "logins" ? "logins" : "audit";
  const days = Math.min(Math.max(parseInt(q.get("days") || "30", 10) || 30, 1), 365);
  const page = Math.max(parseInt(q.get("page") || "1", 10) || 1, 1);
  const take = 100;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  if (view === "logins") {
    const where = {
      createdAt: { gte: since },
      ...(q.get("email") ? { email: { contains: q.get("email")!.toLowerCase() } } : {}),
      ...(q.get("ip") ? { ip: q.get("ip")! } : {}),
      ...(q.get("failed") === "1" ? { success: false } : {}),
    };
    const [rows, total] = await Promise.all([
      db.loginEvent.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * take, take }),
      db.loginEvent.count({ where }),
    ]);
    return NextResponse.json({ view, rows, total, page, pageSize: take });
  }

  const where = {
    createdAt: { gte: since },
    ...(q.get("action") ? { action: q.get("action")! } : {}),
    ...(q.get("actor") ? { OR: [{ actorId: q.get("actor")! }, { actorEmail: { contains: q.get("actor")!, mode: "insensitive" as const } }] } : {}),
    ...(q.get("target") ? { targetId: q.get("target")! } : {}),
  };
  const [rows, total, actions] = await Promise.all([
    db.adminAuditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * take, take }),
    db.adminAuditLog.count({ where }),
    db.adminAuditLog.findMany({ where: { createdAt: { gte: since } }, select: { action: true }, distinct: ["action"], orderBy: { action: "asc" } }),
  ]);
  return NextResponse.json({ view, rows, total, page, pageSize: take, actions: actions.map((a: { action: string }) => a.action) });
}
