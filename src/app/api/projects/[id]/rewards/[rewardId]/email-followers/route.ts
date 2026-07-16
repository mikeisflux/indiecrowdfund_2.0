import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { formatError } from "@/lib/errors";
import { queueEmail, EMAIL_PRIORITY, getUnsubscribeUrl } from "@/lib/email";

const log = logger.child({ module: "reward-email-followers" });

export const dynamic = "force-dynamic";

// POST /api/projects/[id]/rewards/[rewardId]/email-followers
// One-click blast: email a SECRET reward's private link to the campaign's
// followers so they can view + pledge it. Creator/collaborator only.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; rewardId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id: projectId, rewardId } = await params;

    // Ownership: creator or accepted collaborator with edit permission.
    const project = await db.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: {
        title: true,
        slug: true,
        imageUrl: true,
        creatorId: true,
        creator: { select: { name: true, vanityUrl: true } },
        followers: { select: { userId: true, email: true } },
      },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    let canEdit = project.creatorId === session.user.id;
    if (!canEdit) {
      const collab = await db.projectCollaborator.findFirst({
        where: { projectId, userId: session.user.id, status: "ACCEPTED", canEditProject: true },
        select: { id: true },
      });
      canEdit = !!collab;
    }
    if (!canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // The reward must be a SECRET reward with a token.
    const reward = await db.reward.findFirst({
      where: { id: rewardId, projectId },
      select: { title: true, visibility: true, secretToken: true },
    });
    if (!reward) {
      return NextResponse.json({ error: "Reward not found" }, { status: 404 });
    }
    if (reward.visibility !== "SECRET" || !reward.secretToken) {
      return NextResponse.json(
        { error: "This reward isn't a secret reward. Make it a secret reward first." },
        { status: 400 }
      );
    }

    // Collect follower emails: registered followers (via their account) plus
    // email-only prelaunch sign-ups. Exclude the creator, dedupe.
    const emails = new Set<string>();
    type FollowerRow = { userId: string | null; email: string | null };
    const followers = project.followers as FollowerRow[];
    const followerUserIds = followers
      .filter((f) => f.userId && f.userId !== project.creatorId)
      .map((f) => f.userId as string);
    if (followerUserIds.length > 0) {
      const users = await db.user.findMany({
        where: { id: { in: followerUserIds }, deletedAt: null, emailVerified: { not: null } },
        select: { email: true },
      });
      users.forEach((u) => u.email && emails.add(u.email.toLowerCase()));
    }
    followers
      .filter((f) => !f.userId && f.email)
      .forEach((f) => f.email && emails.add(f.email.toLowerCase()));

    const recipients = Array.from(emails);
    if (recipients.length === 0) {
      return NextResponse.json({ success: true, sent: 0, message: "No followers to email yet." });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://indiecrowdfund.com";
    const projectPath = project.creator?.vanityUrl
      ? `/projects/${project.creator.vanityUrl}/${project.slug}`
      : `/projects/${project.slug}`;
    const secretUrl = `${baseUrl}${projectPath}/pledge?secret=${encodeURIComponent(reward.secretToken)}`;
    const esc = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const creatorName = project.creator?.name || "The creator";

    let sent = 0;
    for (const email of recipients) {
      try {
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#374151;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f4f4f7;"><tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
      <tr><td align="center" style="padding:26px 24px;background:linear-gradient(135deg,#10b981 0%,#059669 100%);background-color:#10b981;">
        <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;">A secret reward for you</h1>
      </td></tr>
      <tr><td style="padding:28px 24px;">
        <p style="margin:0 0 12px 0;font-size:16px;">${esc(creatorName)} unlocked a secret reward on <strong>${esc(project.title)}</strong> just for followers.</p>
        <p style="margin:0 0 20px 0;font-size:16px;color:#4b5563;">&ldquo;${esc(reward.title)}&rdquo; is only visible with the private link below.</p>
        <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:8px;background:#10b981;">
          <a href="${esc(secretUrl)}" style="display:inline-block;padding:12px 26px;color:#fff;text-decoration:none;font-weight:600;font-size:15px;border-radius:8px;">View the secret reward &rarr;</a>
        </td></tr></table>
        <p style="margin:18px 0 0 0;font-size:12px;color:#9ca3af;">Please keep this link private — it's just for followers.</p>
      </td></tr>
      <tr><td style="padding:14px 24px 28px 24px;border-top:1px solid #e5e7eb;text-align:center;">
        <p style="color:#9ca3af;font-size:12px;margin:12px 0 0 0;"><a href="${esc(getUnsubscribeUrl(email))}" style="color:#9ca3af;">Unsubscribe</a> &nbsp;|&nbsp; <a href="${baseUrl}" style="color:#9ca3af;">IndieCrowdfund</a></p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

        const result = await queueEmail({
          to: email,
          subject: `A secret reward on "${project.title}"`,
          html,
          priority: EMAIL_PRIORITY.AI_MARKETING,
        });
        if (result.success) sent++;
      } catch {
        // Skip a single bad address; keep going.
      }
    }

    log.info({ projectId, rewardId, sent, followers: recipients.length }, "secret reward emailed to followers");
    return NextResponse.json({ success: true, sent, followers: recipients.length });
  } catch (error) {
    log.error({ err: formatError(error) }, "email-followers failed");
    return NextResponse.json({ error: "Failed to email followers" }, { status: 500 });
  }
}
