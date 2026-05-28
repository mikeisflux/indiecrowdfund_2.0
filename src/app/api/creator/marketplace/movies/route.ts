import { NextResponse } from "next/server";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const moviesLogger = logger.child({ module: "creator-marketplace-movies" });
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/creator/marketplace/movies
 *
 * Create a movie/film listing with video file on R2
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      title,
      description,
      genre,
      coverImageUrl,
      videoFileUrl,
      videoFileName,
      videoFileSize,
      videoDuration,
      videoResolution,
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
    if (!videoFileUrl) {
      return NextResponse.json({ error: "Video file is required" }, { status: 400 });
    }
    if (!price || price <= 0) {
      return NextResponse.json({ error: "Valid price is required" }, { status: 400 });
    }

    // Generate slug
    const baseSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const timestamp = Date.now().toString(36);
    let slug = `${baseSlug}-${timestamp}`;

    // Get company profile
    const company = await prisma.companyProfile.findFirst({
      where: { userId: session.user.id, isActive: true },
      select: { id: true },
    });

    // Guard against double-click: if we already created an identical
    // movie (same creator + title + videoFileUrl) in the last 60s,
    // return the existing row instead of creating a duplicate DRAFT
    // that the creator has to manually clean up.
    const recentDuplicate = await prisma.marketplaceBook.findFirst({
      where: {
        creatorId: session.user.id,
        mediaCategory: "movies",
        title: title.trim(),
        videoFileUrl,
        createdAt: { gt: new Date(Date.now() - 60_000) },
      },
      select: { id: true, title: true, slug: true },
    });
    if (recentDuplicate) {
      return NextResponse.json({
        success: true,
        movie: recentDuplicate,
        duplicate: true,
      });
    }

    // Create with a P2002 retry loop — two concurrent creates in the
    // same millisecond produce the same slug and P2002 on the
    // [creatorId, slug] unique constraint.
    let item;
    let attempts = 0;
    while (true) {
      try {
        item = await prisma.marketplaceBook.create({
          data: {
            creatorId: session.user.id,
            companyId: company?.id || null,
            title: title.trim(),
            slug,
            description: description?.trim() || "",
            mediaCategory: "movies",
            category: genre || null,
            price,
            currency,
            paymentProcessor: isNsfw ? "DIVINITYCOIN" : paymentProcessor,
            coverImageUrl: coverImageUrl || null,
            hasAdultContent: isNsfw,
            promoContentSfw: !isNsfw,
            tags,
            videoFileUrl,
            videoFileName: videoFileName || null,
            videoFileSize: videoFileSize ? BigInt(videoFileSize) : null,
            videoDuration: videoDuration ? parseInt(String(videoDuration)) : null,
            videoResolution: videoResolution || null,
            status: submitForReview ? "PENDING_REVIEW" : "DRAFT",
            submittedAt: submitForReview ? new Date() : null,
          },
        });
        break;
      } catch (createErr) {
        const isUniqueViolation =
          createErr &&
          typeof createErr === "object" &&
          "code" in createErr &&
          (createErr as { code?: string }).code === "P2002";
        if (!isUniqueViolation || attempts >= 5) throw createErr;
        attempts++;
        slug = `${baseSlug}-${timestamp}-${Math.random().toString(36).slice(2, 8)}`;
      }
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

    moviesLogger.info(
      { userId: session.user.id, movieId: item.id },
      "Movie listing created"
    );

    return NextResponse.json({
      success: true,
      movie: { id: item.id, title: item.title, slug: item.slug },
    });
  } catch (error) {
    moviesLogger.error({ err: formatError(error) }, "Error creating movie listing");
    return NextResponse.json(
      { error: "Failed to create movie listing" },
      { status: 500 }
    );
  }
}
