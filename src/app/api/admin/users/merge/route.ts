import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { formatError } from "@/lib/errors";
import { mergeUserInto } from "@/lib/users/merge-user";

const log = logger.child({ module: "admin-merge-users" });

export const dynamic = "force-dynamic";

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await db.user.findFirst({ where: { id: session.user.id, deletedAt: null }, select: { id: true, role: true } });
  return user?.role === "SUPER_ADMIN" ? user : null;
}

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  createdAt: true,
  updatedAt: true,
  emailVerified: true,
  _count: { select: { pledges: true, createdProjects: true, sessions: true } },
} as const;

async function findUser(ref: string) {
  const value = ref.trim();
  if (!value) return null;
  return db.user.findFirst({
    where: {
      deletedAt: null,
      OR: [{ id: value }, { email: { equals: value, mode: "insensitive" } }],
    },
    select: USER_SELECT,
  });
}

// GET ?keep=<id|email>&merge=<id|email>  — preview both accounts
// POST { keep, merge }                    — move everything from `merge`
//                                           into `keep` and retire `merge`
//
// For the backer whose history is split across two addresses (one
// pledge under the old Gmail, the rest under Yahoo). The duplicate tool
// only handles the same address in different capitalisation; this
// handles any two accounts, with the admin choosing which survives.
export async function GET(req: NextRequest) {
  const admin = await requireSuperAdmin();
  if (!admin) return NextResponse.json({ error: "Super Admin access required" }, { status: 403 });
  const keepRef = req.nextUrl.searchParams.get("keep") || "";
  const mergeRef = req.nextUrl.searchParams.get("merge") || "";
  const [keep, merge] = await Promise.all([findUser(keepRef), findUser(mergeRef)]);
  return NextResponse.json({
    keep,
    merge,
    problems: [
      ...(!keep ? [`No active account matches "${keepRef}"`] : []),
      ...(!merge ? [`No active account matches "${mergeRef}"`] : []),
      ...(keep && merge && keep.id === merge.id ? ["Both references point at the same account"] : []),
      ...(merge && (merge.role === "ADMIN" || merge.role === "SUPER_ADMIN") ? ["The account being merged away is an admin; demote it first"] : []),
    ],
  });
}

export async function POST(req: NextRequest) {
  const admin = await requireSuperAdmin();
  if (!admin) return NextResponse.json({ error: "Super Admin access required" }, { status: 403 });
  try {
    const body = await req.json().catch(() => ({}));
    const keepRef = typeof body.keep === "string" ? body.keep : "";
    const mergeRef = typeof body.merge === "string" ? body.merge : "";
    const [keep, merge] = await Promise.all([findUser(keepRef), findUser(mergeRef)]);
    if (!keep) return NextResponse.json({ error: `No active account matches "${keepRef}"` }, { status: 404 });
    if (!merge) return NextResponse.json({ error: `No active account matches "${mergeRef}"` }, { status: 404 });
    if (keep.id === merge.id) return NextResponse.json({ error: "Both references point at the same account" }, { status: 400 });
    if (merge.role === "ADMIN" || merge.role === "SUPER_ADMIN") {
      return NextResponse.json({ error: "The account being merged away is an admin; demote it first" }, { status: 400 });
    }

    await mergeUserInto(merge.id, keep.id);

    // Every message to the retired address now lands on the kept account.
    const after = await db.user.findUnique({ where: { id: keep.id }, select: USER_SELECT });
    log.warn({ adminId: admin.id, keep: keep.id, merged: merge.id, mergedEmail: merge.email }, "Admin merged two accounts");
    return NextResponse.json({
      success: true,
      keep: after,
      merged: { id: merge.id, email: merge.email, pledgesMoved: merge._count.pledges, projectsMoved: merge._count.createdProjects },
    });
  } catch (error) {
    log.error({ err: formatError(error) }, "merge failed");
    return NextResponse.json({ error: "Merge failed — nothing was changed" }, { status: 500 });
  }
}
