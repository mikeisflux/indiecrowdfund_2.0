import { NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { GRANT_AGREEMENT_VERSION } from "@/components/legal/grant-agreement";

const log = logger.child({ module: "project-grant-agreement" });

export const dynamic = "force-dynamic";

// GET - Whether this project has a signed grant agreement (creator only).
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const project = await db.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { id: true, creatorId: true },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    if (project.creatorId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const agreement = await db.grantAgreement.findUnique({
      where: { projectId },
      select: { version: true, acceptedAt: true },
    });

    return NextResponse.json({
      signed: !!agreement,
      version: agreement?.version ?? null,
      acceptedAt: agreement?.acceptedAt ?? null,
      currentVersion: GRANT_AGREEMENT_VERSION,
    });
  } catch (error) {
    log.error({ err: formatError(error) }, "Failed to read grant agreement status");
    return NextResponse.json({ error: "Failed to read agreement status" }, { status: 500 });
  }
}

// POST - Accept the grant agreement for this project. Only the project's
// creator can sign (the grantee); the acceptance records the agreement
// version in force at signing time.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const project = await db.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { id: true, creatorId: true, title: true },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    if (project.creatorId !== session.user.id) {
      return NextResponse.json(
        { error: "Only the project's creator can sign the grant agreement" },
        { status: 403 }
      );
    }

    // Idempotent: re-signing returns the existing record (unique projectId).
    const existing = await db.grantAgreement.findUnique({ where: { projectId } });
    if (existing) {
      return NextResponse.json({
        signed: true,
        version: existing.version,
        acceptedAt: existing.acceptedAt,
      });
    }

    const agreement = await db.grantAgreement.create({
      data: {
        userId: session.user.id,
        projectId,
        version: GRANT_AGREEMENT_VERSION,
      },
    });

    log.info(
      { projectId, userId: session.user.id, version: agreement.version },
      "Grant agreement signed"
    );

    return NextResponse.json({
      signed: true,
      version: agreement.version,
      acceptedAt: agreement.acceptedAt,
    });
  } catch (error) {
    log.error({ err: formatError(error) }, "Failed to accept grant agreement");
    return NextResponse.json({ error: "Failed to accept agreement" }, { status: 500 });
  }
}
