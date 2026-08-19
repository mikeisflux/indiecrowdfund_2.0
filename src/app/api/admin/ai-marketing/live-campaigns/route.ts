import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { formatError } from "@/lib/errors";

const liveCampaignsLogger = logger.child({ module: "ai-marketing-live-campaigns" });

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/ai-marketing/live-campaigns
 *
 * The campaigns an operator can drop into a hand-written email.
 *
 * This used to return LIVE only, on the reasoning that a marketing email
 * should not point at a page nobody can back. That reasoning was too narrow
 * and produced a dead button: the moment nothing happened to be live, the
 * Insert campaign control greyed out with no way to tell whether that was the
 * real answer or a broken request.
 *
 * Marketing emails legitimately promote three things, so all three are
 * offered and each is labelled so the operator knows what they are inserting:
 *
 *   - Live      — backable right now
 *   - Coming soon — an approved, active prelaunch page collecting followers
 *   - Funded    — finished successfully; still worth a follow-up or late pledge
 *
 * Drafts, submitted, rejected, paused, failed and cancelled projects are never
 * offered: those are pages a reader either cannot see or should not be sent to.
 */
export async function GET() {
  try {
    const session = await auth();
    if (session?.user?.role !== "SUPER_ADMIN" && session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projects = await db.project.findMany({
      where: {
        deletedAt: null,
        OR: [
          { status: { in: ["LIVE", "FUNDED"] } },
          // An approved prelaunch page is public and collecting followers,
          // which is exactly what a "coming soon" email is for.
          { prelaunchActive: true, prelaunchStatus: "APPROVED" },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        title: true,
        slug: true,
        category: true,
        status: true,
        prelaunchActive: true,
        // `subtitle`, not `shortDescription` — Project has no such column, and
        // selecting it made Prisma reject the whole query, so this route 500'd
        // on every call. That, not an empty result, is why Insert campaign had
        // nothing to offer.
        subtitle: true,
        imageUrl: true,
        creator: { select: { vanityUrl: true } },
      },
    });

    const campaigns = projects.map((p) => {
      const state =
        p.status === "LIVE" ? "live" : p.status === "FUNDED" ? "funded" : "prelaunch";
      return {
        slug: p.slug,
        title: p.title,
        category: p.category,
        imageUrl: p.imageUrl,
        blurb: p.subtitle || "",
        state,
        stateLabel: state === "live" ? "Live" : state === "funded" ? "Funded" : "Coming soon",
        url: p.creator?.vanityUrl
          ? `/projects/${p.creator.vanityUrl}/${p.slug}`
          : `/projects/${p.slug}`,
      };
    });

    // Live first, then what is about to launch, then what already finished.
    const rank = { live: 0, prelaunch: 1, funded: 2 } as const;
    campaigns.sort((a, b) => rank[a.state as keyof typeof rank] - rank[b.state as keyof typeof rank]);

    return NextResponse.json({ campaigns });
  } catch (error) {
    liveCampaignsLogger.error({ err: formatError(error) }, "Failed to list live campaigns");
    return NextResponse.json({ error: "Failed to list campaigns" }, { status: 500 });
  }
}
