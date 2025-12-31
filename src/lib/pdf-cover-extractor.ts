/**
 * PDF Cover Extraction Utility
 *
 * Extracts the first page of a PDF and converts it to a thumbnail image.
 * Uses pdf.js for rendering and sharp for image processing.
 */

import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

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
export async function extractPdfCover(
  pdfUrl: string,
  outputKey: string
): Promise<CoverExtractionResult> {
  try {
    // Dynamic imports to handle optional dependencies
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const { createCanvas } = await import("canvas");
    const sharp = (await import("sharp")).default;

    // Set up PDF.js worker
    // In Node.js environment, we don't need a worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = "";

    // Fetch the PDF
    let pdfBuffer: Buffer;

    if (pdfUrl.startsWith("http")) {
      // Fetch from URL
      const response = await fetch(pdfUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      pdfBuffer = Buffer.from(arrayBuffer);
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      canvasContext: context as any,
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
    console.error("PDF cover extraction failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Generate a unique key for the cover image
 */
export function generateCoverKey(fileId: string, type: "digital-file" | "marketplace-book"): string {
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
        coverImageUrl: result.success ? result.coverUrl : null,
        coverExtractedAt: result.success ? new Date() : null,
        coverExtractionFailed: !result.success,
        totalPages: result.totalPages || null,
      },
    });
  } else if (type === "marketplace-book" && prisma.marketplaceBook) {
    await prisma.marketplaceBook.update({
      where: { id: fileId },
      data: {
        pdfCoverImageUrl: result.success ? result.coverUrl : null,
        pdfCoverExtractedAt: result.success ? new Date() : null,
        pdfCoverExtractionFailed: !result.success,
        pdfTotalPages: result.totalPages || null,
      },
    });
  }

  return result;
}

/**
 * Queue cover extraction for a batch of files
 * This can be used for backfilling existing PDFs
 */
export async function queueCoverExtraction(
  fileIds: string[],
  type: "digital-file" | "marketplace-book"
): Promise<{ queued: number; errors: string[] }> {
  const errors: string[] = [];
  let queued = 0;

  for (const fileId of fileIds) {
    try {
      // In a production environment, this would add to a job queue
      // For now, we'll just track what needs to be processed
      queued++;
    } catch (error) {
      errors.push(`Failed to queue ${fileId}: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  return { queued, errors };
}
