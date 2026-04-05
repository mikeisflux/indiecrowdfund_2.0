/* eslint-disable @typescript-eslint/no-explicit-any */

interface PledgeForProcessing {
  id: string;
  projectId: string;
  backerNumber: number | null;
  status: string;
  amount: unknown;
  shippingAmount: unknown;
  fulfillmentStatus: string | null;
  paymentProcessor: string | null;
  chargeStatus?: string;
  isPreOrder: boolean;
  createdAt: Date;
  metadata: unknown;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
  reward: {
    id: string;
    title: string;
    amount: unknown;
  } | null;
  addons: {
    addon: {
      id: string;
      title: string;
      amount: unknown;
      isModifier?: boolean;
    };
    quantity: number;
    amount: unknown;
  }[];
  modifierAssignments: {
    id: string;
    rewardId: string;
    modifierAddonId: string;
    isAutoAssigned: boolean;
  }[];
}

interface SurveyResponseForProcessing {
  pledgeId: string;
  isComplete: boolean;
  completedAt: Date | null;
  shippingAddress: unknown;
  addressLocked?: boolean;
}

export function processBackers(
  pledges: PledgeForProcessing[],
  surveyResponseMap: Map<string, SurveyResponseForProcessing>,
) {
  // Deduplicate pledges by ID (in case of data issues)
  const seenPledgeIds = new Set<string>();
  const uniquePledges = pledges.filter(pledge => {
    if (seenPledgeIds.has(pledge.id)) return false;
    seenPledgeIds.add(pledge.id);
    return true;
  });

  return uniquePledges.map(pledge => {
    const surveyResponse = surveyResponseMap.get(pledge.id);
    const shippingAddress = surveyResponse?.shippingAddress as {
      name?: string;
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
      phone?: string;
    } | null;

    // Map fulfillment status to our display status
    let status: "not_pushed" | "push_errored" | "pushed" | "shipped" = "not_pushed";
    if (pledge.fulfillmentStatus === "SHIPPED" || pledge.fulfillmentStatus === "DELIVERED") {
      status = "shipped";
    } else if (pledge.fulfillmentStatus === "FAILED") {
      status = "push_errored";
    } else if (pledge.fulfillmentStatus === "IN_PROGRESS") {
      status = "pushed";
    } else if (pledge.status === "COMPLETED" && surveyResponse?.isComplete) {
      status = "not_pushed"; // Ready to push
    }

    // Build items list - only the main reward, addons are separate
    const items = pledge.reward ? [{ name: pledge.reward.title, quantity: 1 }] : [];

    // Build addons list with proper structure
    const addons = pledge.addons.map((a: any) => ({
      id: a.addon.id,
      name: a.addon.title,
      quantity: a.quantity,
      amount: Number(a.addon.amount),
      isModifier: a.addon.isModifier || false,
    }));

    // Check if backer has modifier addons that need assignment
    const hasModifierAddons = pledge.addons.some((a: any) => a.addon.isModifier);
    const modifierAssignments = (pledge.modifierAssignments || []).map((ma: any) => {
      const modifierAddon = pledge.addons.find((a: any) => a.addon.id === ma.modifierAddonId);
      return {
        id: ma.id,
        rewardId: ma.rewardId,
        rewardTitle: pledge.reward?.title,
        modifierAddonId: ma.modifierAddonId,
        modifierAddonTitle: modifierAddon?.addon?.title,
        isAutoAssigned: ma.isAutoAssigned,
      };
    });
    const needsModifierAssignment = hasModifierAddons && modifierAssignments.length < pledge.addons.filter((a: any) => a.addon.isModifier).length;

    // Balance fields - compute from related records (stored pledge fields may be 0 for older pledges)
    const pledgeTotal = Number(pledge.amount);
    const rewardAmt = pledge.reward ? Number(pledge.reward.amount) : 0;
    const addonsAmt = pledge.addons.reduce((sum: number, a: any) => sum + Number(a.amount || 0), 0);
    const shippingAmt = Number(pledge.shippingAmount) || 0;

    // Use stored balanceDue from metadata if available (set by order edits)
    const pledgeMeta = (pledge.metadata as Record<string, unknown>) || {};
    const storedBalance = pledgeMeta.balanceDue != null ? Number(pledgeMeta.balanceDue) : null;
    const balanceDue = storedBalance !== null
      ? storedBalance
      : (rewardAmt + addonsAmt + shippingAmt) - pledgeTotal;

    // Determine charge status
    let chargeStatus: "not_charged" | "errored" | "charged" | "paypal_collected" = "not_charged";
    if (pledge.status === "COMPLETED") {
      chargeStatus = (pledge.paymentProcessor === "DIVINITYCOIN" || pledge.paymentProcessor === "PAYPAL")
        ? "paypal_collected"
        : "charged";
    } else if (pledge.status === "FAILED") {
      chargeStatus = "errored";
    }

    // Check if address is complete
    const addressComplete = !!(shippingAddress?.line1 && shippingAddress?.city && shippingAddress?.country && shippingAddress?.postalCode);

    return {
      id: pledge.id,
      projectId: pledge.projectId,
      backerNumber: pledge.backerNumber || 0,
      name: pledge.user.name || "Anonymous",
      email: pledge.user.email || "",
      avatar: pledge.user.image || undefined,
      pledgeAmount: pledgeTotal,
      reward: pledge.reward?.title || "No Reward",
      rewardId: pledge.reward?.id,
      rewardAmount: pledge.reward ? Number(pledge.reward.amount) : 0,
      status,
      chargeStatus,
      paymentProcessor: pledge.paymentProcessor,
      surveyCompleted: surveyResponse?.isComplete || false,
      addressComplete,
      pledgeDate: pledge.createdAt.toISOString(),
      shippingAddress: shippingAddress ? {
        name: shippingAddress.name || "",
        line1: shippingAddress.line1 || "",
        line2: shippingAddress.line2 || "",
        city: shippingAddress.city || "",
        state: shippingAddress.state || "",
        country: shippingAddress.country || "",
        postalCode: shippingAddress.postalCode || "",
        phone: shippingAddress.phone || "",
      } : undefined,
      balance: {
        pledgeAmount: pledgeTotal,
        pledgeLevelAmount: rewardAmt,
        addonsAmount: addonsAmt,
        shippingAmount: shippingAmt,
        totalCharged: pledgeTotal,
        balanceDue,
      },
      items,
      addons,
      digitalDownloads: [], // Would be populated from digital file distribution records
      activity: [], // Would be populated from activity logs
      needsModifierAssignment,
      modifierAssignments,
    };
  });
}
