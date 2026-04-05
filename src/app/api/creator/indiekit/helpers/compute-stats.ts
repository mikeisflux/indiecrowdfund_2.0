/* eslint-disable @typescript-eslint/no-explicit-any */

interface ComputeStatsInput {
  pledges: any[];
  surveyResponses: any[];
  addOnSales: { _sum: { amount: unknown; quantity: unknown }; _count: number };
  selectedProject: { currentAmount: unknown };
  postCampaignTotal: number;
  postCampaignPerProject: { projectId: string; projectTitle: string; amount: number }[];
}

export function computeStats({
  pledges,
  surveyResponses,
  addOnSales,
  selectedProject,
  postCampaignTotal,
  postCampaignPerProject,
}: ComputeStatsInput) {
  // Calculate stats
  const totalBackers = pledges.filter((p: any) => p.status === "COMPLETED").length;
  const surveysCompleted = surveyResponses.filter((sr: any) => sr.isComplete).length;
  const surveysPending = totalBackers - surveysCompleted;

  // Count fulfilled backers (those with shipped status in fulfillmentStatus)
  const fulfilledBackers = pledges.filter(
    (p: any) => p.fulfillmentStatus === "SHIPPED" || p.fulfillmentStatus === "DELIVERED"
  ).length;

  // Count packages shipped
  const packagesShipped = pledges.filter(
    (p: any) => p.fulfillmentStatus === "SHIPPED" || p.fulfillmentStatus === "DELIVERED"
  ).length;

  // Count digital downloads distributed
  const digitalDownloads = surveyResponses.filter((sr: any) => sr.isComplete).length;

  // Calculate pledge level breakdown
  const pledgeLevelCounts = new Map<string, number>();
  pledges.filter((p: any) => p.status === "COMPLETED").forEach((pledge: any) => {
    const level = pledge.reward?.title || "No Reward";
    pledgeLevelCounts.set(level, (pledgeLevelCounts.get(level) || 0) + 1);
  });
  const pledgeLevelBreakdown = Array.from(pledgeLevelCounts.entries())
    .map(([label, count]) => ({
      label,
      count,
      percentage: totalBackers > 0 ? Math.round((count / totalBackers) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Calculate survey status breakdown
  const surveyStatusBreakdown = [
    {
      label: "Completed",
      count: surveysCompleted,
      percentage: totalBackers > 0 ? Math.round((surveysCompleted / totalBackers) * 100) : 0,
      color: "bg-green-500",
    },
    {
      label: "Pending",
      count: surveysPending,
      percentage: totalBackers > 0 ? Math.round((surveysPending / totalBackers) * 100) : 0,
      color: "bg-yellow-500",
    },
  ];

  // Calculate shipping region breakdown
  const regionCounts = new Map<string, number>();
  surveyResponses.forEach((sr: any) => {
    const address = sr.shippingAddress as { country?: string } | null;
    const country = address?.country || "Unknown";
    regionCounts.set(country, (regionCounts.get(country) || 0) + 1);
  });
  const shippingRegionBreakdown = Array.from(regionCounts.entries())
    .map(([label, count]) => ({
      label,
      count,
      percentage: surveyResponses.length > 0 ? Math.round((count / surveyResponses.length) * 100) : 0,
      color: "bg-teal-500",
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10); // Top 10 regions

  // Payment status breakdown - we only fetch COMPLETED pledges now
  // so all pledges shown are successful payments
  const totalPledges = pledges.length;
  const paymentStatusBreakdown = [
    { label: "Completed", count: totalPledges, percentage: 100, color: "bg-green-500" },
  ];

  // Pre-order count
  const preOrderBackers = pledges.filter((p: any) => p.isPreOrder).length;

  // Calculate balance due per pledge for post-campaign charge tracking
  // Balance due is stored in metadata.balanceDue when orders are edited via IndieKit
  // Falls back to computed values from related reward/addon data
  const pledgesWithBalance = pledges.map((p: any) => {
    const meta = (p.metadata as Record<string, unknown>) || {};
    const storedBalanceDue = meta.balanceDue != null ? Number(meta.balanceDue) : null;
    if (storedBalanceDue !== null) {
      return { ...p, balanceDue: Math.round(storedBalanceDue * 100) / 100 };
    }
    // Compute from actual related data
    const pledgeTotal = Number(p.amount);
    const computedRewardAmt = p.reward ? Number(p.reward.amount) : 0;
    const computedAddonsAmt = p.addons.reduce((sum: number, a: { amount: unknown }) => sum + Number(a.amount || 0), 0);
    const computedShipping = Number(p.shippingAmount) || 0;
    const expectedTotal = computedRewardAmt + computedAddonsAmt + computedShipping;
    const balanceDue = Math.round((expectedTotal - pledgeTotal) * 100) / 100;
    return { ...p, balanceDue };
  });

  // Post-survey addon revenue = sum of positive balance due amounts only
  // This represents money owed from post-campaign order edits (addon additions, shipping changes)
  const backersWithBalanceDue = pledgesWithBalance.filter((p: any) => p.balanceDue > 0);
  const postSurveyAddonRevenue = backersWithBalanceDue.reduce((sum: number, p: any) => sum + p.balanceDue, 0);

  // Calculate charge stats for workflow
  // "Charge Cards" is for ADDITIONAL charges (add-ons added via survey, shipping upgrades, etc.)
  // NOT for initial pledge payments - those are already collected when status is COMPLETED
  const chargeStats = {
    notCharged: backersWithBalanceDue.length, // Backers with outstanding balance from post-campaign changes
    errored: pledges.filter((p: any) => p.chargeStatus === "FAILED").length,
    charged: 0, // TODO: track successful additional charge collections
    paypalCollected: pledges.filter((p: any) => p.paymentProcessor === "PAYPAL" && p.status === "COMPLETED").length,
  };

  // Calculate backers with addons (campaign + post-campaign)
  const backersWithAddons = pledges.filter((p: any) => p.addons && p.addons.length > 0).length;

  const stats = {
    totalBackers,
    fulfilledBackers,
    surveysCompleted,
    surveysPending,
    totalRaised: Number(selectedProject.currentAmount),
    addOnPurchases: Number(addOnSales._sum.amount || 0), // Total campaign addon sales (all time)
    postSurveyAddonRevenue, // Revenue from post-campaign IndieKit order edits only
    backersWithBalanceDue: backersWithBalanceDue.length,
    backersWithAddons,
    totalAddonItems: Number(addOnSales._sum.quantity || 0),
    addonPurchaseCount: addOnSales._count || 0,
    digitalDownloads,
    packagesShipped,
    preOrderBackers,
    chargeStats,
    pledgeLevelBreakdown,
    surveyStatusBreakdown,
    shippingRegionBreakdown,
    paymentStatusBreakdown,
    // Post-campaign sales (from IndieKit survey add-on purchases across ALL projects)
    postCampaignTotalRaised: postCampaignTotal,
    postCampaignAddonSales: postCampaignTotal, // All post-campaign sales are addon sales
    postCampaignPerProject,
  };

  return { stats, chargeStats, totalBackers, surveysCompleted };
}
