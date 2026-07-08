import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const adminEmailsLogger = logger.child({ module: "admin-emails" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ emailId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin status
    const currentUser = await db.user.findFirst({
      where: { id: session.user.id, deletedAt: null },
      select: { role: true },
    });

    if (currentUser?.role !== "ADMIN" && currentUser?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { emailId } = await params;
    const { searchParams } = new URL(req.url);
    const download = searchParams.get("download") === "true";

    // Get the email log
    const emailLog = await db.emailLog.findUnique({
      where: { id: emailId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        project: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
        pledge: {
          select: {
            id: true,
            amount: true,
            status: true,
          },
        },
      },
    });

    if (!emailLog) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    // If download requested, return as HTML file
    if (download && emailLog.htmlContent) {
      const filename = `email-${emailLog.type.toLowerCase()}-${emailLog.id}.html`;
      return new NextResponse(emailLog.htmlContent, {
        headers: {
          "Content-Type": "text/html",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    return NextResponse.json({ emailLog });
  } catch (error) {
    adminEmailsLogger.error({ err: formatError(error) }, "Error fetching email:");
    return NextResponse.json(
      { error: "Failed to fetch email" },
      { status: 500 }
    );
  }
}
