import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const adminMarketplacePdfManagementLogger = logger.child({ module: "admin-marketplace-pdf-management" });
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";
import { getR2Storage } from "@/lib/r2";
// In Prisma 7 the old `@prisma/client/runtime/library` export path is
// gone; `Decimal` now lives on the `Prisma` namespace of the generated
// client. Import it as a type-only to avoid pulling any runtime code.
import type { Prisma } from "@prisma/client";
import { formatFileSize } from "@/lib/utils";

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
  price: Prisma.Decimal;
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
    const user = await prisma.user.findFirst({
      where: { id: session.user.id, deletedAt: null },
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
        adminMarketplacePdfManagementLogger.error({ err: String(err) }, "Error checking R2 files:");
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
    adminMarketplacePdfManagementLogger.error({ err: String(error) }, "Error fetching PDF management data:");
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
 * Bulk-fix: fetch file sizes from R2 for all books missing pdfFileSize.
 * Tries multiple key variations including root-level UUID-based lookups
 * since files may be stored at root ({uuid}_{filename}) instead of
 * under marketplace/{userId}/pdfs/ prefix.
 */
export async function PATCH() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findFirst({
      where: { id: session.user.id, deletedAt: null },
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

    adminMarketplacePdfManagementLogger.info(`[PDF Fix] Starting bulk fix for ${booksToFix.length} books`);

    const r2 = await getR2Storage();
    if (!r2) {
      return NextResponse.json(
        { error: "R2 storage not configured" },
        { status: 500 }
      );
    }

    // Pre-fetch all R2 files to build a UUID lookup index
    // This handles cases where files are at the root level instead of under marketplace/ prefix
    const allR2Files = await r2.listFiles(undefined, 1000);
    const r2FilesByUuid: Record<string, { key: string; size: number }> = {};
    for (const file of allR2Files) {
      const keyParts = file.key.split("/");
      const filename = keyParts[keyParts.length - 1];
      const uuidMatch = filename.match(/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
      if (uuidMatch) {
        r2FilesByUuid[uuidMatch[1].toLowerCase()] = { key: file.key, size: file.size };
      }
    }
    adminMarketplacePdfManagementLogger.info(`[PDF Fix] Indexed ${Object.keys(r2FilesByUuid).length} R2 files by UUID from ${allR2Files.length} total files`);

    let fixed = 0;
    let failed = 0;
    const results: { id: string; title?: string; status: string; size?: number; key?: string; error?: string }[] = [];

    // Process books in parallel batches of 5
    const BATCH_SIZE = 5;
    for (let i = 0; i < booksToFix.length; i += BATCH_SIZE) {
      const batch = booksToFix.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.allSettled(
        batch.map(async (book: { id: string; title: string; pdfFileUrl: string }) => {
          // Decode URL-encoded paths (%2F → /)
          const decodedUrl = decodeURIComponent(book.pdfFileUrl || "");

          // Extract R2 key from URL
          const match = decodedUrl.match(/\/api\/r2\/serve\/(.+)$/);
          if (!match) {
            return { id: book.id, title: book.title, status: "skipped - non-R2 URL", key: book.pdfFileUrl };
          }

          const r2Key = match[1];
          adminMarketplacePdfManagementLogger.info(`[PDF Fix] Checking R2 key: "${r2Key}" for book "${book.title}" (${book.id})`);

          // Try 1: Direct decoded key
          let metadata = await r2.getFileMetadata(r2Key);
          let usedKey = r2Key;

          // Try 2: Original URL-encoded key (undecoded)
          if (!metadata) {
            const originalMatch = (book.pdfFileUrl || "").match(/\/api\/r2\/serve\/(.+)$/);
            if (originalMatch && originalMatch[1] !== r2Key) {
              adminMarketplacePdfManagementLogger.info(`[PDF Fix] Try encoded key: "${originalMatch[1]}"`);
              metadata = await r2.getFileMetadata(originalMatch[1]);
              if (metadata) usedKey = originalMatch[1];
            }
          }

          // Try 3: Just the filename part (strip marketplace/{userId}/pdfs/ prefix)
          if (!metadata) {
            const filenameOnly = r2Key.split("/").pop() || r2Key;
            if (filenameOnly !== r2Key) {
              adminMarketplacePdfManagementLogger.info(`[PDF Fix] Try filename only: "${filenameOnly}"`);
              metadata = await r2.getFileMetadata(filenameOnly);
              if (metadata) usedKey = filenameOnly;
            }
          }

          // Try 4: UUID-based lookup from pre-fetched R2 file index
          if (!metadata) {
            const uuidFromKey = r2Key.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
            if (uuidFromKey) {
              const indexedFile = r2FilesByUuid[uuidFromKey[1].toLowerCase()];
              if (indexedFile) {
                adminMarketplacePdfManagementLogger.info(`[PDF Fix] UUID match found: "${indexedFile.key}" (${formatFileSize(indexedFile.size)})`);
                // Verify with HeadObject
                metadata = await r2.getFileMetadata(indexedFile.key);
                if (metadata) usedKey = indexedFile.key;
              }
            }
          }

          if (metadata && metadata.size > 0) {
            // Update both the file size AND the URL if the key changed
            const updateData: { pdfFileSize: number; pdfFileUrl?: string } = {
              pdfFileSize: metadata.size,
            };
            if (usedKey !== r2Key) {
              updateData.pdfFileUrl = `/api/r2/serve/${usedKey}`;
              adminMarketplacePdfManagementLogger.info(`[PDF Fix] Also updating URL to: /api/r2/serve/${usedKey}`);
            }

            await prisma.marketplaceBook.update({
              where: { id: book.id },
              data: updateData,
            });
            adminMarketplacePdfManagementLogger.info(`[PDF Fix] Fixed book "${book.title}" - size: ${formatFileSize(metadata.size)}`);
            return { id: book.id, title: book.title, status: "fixed", size: metadata.size, key: usedKey };
          }

          adminMarketplacePdfManagementLogger.info(`[PDF Fix] File not found in R2 for book "${book.title}" - tried key: "${r2Key}"`);
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
          adminMarketplacePdfManagementLogger.error({ err: String(errorMsg) }, `[PDF Fix] Unexpected error in batch:`);
          results.push({ id: "unknown", status: "error", error: errorMsg });
          failed++;
        }
      }
    }

    adminMarketplacePdfManagementLogger.info(`[PDF Fix] Completed: ${fixed} fixed, ${failed} failed out of ${booksToFix.length}`);

    return NextResponse.json({
      message: `Fixed ${fixed} of ${booksToFix.length} books`,
      fixed,
      failed,
      total: booksToFix.length,
      results,
    });
  } catch (error) {
    adminMarketplacePdfManagementLogger.error({ err: String(error) }, "Error bulk-fixing PDF file sizes:");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/marketplace/pdf-management
 *
 * Diagnostic scan: List ALL files in R2 (root level + marketplace/ prefix),
 * cross-reference with database, and attempt to auto-fix mismatched URLs.
 * Also supports action: "auto-fix" to automatically match R2 files to books.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findFirst({
      where: { id: session.user.id, deletedAt: null },
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

    adminMarketplacePdfManagementLogger.info(`[PDF Scan] Starting R2 scan (action: ${action})...`);

    // List ALL files in R2 - search root level AND marketplace/ prefix
    const [rootFiles, prefixedFiles] = await Promise.all([
      r2.listFiles(undefined, 1000),
      r2.listFiles("marketplace/", 1000),
    ]);

    // Combine and deduplicate
    const allFileKeys = new Set<string>();
    const allR2Files: { key: string; size: number; lastModified?: Date }[] = [];
    for (const file of [...rootFiles, ...prefixedFiles]) {
      if (!allFileKeys.has(file.key)) {
        allFileKeys.add(file.key);
        allR2Files.push(file);
      }
    }

    // Filter to only PDF files (by extension or size > 100KB)
    const pdfFiles = allR2Files.filter(
      (f) => f.key.toLowerCase().endsWith(".pdf") || f.size > 100000
    );

    adminMarketplacePdfManagementLogger.info(`[PDF Scan] Found ${allR2Files.length} total files in R2 (${rootFiles.length} root, ${prefixedFiles.length} prefixed), ${pdfFiles.length} likely PDFs`);

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

    adminMarketplacePdfManagementLogger.info(`[PDF Scan] Found ${booksWithIssues.length} books with missing file sizes`);

    // Build indexes for matching
    // Index by UUID (first segment before underscore)
    const r2FilesByUuid: Record<string, (typeof pdfFiles)[number]> = {};
    // Index by sanitized filename (after UUID prefix)
    const r2FilesByName: Record<string, (typeof pdfFiles)[number]> = {};

    for (const file of pdfFiles) {
      // Get just the filename (last segment of the key)
      const keyParts = file.key.split("/");
      const filename = keyParts[keyParts.length - 1];

      // Extract UUID prefix: {uuid}_{rest}
      const uuidMatch = filename.match(/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})_(.+)$/i);
      if (uuidMatch) {
        r2FilesByUuid[uuidMatch[1].toLowerCase()] = file;
        r2FilesByName[uuidMatch[2].toLowerCase()] = file;
      }

      // Also index by full filename
      r2FilesByName[filename.toLowerCase()] = file;
    }

    adminMarketplacePdfManagementLogger.info(`[PDF Scan] Indexed ${Object.keys(r2FilesByUuid).length} files by UUID, ${Object.keys(r2FilesByName).length} by name`);

    // Try to match each book to an R2 file
    const matches: {
      bookId: string;
      bookTitle: string;
      creatorId: string;
      currentUrl: string;
      currentKey: string | null;
      matchedKey: string | null;
      matchedSize: number | null;
      matchType: string;
    }[] = [];

    for (const book of booksWithIssues) {
      // Extract the current R2 key from the stored URL (decode %2F etc.)
      const decodedUrl = decodeURIComponent(book.pdfFileUrl || "");
      const currentKeyMatch = decodedUrl.match(/\/api\/r2\/serve\/(.+)$/);
      const currentKey = currentKeyMatch ? currentKeyMatch[1] : null;

      let matchedFile: (typeof pdfFiles)[number] | null = null;
      let matchType = "none";

      // Strategy 1: Direct key match against all R2 files
      if (currentKey) {
        const directMatch = pdfFiles.find((f) => f.key === currentKey);
        if (directMatch) {
          matchedFile = directMatch;
          matchType = "direct-key";
        }
      }

      // Strategy 2: Extract UUID from the URL and match to root-level files
      if (!matchedFile && currentKey) {
        // Extract UUID from key like marketplace/{userId}/pdfs/{uuid}_{filename}
        // or just {uuid}_{filename}
        const uuidFromUrl = currentKey.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
        if (uuidFromUrl) {
          const match = r2FilesByUuid[uuidFromUrl[1].toLowerCase()];
          if (match) {
            matchedFile = match;
            matchType = "uuid-match";
          }
        }
      }

      // Strategy 3: Match by pdfFileName from database
      if (!matchedFile && book.pdfFileName) {
        const sanitizedName = book.pdfFileName
          .replace(/[^a-zA-Z0-9.-]/g, "_")
          .substring(0, 50)
          .toLowerCase();

        // Try exact name match
        const nameMatch = r2FilesByName[sanitizedName];
        if (nameMatch) {
          matchedFile = nameMatch;
          matchType = "filename-exact";
        }

        // Try partial match against all files
        if (!matchedFile) {
          for (const file of pdfFiles) {
            if (file.key.toLowerCase().includes(sanitizedName)) {
              matchedFile = file;
              matchType = "filename-partial";
              break;
            }
          }
        }
      }

      // Strategy 4: Match by book title/slug similarity
      if (!matchedFile) {
        const slugLower = book.slug.toLowerCase().replace(/-/g, "_");
        const titleWords = book.title.toLowerCase().replace(/[^a-z0-9]+/g, "_");

        for (const file of pdfFiles) {
          const keyLower = file.key.toLowerCase();
          if (keyLower.includes(slugLower) || keyLower.includes(titleWords)) {
            matchedFile = file;
            matchType = "slug-match";
            break;
          }
        }
      }

      const logPrefix = matchedFile ? "MATCHED" : "NO MATCH";
      adminMarketplacePdfManagementLogger.info(`[PDF Scan] ${logPrefix}: "${book.title}" | currentKey: ${currentKey} | matchedKey: ${matchedFile?.key || "none"} (${matchType})`);

      matches.push({
        bookId: book.id,
        bookTitle: book.title,
        creatorId: book.creatorId,
        currentUrl: book.pdfFileUrl || "",
        currentKey,
        matchedKey: matchedFile ? matchedFile.key : null,
        matchedSize: matchedFile ? matchedFile.size : null,
        matchType,
      });
    }

    const matchedCount = matches.filter((m) => m.matchedKey).length;
    const unmatchedCount = matches.filter((m) => !m.matchedKey).length;

    adminMarketplacePdfManagementLogger.info(`[PDF Scan] Matched ${matchedCount} books, ${unmatchedCount} unmatched`);

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

          adminMarketplacePdfManagementLogger.info(`[PDF Scan] Auto-fixing book "${match.bookTitle}" - URL: ${newUrl}, Size: ${formatFileSize(match.matchedSize)}`);

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
      adminMarketplacePdfManagementLogger.info(`[PDF Scan] Auto-fixed ${fixedCount} books`);
    }

    return NextResponse.json({
      action,
      r2FileCount: allR2Files.length,
      r2RootFiles: rootFiles.length,
      r2PrefixedFiles: prefixedFiles.length,
      r2PdfFiles: pdfFiles.length,
      booksWithIssues: booksWithIssues.length,
      matched: matchedCount,
      unmatched: unmatchedCount,
      fixed: action === "auto-fix" ? fixedCount : undefined,
      matches,
      r2Files: pdfFiles.map((f) => ({
        key: f.key,
        size: f.size,
        sizeFormatted: formatFileSize(f.size),
        lastModified: f.lastModified?.toISOString(),
      })),
    });
  } catch (error) {
    adminMarketplacePdfManagementLogger.error({ err: String(error) }, "Error scanning R2 files:");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

