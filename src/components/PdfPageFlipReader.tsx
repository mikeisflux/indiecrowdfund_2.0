"use client";

import { usePdfAsImages } from "@/lib/usePdfAsImages";
import { Loader2 } from "lucide-react";
import { PageFlipReader } from "./PageFlipReader";

// PDF-backed page-turn reader, used by the Digital Library and by the
// interior preview on layout-v2 campaign pages.
//
// This used to contain the flipbook itself. The rendering half now lives in
// PageFlipReader, which takes pages that are already images. This file is
// only the PDF-specific part: rasterise, report progress, hand the images
// over. Both pdf.js and react-pageflip load on demand, so importing this
// component doesn't pull either into the caller's initial bundle — which
// matters on the public campaign page, where most projects have no preview.
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
  showCover?: boolean; // False = no hard cover, every page bends
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
  showCover = true,
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
      showCover={showCover}
    />
  );
}
