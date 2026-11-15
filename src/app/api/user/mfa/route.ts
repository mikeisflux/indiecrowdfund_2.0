import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { auth } from "@/lib/auth";
import {
  getMfaState,
  beginMfaEnrollment,
  confirmMfaEnrollment,
  disableMfa,
  regenerateBackupCodes,
} from "@/lib/auth/mfa";
import { auditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

// GET - this account's two-factor status.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const state = await getMfaState(session.user.id);
  if (!state) return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json(state);
}

// POST - { action: "begin" } → { secret, url, qr }
//        { action: "confirm", code } → { backupCodes }
//        { action: "regenerate", code } → { backupCodes }
//        { action: "disable", code } → { ok }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const action = typeof body.action === "string" ? body.action : "";
  const code = typeof body.code === "string" ? body.code : "";

  if (action === "begin") {
    const { secret, url } = await beginMfaEnrollment(session.user.id, session.user.email);
    const qr = await QRCode.toDataURL(url, { margin: 1, width: 220 });
    return NextResponse.json({ secret, url, qr });
  }
  if (action === "confirm") {
    const res = await confirmMfaEnrollment(session.user.id, code);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
    auditLog({ action: "MFA_ENABLED", actorId: session.user.id, actorEmail: session.user.email, targetId: session.user.id, targetType: "USER" });
    return NextResponse.json({ ok: true, backupCodes: res.backupCodes });
  }
  if (action === "regenerate") {
    const res = await regenerateBackupCodes(session.user.id, code);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
    auditLog({ action: "MFA_BACKUP_CODES_REGENERATED", actorId: session.user.id, actorEmail: session.user.email, targetId: session.user.id, targetType: "USER" });
    return NextResponse.json({ ok: true, backupCodes: res.backupCodes });
  }
  if (action === "disable") {
    const res = await disableMfa(session.user.id, code);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
    auditLog({ action: "MFA_DISABLED", actorId: session.user.id, actorEmail: session.user.email, targetId: session.user.id, targetType: "USER" });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
