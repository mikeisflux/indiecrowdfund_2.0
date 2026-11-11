import { db } from "@/lib/db";

/**
 * Which creators are missing payout information, and what.
 *
 * The bank-account forms have required a billing address since the KYC
 * change, but rows saved before that were left alone ("legacy account, ask
 * creator to re-save" in the admin payout view). Nothing ever asked the
 * creator, so an admin found out at settlement time, with money waiting.
 *
 * This is the single rule for "complete". The dashboard gate, the creator
 * API, the admin report and the reminder email all read it, so a creator is
 * blocked for exactly the fields an admin would see as missing.
 */

export type PayoutProcessor = "DIVINITYCOIN" | "WHOP" | "PAYPAL";

export const PAYOUT_PROCESSOR_LABEL: Record<PayoutProcessor, string> = {
  DIVINITYCOIN: "Divinity Payments",
  WHOP: "Whop",
  PAYPAL: "PayPal",
};

/** Creator API route that saves the bank account for each processor. */
export const PAYOUT_PROCESSOR_API: Record<PayoutProcessor, string> = {
  DIVINITYCOIN: "/api/creator/bank-account",
  WHOP: "/api/creator/whop-bank-account",
  PAYPAL: "/api/creator/paypal-bank-account",
};

/** Campaign statuses that must have a payout account on file. */
export const PAYOUT_ACCOUNT_REQUIRED_STATUSES = ["SUBMITTED", "APPROVED", "LIVE", "PAUSED", "FUNDED"] as const;

interface BankRowShape {
  bankNameEncrypted?: string | null;
  accountHolderEncrypted?: string | null;
  accountHolderFirstNameEncrypted?: string | null;
  accountHolderLastNameEncrypted?: string | null;
  accountNumberEncrypted?: string | null;
  routingNumberEncrypted?: string | null;
  billingLine1Encrypted?: string | null;
  billingCityEncrypted?: string | null;
  billingZipEncrypted?: string | null;
  billingCountryEncrypted?: string | null;
}

/** Human-readable names of the fields a saved bank row is missing. */
export function missingBankFields(row: BankRowShape): string[] {
  const missing: string[] = [];
  if (!row.bankNameEncrypted) missing.push("bank name");
  const holder = row.accountHolderEncrypted || (row.accountHolderFirstNameEncrypted && row.accountHolderLastNameEncrypted);
  if (!holder) missing.push("account holder name");
  if (!row.accountNumberEncrypted) missing.push("account number");
  if (!row.routingNumberEncrypted) missing.push("routing number");
  const addressMissing = [
    !row.billingLine1Encrypted && "street",
    !row.billingCityEncrypted && "city",
    !row.billingZipEncrypted && "ZIP/postal code",
    !row.billingCountryEncrypted && "country",
  ].filter(Boolean);
  if (addressMissing.length === 4) missing.push("billing address");
  else if (addressMissing.length > 0) missing.push(`billing address (${addressMissing.join(", ")})`);
  return missing;
}

export interface PendingPayoutAccount {
  processor: PayoutProcessor;
  label: string;
  /** A bank row exists for this processor (it is incomplete). False = nothing on file. */
  exists: boolean;
  missing: string[];
  /** What we can safely prefill in the fix-it form. */
  prefill: { bankName: string | null; accountType: string | null; bankCountry: string | null; lastFour: string | null };
  /** Campaigns that pay out through this processor. */
  projects: { id: string; title: string; status: string }[];
}

const BANK_SELECT = {
  bankNameEncrypted: true,
  accountHolderEncrypted: true,
  accountNumberEncrypted: true,
  routingNumberEncrypted: true,
  billingLine1Encrypted: true,
  billingCityEncrypted: true,
  billingZipEncrypted: true,
  billingCountryEncrypted: true,
  bankNameDisplay: true,
  accountType: true,
  bankCountry: true,
  accountLastFour: true,
} as const;

/**
 * Everything a creator must fix before payouts can be made: incomplete bank
 * rows for any processor, and a missing account for any processor one of
 * their launched or launch-ready campaigns pays out through. Empty array
 * means nothing is owed.
 */
export async function pendingPayoutDetails(userId: string): Promise<PendingPayoutAccount[]> {
  const [dc, whop, paypal, paypalConfig, projects] = await Promise.all([
    db.divinityCoinBankAccount.findUnique({
      where: { userId },
      select: { ...BANK_SELECT, accountHolderFirstNameEncrypted: true, accountHolderLastNameEncrypted: true },
    }),
    db.whopBankAccount.findUnique({ where: { userId }, select: BANK_SELECT }),
    db.payPalBankAccount.findUnique({ where: { userId }, select: BANK_SELECT }),
    db.payPalPayoutConfig.findUnique({ where: { userId }, select: { id: true } }),
    db.project.findMany({
      where: { creatorId: userId, deletedAt: null, status: { in: [...PAYOUT_ACCOUNT_REQUIRED_STATUSES] } },
      select: { id: true, title: true, status: true, paymentProcessor: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const rows: Record<PayoutProcessor, typeof whop | typeof dc> = { DIVINITYCOIN: dc, WHOP: whop, PAYPAL: paypal };
  const out: PendingPayoutAccount[] = [];

  for (const processor of ["DIVINITYCOIN", "WHOP", "PAYPAL"] as PayoutProcessor[]) {
    const row = rows[processor];
    const owned = projects
      .filter((p: { paymentProcessor: string }) => p.paymentProcessor === processor)
      .map((p: { id: string; title: string; status: string }) => ({ id: p.id, title: p.title, status: p.status }));

    if (row) {
      const missing = missingBankFields(row);
      if (missing.length === 0) continue;
      out.push({
        processor,
        label: PAYOUT_PROCESSOR_LABEL[processor],
        exists: true,
        missing,
        prefill: { bankName: row.bankNameDisplay, accountType: row.accountType, bankCountry: row.bankCountry, lastFour: row.accountLastFour },
        projects: owned,
      });
      continue;
    }

    // No row at all. Only a problem when a campaign actually pays out this
    // way. A PayPal campaign may still be paid through the legacy
    // PayPalPayoutConfig (payout by PayPal email), which counts.
    if (owned.length === 0) continue;
    if (processor === "PAYPAL" && paypalConfig) continue;
    out.push({
      processor,
      label: PAYOUT_PROCESSOR_LABEL[processor],
      exists: false,
      missing: ["bank account"],
      prefill: { bankName: null, accountType: null, bankCountry: null, lastFour: null },
      projects: owned,
    });
  }

  return out;
}

export interface IncompletePayoutCreator {
  userId: string;
  name: string | null;
  email: string;
  accounts: { processor: PayoutProcessor; label: string; exists: boolean; missing: string[]; projects: { id: string; title: string; status: string }[] }[];
}

/**
 * Every creator with something to fix. Admin report and bulk reminder. Looks
 * at bank rows (any creator) plus creators with a gated campaign, so a
 * creator with no row and a live campaign is in the list too.
 */
export async function findCreatorsWithIncompletePayoutDetails(): Promise<IncompletePayoutCreator[]> {
  const rowUsers = await Promise.all([
    db.divinityCoinBankAccount.findMany({ select: { userId: true } }),
    db.whopBankAccount.findMany({ select: { userId: true } }),
    db.payPalBankAccount.findMany({ select: { userId: true } }),
    db.project.findMany({
      where: { deletedAt: null, status: { in: [...PAYOUT_ACCOUNT_REQUIRED_STATUSES] }, paymentProcessor: { in: ["DIVINITYCOIN", "WHOP", "PAYPAL"] } },
      select: { creatorId: true },
      distinct: ["creatorId"],
    }),
  ]);
  const ids = new Set<string>();
  for (const r of rowUsers[0]) ids.add(r.userId);
  for (const r of rowUsers[1]) ids.add(r.userId);
  for (const r of rowUsers[2]) ids.add(r.userId);
  for (const r of rowUsers[3]) ids.add(r.creatorId);
  if (ids.size === 0) return [];

  const users = await db.user.findMany({
    where: { id: { in: [...ids] }, deletedAt: null },
    select: { id: true, name: true, email: true },
  });

  const out: IncompletePayoutCreator[] = [];
  for (const u of users as { id: string; name: string | null; email: string }[]) {
    const pending = await pendingPayoutDetails(u.id);
    if (pending.length === 0) continue;
    out.push({
      userId: u.id,
      name: u.name,
      email: u.email,
      accounts: pending.map((p) => ({ processor: p.processor, label: p.label, exists: p.exists, missing: p.missing, projects: p.projects })),
    });
  }
  return out.sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
}
