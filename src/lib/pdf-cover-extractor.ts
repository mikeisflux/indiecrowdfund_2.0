/**
 * PDF Cover Extraction Utility
 *
 * Extracts the first page of a PDF and converts it to a thumbnail image.
 * Uses pdf.js for rendering and sharp for image processing.
 *
 * Note: This feature requires optional dependencies (canvas, pdfjs-dist, sharp)
 * that may not be installed. The functions will return graceful errors if missing.
 */

import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

import { logger } from "@/lib/logger";

const pdfCoverExtractorLogger = logger.child({ module: "pdf-cover-extractor" });


// R2 configuration
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "indiecrowdfund";
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

// Initialize R2 client
const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID || "",
    secretAccessKey: R2_SECRET_ACCESS_KEY || "",
  },
});

export interface CoverExtractionResult {
  success: boolean;
  coverUrl?: string;
  totalPages?: number;
  error?: string;
}

/**
 * Check if optional dependencies are available
 */
async function checkDependencies(): Promise<{ available: boolean; error?: string }> {
  try {
    // Use eval to prevent webpack from trying to bundle these optional deps
    const requireModule = eval("require");
    requireModule.resolve("canvas");
    requireModule.resolve("pdfjs-dist");
    requireModule.resolve("sharp");
    return { available: true };
  } catch {
    return {
      available: false,
      error: "PDF cover extraction requires canvas, pdfjs-dist, and sharp packages. Install them with: npm install canvas pdfjs-dist sharp"
    };
  }
}

/**
 * Extract the first page of a PDF as a cover image
 *
 * Note: This function requires the following packages to be installed:
 * - pdfjs-dist: For PDF parsing and rendering
 * - canvas: For server-side canvas rendering
 * - sharp: For image processing and optimization
 *
 * @param pdfUrl - URL or R2 key of the PDF file
 * @param outputKey - R2 key for the output cover image
 * @returns CoverExtractionResult
 */
async function extractPdfCover(
  pdfUrl: string,
  outputKey: string
): Promise<CoverExtractionResult> {
  // Check dependencies first
  const depCheck = await checkDependencies();
  if (!depCheck.available) {
    return { success: false, error: depCheck.error };
  }

  try {
    // Use eval to prevent webpack from bundling these optional dependencies
    const requireModule = eval("require");
    const pdfjsLib = requireModule("pdfjs-dist/legacy/build/pdf.mjs");
    const { createCanvas } = requireModule("canvas");
    const sharp = requireModule("sharp");

    // Set up PDF.js worker
    // In Node.js environment, we don't need a worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = "";

    // Fetch the PDF
    let pdfBuffer: Buffer;

    if (pdfUrl.startsWith("http")) {
      // SSRF-hardened fetch. The previous bare fetch(pdfUrl) was reachable
      // from /api/backer/digital-files/extract-cover whenever a row had
      // a legacy fileUrl set: a hostile value pointed at
      // http://169.254.169.254/ (Hetzner / AWS / GCP cloud metadata)
      // would be proxied back. safeFetchExternal blocks private /
      // loopback / link-local IPs and refuses redirects.
      const { safeFetchExternal } = await import("@/lib/safe-fetch");
      const result = await safeFetchExternal(pdfUrl, {
        allowHostSuffixes: [
          "r2.cloudflarestorage.com",
          "r2.dev",
          "s3.amazonaws.com",
          "amazonaws.com",
        ],
        maxBytes: 100 * 1024 * 1024, // 100 MB cap on PDF fetches
      });
      if (!result.ok) {
        throw new Error(`Failed to fetch PDF: HTTP ${result.status}`);
      }
      pdfBuffer = result.bytes;
    } else {
      // Fetch from R2
      const command = new GetObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: pdfUrl,
      });
      const response = await r2Client.send(command);
      if (!response.Body) {
        throw new Error("Failed to get PDF from R2");
      }
      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
        chunks.push(chunk);
      }
      pdfBuffer = Buffer.concat(chunks);
    }

    // Load PDF document
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(pdfBuffer),
      useSystemFonts: true,
      standardFontDataUrl: undefined,
    });

    const pdf = await loadingTask.promise;
    const totalPages = pdf.numPages;

    // Get first page
    const page = await pdf.getPage(1);

    // Set up viewport - scale for good quality thumbnail
    const scale = 2.0; // Higher scale for better quality
    const viewport = page.getViewport({ scale });

    // Create canvas
    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext("2d");

    // Render page to canvas
    await page.render({
      canvasContext: context,
      viewport,
    }).promise;

    // Convert canvas to buffer
    const pngBuffer = canvas.toBuffer("image/png");

    // Process with sharp - resize and convert to WebP
    const coverBuffer = await sharp(pngBuffer)
      .resize(400, 600, {
        fit: "cover",
        position: "top",
      })
      .webp({ quality: 85 })
      .toBuffer();

    // Upload to R2
    const uploadCommand = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: outputKey,
      Body: coverBuffer,
      ContentType: "image/webp",
    });

    await r2Client.send(uploadCommand);

    // Generate public URL
    const coverUrl = R2_PUBLIC_URL
      ? `${R2_PUBLIC_URL}/${outputKey}`
      : `https://${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${outputKey}`;

    return {
      success: true,
      coverUrl,
      totalPages,
    };
  } catch (error) {
    pdfCoverExtractorLogger.error({ err: error }, "PDF cover extraction failed:");
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Generate a unique key for the cover image
 */
function generateCoverKey(fileId: string, type: "digital-file" | "marketplace-book"): string {
  return `covers/${type}/${fileId}.webp`;
}

/**
 * Extract cover and update database record
 * This is a convenience function that handles the full workflow
 */
export async function extractAndSaveCover(
  prisma: {
    digitalFile?: {
      update: (args: {
        where: { id: string };
        data: {
          coverImageUrl: string | null;
          coverExtractedAt: Date | null;
          coverExtractionFailed: boolean;
          totalPages: number | null;
        };
      }) => Promise<unknown>;
    };
    marketplaceBook?: {
      update: (args: {
        where: { id: string };
        data: {
          pdfCoverImageUrl: string | null;
          pdfCoverExtractedAt: Date | null;
          pdfCoverExtractionFailed: boolean;
          pdfTotalPages: number | null;
        };
      }) => Promise<unknown>;
    };
  },
  fileId: string,
  pdfUrl: string,
  type: "digital-file" | "marketplace-book"
): Promise<CoverExtractionResult> {
  const outputKey = generateCoverKey(fileId, type);
  const result = await extractPdfCover(pdfUrl, outputKey);

  // Update database based on type
  if (type === "digital-file" && prisma.digitalFile) {
    await prisma.digitalFile.update({
      where: { id: fileId },
      data: {
        coverImageUrl: result.success ? result.coverUrl ?? null : null,
        coverExtractedAt: result.success ? new Date() : null,
        coverExtractionFailed: !result.success,
        totalPages: result.totalPages || null,
      },
    });
  } else if (type === "marketplace-book" && prisma.marketplaceBook) {
    await prisma.marketplaceBook.update({
      where: { id: fileId },
      data: {
        pdfCoverImageUrl: result.success ? result.coverUrl ?? null : null,
        pdfCoverExtractedAt: result.success ? new Date() : null,
        pdfCoverExtractionFailed: !result.success,
        pdfTotalPages: result.totalPages || null,
      },
    });
  }

  return result;
}

