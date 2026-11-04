import { db } from "@/lib/db";

/**
 * What the support bot knows about a logged-in backer before it answers.
 *
 * An escalation that says "a digital reward is missing" with no campaign
 * name is useless to the person who reads it, and the bot had everything it
 * needed in the database the whole time: the backer's pledges, what each one
 * included, whether that tier or add-on carries a digital file at all, and
 * whether the creator has uploaded one. This builds that picture once per
 * request, in the same terms the Downloads tab uses, so the bot can answer
 * "your Star Whores tier doesn't include the PDF; it's an add-on" instead of
 * guessing, and so every escalation email carries it.
 */

export interface BackerPledgeSummary {
  pledgeId: string;
  campaign: string;
  slug: string;
  campaignStatus: string;
  pledgeStatus: string;
  backedAt: Date;
  amount: number;
  reward: string | null;
  rewardIsDigitalOnly: boolean;
  addons: string[];
  surveyCompleted: boolean;
  fulfillment: string;
  /** Digital files on this campaign that THIS pledge can download (released and READY). */
  digitalFilesAvailable: string[];
  /** READY files on the campaign this pledge does NOT qualify for (tier/add-on gated). */
  digitalFilesNotIncluded: string[];
  /** Files the creator has started but not finished uploading. */
  digitalFilesPending: number;
  /** The campaign has no digital files at all. */
  campaignHasNoDigitalFiles: boolean;
}

export async function getBackerSupportContext(userId: string, limit = 10): Promise<BackerPledgeSummary[]> {
  const pledges = await db.pledge.findMany({
    where: { userId, deletedAt: null, status: { in: ["COMPLETED", "PENDING"] } },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true, projectId: true, rewardId: true, status: true, amount: true, createdAt: true, surveyCompleted: true, fulfillmentStatus: true,
      project: { select: { title: true, slug: true, status: true } },
      reward: { select: { title: true, shippingType: true } },
      addons: { select: { addonId: true, addon: { select: { title: true } } } },
    },
  });
  if (pledges.length === 0) return [];

  const projectIds = [...new Set(pledges.map((p) => p.projectId))];
  const [files, distributions] = await Promise.all([
    db.digitalFile.findMany({
      where: { projectId: { in: projectIds }, replacesFileId: null },
      select: { id: true, projectId: true, name: true, uploadStatus: true, accessType: true, rewardIds: true, addonIds: true },
    }),
    db.digitalDistribution.findMany({
      where: { pledgeId: { in: pledges.map((p) => p.id) }, distributedAt: { not: null } },
      select: { pledgeId: true, digitalFileId: true },
    }),
  ]);
  const distributed = new Set(distributions.map((d: { pledgeId: string; digitalFileId: string }) => `${d.pledgeId}:${d.digitalFileId}`));

  return pledges.map((p) => {
    const projectFiles = files.filter((f: { projectId: string }) => f.projectId === p.projectId);
    const ready = projectFiles.filter((f: { uploadStatus: string }) => f.uploadStatus === "READY");
    const addonIds = p.addons.map((a: { addonId: string }) => a.addonId);
    const available: string[] = [];
    const notIncluded: string[] = [];
    for (const f of ready) {
      // Same rule as /api/backer/digital-library.
      const fileRewardIds = (f.rewardIds as string[]) || [];
      const fileAddonIds = (f.addonIds as string[]) || [];
      let hasAccess = distributed.has(`${p.id}:${f.id}`) || f.accessType === "ALL_BACKERS" || (fileRewardIds.length === 0 && fileAddonIds.length === 0);
      if (!hasAccess) {
        const rewardMatch = fileRewardIds.length > 0 && !!p.rewardId && fileRewardIds.includes(p.rewardId);
        const addonMatch = fileAddonIds.length > 0 && addonIds.some((id: string) => fileAddonIds.includes(id));
        hasAccess = rewardMatch || addonMatch;
      }
      (hasAccess ? available : notIncluded).push(f.name);
    }
    return {
      pledgeId: p.id,
      campaign: p.project.title,
      slug: p.project.slug,
      campaignStatus: p.project.status,
      pledgeStatus: p.status,
      backedAt: p.createdAt,
      amount: Number(p.amount),
      reward: p.reward?.title ?? null,
      rewardIsDigitalOnly: p.reward?.shippingType === "NO_SHIPPING",
      addons: p.addons.map((a: { addon: { title: string } }) => a.addon.title),
      surveyCompleted: p.surveyCompleted,
      fulfillment: p.fulfillmentStatus,
      digitalFilesAvailable: available,
      digitalFilesNotIncluded: notIncluded,
      digitalFilesPending: projectFiles.length - ready.length,
      campaignHasNoDigitalFiles: projectFiles.length === 0,
    };
  });
}

/** Plain-text rendering for the model's system prompt and the escalation email. */
export function formatBackerSupportContext(rows: BackerPledgeSummary[]): string {
  if (rows.length === 0) return "This user has no pledges on record.";
  return rows
    .map((r, i) => {
      const digital =
        r.digitalFilesAvailable.length > 0
          ? `digital files this pledge can download: ${r.digitalFilesAvailable.join("; ")}`
          : r.campaignHasNoDigitalFiles
            ? "the creator has not uploaded any digital files for this campaign"
            : r.digitalFilesNotIncluded.length > 0
              ? `this campaign has ${r.digitalFilesNotIncluded.length} digital file(s) but NONE are included in this pledge's tier or add-ons (${r.digitalFilesNotIncluded.slice(0, 4).join("; ")}${r.digitalFilesNotIncluded.length > 4 ? "; …" : ""})`
              : "no released digital files apply to this pledge";
      return [
        `${i + 1}. ${r.campaign} (slug ${r.slug}, campaign ${r.campaignStatus}) — pledge ${r.pledgeId}, ${r.pledgeStatus}, $${r.amount.toFixed(2)}, backed ${r.backedAt.toISOString().slice(0, 10)}`,
        `   reward: ${r.reward ?? "no reward (donation)"}${r.rewardIsDigitalOnly ? " [digital-only tier]" : ""}; add-ons: ${r.addons.length ? r.addons.join(", ") : "none"}`,
        `   survey ${r.surveyCompleted ? "completed" : "not completed"}; fulfillment ${r.fulfillment}; ${digital}${r.digitalFilesPending ? `; ${r.digitalFilesPending} file(s) still uploading` : ""}`,
      ].join("\n");
    })
    .join("\n");
}
