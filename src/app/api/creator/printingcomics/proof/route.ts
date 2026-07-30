import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { loadPrintingComicsConfig } from "@/lib/printingcomics/config";
import { pcFetch, PrintingComicsApiError, resolveFileUrl, isFileGone } from "@/lib/printingcomics/client";

const log = logger.child({ module: "printingcomics-proof" });

export const dynamic = "force-dynamic";

// GET /api/creator/printingcomics/proof?orderId=<printingComicsOrderId>
//
// On-demand fallback for the proof webhook: pulls the latest proof
// (proofStatus + latestProof.fileUrl/reviewUrl/version + version history)
// from Printing Comics' GET /orders/:id/proof, in case a proof.ready
// webhook was missed. Also syncs the freshest proof state onto our row.
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const orderId = new URL(req.url).searchParams.get("orderId");
    if (!orderId) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 });
    }

    // Ownership: the caller must own (or collaborate on) the project this
    // print order belongs to.
    const printOrder = await db.projectPrintOrder.findFirst({
      where: {
        printingComicsOrderId: orderId,
        project: {
          deletedAt: null,
          OR: [
            { creatorId: session.user.id },
            { collaborators: { some: { userId: session.user.id, status: "ACCEPTED" } } },
          ],
        },
      },
      select: { id: true },
    });
    if (!printOrder) {
      return NextResponse.json({ error: "Order not found or access denied" }, { status: 404 });
    }

    const config = await loadPrintingComicsConfig();
    if (!config) {
      return NextResponse.json(
        { error: "Printing Comics is not configured. Ask an admin to add the API key." },
        { status: 502 }
      );
    }

    try {
      const data = (await pcFetch(config, {
        method: "GET",
        path: `/orders/${encodeURIComponent(orderId)}/proof`,
      })) as {
        // Order-level status vocab: requested | awaiting_approval | approved |
        // changes_requested. This is what the UI button gates on.
        proofStatus?: string;
        // Per-proof status vocab is DIFFERENT (pending | approved |
        // changes_requested) — "pending" here, not "awaiting_approval" — so we
        // must NOT write latestProof.status into our order-level proofStatus.
        latestProof?: {
          status?: string;
          fileUrl?: string;
          reviewUrl?: string;
          version?: number;
          // Per-line-item proofs (PC 2026-07-27): which item and slot this
          // proof covers. Comics have two (cover + interior), prints one.
          orderItemId?: string;
          itemName?: string;
          kind?: string;
          token?: string;
        };
        // Every proof version on the order, newest first, one per item/slot.
        // Each carries its own token — the creator approves each slot
        // separately, and order-level proofStatus only reads "approved" once
        // every required slot is.
        proofs?: Array<{
          orderItemId?: string | null;
          itemName?: string | null;
          kind?: string | null;
          status?: string;
          version?: number;
          fileUrl?: string;
          reviewUrl?: string | null;
          token?: string;
          approvedName?: string | null;
          decidedAt?: string | null;
          decisionNote?: string | null;
          createdAt?: string;
        }>;
      };

      // Best-effort: keep our local row in sync with the on-demand pull.
      // Take proofStatus ONLY from the order-level field (never fall back to
      // latestProof.status, whose "pending" would never match the button's
      // awaiting_approval check).
      const latest = data?.latestProof;
      await db.projectPrintOrder
        .update({
          where: { id: printOrder.id },
          data: {
            proofStatus: data?.proofStatus ?? undefined,
            // Origin-relative file/review URLs must be prefixed with PC's
            // origin or they resolve against indiecrowdfund.com and 404.
            proofUrl: resolveFileUrl(config, latest?.fileUrl),
            proofReviewUrl: resolveFileUrl(config, latest?.reviewUrl),
            proofVersion: latest?.version ?? undefined,
            proofUpdatedAt: new Date(),
          },
        })
        .catch(() => {});

      // Surface every proof so the UI can show cover + interior separately;
      // `proofs` is absent on pre-7/27 responses, where latestProof is the
      // only one.
      return NextResponse.json({
        ...data,
        proofs:
          data?.proofs?.map((p) => ({
            ...p,
            fileUrl: resolveFileUrl(config, p.fileUrl),
            reviewUrl: resolveFileUrl(config, p.reviewUrl),
          })) ?? undefined,
      });
    } catch (err) {
      if (isFileGone(err)) {
        // Artwork and proofs are purged once an order ships. Retrying can't
        // help — the creator has to re-upload.
        return NextResponse.json(
          {
            error:
              "This proof file is no longer available — Printing Comics removes artwork and proofs once an order ships. Re-upload the file to generate a new proof.",
            gone: true,
          },
          { status: 410 }
        );
      }
      if (err instanceof PrintingComicsApiError) {
        return NextResponse.json({ error: err.bodyText }, { status: err.status });
      }
      throw err;
    }
  } catch (error) {
    log.error({ err: String(error) }, "proof proxy failed");
    return NextResponse.json({ error: "Failed to load proof" }, { status: 500 });
  }
}
