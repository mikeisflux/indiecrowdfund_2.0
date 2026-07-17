import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { sendDigitalDeliveryEmail } from "@/lib/email/email-templates-misc";

const log = logger.child({ module: "auto-distribute" });

// Build the pledge `where` that identifies who a distribution rule delivers to,
// mirroring the per-rule logic used by "Process Distribution" in the IndieKit
// digital tab (src/app/api/creator/indiekit/digital/route.ts). While the project
// is still LIVE we additionally require the order to be LOCKED — matching the
// liveLockGate in that route — so mid-campaign auto-delivery only reaches backers
// who locked their order. Once the project is no longer LIVE (e.g. FUNDED) the
// lock requirement lifts and all eligible backers qualify.
function buildRuleWhere(
  projectId: string,
  rule: {
    triggerType: string;
    triggerRewardId: string | null;
    triggerAddonId: string | null;
    requiresPayment: boolean;
  },
  projectStatus: string,
  pledgeId?: string
) {
  const where: {
    projectId: string;
    status: "COMPLETED" | { in: ["COMPLETED", "PENDING"] };
    deletedAt: null;
    orderLockStatus?: "LOCKED";
    id?: string;
    rewardId?: string;
    addons?: { some: { addonId: string } };
  } = {
    projectId,
    status: rule.requiresPayment ? "COMPLETED" : { in: ["COMPLETED", "PENDING"] },
    deletedAt: null,
  };

  if (projectStatus === "LIVE") where.orderLockStatus = "LOCKED";
  if (pledgeId) where.id = pledgeId;

  if (rule.triggerType === "SPECIFIC_REWARD" && rule.triggerRewardId) {
    where.rewardId = rule.triggerRewardId;
  } else if (rule.triggerType === "SPECIFIC_ADDON" && rule.triggerAddonId) {
    where.addons = { some: { addonId: rule.triggerAddonId } };
  }
  // ALL_BACKERS → no extra constraint.

  return where;
}

// Send one delivery email per backer listing the files they were just granted.
async function sendDeliveryEmails(
  projectTitle: string,
  newFilesByPledge: Map<string, string[]>
): Promise<number> {
  const pledgeIds = Array.from(newFilesByPledge.keys());
  if (pledgeIds.length === 0) return 0;

  const pledges = await db.pledge.findMany({
    where: { id: { in: pledgeIds } },
    select: { id: true, user: { select: { email: true, name: true } } },
  });

  let sent = 0;
  for (const p of pledges) {
    const email = p.user?.email;
    const fileNames = newFilesByPledge.get(p.id) ?? [];
    if (!email || fileNames.length === 0) continue;
    try {
      const res = await sendDigitalDeliveryEmail(email, p.user?.name ?? null, projectTitle, fileNames.length, fileNames);
      if (res.success) sent++;
    } catch (err) {
      log.error({ err: String(err), pledgeId: p.id }, "auto-distribute delivery email failed");
    }
  }
  return sent;
}

export interface AutoDistributeResult {
  rulesProcessed: number;
  distributed: number;
  emailed: number;
}

/**
 * Re-run a project's already-processed distribution rules, catching up any
 * newly-eligible backers who don't have the files yet. Idempotent: a backer who
 * already received a file is skipped, so this is safe to call repeatedly.
 *
 * "Already processed" means the creator has pressed **Process Distribution** for
 * the rule (its status is STARTED or COMPLETED). Rules that were never processed
 * (NOT_STARTED) are ignored — this never releases a file the creator hasn't sent.
 *
 * Use cases:
 *  - A backer just locked their order → pass `{ pledgeId }` to deliver the
 *    already-processed rules' files to that single backer.
 *  - A campaign just closed (FUNDED) → call with no pledgeId to deliver to every
 *    backer who now qualifies (the LIVE lock gate having lifted).
 */
export async function distributeReadyFilesForProject(
  projectId: string,
  opts: { pledgeId?: string } = {}
): Promise<AutoDistributeResult> {
  const { pledgeId } = opts;
  const empty: AutoDistributeResult = { rulesProcessed: 0, distributed: 0, emailed: 0 };

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true, title: true, status: true },
  });
  if (!project) return empty;

  // Rules the creator has already run via "Process Distribution".
  const rules = await db.distributionRule.findMany({
    where: { projectId, status: { in: ["STARTED", "COMPLETED"] } },
    select: {
      id: true,
      digitalFileId: true,
      triggerType: true,
      triggerRewardId: true,
      triggerAddonId: true,
      requiresPayment: true,
      digitalFile: { select: { name: true } },
    },
  });
  if (rules.length === 0) return { ...empty };

  const now = new Date();
  const newFilesByPledge = new Map<string, string[]>();
  let distributed = 0;

  for (const rule of rules) {
    const eligible = await db.pledge.findMany({
      where: buildRuleWhere(projectId, rule, project.status, pledgeId),
      select: { id: true },
    });
    if (eligible.length === 0) continue;

    const eligibleIds = eligible.map((p) => p.id);
    // Skip backers who already have this file delivered.
    const existing = await db.digitalDistribution.findMany({
      where: { digitalFileId: rule.digitalFileId, pledgeId: { in: eligibleIds }, distributedAt: { not: null } },
      select: { pledgeId: true },
    });
    const alreadyHave = new Set(existing.map((e: { pledgeId: string }) => e.pledgeId));
    const toDeliver = eligibleIds.filter((id) => !alreadyHave.has(id));
    if (toDeliver.length === 0) continue;

    let created = 0;
    for (const pid of toDeliver) {
      try {
        await db.digitalDistribution.upsert({
          where: { digitalFileId_pledgeId: { digitalFileId: rule.digitalFileId, pledgeId: pid } },
          update: { distributedAt: now },
          create: { digitalFileId: rule.digitalFileId, pledgeId: pid, distributedAt: now },
        });
        created++;
        const arr = newFilesByPledge.get(pid) ?? [];
        arr.push(rule.digitalFile.name);
        newFilesByPledge.set(pid, arr);
      } catch (err) {
        log.error({ err: String(err), ruleId: rule.id, pledgeId: pid }, "auto-distribute upsert failed");
      }
    }

    if (created > 0) {
      distributed += created;
      // Keep the file + rule "distributed" counters live.
      await db.digitalFile.update({
        where: { id: rule.digitalFileId },
        data: { distributedCount: { increment: created } },
      });
      await db.distributionRule.update({
        where: { id: rule.id },
        data: { distributedCount: { increment: created } },
      });
    }
  }

  const emailed = await sendDeliveryEmails(project.title, newFilesByPledge);

  if (distributed > 0) {
    log.info(
      { projectId, pledgeId: pledgeId ?? null, rulesProcessed: rules.length, distributed, emailed },
      "auto-distributed already-processed rules"
    );
  }

  return { rulesProcessed: rules.length, distributed, emailed };
}
