/* eslint-disable @typescript-eslint/no-explicit-any */

interface ComputeStatsInput {
  pledges: any[];
  surveyResponses: any[];
  addOnSales: { _sum: { amount: unknown; quantity: unknown }; _count: number };
  selectedProject: { currentAmount: unknown; endDate?: Date | null };
  postCampaignTotal: number;
  postCampaignPerProject: { projectId: string; projectTitle: string; amount: number }[];
  /** Count of FAILED pledges (they're excluded from the pledges list). */
  failedChargesCount?: number;
}

export function computeStats({
  pledges,
  surveyResponses,
  addOnSales,
  selectedProject,
  postCampaignTotal,
  postCampaignPerProject,
  failedChargesCount = 0,
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

  // Pre-orders = pledges placed after the campaign's end date (there is
  // no isPreOrder column — the old filter read a nonexistent field and
  // always found zero). New vs returning is judged by whether the same
  // user also backed during the campaign.
  const endDate = selectedProject.endDate ? new Date(selectedProject.endDate) : null;
  const preOrderPledges = endDate
    ? pledges.filter((p: any) => new Date(p.createdAt) > endDate)
    : [];
  const preOrderBackers = preOrderPledges.length;
  const preOrderRevenue = preOrderPledges.reduce(
    (sum: number, p: any) => sum + Number(p.amount || 0),
    0
  );
  const campaignBackerUserIds = new Set(
    endDate
      ? pledges
          .filter((p: any) => new Date(p.createdAt) <= endDate)
          .map((p: any) => p.userId || p.user?.id)
          .filter(Boolean)
      : []
  );
  const returningBackers = preOrderPledges.filter((p: any) =>
    campaignBackerUserIds.has(p.userId || p.user?.id)
  ).length;
  const newBackers = preOrderBackers - returningBackers;

  // Calculate balance due per pledge for post-campaign charge tracking.
  // Balance due is stored in metadata.balanceDue when orders are edited
  // via IndieKit. Falls back to computed values from the per-pledge
  // SNAPSHOTS captured at pledge time (Pledge.rewardAmount and
  // Pledge.addonsAmount) — NOT the live Reward.amount or PledgeAddon
  // rows, which can change post-pledge (creator edits the tier price,
  // adds/removes addons, etc.) and would otherwise make every backer
  // on an edited tier appear to "owe more" through no fault of theirs.
  //
  // The snapshot is the contract — what each backer agreed to and paid
  // for. Charge Cards is for backers who genuinely added something
  // post-pledge (via the survey order-edit flow), in which case
  // metadata.balanceDue is set explicitly by that flow.
  const pledgesWithBalance = pledges.map((p: any) => {
    const meta = (p.metadata as Record<string, unknown>) || {};
    const storedBalanceDue = meta.balanceDue != null ? Number(meta.balanceDue) : null;
    if (storedBalanceDue !== null) {
      return { ...p, balanceDue: Math.round(storedBalanceDue * 100) / 100 };
    }
    // Compute from the per-pledge snapshot fields, NOT live join data.
    const pledgeTotal = Number(p.amount);
    const snapshotReward = Number(p.rewardAmount || 0);
    const snapshotAddons = Number(p.addonsAmount || 0);
    const snapshotShipping = Number(p.shippingAmount || 0);
    const expectedTotal = snapshotReward + snapshotAddons + snapshotShipping;
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
    // FAILED pledges are excluded from the fetched list, so the count
    // comes in separately from the route.
    errored: failedChargesCount,
    // A collected additional charge stamps balancePaymentCompletedAt on
    // the pledge metadata (see /api/pay/balance/confirm).
    charged: pledges.filter(
      (p: any) => ((p.metadata as Record<string, unknown>) || {}).balancePaymentCompletedAt
    ).length,
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
    preOrderRevenue: Math.round(preOrderRevenue * 100) / 100,
    returningBackers,
    newBackers,
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
