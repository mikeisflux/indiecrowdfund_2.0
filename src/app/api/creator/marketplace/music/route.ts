import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const musicLogger = logger.child({ module: "creator-marketplace-music" });
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/creator/marketplace/music
 *
 * Create a music release (single, EP, or album) with tracks
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      releaseType = "single",
      title,
      artistName,
      description,
      genre,
      coverImageUrl,
      tracks = [],
      price,
      currency = "USD",
      paymentProcessor = "PAYPAL",
      isNsfw = false,
      tags = [],
      submitForReview = false,
    } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    if (!tracks.length) {
      return NextResponse.json({ error: "At least one track is required" }, { status: 400 });
    }
    if (!price || price <= 0) {
      return NextResponse.json({ error: "Valid download price is required" }, { status: 400 });
    }

    // Generate slug
    const baseSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const timestamp = Date.now().toString(36);
    const slug = `${baseSlug}-${timestamp}`;

    // Get company profile
    const company = await prisma.companyProfile.findFirst({
      where: { userId: session.user.id, isActive: true },
      select: { id: true },
    });

    // Guard against double-click: if we already created an identical
    // music release (same creator + title + track count) in the last
    // 60 seconds, return the existing album/tracks instead of creating
    // a duplicate. Otherwise a creator double-clicking "Release" would
    // get two copies on every music release.
    const firstTrackAudio = tracks[0]?.audioFileUrl;
    const recentDuplicate = firstTrackAudio ? await prisma.marketplaceBook.findFirst({
      where: {
        creatorId: session.user.id,
        mediaCategory: "music",
        title: (tracks.length === 1 ? title.trim() : tracks[0]?.title?.trim()) || undefined,
        audioFileUrl: firstTrackAudio,
        createdAt: { gt: new Date(Date.now() - 60_000) },
      },
      select: { id: true, albumId: true },
    }) : null;
    if (recentDuplicate) {
      return NextResponse.json({
        success: true,
        albumId: recentDuplicate.albumId,
        trackCount: tracks.length,
        duplicate: true,
      });
    }

    // Create album if multi-track
    let albumId: string | null = null;
    if (tracks.length > 1 || releaseType !== "single") {
      const albumSlug = `${baseSlug}-album-${timestamp}`;
      const album = await prisma.marketplaceAlbum.create({
        data: {
          creatorId: session.user.id,
          title: title.trim(),
          slug: albumSlug,
          description: description?.trim() || null,
          coverImageUrl: coverImageUrl || null,
          category: genre || null,
          tags,
          albumType: releaseType,
          totalTracks: tracks.length,
          totalDuration: tracks.reduce(
            (sum: number, t: { audioDuration?: number | null }) => sum + (t.audioDuration || 0),
            0
          ),
          companyId: company?.id || null,
        },
      });
      albumId = album.id;
    }

    // Create each track as a MarketplaceBook with mediaCategory = "music"
    const createdTracks = [];
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      const trackSlug = tracks.length === 1
        ? slug
        : `${baseSlug}-${(track.title || `track-${i + 1}`)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")}-${timestamp}`;

      const item = await prisma.marketplaceBook.create({
        data: {
          creatorId: session.user.id,
          companyId: company?.id || null,
          title: (tracks.length === 1 ? title.trim() : track.title?.trim()) || `Track ${i + 1}`,
          slug: trackSlug,
          description: description?.trim() || "",
          mediaCategory: "music",
          category: genre || null,
          price,
          currency,
          paymentProcessor: isNsfw ? "DIVINITYCOIN" : paymentProcessor,
          coverImageUrl: coverImageUrl || null,
          hasAdultContent: isNsfw,
          promoContentSfw: !isNsfw,
          tags,
          // Audio fields
          audioFileUrl: track.audioFileUrl,
          audioFileName: track.audioFileName || null,
          audioFileSize: track.audioFileSize ? parseInt(String(track.audioFileSize)) : null,
          audioDuration: track.audioDuration ? parseInt(String(track.audioDuration)) : null,
          // Album association
          albumId,
          trackNumber: i + 1,
          // Status
          status: submitForReview ? "PENDING_REVIEW" : "DRAFT",
          submittedAt: submitForReview ? new Date() : null,
        },
      });
      createdTracks.push(item);
    }

    // Auto-promote user to CREATOR if needed
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });
    if (user?.role === "BACKER") {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { role: "CREATOR" },
      });
    }

    musicLogger.info(
      { userId: session.user.id, albumId, trackCount: createdTracks.length },
      "Music release created"
    );

    return NextResponse.json({
      success: true,
      albumId,
      tracks: createdTracks.map((t) => ({ id: t.id, title: t.title, slug: t.slug })),
    });
  } catch (error) {
    musicLogger.error({ err: String(error) }, "Error creating music release");
    return NextResponse.json(
      { error: "Failed to create music release" },
      { status: 500 }
    );
  }
}
