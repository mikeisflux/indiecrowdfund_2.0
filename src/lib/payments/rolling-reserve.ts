// PaymentCloud rolling reserve helper.
//
// PaymentCloud holds 10% of gross campaign revenue in escrow for 180
// days after a campaign funds, as a buffer against chargebacks. The
// reserve is calculated on GROSS (pre-fee) revenue. Two ways a project
// gets flagged:
//   - Auto-trigger: projects with effective revenue ≥ $2,500
//   - Admin override: marked manually for new or high-risk creators
//     during project review

export const ROLLING_RESERVE_PERCENT = 0.10;
export const ROLLING_RESERVE_DAYS = 180;
export const ROLLING_RESERVE_AUTO_THRESHOLD = 2500;

/**
 * True if the project should have a rolling reserve. Either the admin
 * has flagged it manually or the auto-trigger flag is set (which we
 * flip when the project funds with effective revenue at or above the
 * threshold). Stripe / PayPal / DivinityCoin / Whop projects don't
 * have a rolling reserve since this is a PaymentCloud-specific
 * mechanism.
 */
export function isProjectSubjectToRollingReserve(project: {
  paymentProcessor: string;
  rollingReserveSubject: boolean;
  rollingReserveAuto: boolean;
}): boolean {
  if (project.paymentProcessor !== "NMI") return false;
  return project.rollingReserveSubject || project.rollingReserveAuto;
}

/**
 * Compute the reserved amount given the gross. Returns 0 when the
 * project isn't subject to a rolling reserve.
 */
export function computeRollingReserveAmount(
  gross: number,
  subject: boolean
): number {
  if (!subject || gross <= 0) return 0;
  return Math.round(gross * ROLLING_RESERVE_PERCENT * 100) / 100;
}

/** 180 days after the held-at date. */
export function computeRollingReserveReleaseDate(heldAt: Date): Date {
  const release = new Date(heldAt);
  release.setUTCDate(release.getUTCDate() + ROLLING_RESERVE_DAYS);
  return release;
}

/**
 * Result of running the auto-trigger check. The caller persists the
 * returned fields on the Project row when funding completes.
 */
export interface AutoTriggerResult {
  rollingReserveAuto: boolean;
  rollingReserveAmount: number;
  rollingReserveHeldAt: Date | null;
  rollingReserveReleaseAt: Date | null;
}

/**
 * Run the auto-trigger evaluation when a project funds. If the
 * effective revenue is at or over the threshold, mark `rollingReserveAuto`
 * and freeze the reserved amount + release date. Idempotent: callers
 * can re-run safely; we won't reset already-held values.
 */
export function evaluateAutoTrigger(
  project: {
    paymentProcessor: string;
    rollingReserveSubject: boolean;
    rollingReserveAuto: boolean;
    rollingReserveAmount: number;
    rollingReserveHeldAt: Date | null;
    rollingReserveReleaseAt: Date | null;
  },
  effectiveRevenue: number,
  now: Date = new Date()
): AutoTriggerResult {
  if (project.paymentProcessor !== "NMI") {
    return {
      rollingReserveAuto: project.rollingReserveAuto,
      rollingReserveAmount: project.rollingReserveAmount,
      rollingReserveHeldAt: project.rollingReserveHeldAt,
      rollingReserveReleaseAt: project.rollingReserveReleaseAt,
    };
  }

  const shouldAuto = effectiveRevenue >= ROLLING_RESERVE_AUTO_THRESHOLD;
  const subject = project.rollingReserveSubject || shouldAuto;

  // If the project was already held and the reserve was frozen, leave
  // the original held-at + release-at alone. Recomputing the amount is
  // fine — partial refunds change effective revenue.
  if (project.rollingReserveHeldAt) {
    return {
      rollingReserveAuto: shouldAuto || project.rollingReserveAuto,
      rollingReserveAmount: subject
        ? computeRollingReserveAmount(effectiveRevenue, true)
        : 0,
      rollingReserveHeldAt: project.rollingReserveHeldAt,
      rollingReserveReleaseAt: project.rollingReserveReleaseAt,
    };
  }

  if (!subject) {
    return {
      rollingReserveAuto: false,
      rollingReserveAmount: 0,
      rollingReserveHeldAt: null,
      rollingReserveReleaseAt: null,
    };
  }

  return {
    rollingReserveAuto: shouldAuto,
    rollingReserveAmount: computeRollingReserveAmount(effectiveRevenue, true),
    rollingReserveHeldAt: now,
    rollingReserveReleaseAt: computeRollingReserveReleaseDate(now),
  };
}
