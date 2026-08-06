import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getDeletionEligibility } from "@/lib/account-deletion/eligibility";
import { performAccountDeletion } from "@/lib/account-deletion/perform";

const deleteAccountLogger = logger.child({ module: "user-delete-account" });

export const dynamic = "force-dynamic";

function clientIp(req: NextRequest): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null
  );
}

// POST /api/user/delete-account
// Body: { password?: string, confirmText: "DELETE MY ACCOUNT", acknowledged: true }
//
// Two outcomes depending on whether the caller has ever run a campaign
// (see lib/account-deletion/eligibility.ts for the exact rules):
//
//   Never launched (backers, draft/prelaunch-only creators)
//     -> deleted immediately by performAccountDeletion(). Irreversible;
//        the client signs out after the response.
//
//   Has ever taken a campaign live
//     -> nothing is destroyed. An AccountDeletionRequest is filed for
//        admin review, because deletion releases the creator from their
//        fulfillment obligations to backers. If any backer is still
//        unfulfilled the request is refused outright (409) until that
//        reaches zero.
//
// Prelaunch pages never count as "launched" — they take no money and owe
// nobody anything.
//
// GET returns the caller's eligibility so the dialog can show the right
// copy before they type anything.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const eligibility = await getDeletionEligibility(session.user.id);
    const pendingRequest = await db.accountDeletionRequest.findFirst({
      where: { userId: session.user.id, status: "PENDING" },
      select: { id: true, createdAt: true },
    });

    return NextResponse.json({
      status: eligibility.status,
      everLaunched: eligibility.everLaunched,
      liveProjectCount: eligibility.liveProjectCount,
      totalUnfulfilled: eligibility.totalUnfulfilled,
      totalFulfilled: eligibility.totalFulfilled,
      blockedReason: eligibility.blockedReason,
      projects: eligibility.projects,
      pendingRequest,
    });
  } catch (err) {
    deleteAccountLogger.error(
      { err: String(err), userId: session.user.id },
      "Failed to compute deletion eligibility"
    );
    return NextResponse.json(
      { error: "Could not check your account status. Please try again." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  let body: { password?: string; confirmText?: string; acknowledged?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { password, confirmText, acknowledged } = body;

  // Typed-confirmation phrase prevents accidental clicks. The dialog
  // requires the user to type this string verbatim. Exact match — no
  // trimming or case-folding, so a stray paste can't slip through.
  if (confirmText !== "DELETE MY ACCOUNT") {
    return NextResponse.json(
      { error: 'Please type "DELETE MY ACCOUNT" to confirm.' },
      { status: 400 }
    );
  }

  // Section 4 of the Data Deletion Policy makes deletion a waiver of
  // reward entitlements, refunds, chargebacks, and claims against
  // creators. That has to be affirmatively accepted, and the acceptance
  // is logged below — a client-side checkbox alone isn't a record.
  if (acknowledged !== true) {
    return NextResponse.json(
      {
        error:
          "You must acknowledge that you forfeit all rewards and that creators are released from fulfilling them.",
      },
      { status: 400 }
    );
  }

  const user = await db.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { id: true, password: true, accountDeletedAt: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (user.accountDeletedAt) {
    return NextResponse.json(
      { error: "Account is already deleted." },
      { status: 410 }
    );
  }

  // Password verification: required if the user has one. OAuth-only
  // users (no password set) skip this since the typed confirmation
  // already gates the destructive action.
  if (user.password) {
    if (!password) {
      return NextResponse.json(
        { error: "Password required to delete account." },
        { status: 400 }
      );
    }
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return NextResponse.json(
        { error: "Password is incorrect." },
        { status: 401 }
      );
    }
  }

  // Creator gate. Anyone who has ever taken a campaign live cannot delete
  // instantly: deleting releases them from fulfillment obligations, so a
  // human confirms nothing is owed first. Still-unfulfilled backers block
  // the request entirely. See lib/account-deletion/eligibility.ts.
  const eligibility = await getDeletionEligibility(userId);

  if (eligibility.status === "BLOCKED") {
    return NextResponse.json(
      {
        error: eligibility.blockedReason,
        eligibility: {
          status: eligibility.status,
          totalUnfulfilled: eligibility.totalUnfulfilled,
          liveProjectCount: eligibility.liveProjectCount,
        },
      },
      { status: 409 }
    );
  }

  if (eligibility.status === "REQUIRES_APPROVAL") {
    // Don't destroy anything — file a request for admin review. Idempotent:
    // a second submit returns the pending request rather than stacking rows.
    const existing = await db.accountDeletionRequest.findFirst({
      where: { userId, status: "PENDING" },
      select: { id: true, createdAt: true },
    });
    if (existing) {
      return NextResponse.json({
        success: true,
        pendingApproval: true,
        requestId: existing.id,
        message:
          "Your deletion request is already awaiting admin review. We'll email you when it's been processed.",
      });
    }

    const created = await db.accountDeletionRequest.create({
      data: {
        userId,
        status: "PENDING",
        launchedProjectCount: eligibility.projects.length,
        unfulfilledCount: eligibility.totalUnfulfilled,
        fulfilledCount: eligibility.totalFulfilled,
        snapshot: eligibility.projects.map((p) => ({
          id: p.id,
          title: p.title,
          slug: p.slug,
          status: p.status,
          launchedAt: p.launchedAt?.toISOString() ?? null,
          backerCount: p.backerCount,
          fulfilledCount: p.fulfilledCount,
          unfulfilledCount: p.unfulfilledCount,
          fulfillmentPercent: p.fulfillmentPercent,
        })),
        requestIp: clientIp(req),
        requestUserAgent: req.headers.get("user-agent") || null,
      },
      select: { id: true },
    });

    deleteAccountLogger.info(
      { userId, requestId: created.id, launchedProjects: eligibility.projects.length },
      "Creator account deletion request submitted for admin review"
    );

    return NextResponse.json({
      success: true,
      pendingApproval: true,
      requestId: created.id,
      message:
        "Your deletion request has been submitted for review. Because you've run a campaign on IndieCrowdfund, an admin has to approve it. We'll email you when it's been processed.",
    });
  }

  // Backers and never-launched creators delete immediately.
  try {
    await performAccountDeletion(userId);
  } catch (err) {
    deleteAccountLogger.error(
      { err: String(err), userId },
      "Account deletion transaction failed"
    );
    return NextResponse.json(
      { error: "Account deletion failed. Please try again or contact support." },
      { status: 500 }
    );
  }

  // Durable record that the waiver was accepted, in case a deleted backer
  // later disputes a forfeited reward or files a chargeback.
  deleteAccountLogger.info(
    {
      userId,
      acknowledgedForfeiture: true,
      acknowledgedAt: new Date().toISOString(),
      ip:
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        req.headers.get("x-real-ip") ||
        null,
      userAgent: req.headers.get("user-agent") || null,
    },
    "Account deleted by user request (reward forfeiture acknowledged)"
  );

  return NextResponse.json({
    success: true,
    message:
      "Your account has been deleted. You will be signed out shortly.",
  });
}
