import { NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const log = logger.child({ module: "creator-grant-agreements-pending" });

export const dynamic = "force-dynamic";

// GET - The creator's projects that still need a signed grant agreement.
// FUNDED projects need one before any payout can be created; LIVE projects
// can sign early so the paperwork is done before their campaign ends.
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projects = await db.project.findMany({
      where: {
        creatorId: session.user.id,
        deletedAt: null,
        status: { in: ["LIVE", "FUNDED"] },
        grantAgreement: null,
      },
      select: { id: true, title: true, status: true },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ pending: projects });
  } catch (error) {
    log.error({ err: formatError(error) }, "Failed to list pending grant agreements");
    return NextResponse.json({ error: "Failed to list pending agreements" }, { status: 500 });
  }
}
