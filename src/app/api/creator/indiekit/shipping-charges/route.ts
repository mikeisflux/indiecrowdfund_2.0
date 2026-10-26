import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { formatError } from "@/lib/errors";
import { listShippingChargeBackers, setShippingCharge } from "@/lib/indiekit/shipping-charges";
import { sendBalanceRequest } from "@/lib/indiekit/balance-request";

const log = logger.child({ module: "creator-indiekit-shipping-charges" });

export const dynamic = "force-dynamic";

async function projectAccess(userId: string, projectId: string) {
  return db.project.findFirst({
    where: {
      id: projectId,
      deletedAt: null,
      OR: [{ creatorId: userId }, { collaborators: { some: { userId, status: "ACCEPTED" } } }],
    },
    select: { id: true, title: true },
  });
}

// GET ?projectId=…  → every paid order with what it contains, where it
// ships, and where its shipping charge stands.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const projectId = req.nextUrl.searchParams.get("projectId") || "";
  if (!projectId) return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  const project = await projectAccess(session.user.id, projectId);
  if (!project) return NextResponse.json({ error: "Project not found or no access" }, { status: 404 });

  try {
    const backers = await listShippingChargeBackers(projectId);
    const physical = backers.filter((b) => b.physical);
    const summary = {
      orders: backers.length,
      physical: physical.length,
      digitalOnly: backers.length - physical.length,
      noAddress: physical.filter((b) => !b.address).length,
      set: physical.filter((b) => b.state === "set").length,
      sent: physical.filter((b) => b.state === "sent").length,
      paid: physical.filter((b) => b.state === "paid").length,
      none: physical.filter((b) => b.state === "none").length,
      owed: Math.round(physical.filter((b) => b.state === "set" || b.state === "sent").reduce((s, b) => s + b.balanceDue, 0) * 100) / 100,
      collected: Math.round(physical.filter((b) => b.state === "paid").reduce((s, b) => s + (b.shippingCharge?.amount ?? 0), 0) * 100) / 100,
    };
    return NextResponse.json({ project: project.title, backers, summary });
  } catch (error) {
    log.error({ err: formatError(error), projectId }, "shipping-charges GET failed");
    return NextResponse.json({ error: "Failed to load orders" }, { status: 500 });
  }
}

const setSchema = z.object({
  action: z.literal("set"),
  projectId: z.string().min(1),
  pledgeId: z.string().min(1),
  amount: z.number().min(0).max(100000),
  note: z.string().max(120).optional().nullable(),
  send: z.boolean().optional(),
});
const sendSchema = z.object({
  action: z.literal("send"),
  projectId: z.string().min(1),
  pledgeId: z.string().min(1),
});
const sendAllSchema = z.object({
  action: z.literal("send_all"),
  projectId: z.string().min(1),
  /** "unsent": orders with a charge set but never emailed. "unpaid": also re-email anyone sent more than olderThanHours ago who hasn't paid. */
  scope: z.enum(["unsent", "unpaid"]).default("unsent"),
  olderThanHours: z.number().min(1).max(24 * 90).default(72),
});
const bodySchema = z.discriminatedUnion("action", [setSchema, sendSchema, sendAllSchema]);

// POST — set a charge on one order (optionally emailing the pay link),
// email one order's pay link, or email every order that needs one.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ error: err instanceof z.ZodError ? err.issues.map((i) => i.message).join("; ") : "Invalid request" }, { status: 400 });
  }
  const project = await projectAccess(session.user.id, body.projectId);
  if (!project) return NextResponse.json({ error: "Project not found or no access" }, { status: 404 });

  try {
    if (body.action === "set") {
      const saved = await setShippingCharge({
        projectId: body.projectId,
        pledgeId: body.pledgeId,
        amount: body.amount,
        note: body.note ?? null,
        actorId: session.user.id,
      });
      if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: 400 });
      let sent: { ok: boolean; error?: string; deduplicated?: boolean } | null = null;
      if (body.send && body.amount > 0) {
        const r = await sendBalanceRequest(body.pledgeId, body.projectId, { minSecondsBetween: 0 });
        sent = r.ok ? { ok: true, deduplicated: r.deduplicated } : { ok: false, error: r.error };
      }
      const backer = sent?.ok
        ? (await listShippingChargeBackers(body.projectId)).find((b) => b.pledgeId === body.pledgeId) ?? saved.backer
        : saved.backer;
      return NextResponse.json({ success: true, backer, sent });
    }

    if (body.action === "send") {
      const r = await sendBalanceRequest(body.pledgeId, body.projectId, { minSecondsBetween: 30 });
      if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
      const backer = (await listShippingChargeBackers(body.projectId)).find((b) => b.pledgeId === body.pledgeId) ?? null;
      return NextResponse.json({ success: true, deduplicated: r.deduplicated, balanceDue: r.balanceDue, backer });
    }

    // send_all
    const backers = await listShippingChargeBackers(body.projectId);
    const cutoff = Date.now() - body.olderThanHours * 60 * 60 * 1000;
    const targets = backers.filter((b) => {
      if (!b.shippingCharge || b.balanceDue <= 0 || b.state === "paid" || !b.email) return false;
      if (b.state === "set") return true;
      if (body.scope === "unpaid" && b.state === "sent") {
        return !b.balanceSentAt || new Date(b.balanceSentAt).getTime() < cutoff;
      }
      return false;
    });
    let emailed = 0;
    const failed: { email: string; error: string }[] = [];
    for (const b of targets) {
      const r = await sendBalanceRequest(b.pledgeId, body.projectId, { minSecondsBetween: 0 });
      if (r.ok) emailed++;
      else failed.push({ email: b.email ?? b.pledgeId, error: r.error });
      // Gentle on the mail relay.
      await new Promise((res) => setTimeout(res, 150));
    }
    log.info({ projectId: body.projectId, scope: body.scope, targets: targets.length, emailed, failed: failed.length, actorId: session.user.id }, "Shipping charge pay links sent");
    return NextResponse.json({ success: true, targeted: targets.length, emailed, failed });
  } catch (error) {
    log.error({ err: formatError(error), action: body.action }, "shipping-charges POST failed");
    return NextResponse.json({ error: "Request failed — check server logs" }, { status: 500 });
  }
}
