import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { db } from "@/lib/db";
import { distributeStretchGoalsForProject } from "@/lib/rewards/stretch-goals";

const stretchGoalLogger = logger.child({ module: "cron-distribute-stretch-goals" });

/**
 * Grant unlocked stretch goals to backers' orders.
 *
 * Runs on a schedule rather than firing once at the moment a threshold is
 * crossed, because "who qualifies" keeps changing: a backer who pledges an
 * hour after a goal unlocks is owed it too, and no single event marks that.
 * The work is idempotent (PledgeAddon is unique on pledgeId+addonId), so
 * running it every few minutes costs a query and writes nothing once a
 * campaign is settled.
 *
 * Scoped to LIVE and FUNDED projects that actually have stretch goals — a
 * campaign with none never reaches the pledge query.
 *
 * Security: CRON_SECRET, same as every other cron route here.
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projects = await db.project.findMany({
      where: {
        deletedAt: null,
        status: { in: ["LIVE", "FUNDED"] },
        rewards: { some: { type: "STRETCH_GOAL", isEnded: false } },
      },
      select: { id: true, title: true },
    });

    let totalGranted = 0;
    const results: { projectId: string; title: string; granted: number; unlocked: number }[] = [];

    for (const project of projects) {
      try {
        const result = await distributeStretchGoalsForProject(project.id);
        totalGranted += result.granted;
        results.push({
          projectId: project.id,
          title: project.title,
          granted: result.granted,
          unlocked: result.unlockedGoalIds.length,
        });
        if (result.granted > 0) {
          stretchGoalLogger.info(
            {
              projectId: project.id,
              granted: result.granted,
              raised: result.raisedAmount,
              goals: result.unlockedGoalIds.length,
            },
            "Distributed stretch goals"
          );
        }
      } catch (err) {
        // One bad campaign must not stop the rest — the loop is the whole
        // platform's stretch goals, not one creator's.
        stretchGoalLogger.error(
          { err: formatError(err), projectId: project.id },
          "Failed to distribute stretch goals for project"
        );
      }
    }

    return NextResponse.json({
      success: true,
      projectsChecked: projects.length,
      granted: totalGranted,
      results,
    });
  } catch (error) {
    stretchGoalLogger.error({ err: formatError(error) }, "Stretch goal cron failed");
    return NextResponse.json(
      { error: "Failed to distribute stretch goals" },
      { status: 500 }
    );
  }
}
