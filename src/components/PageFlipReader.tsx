"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";

const HTMLFlipBook = dynamic(() => import("react-pageflip"), { ssr: false });

type FlipEvent = { data: number };

// The page-turn reader, given pages that are already images.
//
// Extracted from PdfPageFlipReader, which was two things in one file: a hook
// that rasterises a PDF into an image array, and a flipbook that renders that
// array. Only the first half is PDF-specific, and both current callers — the
// Digital Library and the campaign-page interior preview — reach this through
// that PDF wrapper. Keeping the split means a future caller with pages that
// are already images doesn't have to route them through a PDF to render them.
export type PageFlipReaderProps = {
  images: string[];
  /** Stable identity for the book — remounts the flipbook when it changes. */
  bookId: string;
  initialPageIndex?: number;
  onPageChange?: (pageIndex: number, totalPages: number) => void;
  onReady?: (numPages: number) => void;
  className?: string;
  width?: number;
  height?: number;
  /** Single page instead of a two-page spread — used on mobile. */
  singlePage?: boolean;
};

export function PageFlipReader({
  images,
  bookId,
  initialPageIndex = 0,
  onPageChange,
  onReady,
  className,
  width = 380,
  height = 520,
  singlePage = false,
}: PageFlipReaderProps) {
   
  const flipRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  // Displayed page number. Held in state rather than read off the flipbook
  // ref during render — reading a ref while rendering doesn't schedule an
  // update, so the counter only moved when something else re-rendered the
  // component. (Inherited from PdfPageFlipReader, fixed here.)
  const [currentPage, setCurrentPage] = useState(initialPageIndex);

  const onPageChangeRef = useRef(onPageChange);
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onPageChangeRef.current = onPageChange;
    onReadyRef.current = onReady;
  }, [onPageChange, onReady]);

  const flipKey = useMemo(() => `flipbook-${bookId}`, [bookId]);

  useEffect(() => {
    setReady(false);
    setCurrentPage(initialPageIndex);
    // initialPageIndex is intentionally not a dependency: this resets the
    // counter when the *book* changes, not when the caller's start page does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);

  const imageCount = images.length;

  useEffect(() => {
    if (imageCount === 0) return;

    onReadyRef.current?.(imageCount);

    const turn = (inst: { turnToPage: (n: number) => void } | undefined) => {
      if (!inst) return;
      try {
        inst.turnToPage(Math.max(0, Math.min(initialPageIndex, imageCount - 1)));
      } catch {
        // Ignore errors
      }
    };

    const inst = flipRef.current?.pageFlip?.();
    if (!inst) {
      // Delay one frame so pageflip has attached DOM
      requestAnimationFrame(() => {
        turn(flipRef.current?.pageFlip?.());
        setReady(true);
      });
      return;
    }

    turn(inst);
    setReady(true);
  }, [imageCount, initialPageIndex]);

  if (!images.length) {
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
          setCurrentPage(e.data);
          onPageChangeRef.current?.(e.data, images.length);
        }}
        className={ready ? "demo-book" : "demo-book opacity-0"}
      >
        {images.map((src, idx) => (
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
        Page <span className="text-white font-medium tabular-nums">{currentPage + 1}</span> of {images.length}
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
