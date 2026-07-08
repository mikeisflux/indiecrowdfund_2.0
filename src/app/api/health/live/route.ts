import { NextResponse } from "next/server";

// Bare liveness probe used by the systemd watchdog
// (scripts/ic-watchdog.sh). Returns immediately with no DB query, no settings
// lookup, no I/O — so a worker can still serve it even if Postgres is dead,
// settings cache is cold, or the storage backend is wedged. We want to catch
// exactly one failure mode here: the Node event loop is unresponsive (or the
// TCP accept queue is wedged so we can't even reach the handler). That's the
// Jun 8-9 saturation pattern. Anything that needs DB access lives in
// /api/health (full readiness check used by the admin dashboard).
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ status: "ok", uptime: process.uptime() });
}
