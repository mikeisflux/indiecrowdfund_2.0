import { db } from "@/lib/db";

interface ProjectRef {
  id: string;
  title: string;
  status: string;
}

export async function computePostCampaignSales(projects: ProjectRef[]) {
  // Compute post-campaign sales across creator projects that have ENDED (FUNDED status)
  // Post-campaign = add-ons purchased via IndieKit survey after the campaign closed
  // LIVE projects are still in their funding period and should NOT be included
  // Tracked in pledge.metadata.completedAdditionalItems array
  const endedProjectIds = projects
    .filter(p => p.status === "FUNDED")
    .map(p => p.id);
  const postCampaignPledges = endedProjectIds.length > 0 ? await db.pledge.findMany({
    where: {
      projectId: { in: endedProjectIds },
      status: "COMPLETED",
      deletedAt: null,
      metadata: {
        path: ["completedAdditionalItems"],
        not: { equals: null },
      },
    },
    select: {
      projectId: true,
      metadata: true,
    },
  }) : [];

  // Sum up post-campaign sales per project
  const postCampaignByProject = new Map<string, number>();
  let postCampaignTotal = 0;

  for (const pledge of postCampaignPledges) {
    const meta = pledge.metadata as Record<string, unknown> | null;
    const completedItems = (meta?.completedAdditionalItems as Array<{ amount?: number }>) || [];
    for (const item of completedItems) {
      const amount = Number(item.amount || 0);
      if (amount > 0) {
        postCampaignTotal += amount;
        postCampaignByProject.set(
          pledge.projectId,
          (postCampaignByProject.get(pledge.projectId) || 0) + amount
        );
      }
    }
  }

  // Build per-project breakdown for the chart
  const postCampaignPerProject = projects
    .map(p => ({
      projectId: p.id,
      projectTitle: p.title,
      amount: postCampaignByProject.get(p.id) || 0,
    }))
    .filter(p => p.amount > 0);

  return { postCampaignTotal, postCampaignPerProject };
}
