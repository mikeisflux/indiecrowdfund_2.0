import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";
import { getR2Storage } from "@/lib/r2";
import { Decimal } from "@prisma/client/runtime/library";

export const dynamic = "force-dynamic";

// Type for book returned from the Prisma query
interface PdfBookRecord {
  id: string;
  title: string;
  slug: string;
  status: string;
  pdfFileUrl: string | null;
  pdfFileName: string | null;
  pdfFileSize: number | null;
  pdfCoverImageUrl: string | null;
  pdfTotalPages: number | null;
  coverImageUrl: string | null;
  price: Decimal;
  purchaseCount: number;
  createdAt: Date;
  publishedAt: Date | null;
  creator: {
    id: string;
    name: string | null;
    email: string;
  };
  _count: {
    purchases: number;
  };
}

/**
 * GET /api/admin/marketplace/pdf-management
 *
 * Get all marketplace books with their PDF status for admin diagnostics
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (user?.role !== "SUPER_ADMIN" && user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter"); // all, missing-pdf, has-pdf
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      deletedAt: null,
    };

    if (filter === "missing-pdf") {
      // pdfFileUrl is a required String, so check for empty string, not null
      where.OR = [
        { pdfFileUrl: "" },
        { pdfFileSize: null },
        { pdfFileSize: 0 },
      ];
    } else if (filter === "has-pdf") {
      // pdfFileUrl is required, so just check it's not empty
      where.NOT = { pdfFileUrl: "" };
    }

    if (search) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { id: { contains: search } },
          ],
        },
      ];
    }

    // Get total count
    const total = await prisma.marketplaceBook.count({ where });

    // Get books with PDF info
    const books = await prisma.marketplaceBook.findMany({
      where,
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        pdfFileUrl: true,
        pdfFileName: true,
        pdfFileSize: true,
        pdfCoverImageUrl: true,
        pdfTotalPages: true,
        coverImageUrl: true,
        price: true,
        purchaseCount: true,
        createdAt: true,
        publishedAt: true,
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            purchases: {
              where: { status: "COMPLETED" },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Check R2 file existence for books with PDF URLs (optional, can be slow)
    const checkR2 = searchParams.get("checkR2") === "true";
    let r2Status: Record<string, boolean | null> = {};

    if (checkR2) {
      try {
        const r2 = await getR2Storage();
        if (r2) {
          const checks = await Promise.all(
            (books as PdfBookRecord[])
              .filter((b: PdfBookRecord) => b.pdfFileUrl)
              .map(async (book: PdfBookRecord) => {
                // Decode URL-encoded paths (some books have %2F instead of /)
                const decodedUrl = decodeURIComponent(book.pdfFileUrl || "");
                const match = decodedUrl.match(/\/api\/r2\/serve\/(.+)$/);
                if (match) {
                  let exists = await r2.fileExists(match[1]);
                  // Fallback: try original encoded path
                  if (!exists) {
                    const originalMatch = (book.pdfFileUrl || "").match(/\/api\/r2\/serve\/(.+)$/);
                    if (originalMatch && originalMatch[1] !== match[1]) {
                      exists = await r2.fileExists(originalMatch[1]);
                    }
                  }
                  return { id: book.id, exists };
                }
                return { id: book.id, exists: null }; // Non-R2 URL
              })
          );
          r2Status = Object.fromEntries(checks.map((c) => [c.id, c.exists]));
        }
      } catch (err) {
        console.error("Error checking R2 files:", err);
      }
    }

    // Transform for response
    const transformedBooks = (books as PdfBookRecord[]).map((book: PdfBookRecord) => ({
      id: book.id,
      title: book.title,
      slug: book.slug,
      status: book.status,
      pdf: {
        url: book.pdfFileUrl,
        fileName: book.pdfFileName,
        fileSize: book.pdfFileSize,
        fileSizeFormatted: book.pdfFileSize
          ? formatFileSize(book.pdfFileSize)
          : null,
        coverUrl: book.pdfCoverImageUrl,
        totalPages: book.pdfTotalPages,
        hasUrl: !!book.pdfFileUrl,
        hasSize: !!book.pdfFileSize && book.pdfFileSize > 0,
        r2Exists: checkR2 ? r2Status[book.id] : undefined,
      },
      coverImageUrl: book.coverImageUrl,
      price: Number(book.price),
      purchaseCount: book._count.purchases,
      createdAt: book.createdAt.toISOString(),
      publishedAt: book.publishedAt?.toISOString() || null,
      creator: {
        id: book.creator.id,
        name: book.creator.name,
        email: book.creator.email,
      },
      issues: detectIssues(book),
    }));

    // Get summary stats
    // Note: pdfFileUrl is a required String field, so we check for empty string, not null
    const stats = {
      total,
      withPdf: await prisma.marketplaceBook.count({
        where: {
          deletedAt: null,
          NOT: { pdfFileUrl: "" },
        },
      }),
      missingPdf: await prisma.marketplaceBook.count({
        where: {
          deletedAt: null,
          pdfFileUrl: "",
        },
      }),
      missingSize: await prisma.marketplaceBook.count({
        where: {
          deletedAt: null,
          NOT: { pdfFileUrl: "" },
          OR: [{ pdfFileSize: null }, { pdfFileSize: 0 }],
        },
      }),
      liveWithIssues: await prisma.marketplaceBook.count({
        where: {
          deletedAt: null,
          status: "LIVE",
          OR: [
            { pdfFileUrl: "" },
            { pdfFileSize: null },
            { pdfFileSize: 0 },
          ],
        },
      }),
    };

    return NextResponse.json({
      books: transformedBooks,
      stats,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching PDF management data:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Detect issues with a book's PDF configuration
 */
function detectIssues(book: {
  status: string;
  pdfFileUrl: string | null;
  pdfFileSize: number | null;
  pdfFileName: string | null;
}): string[] {
  const issues: string[] = [];

  if (!book.pdfFileUrl) {
    issues.push("Missing PDF URL");
  }

  if (!book.pdfFileSize || book.pdfFileSize === 0) {
    issues.push("Missing file size");
  }

  if (!book.pdfFileName) {
    issues.push("Missing file name");
  }

  if (book.status === "LIVE" && !book.pdfFileUrl) {
    issues.push("LIVE book without PDF!");
  }

  return issues;
}

/**
 * PATCH /api/admin/marketplace/pdf-management
 *
 * Bulk-fix: fetch file sizes from R2 for all books missing pdfFileSize
 * Processes books in parallel batches with timeout protection
 */
export async function PATCH() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (user?.role !== "SUPER_ADMIN" && user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Find all books with a PDF URL but missing file size
    const booksToFix = await prisma.marketplaceBook.findMany({
      where: {
        deletedAt: null,
        NOT: { pdfFileUrl: "" },
        OR: [{ pdfFileSize: null }, { pdfFileSize: 0 }],
      },
      select: {
        id: true,
        title: true,
        pdfFileUrl: true,
      },
    });

    if (booksToFix.length === 0) {
      return NextResponse.json({
        message: "No books need fixing",
        fixed: 0,
        failed: 0,
      });
    }

    console.log(`[PDF Fix] Starting bulk fix for ${booksToFix.length} books`);

    const r2 = await getR2Storage();
    if (!r2) {
      return NextResponse.json(
        { error: "R2 storage not configured" },
        { status: 500 }
      );
    }

    let fixed = 0;
    let failed = 0;
    const results: { id: string; title?: string; status: string; size?: number; key?: string; error?: string }[] = [];

    // Process books in parallel batches of 5 to avoid overwhelming R2
    const BATCH_SIZE = 5;
    for (let i = 0; i < booksToFix.length; i += BATCH_SIZE) {
      const batch = booksToFix.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.allSettled(
        batch.map(async (book: { id: string; title: string; pdfFileUrl: string }) => {
          // Decode URL-encoded paths (some books have %2F instead of /)
          const decodedUrl = decodeURIComponent(book.pdfFileUrl || "");

          // Extract R2 key from URL
          const match = decodedUrl.match(/\/api\/r2\/serve\/(.+)$/);
          if (!match) {
            return { id: book.id, title: book.title, status: "skipped - non-R2 URL", key: book.pdfFileUrl };
          }

          const r2Key = match[1];
          console.log(`[PDF Fix] Checking R2 key: ${r2Key} for book "${book.title}" (${book.id})`);

          let metadata = await r2.getFileMetadata(r2Key);

          // If not found with decoded path, try the original URL-encoded path
          if (!metadata) {
            const originalMatch = (book.pdfFileUrl || "").match(/\/api\/r2\/serve\/(.+)$/);
            if (originalMatch && originalMatch[1] !== r2Key) {
              console.log(`[PDF Fix] Retrying with encoded key: ${originalMatch[1]}`);
              metadata = await r2.getFileMetadata(originalMatch[1]);
            }
          }

          // Fallback: try checking if the file exists with a slightly different path
          if (!metadata) {
            // Try without leading slash
            const altKey = r2Key.startsWith("/") ? r2Key.slice(1) : r2Key;
            if (altKey !== r2Key) {
              console.log(`[PDF Fix] Retrying with alt key: ${altKey}`);
              metadata = await r2.getFileMetadata(altKey);
            }
          }

          if (metadata && metadata.size > 0) {
            await prisma.marketplaceBook.update({
              where: { id: book.id },
              data: { pdfFileSize: metadata.size },
            });
            console.log(`[PDF Fix] Fixed book "${book.title}" - size: ${formatFileSize(metadata.size)}`);
            return { id: book.id, title: book.title, status: "fixed", size: metadata.size, key: r2Key };
          }

          // Check if file exists at all (maybe empty file)
          const exists = await r2.fileExists(r2Key);
          if (exists) {
            console.log(`[PDF Fix] File exists but has 0 size for book "${book.title}" - key: ${r2Key}`);
            return { id: book.id, title: book.title, status: "failed - file exists but size is 0", key: r2Key };
          }

          console.log(`[PDF Fix] File not found in R2 for book "${book.title}" - key: ${r2Key}`);
          return { id: book.id, title: book.title, status: "failed - file not found in R2", key: r2Key };
        })
      );

      // Process batch results
      for (const result of batchResults) {
        if (result.status === "fulfilled") {
          const data = result.value;
          results.push(data);
          if (data.status === "fixed") {
            fixed++;
          } else {
            failed++;
          }
        } else {
          // Promise rejected - should be rare since we catch inside
          const errorMsg = result.reason instanceof Error ? result.reason.message : String(result.reason);
          console.error(`[PDF Fix] Unexpected error in batch:`, errorMsg);
          results.push({ id: "unknown", status: "error", error: errorMsg });
          failed++;
        }
      }
    }

    console.log(`[PDF Fix] Completed: ${fixed} fixed, ${failed} failed out of ${booksToFix.length}`);

    return NextResponse.json({
      message: `Fixed ${fixed} of ${booksToFix.length} books`,
      fixed,
      failed,
      total: booksToFix.length,
      results,
    });
  } catch (error) {
    console.error("Error bulk-fixing PDF file sizes:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/marketplace/pdf-management
 *
 * Diagnostic scan: List all files in R2 under marketplace/ prefix,
 * cross-reference with database, and attempt to auto-fix mismatched URLs.
 * Also supports action: "auto-fix" to automatically match R2 files to books.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (user?.role !== "SUPER_ADMIN" && user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const action = (body as { action?: string }).action || "scan";

    const r2 = await getR2Storage();
    if (!r2) {
      return NextResponse.json(
        { error: "R2 storage not configured" },
        { status: 500 }
      );
    }

    console.log(`[PDF Scan] Starting R2 scan (action: ${action})...`);

    // List all files in R2 under marketplace/ prefix
    const r2Files = await r2.listFiles("marketplace/", 1000);
    console.log(`[PDF Scan] Found ${r2Files.length} files in R2 under marketplace/`);

    // Get all books that have missing file sizes
    const booksWithIssues = await prisma.marketplaceBook.findMany({
      where: {
        deletedAt: null,
        NOT: { pdfFileUrl: "" },
        OR: [{ pdfFileSize: null }, { pdfFileSize: 0 }],
      },
      select: {
        id: true,
        title: true,
        slug: true,
        pdfFileUrl: true,
        pdfFileName: true,
        creatorId: true,
        creator: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    console.log(`[PDF Scan] Found ${booksWithIssues.length} books with missing file sizes`);

    // Build a map of R2 files by various lookup strategies
    const r2FilesByCreator: Record<string, typeof r2Files> = {};
    const r2FilesByName: Record<string, (typeof r2Files)[number]> = {};

    for (const file of r2Files) {
      // Parse key: marketplace/{userId}/pdfs/{fileId}_{filename}
      const keyMatch = file.key.match(/^marketplace\/([^/]+)\/pdfs\/(.+)$/);
      if (keyMatch) {
        const userId = keyMatch[1];
        const fullFilename = keyMatch[2]; // fileId_sanitizedName

        if (!r2FilesByCreator[userId]) {
          r2FilesByCreator[userId] = [];
        }
        r2FilesByCreator[userId].push(file);

        // Index by the filename part (after the UUID prefix)
        const nameMatch = fullFilename.match(/^[^_]+_(.+)$/);
        if (nameMatch) {
          r2FilesByName[nameMatch[1].toLowerCase()] = file;
        }
        // Also index by full filename
        r2FilesByName[fullFilename.toLowerCase()] = file;
      }
    }

    // Try to match each book to an R2 file
    const matches: {
      bookId: string;
      bookTitle: string;
      creatorId: string;
      currentUrl: string;
      matchedKey: string | null;
      matchedSize: number | null;
      matchType: string;
      creatorFiles: number;
    }[] = [];

    for (const book of booksWithIssues) {
      // Extract the current R2 key from the stored URL
      const decodedUrl = decodeURIComponent(book.pdfFileUrl || "");
      const currentKeyMatch = decodedUrl.match(/\/api\/r2\/serve\/(.+)$/);
      const currentKey = currentKeyMatch ? currentKeyMatch[1] : null;

      // Count how many files this creator has in R2
      const creatorFiles = r2FilesByCreator[book.creatorId] || [];

      let matchedFile: (typeof r2Files)[number] | null = null;
      let matchType = "none";

      // Strategy 1: Direct key match (already checked by PATCH, but verify)
      if (currentKey) {
        const directMatch = r2Files.find((f) => f.key === currentKey);
        if (directMatch) {
          matchedFile = directMatch;
          matchType = "direct-key";
        }
      }

      // Strategy 2: Match by creator ID - if creator has exactly 1 PDF file, it's likely the right one
      if (!matchedFile && creatorFiles.length === 1) {
        matchedFile = creatorFiles[0];
        matchType = "single-creator-file";
      }

      // Strategy 3: Match by filename
      if (!matchedFile && book.pdfFileName) {
        const sanitizedName = book.pdfFileName
          .replace(/[^a-zA-Z0-9.-]/g, "_")
          .substring(0, 50)
          .toLowerCase();

        // Check if any of the creator's files match by name
        for (const file of creatorFiles) {
          const fileNameMatch = file.key.match(/^marketplace\/[^/]+\/pdfs\/[^_]+_(.+)$/);
          if (fileNameMatch && fileNameMatch[1].toLowerCase() === sanitizedName) {
            matchedFile = file;
            matchType = "filename-match";
            break;
          }
        }

        // Also try partial match
        if (!matchedFile) {
          for (const file of creatorFiles) {
            if (file.key.toLowerCase().includes(sanitizedName)) {
              matchedFile = file;
              matchType = "partial-filename";
              break;
            }
          }
        }
      }

      // Strategy 4: Match by slug similarity
      if (!matchedFile && creatorFiles.length > 0) {
        const slugLower = book.slug.toLowerCase().replace(/-/g, "_");
        for (const file of creatorFiles) {
          if (file.key.toLowerCase().includes(slugLower)) {
            matchedFile = file;
            matchType = "slug-match";
            break;
          }
        }
      }

      matches.push({
        bookId: book.id,
        bookTitle: book.title,
        creatorId: book.creatorId,
        currentUrl: book.pdfFileUrl || "",
        matchedKey: matchedFile ? matchedFile.key : null,
        matchedSize: matchedFile ? matchedFile.size : null,
        matchType,
        creatorFiles: creatorFiles.length,
      });
    }

    const matchedCount = matches.filter((m) => m.matchedKey).length;
    const unmatchedCount = matches.filter((m) => !m.matchedKey).length;

    console.log(`[PDF Scan] Matched ${matchedCount} books, ${unmatchedCount} unmatched`);

    // If action is auto-fix, update the matched books
    let fixedCount = 0;
    if (action === "auto-fix") {
      for (const match of matches) {
        if (match.matchedKey && match.matchedSize && match.matchedSize > 0) {
          const newUrl = `/api/r2/serve/${match.matchedKey}`;
          // Extract filename from key
          const keyParts = match.matchedKey.split("/");
          const fullFilename = keyParts[keyParts.length - 1];
          const fileIdAndName = fullFilename.split("_");
          const originalName = fileIdAndName.slice(1).join("_");

          console.log(`[PDF Scan] Auto-fixing book "${match.bookTitle}" - URL: ${newUrl}, Size: ${formatFileSize(match.matchedSize)}`);

          await prisma.marketplaceBook.update({
            where: { id: match.bookId },
            data: {
              pdfFileUrl: newUrl,
              pdfFileSize: match.matchedSize,
              pdfFileName: originalName || undefined,
            },
          });
          fixedCount++;
        }
      }
      console.log(`[PDF Scan] Auto-fixed ${fixedCount} books`);
    }

    return NextResponse.json({
      action,
      r2FileCount: r2Files.length,
      booksWithIssues: booksWithIssues.length,
      matched: matchedCount,
      unmatched: unmatchedCount,
      fixed: action === "auto-fix" ? fixedCount : undefined,
      matches,
      r2Files: r2Files.map((f) => ({
        key: f.key,
        size: f.size,
        sizeFormatted: formatFileSize(f.size),
        lastModified: f.lastModified?.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Error scanning R2 files:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Format file size to human readable
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
