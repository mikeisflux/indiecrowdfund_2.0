// src/lib/pdfToImages.ts
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

// Use local worker file for reliability
pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

export type PdfImagesResult = {
  urls: string[];       // blob URLs for each page, index 0 = page 1
  numPages: number;
  revoke: () => void;   // cleanup blob URLs
};

/**
 * Render each PDF page to a PNG blob URL.
 * - scale 1.5–2 is usually enough; higher = heavier memory.
 * - This renders once; flipping uses <img>, so it stays smooth.
 */
export async function pdfToImages(
  pdfUrl: string,
  scale = 1.6,
  onProgress?: (progress: number) => void
): Promise<PdfImagesResult> {
  const loadingTask = pdfjsLib.getDocument({
    url: pdfUrl,
    // If your PDF is behind auth/cookies, you may need:
    // withCredentials: true,
  });

  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;

  const urls: string[] = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { alpha: false });

    if (!ctx) throw new Error("Failed to get canvas context");

    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    await page.render({ canvasContext: ctx, viewport, canvas }).promise;

    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png", 0.92);
    });

    const url = URL.createObjectURL(blob);
    urls.push(url);

    // Report progress
    if (onProgress) {
      onProgress(Math.round((pageNum / numPages) * 100));
    }

    // Reduce memory pressure
    canvas.width = 0;
    canvas.height = 0;
  }

  const revoke = () => {
    urls.forEach((u) => URL.revokeObjectURL(u));
  };

  return { urls, numPages, revoke };
}
