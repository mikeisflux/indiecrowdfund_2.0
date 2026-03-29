"use client";

import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getLocalBookUrl } from "@/lib/local-books-db";

// Use local worker for reliability
pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

// Cache for thumbnail URLs by file ID or PDF URL
const thumbnailCache = new Map<string, string>();

/**
 * Prefetch and cache a thumbnail for a PDF
 * Call this proactively to ensure thumbnail is ready before rendering
 */
export async function prefetchThumbnail(pdfUrl: string, cacheKey: string): Promise<string | null> {
  // Check cache first
  const cached = thumbnailCache.get(cacheKey);
  if (cached) return cached;

  try {
    // Fetch PDF
    const response = await fetch(pdfUrl);
    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
    const pdfData = await response.arrayBuffer();

    // Load PDF
    const loadingTask = pdfjsLib.getDocument({ data: pdfData });
    const pdf = await loadingTask.promise;

    // Get first page
    const page = await pdf.getPage(1);

    // Scale for thumbnail
    const scale = 0.5;
    const viewport = page.getViewport({ scale });

    // Create canvas
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Failed to get canvas context");

    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    // Render page
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;

    // Convert to blob URL
    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
        "image/jpeg",
        0.85
      );
    });

    const url = URL.createObjectURL(blob);

    // Cache it
    thumbnailCache.set(cacheKey, url);

    // Cleanup canvas
    canvas.width = 0;
    canvas.height = 0;

    return url;
  } catch (err) {
    console.error("Prefetch thumbnail error:", err);
    return null;
  }
}

type Props = {
  pdfUrl?: string;
  fileId?: string;  // For crowdfunding files - will fetch signed URL
  source?: "crowdfunding" | "marketplace" | "local";
  className?: string;
  iconClassName?: string;
  fallbackGradient?: string;
  onLoad?: (thumbnailUrl: string) => void;
};

/**
 * PdfThumbnail - Renders the first page of a PDF as a thumbnail
 * Uses client-side PDF.js rendering (no server-side canvas required)
 * Supports both direct URLs and fileId-based fetching for crowdfunding files
 */
export function PdfThumbnail({
  pdfUrl: directPdfUrl,
  fileId,
  source = "crowdfunding",
  className,
  iconClassName = "text-amber-600/50",
  fallbackGradient = "from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30",
  onLoad
}: Props) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const mountedRef = useRef(true);
  const renderingRef = useRef(false);

  // Cache key is either fileId or direct URL
  const cacheKey = fileId || directPdfUrl || "";

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!cacheKey) {
      setLoading(false);
      setError(true);
      return;
    }

    // Check cache first
    const cached = thumbnailCache.get(cacheKey);
    if (cached) {
      setThumbnailUrl(cached);
      setLoading(false);
      onLoad?.(cached);
      return;
    }

    // Prevent duplicate renders
    if (renderingRef.current) return;
    renderingRef.current = true;

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(false);

        // Get PDF URL - either direct or via API
        let pdfUrl = directPdfUrl;

        if (!pdfUrl && fileId) {
          // Fetch URL based on source
          if (source === "crowdfunding") {
            // Use proxy endpoint to avoid CORS issues with direct R2 URLs
            pdfUrl = `/api/backer/digital-files/stream?fileId=${encodeURIComponent(fileId)}`;
          } else if (source === "marketplace") {
            const res = await fetch(`/api/backer/marketplace-purchases/${fileId}/download`);
            if (!res.ok) throw new Error("Failed to get PDF URL");
            const { downloadUrl } = await res.json();
            pdfUrl = downloadUrl;
          } else if (source === "local") {
            // Get blob URL from IndexedDB
            const localUrl = await getLocalBookUrl(fileId);
            if (!localUrl) throw new Error("Failed to get local book URL");
            pdfUrl = localUrl;
          }
        }

        if (!pdfUrl || cancelled || !mountedRef.current) {
          throw new Error("No PDF URL available");
        }

        // Fetch PDF
        const response = await fetch(pdfUrl);
        if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
        const pdfData = await response.arrayBuffer();

        if (cancelled || !mountedRef.current) return;

        // Load PDF
        const loadingTask = pdfjsLib.getDocument({ data: pdfData });
        const pdf = await loadingTask.promise;

        if (cancelled || !mountedRef.current) return;

        // Get first page
        const page = await pdf.getPage(1);

        // Scale for thumbnail - small but clear
        const scale = 0.5;
        const viewport = page.getViewport({ scale });

        // Create canvas
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { alpha: false });
        if (!ctx) throw new Error("Failed to get canvas context");

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);

        // Render page
        await page.render({ canvasContext: ctx, viewport, canvas }).promise;

        if (cancelled || !mountedRef.current) return;

        // Convert to blob URL
        const blob: Blob = await new Promise((resolve, reject) => {
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
            "image/jpeg",
            0.85
          );
        });

        const url = URL.createObjectURL(blob);

        // Cache it
        thumbnailCache.set(cacheKey, url);

        // Cleanup canvas
        canvas.width = 0;
        canvas.height = 0;

        if (cancelled || !mountedRef.current) {
          URL.revokeObjectURL(url);
          return;
        }

        setThumbnailUrl(url);
        setLoading(false);
        onLoad?.(url);
      } catch (err) {
        console.error("PDF thumbnail error:", err);
        if (!cancelled && mountedRef.current) {
          setError(true);
          setLoading(false);
        }
      } finally {
        renderingRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cacheKey, directPdfUrl, fileId, source, onLoad]);

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center bg-gradient-to-br", fallbackGradient, className)}>
        <Loader2 className={cn("h-8 w-8 animate-spin", iconClassName)} />
      </div>
    );
  }

  if (error || !thumbnailUrl) {
    return (
      <div className={cn("flex items-center justify-center bg-gradient-to-br", fallbackGradient, className)}>
        <FileText className={cn("h-16 w-16", iconClassName)} />
      </div>
    );
  }

  return (
    <div className={cn("relative w-full h-full", className)}>
      {/* Using img for blob URLs - Next Image doesn't support blob: protocol */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={thumbnailUrl}
        alt="PDF thumbnail"
        className="object-contain w-full h-full"
      />
    </div>
  );
}

/**
 * Clear thumbnail cache and revoke URLs
 */
export function clearThumbnailCache() {
  thumbnailCache.forEach((url) => URL.revokeObjectURL(url));
  thumbnailCache.clear();
}
