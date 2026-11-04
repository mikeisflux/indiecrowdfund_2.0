import { createHash, randomInt } from "crypto";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { sendEmail } from "@/lib/email";

const log = logger.child({ module: "support-verification" });

/**
 * Email-code identity check for the support chat.
 *
 * The bot can look up a backer's orders and email history, and that is
 * personal data. A logged-in session is not proof enough that the person at
 * the keyboard owns the account (shared computers, a session left open), and
 * a visitor who simply TYPES an email must not get that address's history.
 * So: before any personal lookup or order escalation the bot requests a
 * code, we email it to the ADDRESS ON THE ACCOUNT (never to an address the
 * visitor chose), and the server verifies the code. The model only ever sees
 * "sent" / "verified" / "wrong code"; it never sees the code.
 *
 * Limits: code valid 10 minutes, 5 attempts per code, 3 codes per address
 * per hour, verification good for 30 minutes per chat.
 */

const CODE_TTL_MS = 10 * 60_000;
const VERIFIED_TTL_MS = 30 * 60_000;
const MAX_ATTEMPTS = 5;
const MAX_CODES_PER_HOUR = 3;

function hashCode(code: string, chatToken: string): string {
  return createHash("sha256").update(`${code}:${chatToken}`).digest("hex");
}

export interface VerifiedIdentity {
  email: string;
  userId: string | null;
  name: string | null;
  verifiedAt: Date;
}

/** The identity this chat has proven, if any (within the 30-minute window). */
export async function getVerifiedIdentity(chatToken: string | undefined): Promise<VerifiedIdentity | null> {
  if (!chatToken) return null;
  const row = await db.supportVerification.findFirst({
    where: { chatToken, verifiedAt: { gte: new Date(Date.now() - VERIFIED_TTL_MS) } },
    orderBy: { verifiedAt: "desc" },
    select: { email: true, userId: true, verifiedAt: true },
  });
  if (!row?.verifiedAt) return null;
  const user = row.userId
    ? await db.user.findFirst({ where: { id: row.userId, deletedAt: null }, select: { name: true } })
    : null;
  return { email: row.email, userId: row.userId, name: user?.name ?? null, verifiedAt: row.verifiedAt };
}

export type IssueResult =
  | { ok: true; sentTo: string; masked: string }
  | { ok: false; reason: "rate_limited" | "no_account" | "send_failed" | "invalid_email" };

/**
 * Email a code. `email` is the address the VISITOR gave (only used when no
 * session); `sessionEmail` is the logged-in account's. Either way the code
 * goes to the address on file for an existing account. When the address has
 * no account we say so to the caller but the bot must word it neutrally.
 */
export async function issueVerificationCode(args: { chatToken: string; email?: string; sessionEmail?: string | null; ip?: string | null }): Promise<IssueResult> {
  const candidate = (args.sessionEmail || args.email || "").trim().toLowerCase();
  if (!candidate || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(candidate)) return { ok: false, reason: "invalid_email" };

  const user = await db.user.findFirst({ where: { email: { equals: candidate, mode: "insensitive" }, deletedAt: null }, select: { id: true, email: true, name: true } });
  if (!user) return { ok: false, reason: "no_account" };

  const recent = await db.supportVerification.count({ where: { email: user.email.toLowerCase(), createdAt: { gte: new Date(Date.now() - 3_600_000) } } });
  if (recent >= MAX_CODES_PER_HOUR) return { ok: false, reason: "rate_limited" };

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.supportVerification.create({
    data: { chatToken: args.chatToken, email: user.email.toLowerCase(), userId: user.id, codeHash: hashCode(code, args.chatToken), expiresAt: new Date(Date.now() + CODE_TTL_MS), ip: args.ip ?? null },
  });

  const html = `
    <!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#333;max-width:560px;margin:0 auto;padding:24px;">
      <h2 style="color:#16a34a;margin:0 0 12px;">Your ICF Support verification code</h2>
      <p>Someone in the support chat on IndieCrowdfund asked to see the orders on this account. Enter this code in the chat to confirm it's you:</p>
      <p style="font-size:32px;letter-spacing:8px;font-weight:700;margin:16px 0;">${code}</p>
      <p style="color:#6b7280;font-size:14px;">The code expires in 10 minutes. If you didn't ask for it, ignore this email; nothing is shared without the code.</p>
    </body></html>`;
  const result = await sendEmail({ to: user.email, subject: `${code} is your ICF Support code`, html, skipUnsubscribeCheck: true });
  if (!result.success) {
    log.error({ err: result.error, userId: user.id }, "verification code email failed");
    return { ok: false, reason: "send_failed" };
  }
  log.info({ userId: user.id, chatToken: args.chatToken.slice(0, 8) }, "support verification code sent");
  const [local, domain] = user.email.split("@");
  const masked = `${local.slice(0, 2)}${"*".repeat(Math.max(1, local.length - 2))}@${domain}`;
  return { ok: true, sentTo: user.email, masked };
}

export type VerifyResult = { ok: true; identity: VerifiedIdentity } | { ok: false; reason: "no_code" | "expired" | "wrong" | "too_many_attempts" };

export async function verifyCode(args: { chatToken: string; code: string }): Promise<VerifyResult> {
  const code = args.code.replace(/\D/g, "");
  const row = await db.supportVerification.findFirst({
    where: { chatToken: args.chatToken, verifiedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return { ok: false, reason: "no_code" };
  if (row.expiresAt.getTime() < Date.now()) return { ok: false, reason: "expired" };
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, reason: "too_many_attempts" };
  if (code.length !== 6 || hashCode(code, args.chatToken) !== row.codeHash) {
    await db.supportVerification.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
    return { ok: false, reason: row.attempts + 1 >= MAX_ATTEMPTS ? "too_many_attempts" : "wrong" };
  }
  const verifiedAt = new Date();
  await db.supportVerification.update({ where: { id: row.id }, data: { verifiedAt } });
  const user = row.userId ? await db.user.findFirst({ where: { id: row.userId }, select: { name: true } }) : null;
  log.info({ userId: row.userId, chatToken: args.chatToken.slice(0, 8) }, "support chat verified");
  return { ok: true, identity: { email: row.email, userId: row.userId, name: user?.name ?? null, verifiedAt } };
}
