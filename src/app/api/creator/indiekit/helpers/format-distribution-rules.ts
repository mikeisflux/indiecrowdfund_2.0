import { db } from "@/lib/db";

export type DistributionRuleType = {
  id: string;
  name: string;
  triggerType: string;
  triggerRewardId: string | null;
  triggerAddonId: string | null;
  requiresPayment: boolean;
  status: string;
  distributedCount: number;
  totalEligible: number;
  startedAt: Date | null;
  digitalFile: { name: string } | null;
};

export async function formatDistributionRules(distributionRulesData: DistributionRuleType[], selectedProjectId: string) {
  return Promise.all(
    distributionRulesData.map(async (rule) => {
      let triggerProductName = "All Backers";
      if (rule.triggerType === "SPECIFIC_REWARD" && rule.triggerRewardId) {
        const reward = await db.reward.findUnique({
          where: { id: rule.triggerRewardId, projectId: selectedProjectId },
          select: { title: true },
        });
        triggerProductName = reward?.title || "Unknown Reward";
      } else if (rule.triggerType === "SPECIFIC_ADDON" && rule.triggerAddonId) {
        const addon = await db.reward.findUnique({
          where: { id: rule.triggerAddonId, projectId: selectedProjectId },
          select: { title: true },
        });
        triggerProductName = addon?.title || "Unknown Add-on";
      }

      // Convert status to lowercase with underscores for frontend
      const statusMap: Record<string, "not_started" | "started" | "completed"> = {
        NOT_STARTED: "not_started",
        STARTED: "started",
        COMPLETED: "completed",
      };

      return {
        id: rule.id,
        name: rule.name,
        condition: rule.triggerType,
        triggerProduct: triggerProductName,
        distributeFile: rule.digitalFile?.name || "Unknown File",
        requiresPayment: rule.requiresPayment,
        status: statusMap[rule.status] || "not_started",
        distributedCount: rule.distributedCount,
        totalEligible: rule.totalEligible,
        startedAt: rule.startedAt?.toISOString(),
      };
    })
  );
}
