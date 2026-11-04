import { z } from "zod";
import { db } from "@/lib/db";
import { ToolError } from "./registry";

/** Shared argument pieces and lookups used by several tools. */

export const Limit = (def: number, max: number) =>
  z.number().int().min(1).max(max).default(def).describe(`Max rows to return (1-${max}, default ${def}).`);

export const Offset = z.number().int().min(0).default(0).describe("Rows to skip, for paging.");

export const DateRange = {
  from: z.string().optional().describe("Start of the window, ISO 8601 date or datetime. Defaults to 30 days ago."),
  to: z.string().optional().describe("End of the window, ISO 8601. Defaults to now."),
};

export function parseRange(args: { from?: string; to?: string }, defaultDays = 30): { from: Date; to: Date } {
  const to = args.to ? new Date(args.to) : new Date();
  const from = args.from ? new Date(args.from) : new Date(to.getTime() - defaultDays * 86_400_000);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new ToolError("from/to must be ISO 8601 dates.", "invalid_arguments");
  }
  if (from > to) throw new ToolError("from must be before to.", "invalid_arguments");
  return { from, to };
}

export const money = (v: unknown): number => Math.round(Number(v ?? 0) * 100) / 100;

export const PROJECT_REF = z
  .string()
  .min(1)
  .describe("Project slug (as in the campaign URL) or project id.");

export async function findProject(ref: string) {
  const project = await db.project.findFirst({
    where: { deletedAt: null, OR: [{ slug: ref }, { id: ref }] },
    select: {
      id: true,
      slug: true,
      title: true,
      subtitle: true,
      status: true,
      category: true,
      subcategory: true,
      campaignType: true,
      paymentProcessor: true,
      goalAmount: true,
      currentAmount: true,
      backerCount: true,
      followerCount: true,
      launchDate: true,
      endDate: true,
      createdAt: true,
      updatedAt: true,
      preOrdersEnabled: true,
      isStaffPick: true,
      creator: { select: { id: true, name: true, email: true, vanityUrl: true } },
    },
  });
  if (!project) throw new ToolError(`No project matches "${ref}".`, "not_found", 404);
  return project;
}

export async function findUserByEmail(email: string) {
  const user = await db.user.findFirst({
    where: { email: { equals: email.trim(), mode: "insensitive" } },
    select: { id: true, email: true, name: true, role: true, createdAt: true, deletedAt: true, emailUnsubscribedAt: true, vanityUrl: true },
  });
  if (!user) throw new ToolError(`No account with email "${email}".`, "not_found", 404);
  return user;
}

export function projectUrl(p: { slug: string; creator?: { vanityUrl: string | null } | null }): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://indiecrowdfund.com";
  return p.creator?.vanityUrl ? `${base}/projects/${p.creator.vanityUrl}/${p.slug}` : `${base}/projects/${p.slug}`;
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : v instanceof Date ? v.toISOString() : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}
