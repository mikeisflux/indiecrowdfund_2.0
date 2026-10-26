import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { currentBalanceDue, round2 } from "@/lib/indiekit/balance-request";

const log = logger.child({ module: "indiekit-shipping-charges" });

export interface ShippingAddressView {
  name: string | null;
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  phone: string | null;
}

export interface ShippingChargeView {
  amount: number;
  note: string | null;
  setAt: string;
}

export interface ShippingChargeBacker {
  pledgeId: string;
  backerNumber: number | null;
  name: string;
  email: string | null;
  address: ShippingAddressView | null;
  addressSource: "survey" | "pledge" | null;
  country: string | null;
  surveyCompleted: boolean;
  fulfillmentStatus: string;
  reward: { title: string; amount: number; physical: boolean } | null;
  addons: { title: string; quantity: number; amount: number; physical: boolean }[];
  /** Anything in the order that has to be mailed. */
  physical: boolean;
  totalPaid: number;
  /** The order's shipping line as it stands (checkout shipping + any charge set here). */
  shippingLine: number;
  /** Shipping collected at checkout, before any charge set here. */
  shippingAtCheckout: number;
  shippingCharge: ShippingChargeView | null;
  balanceDue: number;
  balanceSentAt: string | null;
  balancePaidAt: string | null;
  balanceAmountPaid: number | null;
  /** Where this order is in the shipping-charge flow. */
  state: "none" | "set" | "sent" | "paid";
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function toAddress(raw: unknown): ShippingAddressView | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;
  const view: ShippingAddressView = {
    name: str(a.name) ?? str(a.fullName),
    line1: str(a.line1) ?? str(a.address1) ?? str(a.street),
    line2: str(a.line2) ?? str(a.address2),
    city: str(a.city),
    state: str(a.state) ?? str(a.province) ?? str(a.region),
    postalCode: str(a.postalCode) ?? str(a.zip) ?? str(a.postal_code),
    country: str(a.country),
    phone: str(a.phone),
  };
  return Object.values(view).some((v) => v) ? view : null;
}

type PledgeRow = {
  id: string;
  backerNumber: number | null;
  amount: unknown;
  rewardAmount: unknown;
  addonsAmount: unknown;
  shippingAmount: unknown;
  shippingAddress: unknown;
  metadata: unknown;
  surveyCompleted: boolean;
  fulfillmentStatus: string;
  user: { email: string | null; name: string | null };
  reward: { title: string; amount: unknown; shippingType: string } | null;
  addons: { quantity: number; amount: unknown; addon: { title: string; shippingType: string } | null }[];
  surveyResponse: { shippingAddress: unknown } | null;
};

function toView(p: PledgeRow): ShippingChargeBacker {
  const meta = (p.metadata as Record<string, unknown>) || {};
  const chargeRaw = meta.shippingCharge && typeof meta.shippingCharge === "object" ? (meta.shippingCharge as Record<string, unknown>) : null;
  const shippingCharge: ShippingChargeView | null =
    chargeRaw && Number.isFinite(Number(chargeRaw.amount))
      ? { amount: Number(chargeRaw.amount), note: str(chargeRaw.note), setAt: typeof chargeRaw.setAt === "string" ? chargeRaw.setAt : "" }
      : null;
  const surveyAddr = toAddress(p.surveyResponse?.shippingAddress);
  const pledgeAddr = toAddress(p.shippingAddress);
  const address = surveyAddr ?? pledgeAddr;
  const rewardPhysical = !!p.reward && p.reward.shippingType !== "NO_SHIPPING";
  const addons = p.addons.map((a) => ({
    title: a.addon?.title ?? "(removed add-on)",
    quantity: a.quantity,
    amount: Number(a.amount),
    physical: !!a.addon && a.addon.shippingType !== "NO_SHIPPING",
  }));
  const balanceDue = currentBalanceDue(p);
  const balanceSentAt = typeof meta.balanceNotificationSentAt === "string" ? meta.balanceNotificationSentAt : null;
  const balancePaidAt = typeof meta.balancePaymentCompletedAt === "string" ? meta.balancePaymentCompletedAt : null;
  const shippingLine = Number(p.shippingAmount);
  let state: ShippingChargeBacker["state"] = "none";
  if (shippingCharge) {
    if (balancePaidAt && balanceDue <= 0 && (!balanceSentAt || balancePaidAt >= shippingCharge.setAt)) state = "paid";
    else if (balanceSentAt && balanceSentAt >= shippingCharge.setAt) state = "sent";
    else state = "set";
  }
  return {
    pledgeId: p.id,
    backerNumber: p.backerNumber,
    name: p.user.name || address?.name || p.user.email || "Backer",
    email: p.user.email,
    address,
    addressSource: surveyAddr ? "survey" : pledgeAddr ? "pledge" : null,
    country: address?.country ?? null,
    surveyCompleted: p.surveyCompleted,
    fulfillmentStatus: p.fulfillmentStatus,
    reward: p.reward ? { title: p.reward.title, amount: Number(p.reward.amount), physical: rewardPhysical } : null,
    addons,
    physical: rewardPhysical || addons.some((a) => a.physical),
    totalPaid: Number(p.amount),
    shippingLine,
    shippingAtCheckout: round2(shippingLine - (shippingCharge?.amount ?? 0)),
    shippingCharge,
    balanceDue,
    balanceSentAt,
    balancePaidAt,
    balanceAmountPaid: meta.balanceAmountPaid != null ? Number(meta.balanceAmountPaid) : null,
    state,
  };
}

const PLEDGE_SELECT = {
  id: true,
  backerNumber: true,
  amount: true,
  rewardAmount: true,
  addonsAmount: true,
  shippingAmount: true,
  shippingAddress: true,
  metadata: true,
  surveyCompleted: true,
  fulfillmentStatus: true,
  user: { select: { email: true, name: true } },
  reward: { select: { title: true, amount: true, shippingType: true } },
  addons: { select: { quantity: true, amount: true, addon: { select: { title: true, shippingType: true } } } },
  surveyResponse: { select: { shippingAddress: true } },
} as const;

/** Every paid order on the campaign, physical ones first, in backer order. */
export async function listShippingChargeBackers(projectId: string): Promise<ShippingChargeBacker[]> {
  const pledges = (await db.pledge.findMany({
    where: { projectId, status: "COMPLETED", deletedAt: null },
    select: PLEDGE_SELECT,
    orderBy: [{ backerNumber: "asc" }, { createdAt: "asc" }],
  })) as PledgeRow[];
  return pledges.map(toView);
}

export async function getShippingChargeBacker(projectId: string, pledgeId: string): Promise<ShippingChargeBacker | null> {
  const p = (await db.pledge.findFirst({
    where: { id: pledgeId, projectId, status: "COMPLETED", deletedAt: null },
    select: PLEDGE_SELECT,
  })) as PledgeRow | null;
  return p ? toView(p) : null;
}

/**
 * Set (or replace) the shipping charge on one order. The amount becomes the
 * order's shipping line and is added to the backer's balance due; replacing
 * an unpaid charge applies only the difference. Amount 0 removes it.
 *
 * Nothing is emailed here; sendBalanceRequest does that.
 */
export async function setShippingCharge(input: {
  projectId: string;
  pledgeId: string;
  amount: number;
  note?: string | null;
  actorId: string;
}): Promise<{ ok: true; backer: ShippingChargeBacker } | { ok: false; error: string }> {
  const amount = round2(input.amount);
  if (!Number.isFinite(amount) || amount < 0) return { ok: false, error: "Enter a shipping amount of zero or more" };
  const note = str(input.note)?.slice(0, 120) ?? null;

  try {
    const result = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT id FROM "Pledge" WHERE id = ${input.pledgeId} FOR UPDATE`;
      const fresh = await tx.pledge.findFirst({
        where: { id: input.pledgeId, projectId: input.projectId, status: "COMPLETED", deletedAt: null },
        select: { metadata: true, amount: true, rewardAmount: true, addonsAmount: true, shippingAmount: true },
      });
      if (!fresh) return { ok: false as const, error: "Order not found" };
      const meta = (fresh.metadata as Record<string, unknown>) || {};
      const prevRaw = meta.shippingCharge && typeof meta.shippingCharge === "object" ? (meta.shippingCharge as Record<string, unknown>) : null;
      const prevAmount = prevRaw && Number.isFinite(Number(prevRaw.amount)) ? Number(prevRaw.amount) : 0;
      const paidAt = typeof meta.balancePaymentCompletedAt === "string" ? meta.balancePaymentCompletedAt : null;
      const prevSetAt = prevRaw && typeof prevRaw.setAt === "string" ? prevRaw.setAt : null;
      const prevPaid = !!prevRaw && !!paidAt && !!prevSetAt && paidAt >= prevSetAt && currentBalanceDue(fresh) <= 0;
      if (prevPaid) {
        return { ok: false as const, error: `This backer already paid the $${prevAmount.toFixed(2)} shipping charge. Use a balance adjustment for anything further.` };
      }

      const delta = round2(amount - prevAmount);
      const stored = currentBalanceDue(fresh);
      const newBalance = Math.max(0, round2(stored + delta));

      const adjustments = Array.isArray(meta.adjustments) ? [...(meta.adjustments as unknown[])] : [];
      if (delta !== 0) {
        adjustments.push({
          type: delta > 0 ? "charge" : "credit",
          amount: Math.abs(delta),
          reason: `[shipping] ${note || "Shipping"}${prevRaw ? " (replaces earlier shipping charge)" : ""}`,
          previousBalance: stored,
          newBalance,
          adjustedAt: new Date().toISOString(),
          adjustedBy: input.actorId,
        });
      }

      const { shippingCharge: _old, balanceDueBreakdown: _oldLines, balanceDueReason: _oldReason, ...rest } = meta;
      void _old;
      void _oldLines;
      void _oldReason;
      const nextMeta: Record<string, unknown> = {
        ...rest,
        balanceDue: newBalance,
        adjustments,
      };
      if (amount > 0) {
        nextMeta.shippingCharge = { amount, note, setAt: new Date().toISOString(), setBy: input.actorId };
        nextMeta.balanceDueReason = "shipping";
        nextMeta.balanceDueBreakdown = [{ label: note || "Shipping", amount }];
      }

      await tx.pledge.update({
        where: { id: input.pledgeId },
        data: {
          shippingAmount: { increment: delta },
          metadata: nextMeta,
        },
      });
      return { ok: true as const };
    });
    if (!result.ok) return result;
  } catch (err) {
    log.error({ err: String(err), pledgeId: input.pledgeId }, "setShippingCharge failed");
    return { ok: false, error: "Could not save the shipping charge" };
  }

  const backer = await getShippingChargeBacker(input.projectId, input.pledgeId);
  if (!backer) return { ok: false, error: "Order not found after save" };
  log.info({ pledgeId: input.pledgeId, amount, actorId: input.actorId }, "Shipping charge set");
  return { ok: true, backer };
}
