"use client";

import { usePdfAsImages } from "@/lib/usePdfAsImages";
import { Loader2 } from "lucide-react";
import { PageFlipReader } from "./PageFlipReader";

// PDF-backed page-turn reader, used by the Digital Library.
//
// This used to contain the flipbook itself. The rendering half now lives in
// PageFlipReader, which takes pages that are already images — campaign-page
// interior previews are creator-uploaded images and have no PDF involved, and
// two copies of the flipbook would have drifted. This file is now only the
// PDF-specific part: rasterise, report progress, hand the images over.
type Props = {
  pdfUrl: string;
  fileId: string; // Unique ID for stable key
  initialPageIndex?: number; // 0-based page index
  onPageChange?: (pageIndex: number, totalPages: number) => void;
  onReady?: (numPages: number) => void;
  className?: string;
  width?: number;
  height?: number;
  singlePage?: boolean; // Show single page instead of spread (for mobile)
};

export function PdfPageFlipReader({
  pdfUrl,
  fileId,
  initialPageIndex = 0,
  onPageChange,
  onReady,
  className,
  width = 380,
  height = 520,
  singlePage = false,
}: Props) {
  const { state } = usePdfAsImages(pdfUrl, { scale: 1.6, concurrency: 2 });

  if (state.status === "idle") {
    return null;
  }

  if (state.status === "loading") {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <Loader2 className="h-10 w-10 text-amber-400 animate-spin mb-4" />
        <p className="text-white/70 mb-2">Rendering pages...</p>
        <div className="w-48 h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-400 transition-all duration-200"
            style={{ width: `${state.progress}%` }}
          />
        </div>
        <p className="text-white/50 text-sm mt-2">{state.progress}%</p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <p className="text-red-400">PDF error: {state.error}</p>
      </div>
    );
  }

  return (
    <PageFlipReader
      images={state.images}
      bookId={fileId}
      initialPageIndex={initialPageIndex}
      onPageChange={onPageChange}
      onReady={onReady}
      className={className}
      width={width}
      height={height}
      singlePage={singlePage}
    />
  );
}
