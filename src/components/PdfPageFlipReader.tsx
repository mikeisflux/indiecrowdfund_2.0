"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { usePdfAsImages } from "@/lib/usePdfAsImages";
import { Loader2 } from "lucide-react";

const HTMLFlipBook = dynamic(() => import("react-pageflip"), { ssr: false });

type FlipEvent = { data: number };

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const flipRef = useRef<any>(null);
  const { state } = usePdfAsImages(pdfUrl, { scale: 1.6, concurrency: 2 });

  const [ready, setReady] = useState(false);

  // Store callbacks in refs to avoid stale closures
  const onPageChangeRef = useRef(onPageChange);
  const onReadyRef = useRef(onReady);

  useEffect(() => {
    onPageChangeRef.current = onPageChange;
    onReadyRef.current = onReady;
  }, [onPageChange, onReady]);

  // Only change this key when the *file* changes, not on progress updates
  const flipKey = useMemo(() => `flipbook-${fileId}`, [fileId]);

  // Reset ready state when file changes
  useEffect(() => {
    setReady(false);
  }, [fileId]);

  // Track image count only when ready to avoid re-running effect during loading
  const imageCount = state.status === "ready" ? state.images.length : 0;

  // When images are ready, turn to saved page ONCE
  useEffect(() => {
    if (state.status !== "ready") return;

    onReadyRef.current?.(state.images.length);

    const inst = flipRef.current?.pageFlip?.();
    if (!inst) {
      // Delay one frame so pageflip has attached DOM
      requestAnimationFrame(() => {
        const inst2 = flipRef.current?.pageFlip?.();
        if (inst2) {
          try {
            const targetPage = Math.max(0, Math.min(initialPageIndex, state.images.length - 1));
            inst2.turnToPage(targetPage);
          } catch {
            // Ignore errors
          }
        }
        setReady(true);
      });
      return;
    }

    try {
      const targetPage = Math.max(0, Math.min(initialPageIndex, state.images.length - 1));
      inst.turnToPage(targetPage);
    } catch {
      // Ignore errors
    }
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, imageCount, initialPageIndex]);

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

  if (!state.images.length) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <p className="text-white/70">No pages found.</p>
      </div>
    );
  }

  return (
    <div className={className} style={{ height: '100%' }}>
      <HTMLFlipBook
        key={flipKey}
        ref={flipRef}
        width={width}
        height={height}
        size="stretch"
        minWidth={315}
        maxWidth={1000}
        minHeight={400}
        maxHeight={1533}
        showCover={true}
        mobileScrollSupport={true}
        useMouseEvents={true}
        clickEventForward={false}
        flippingTime={650}
        maxShadowOpacity={0.5}
        drawShadow={true}
        showPageCorners={true}
        disableFlipByClick={false}
        startPage={initialPageIndex}
        startZIndex={0}
        autoSize={true}
        usePortrait={singlePage}
        swipeDistance={30}
        style={{}}
        onFlip={(e: FlipEvent) => {
          onPageChangeRef.current?.(e.data, state.images.length);
        }}
        className={ready ? "demo-book" : "demo-book opacity-0"}
      >
        {state.images.map((src, idx) => (
          <div key={src} className="page">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={`Page ${idx + 1}`}
              draggable={false}
              className="page-img"
            />
          </div>
        ))}
      </HTMLFlipBook>

      <div className="mt-4 text-center text-sm text-white/70">
        Page <span className="text-white font-medium">{(flipRef.current?.pageFlip?.()?.getCurrentPageIndex?.() ?? initialPageIndex) + 1}</span> of {state.images.length}
      </div>

      <style jsx global>{`
        .demo-book {
          margin: 0 auto;
        }

        .stf__parent {
          margin: 0 auto;
          height: auto !important;
        }

        /* Remove gap between pages */
        .stf__item {
          margin: 0 !important;
          padding: 0 !important;
        }

        .page {
          background: #fdfcf8;
          overflow: hidden;
          padding: 0;
          margin: 0;
          box-sizing: border-box;
        }

        .page-img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          user-select: none;
          -webkit-user-drag: none;
          margin: 0;
          padding: 0;
        }
      `}</style>
    </div>
  );
}
