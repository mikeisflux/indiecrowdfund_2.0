import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { loadPrintingComicsConfig } from "@/lib/printingcomics/config";
import { pcFetch, PrintingComicsApiError } from "@/lib/printingcomics/client";

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
        proofStatus?: string;
        latestProof?: { status?: string; fileUrl?: string; reviewUrl?: string; version?: number };
      };

      // Best-effort: keep our local row in sync with the on-demand pull.
      const latest = data?.latestProof;
      await db.projectPrintOrder
        .update({
          where: { id: printOrder.id },
          data: {
            proofStatus: data?.proofStatus ?? latest?.status ?? undefined,
            proofUrl: latest?.fileUrl ?? undefined,
            proofReviewUrl: latest?.reviewUrl ?? undefined,
            proofVersion: latest?.version ?? undefined,
            proofUpdatedAt: new Date(),
          },
        })
        .catch(() => {});

      return NextResponse.json(data);
    } catch (err) {
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
