/* eslint-disable @typescript-eslint/no-explicit-any */

interface PledgeForProcessing {
  id: string;
  projectId: string;
  backerNumber: number | null;
  status: string;
  amount: unknown;
  // Per-pledge price snapshots captured at pledge creation. We
  // intentionally use these over the live reward / pledgeAddon
  // joins when computing balance due — see balance-fields block
  // below for the reasoning.
  rewardAmount?: unknown;
  addonsAmount?: unknown;
  shippingAmount: unknown;
  fulfillmentStatus: string | null;
  orderLockStatus: string | null;
  // Set true and populated by the Order Lock flow (which stores the address on
  // the pledge itself, not via a SurveyResponse).
  surveyCompleted?: boolean;
  shippingAddress?: unknown;
  paymentProcessor: string | null;
  chargeStatus?: string;
  confirmationEmailSent?: boolean;
  chargedImmediately?: boolean;
  divinityCoinPaymentMethodId?: string | null;
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
    // The Order Lock flow saves the address on the pledge (not through a
    // SurveyResponse), so fall back to pledge.shippingAddress when there's no
    // survey response address — otherwise locked backers show "Address
    // Incomplete" even though they provided one at lock time.
    const shippingAddress = (surveyResponse?.shippingAddress ?? pledge.shippingAddress) as {
      name?: string;
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      // The Order Lock page stores the state/province under `region`; normalize
      // it to `state` below so it doesn't read as missing.
      region?: string;
      postalCode?: string;
      country?: string;
      phone?: string;
    } | null;
    // Locked orders are survey-complete too (the lock flow sets
    // pledge.surveyCompleted), even without a SurveyResponse row.
    const surveyIsComplete = surveyResponse?.isComplete || pledge.surveyCompleted === true;

    // Map fulfillment status to our display status
    let status: "not_pushed" | "push_errored" | "pushed" | "shipped" = "not_pushed";
    if (pledge.fulfillmentStatus === "SHIPPED" || pledge.fulfillmentStatus === "DELIVERED") {
      status = "shipped";
    } else if (pledge.fulfillmentStatus === "FAILED") {
      status = "push_errored";
    } else if (pledge.fulfillmentStatus === "IN_PROGRESS") {
      status = "pushed";
    } else if (pledge.status === "COMPLETED" && surveyIsComplete) {
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

    // Balance fields. Use the per-pledge SNAPSHOTS (Pledge.rewardAmount,
    // Pledge.addonsAmount) NOT the live Reward / PledgeAddon joins. The
    // snapshot is what the backer agreed to and paid for at pledge time;
    // the live join can drift (creator edits the tier price, adds/removes
    // addons) and would otherwise make every backer on an edited tier
    // appear to "owe more" through no fault of theirs.
    //
    // Fall back to the live join only when the snapshot field is 0/null,
    // which is the legacy-data case for very old pledges that pre-date
    // these snapshot columns.
    const pledgeTotal = Number(pledge.amount);
    const snapshotReward = Number(pledge.rewardAmount || 0);
    const snapshotAddons = Number(pledge.addonsAmount || 0);
    const rewardAmt = snapshotReward > 0
      ? snapshotReward
      : pledge.reward
        ? Number(pledge.reward.amount)
        : 0;
    const addonsAmt = snapshotAddons > 0
      ? snapshotAddons
      : pledge.addons.reduce((sum: number, a: any) => sum + Number(a.amount || 0), 0);
    const shippingAmt = Number(pledge.shippingAmount) || 0;

    // Use stored balanceDue from metadata if available (set by order edits
    // through the IndieKit survey flow — that's the only legitimate source
    // of a post-pledge balance).
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

    // True for a DivinityCoin pledge that's committed (counts toward the
    // goal) but has NO card on file — e.g. an NMI->DC migrated pledge.
    // A real AoN saved-card pledge is also confirmationEmailSent=true +
    // PENDING but HAS a divinityCoinPaymentMethodId, hence the null
    // check. The chargedImmediately check then suppresses transient
    // false positives: immediate-charge pledges (KIA + AoN-funded) sit
    // in PENDING for a few minutes after checkout while the
    // payment.succeeded webhook is in flight — the safety-net cron
    // resolves them automatically, so flashing "Payment required" there
    // is misleading. The badge now only fires on the saved-card flow
    // (chargedImmediately false) where no card is on file.
    const needsMigrationPayment =
      pledge.paymentProcessor === "DIVINITYCOIN" &&
      pledge.status === "PENDING" &&
      pledge.confirmationEmailSent === true &&
      !pledge.divinityCoinPaymentMethodId &&
      !pledge.chargedImmediately;

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
      orderLockStatus: pledge.orderLockStatus || "UNLOCKED",
      chargeStatus,
      paymentProcessor: pledge.paymentProcessor,
      needsMigrationPayment,
      surveyCompleted: surveyIsComplete,
      addressComplete,
      pledgeDate: pledge.createdAt.toISOString(),
      shippingAddress: shippingAddress ? {
        name: shippingAddress.name || "",
        line1: shippingAddress.line1 || "",
        line2: shippingAddress.line2 || "",
        city: shippingAddress.city || "",
        state: shippingAddress.state || shippingAddress.region || "",
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
