// Helper to determine workflow state
export type WorkflowStatus = "completed" | "in_progress" | "pending" | "locked";

export interface WorkflowContext {
  survey: { status: string; lockedAt?: Date | null } | null;
  totalBackers: number;
  completedSurveys: number;
  addressesLocked: number;
  addressesComplete: number;
  pledges: { fulfillmentStatus: string | null; chargeStatus?: string }[];
  chargeStats: { notCharged: number; errored: number; charged: number };
}

export function getWorkflowState(ctx: WorkflowContext) {
  const steps: { id: string; label: string; description: string; icon: string; status: WorkflowStatus; actionCount?: number }[] = [
    { id: "surveys", label: "Send & Remind", description: "Collect backer surveys", icon: "Mail", status: "pending", actionCount: 0 },
    { id: "lock_orders", label: "Lock Orders", description: "Finalize backer selections", icon: "Lock", status: "locked", actionCount: 0 },
    { id: "charge_cards", label: "Charge Cards", description: "Process additional payments", icon: "CreditCard", status: "locked", actionCount: 0 },
    { id: "lock_addresses", label: "Lock Addresses", description: "Confirm shipping details", icon: "MapPin", status: "locked", actionCount: 0 },
    { id: "start_shipping", label: "Start Shipping", description: "Push orders to fulfillment", icon: "Truck", status: "locked", actionCount: 0 },
    { id: "shipped", label: "Shipped", description: "Mark orders as complete", icon: "CheckCircle2", status: "locked", actionCount: 0 },
  ];

  const { survey, totalBackers, completedSurveys, addressesLocked, addressesComplete, pledges, chargeStats } = ctx;

  // Calculate fulfillment counts
  const notPushedCount = pledges.filter(p => !p.fulfillmentStatus || p.fulfillmentStatus === "PENDING").length;
  const inProgressCount = pledges.filter(p => p.fulfillmentStatus === "IN_PROGRESS").length;
  const shippedCount = pledges.filter(p => p.fulfillmentStatus === "SHIPPED" || p.fulfillmentStatus === "DELIVERED").length;
  const pendingSurveys = totalBackers - completedSurveys;

  // STEP 1: Surveys
  // Always available - show pending surveys count
  steps[0].actionCount = pendingSurveys;
  if (!survey || survey.status === "DRAFT") {
    steps[0].status = "pending";
  } else if (survey.status === "SENT") {
    steps[0].status = completedSurveys > 0 ? "in_progress" : "pending";
    if (completedSurveys >= totalBackers * 0.9) {
      steps[0].status = "completed";
    }
  } else if (survey.status === "LOCKED") {
    steps[0].status = "completed";
  }

  // STEP 2: Lock Orders
  // Available once survey has responses (some surveys completed)
  const unlockedOrders = totalBackers - (survey?.status === "LOCKED" ? totalBackers : 0);
  steps[1].actionCount = completedSurveys > 0 ? unlockedOrders : 0;
  if (completedSurveys > 0) {
    if (survey?.status === "LOCKED") {
      steps[1].status = "completed";
    } else {
      steps[1].status = "pending";
    }
  }

  // STEP 3: Charge Cards
  // Available once orders are locked OR if we have completed surveys
  steps[2].actionCount = chargeStats.notCharged;
  if (survey?.status === "LOCKED" || completedSurveys > 0) {
    if (chargeStats.notCharged === 0 && chargeStats.charged > 0) {
      steps[2].status = "completed";
    } else if (chargeStats.charged > 0) {
      steps[2].status = "in_progress";
    } else {
      steps[2].status = "pending";
    }
  }

  // STEP 4: Lock Addresses
  // Available once we have addresses to lock
  const unlockedAddresses = addressesComplete - addressesLocked;
  steps[3].actionCount = unlockedAddresses > 0 ? unlockedAddresses : addressesComplete;
  if (addressesComplete > 0) {
    if (addressesLocked >= addressesComplete && addressesComplete > 0) {
      steps[3].status = "completed";
    } else if (addressesLocked > 0) {
      steps[3].status = "in_progress";
    } else {
      steps[3].status = "pending";
    }
  }

  // STEP 5: Start Shipping
  // Available once addresses are complete
  steps[4].actionCount = notPushedCount;
  if (addressesComplete > 0) {
    if (notPushedCount === 0 && (inProgressCount > 0 || shippedCount > 0)) {
      steps[4].status = "completed";
    } else if (inProgressCount > 0 || shippedCount > 0) {
      steps[4].status = "in_progress";
    } else {
      steps[4].status = "pending";
    }
  }

  // STEP 6: Shipped
  // Available once some orders are pushed
  steps[5].actionCount = inProgressCount;
  if (inProgressCount > 0 || shippedCount > 0) {
    if (shippedCount === totalBackers && totalBackers > 0) {
      steps[5].status = "completed";
    } else if (shippedCount > 0) {
      steps[5].status = "in_progress";
    } else {
      steps[5].status = "pending";
    }
  }

  return steps;
}
