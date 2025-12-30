"use client";

import React, { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { pdfToImages } from "@/lib/pdfToImages";
import { Loader2 } from "lucide-react";

const HTMLFlipBook = dynamic(() => import("react-pageflip"), { ssr: false });

type Props = {
  pdfUrl: string;
  initialPage?: number; // 1-based PDF page number
  onPageChange?: (page: number, totalPages: number) => void; // 1-based
  onReady?: (numPages: number) => void;
  className?: string;
  width?: number;
  height?: number;
};

type ImgPageProps = {
  src: string;
  pageNumber: number;
};

const ImgPage = React.forwardRef<HTMLDivElement, ImgPageProps>(function ImgPage(
  { src, pageNumber },
  ref
) {
  return (
    <div ref={ref} className="w-full h-full bg-[#fdfcf8]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={`Page ${pageNumber}`}
        className="w-full h-full object-contain select-none pointer-events-none"
        draggable={false}
      />
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs text-gray-500 bg-white/80 px-2 py-0.5 rounded">
        {pageNumber}
      </div>
    </div>
  );
});

export function PdfPageFlipReader({
  pdfUrl,
  initialPage = 1,
  onPageChange,
  onReady,
  className,
  width = 450,
  height = 650,
}: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bookRef = useRef<any>(null);

  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [urls, setUrls] = useState<string[]>([]);
  const [numPages, setNumPages] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Store callbacks in refs to avoid dependency issues
  const onReadyRef = useRef(onReady);
  const onPageChangeRef = useRef(onPageChange);
  const initialPageRef = useRef(initialPage);

  // Keep refs updated
  useEffect(() => {
    onReadyRef.current = onReady;
    onPageChangeRef.current = onPageChange;
    initialPageRef.current = initialPage;
  }, [onReady, onPageChange, initialPage]);

  // Load PDF only when URL changes
  useEffect(() => {
    let alive = true;
    let cleanup: null | (() => void) = null;

    setLoading(true);
    setError(null);
    setProgress(0);

    (async () => {
      try {
        const res = await pdfToImages(pdfUrl, 1.6, (p) => {
          if (alive) setProgress(p);
        });

        if (!alive) {
          res.revoke();
          return;
        }

        cleanup = res.revoke;
        setUrls(res.urls);
        setNumPages(res.numPages);
        setLoading(false);
        onReadyRef.current?.(res.numPages);
      } catch (e) {
        if (alive) {
          setError(e instanceof Error ? e.message : "Failed to render PDF");
          setLoading(false);
        }
      }
    })();

    return () => {
      alive = false;
      cleanup?.();
    };
  }, [pdfUrl]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <Loader2 className="h-10 w-10 text-amber-400 animate-spin mb-4" />
        <p className="text-white/70 mb-2">Preparing book...</p>
        <div className="w-48 h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-400 transition-all duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-white/50 text-sm mt-2">{progress}%</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  if (!urls.length) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <p className="text-white/70">No pages found.</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <HTMLFlipBook
        ref={bookRef}
        width={width}
        height={height}
        size="fixed"
        minWidth={width}
        maxWidth={width}
        minHeight={height}
        maxHeight={height}
        maxShadowOpacity={0.4}
        showCover={true}
        mobileScrollSupport={true}
        useMouseEvents={true}
        drawShadow={true}
        flippingTime={600}
        style={{ willChange: "transform", transform: "translateZ(0)" }}
        onFlip={(e: { data: number }) => {
          const flipIndex = e?.data ?? 0;
          const pdfPage = flipIndex + 1;
          setCurrentPage(pdfPage);
          onPageChangeRef.current?.(pdfPage, numPages);
        }}
        className="book-flip-shadow"
        startPage={Math.max(0, initialPage - 1)}
        showPageCorners={true}
        disableFlipByClick={false}
        swipeDistance={30}
        clickEventForward={true}
        usePortrait={false}
        startZIndex={0}
        autoSize={false}
        renderOnlyPageLengthChange={false}
      >
        {urls.map((src, i) => (
          <ImgPage key={src} src={src} pageNumber={i + 1} />
        ))}
      </HTMLFlipBook>

      <div className="mt-4 text-center text-sm text-white/70">
        Page <span className="text-white font-medium">{currentPage}</span> of {numPages}
      </div>

      <style jsx global>{`
        .book-flip-shadow {
          box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.5);
        }
        .stf__parent {
          margin: 0 auto;
        }
        .stf__wrapper {
          background: transparent !important;
        }
      `}</style>
    </div>
  );
}
