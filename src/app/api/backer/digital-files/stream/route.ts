import { NextRequest, NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getR2Storage } from "@/lib/r2";
import { safeFetchExternal } from "@/lib/safe-fetch";

const streamLogger = logger.child({ module: "backer-digital-files-stream" });

/**
 * GET /api/backer/digital-files/stream?fileId=xxx
 *
 * Proxies PDF content from R2 through the server to avoid CORS issues
 * when rendering thumbnails client-side.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get("fileId");

    if (!fileId) {
      return NextResponse.json({ error: "fileId is required" }, { status: 400 });
    }

    const file = await db.digitalFile.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Verify access: user must have an active pledge for this project
    // (PENDING = campaign backer, COMPLETED = charged/funded)
    const pledge = await db.pledge.findFirst({
      where: {
        userId: session.user.id,
        deletedAt: null,
        projectId: file.projectId,
        status: { in: ["PENDING", "COMPLETED"] },
      },
      include: {
        addons: { select: { addonId: true } },
      },
    });

    if (!pledge) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Check access control for the specific file
    let hasAccess = false;
    const explicitDistribution = await db.digitalDistribution.findUnique({
      where: {
        digitalFileId_pledgeId: {
          digitalFileId: file.id,
          pledgeId: pledge.id,
        },
      },
    });

    if (explicitDistribution?.distributedAt) {
      hasAccess = true;
    } else if (file.accessType === "ALL_BACKERS") {
      hasAccess = true;
    } else {
      const fileRewardIds = (file.rewardIds as string[]) || [];
      const fileAddonIds = (file.addonIds as string[]) || [];
      const pledgeAddonIds = pledge.addons.map((a: { addonId: string }) => a.addonId);

      if (fileRewardIds.length === 0 && fileAddonIds.length === 0) {
        // No reward/addon restrictions configured — only grant access if file is ALL_BACKERS
        // (ALL_BACKERS is already handled above; reaching here means accessType is SPECIFIC_REWARDS/ADDONS)
        hasAccess = false;
      } else {
        const rewardMatch = fileRewardIds.length > 0 && pledge.rewardId !== null && fileRewardIds.includes(pledge.rewardId);
        const addonMatch = fileAddonIds.length > 0 && fileAddonIds.some((id: string) => pledgeAddonIds.includes(id));
        hasAccess = rewardMatch || addonMatch;
      }
    }

    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Get file content
    let content: Buffer | null = null;

    if (file.r2StorageKey) {
      const r2 = await getR2Storage();
      if (!r2) {
        return NextResponse.json({ error: "Storage not configured" }, { status: 500 });
      }
      content = await r2.getFile(file.r2StorageKey);
    } else if (file.fileUrl) {
      // Legacy: fetch from direct URL. file.fileUrl is read from the
      // database -- on new uploads it's set to "" (see
      // api/creator/digital-files/route.ts), but rows imported from older
      // systems or seeded data may contain an arbitrary URL. A bare
      // fetch() here is an SSRF: a hostile fileUrl pointed at
      // http://169.254.169.254/ (Hetzner / AWS / GCP cloud metadata),
      // http://localhost:5432, or any internal service would be proxied
      // through our worker and the response returned to the client.
      // safeFetchExternal blocks private/loopback/link-local IPs (the
      // metadata endpoints), refuses redirects, and ends-matches the
      // hostname against known storage CDNs.
      try {
        const result = await safeFetchExternal(file.fileUrl, {
          allowHostSuffixes: [
            "r2.cloudflarestorage.com",
            "r2.dev",
            "s3.amazonaws.com",
            "amazonaws.com",
          ],
          maxBytes: 200 * 1024 * 1024, // 200 MB cap for legacy downloads
        });
        if (!result.ok) {
          return NextResponse.json({ error: "Failed to fetch file" }, { status: 502 });
        }
        content = result.bytes;
      } catch (fetchErr) {
        streamLogger.warn(
          { err: fetchErr instanceof Error ? fetchErr.message : String(fetchErr), fileId: file.id },
          "Refused to fetch legacy fileUrl (SSRF safety)"
        );
        return NextResponse.json({ error: "Failed to fetch file" }, { status: 502 });
      }
    }

    if (!content) {
      return NextResponse.json({ error: "File content unavailable" }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(content), {
      headers: {
        "Content-Type": file.mimeType || "application/pdf",
        "Content-Length": content.length.toString(),
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    streamLogger.error({ err: formatError(error) }, "PDF stream error:");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
