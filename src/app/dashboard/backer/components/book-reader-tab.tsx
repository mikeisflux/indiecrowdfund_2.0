"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { getCSRFHeaders } from "@/lib/csrf";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  X,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  AlertCircle,
  FileText,
  Bookmark,
  BookmarkPlus,
  Library,
  List,
} from "lucide-react";

const Document = dynamic(() => import("react-pdf").then((mod) => mod.Document), { ssr: false });
const Page = dynamic(() => import("react-pdf").then((mod) => mod.Page), { ssr: false });
const Outline = dynamic(() => import("react-pdf").then((mod) => mod.Outline), { ssr: false });

interface DigitalFile {
  id: string;
  name: string;
  fileName: string;
  fileSize: number;
  project: { id: string; title: string };
}

interface ReadingProgress {
  fileId: string;
  currentPage: number;
  totalPages: number;
  lastRead: string;
}

interface BookmarkItem {
  page: number;
  timestamp: string;
}

interface OutlineItem {
  title: string;
  page: number;
  children?: OutlineItem[];
}

// PDF.js types for outline and document
interface PDFOutlineItem {
  title: string;
  dest: string | unknown[] | null;
  items?: PDFOutlineItem[];
}

// Use the actual type from pdfjs-dist
type PDFDocumentProxyType = import("pdfjs-dist").PDFDocumentProxy;

interface DigitalFileWithMime extends DigitalFile {
  mimeType?: string;
}

const READING_PROGRESS_KEY = "indiecrowdfund_reading_progress";
const BOOKMARKS_KEY = "indiecrowdfund_bookmarks";

const getReadingProgress = (fileId: string): ReadingProgress | null => {
  if (typeof window === "undefined") return null;
  try {
    const item = localStorage.getItem(`${READING_PROGRESS_KEY}_${fileId}`);
    return item ? JSON.parse(item) : null;
  } catch {
    return null;
  }
};

const saveReadingProgress = (progress: ReadingProgress) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${READING_PROGRESS_KEY}_${progress.fileId}`, JSON.stringify(progress));
  } catch {}
};

const getBookmarks = (fileId: string): BookmarkItem[] => {
  if (typeof window === "undefined") return [];
  try {
    const item = localStorage.getItem(`${BOOKMARKS_KEY}_${fileId}`);
    return item ? JSON.parse(item) : [];
  } catch {
    return [];
  }
};

const saveBookmarks = (fileId: string, bookmarks: BookmarkItem[]) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${BOOKMARKS_KEY}_${fileId}`, JSON.stringify(bookmarks));
  } catch {}
};

export function BookReaderTab() {
  const [pdfFiles, setPdfFiles] = useState<DigitalFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<DigitalFile | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentSpread, setCurrentSpread] = useState(0); // 0 = cover, 1 = pages 2-3, etc.
  const [scale, setScale] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isFlipping, setIsFlipping] = useState(false);
  const [flipDirection, setFlipDirection] = useState<"next" | "prev" | null>(null);
  const [dragProgress, setDragProgress] = useState(0);
  const [dragDirection, setDragDirection] = useState<"forward" | "backward" | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [progressMap, setProgressMap] = useState<Record<string, ReadingProgress>>({});
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [showToc, setShowToc] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxyType | null>(null);
  const [animFromSpread, setAnimFromSpread] = useState<number | null>(null);
  const [animToSpread, setAnimToSpread] = useState<number | null>(null);

  const bookRef = useRef<HTMLDivElement>(null);

  // Responsive page dimensions - smaller on mobile
  const pageWidth = isMobile ? 300 : 450;
  const pageHeight = isMobile ? 460 : 650;
  const renderWidth = isMobile ? 280 : 430;

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    import("react-pdf").then((pdfModule) => {
      pdfModule.pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfModule.pdfjs.version}/build/pdf.worker.min.mjs`;
    });
  }, []);

  useEffect(() => {
    fetchPdfFiles();
  }, []);

  const fetchPdfFiles = async () => {
    try {
      const res = await fetch("/api/backer/digital-files", { headers: getCSRFHeaders() });
      if (!res.ok) throw new Error("Failed to fetch files");
      const data = await res.json();
      const pdfs = (data.files || []).filter(
        (f: DigitalFileWithMime) => f.mimeType === "application/pdf" || f.fileName?.toLowerCase().endsWith(".pdf")
      );
      setPdfFiles(pdfs);
      const progress: Record<string, ReadingProgress> = {};
      pdfs.forEach((f: DigitalFile) => {
        const p = getReadingProgress(f.id);
        if (p) progress[f.id] = p;
      });
      setProgressMap(progress);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading library");
    } finally {
      setLoading(false);
    }
  };

  const openBook = async (file: DigitalFile) => {
    setSelectedFile(file);
    setPdfUrl(null);
    setNumPages(0);
    setOutline([]);
    setBookmarks(getBookmarks(file.id));

    try {
      const res = await fetch("/api/backer/digital-files", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({ fileId: file.id }),
      });
      if (!res.ok) throw new Error("Failed to get PDF URL");
      const { downloadUrl } = await res.json();
      setPdfUrl(downloadUrl);

      const saved = getReadingProgress(file.id);
      if (saved) {
        // On mobile, spread = page - 1; on desktop, calculate from spread
        const spread = isMobile
          ? saved.currentPage - 1
          : (saved.currentPage === 1 ? 0 : Math.floor((saved.currentPage - 1) / 2));
        setCurrentSpread(spread);
      } else {
        setCurrentSpread(0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load PDF");
    }
  };

  const closeBook = useCallback(() => {
    if (selectedFile && numPages > 0) {
      // On mobile, spread = page - 1; on desktop, calculate from spread
      const currentPage = isMobile ? currentSpread + 1 : (currentSpread === 0 ? 1 : currentSpread * 2);
      saveReadingProgress({
        fileId: selectedFile.id,
        currentPage,
        totalPages: numPages,
        lastRead: new Date().toISOString(),
      });
      saveBookmarks(selectedFile.id, bookmarks);
    }
    setSelectedFile(null);
    setPdfUrl(null);
    setNumPages(0);
    setCurrentSpread(0);
    setScale(1);
    setIsFullscreen(false);
    setShowToc(false);
    setShowBookmarks(false);
  }, [selectedFile, numPages, currentSpread, bookmarks, isMobile]);

  // On mobile, each "spread" is a single page; on desktop, spreads are 2 pages
  const maxSpreads = isMobile ? numPages : Math.ceil((numPages + 1) / 2);

  // Helper to compute pages for ANY spread
  const getSpreadPagesFor = useCallback((spread: number) => {
    if (isMobile) {
      const page = spread + 1;
      return { left: null as number | null, right: page <= numPages ? page : null, cover: spread === 0 };
    }
    if (spread === 0) return { left: null as number | null, right: 1, cover: true };
    const left = spread * 2;
    const right = spread * 2 + 1;
    return {
      left: left <= numPages ? left : null,
      right: right <= numPages ? right : null,
      cover: false,
    };
  }, [isMobile, numPages]);

  const flipTo = useCallback((direction: "next" | "prev") => {
    if (isFlipping || isDragging) return;

    const from = currentSpread;
    const to = direction === "next" ? from + 1 : from - 1;
    if (to < 0 || to >= maxSpreads) return;

    setFlipDirection(direction);
    setIsFlipping(true);

    // Snapshot for the animation
    setAnimFromSpread(from);
    setAnimToSpread(to);

    // Commit immediately so the "static spread" underneath is already correct
    setCurrentSpread(to);

    // Persist progress using the committed target
    const page = isMobile ? to + 1 : (to === 0 ? 1 : to * 2);
    if (selectedFile) {
      saveReadingProgress({
        fileId: selectedFile.id,
        currentPage: page,
        totalPages: numPages,
        lastRead: new Date().toISOString(),
      });
    }

    window.setTimeout(() => {
      setIsFlipping(false);
      setFlipDirection(null);
      setAnimFromSpread(null);
      setAnimToSpread(null);
    }, 600);
  }, [isFlipping, isDragging, currentSpread, maxSpreads, isMobile, selectedFile, numPages]);

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (isFlipping) return;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    setIsDragging(true);
    setDragStartX(clientX);
    setDragProgress(0);
    setDragDirection(null);
  };

  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging) return;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const delta = dragStartX - clientX;
    const containerWidth = bookRef.current?.offsetWidth || window.innerWidth;
    const progress = Math.min(1, Math.abs(delta) / (containerWidth * 0.4));
    setDragProgress(progress);
    setDragDirection(delta > 0 ? "forward" : "backward");
  }, [isDragging, dragStartX]);

  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;

    const shouldFlip = dragProgress > 0.3 && dragDirection;
    const dir = dragDirection; // capture before we clear state

    // End drag immediately so flipTo isn't blocked
    setIsDragging(false);
    setDragProgress(0);
    setDragDirection(null);

    if (shouldFlip && dir) {
      requestAnimationFrame(() => {
        flipTo(dir === "forward" ? "next" : "prev");
      });
    }
  }, [isDragging, dragProgress, dragDirection, flipTo]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleDragMove);
      window.addEventListener("mouseup", handleDragEnd);
      window.addEventListener("touchmove", handleDragMove, { passive: false });
      window.addEventListener("touchend", handleDragEnd);
    }
    return () => {
      window.removeEventListener("mousemove", handleDragMove);
      window.removeEventListener("mouseup", handleDragEnd);
      window.removeEventListener("touchmove", handleDragMove);
      window.removeEventListener("touchend", handleDragEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  const addBookmark = () => {
    // On mobile, spread = page - 1; on desktop, calculate from spread
    const page = isMobile ? currentSpread + 1 : (currentSpread === 0 ? 1 : currentSpread * 2);
    if (bookmarks.some(b => b.page === page)) return;
    const updated = [...bookmarks, { page, timestamp: new Date().toISOString() }].sort((a, b) => a.page - b.page);
    setBookmarks(updated);
    saveBookmarks(selectedFile!.id, updated);
  };

  const removeBookmark = (page: number) => {
    const updated = bookmarks.filter(b => b.page !== page);
    setBookmarks(updated);
    saveBookmarks(selectedFile!.id, updated);
  };

  const goToSpreadFromPage = (page: number) => {
    // On mobile, spread = page - 1; on desktop, calculate from spread
    const spread = isMobile ? page - 1 : (page === 1 ? 0 : Math.floor((page - 1) / 2));
    setCurrentSpread(spread);
    setShowToc(false);
    setShowBookmarks(false);
  };

  const processOutline = async (items: PDFOutlineItem[]): Promise<OutlineItem[]> => {
    const result: OutlineItem[] = [];
    for (const item of items) {
      if (item.dest && pdfDocument) {
        // dest can be a string (named destination) or an array (explicit destination)
        const dest = typeof item.dest === 'string'
          ? await pdfDocument.getDestination(item.dest)
          : item.dest;
        if (dest && dest[0]) {
          const pageIndex = await pdfDocument.getPageIndex(dest[0]);
          result.push({ title: item.title, page: pageIndex + 1 });
        }
      }
      if (item.items && item.items.length > 0) {
        result.push(...await processOutline(item.items));
      }
    }
    return result;
  };

  const handleOutlineLoad = async (outlineData: PDFOutlineItem[] | null) => {
    if (pdfDocument && outlineData && outlineData.length > 0) {
      const processed = await processOutline(outlineData);
      setOutline(processed);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) return <div className="grid gap-4 md:grid-cols-3">{[1,2,3].map(i => <Skeleton key={i} className="h-64" />)}</div>;
  if (error && !selectedFile) return <Card><CardContent className="py-12 text-center"><AlertCircle className="h-12 w-12 mx-auto mb-4" /><p>{error}</p></CardContent></Card>;

  if (selectedFile && pdfUrl) {
    // Compute page numbers for static display and animation
    const base = getSpreadPagesFor(currentSpread); // committed / static
    const from = animFromSpread ?? currentSpread;  // what the flip shows as "current"
    const to = animToSpread ?? currentSpread;      // what the flip reveals
    const fromPages = getSpreadPagesFor(from);
    const toPages = getSpreadPagesFor(to);

    // Use base for the static spread
    const { left, right, cover } = base;

    // Show loading state while PDF is loading (numPages === 0)
    if (numPages === 0) {
      return (
        <div className={cn("flex flex-col h-screen bg-gradient-to-b from-stone-900 to-stone-950 overflow-hidden", isFullscreen && "fixed inset-0 z-50")}>
          <div className="flex items-center justify-between p-3 bg-black/60 backdrop-blur-sm border-b border-white/10">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={closeBook}><X className="h-5 w-5" /></Button>
              <div>
                <h3 className="font-semibold text-white line-clamp-1">{selectedFile.name}</h3>
                <p className="text-xs text-white/60">{selectedFile.project.title}</p>
              </div>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <BookOpen className="h-12 w-12 mx-auto mb-4 text-amber-400 animate-pulse" />
              <p className="text-white/60">Loading book...</p>
            </div>
          </div>
          {/* Hidden Document component to load the PDF and trigger onLoadSuccess */}
          <div className="hidden">
            <Document
              file={pdfUrl}
              onLoadSuccess={(pdf) => { setNumPages(pdf.numPages); setPdfDocument(pdf); }}
              onLoadError={(err) => { console.error("PDF load error:", err); setError("Failed to load PDF"); }}
              loading={null}
            />
          </div>
        </div>
      );
    }

    // Guard against invalid page numbers
    if (!right || right < 1 || right > numPages) {
      return null;
    }

    return (
      <div className={cn("flex flex-col h-screen bg-gradient-to-b from-stone-900 to-stone-950 overflow-hidden", isFullscreen && "fixed inset-0 z-50")}>
        {/* Header */}
        <div className="flex items-center justify-between p-3 bg-black/60 backdrop-blur-sm border-b border-white/10">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={closeBook}><X className="h-5 w-5" /></Button>
            <div>
              <h3 className="font-semibold text-white line-clamp-1">{selectedFile.name}</h3>
              <p className="text-xs text-white/60">{selectedFile.project.title}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {outline.length > 0 && <Button variant="ghost" size="icon" onClick={() => setShowToc(t => !t)}><List className="h-4 w-4" /></Button>}
            <Button variant="ghost" size="icon" onClick={() => setShowBookmarks(t => !t)}><Bookmark className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={addBookmark}><BookmarkPlus className="h-4 w-4" /></Button>
            {!isMobile && (
              <>
                <Button variant="ghost" size="icon" onClick={() => setScale(s => Math.max(0.6, s - 0.1))}><ZoomOut className="h-4 w-4" /></Button>
                <span className="text-sm w-12 text-center">{Math.round(scale * 100)}%</span>
                <Button variant="ghost" size="icon" onClick={() => setScale(s => Math.min(2.5, s + 0.1))}><ZoomIn className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => setScale(1)}><RotateCcw className="h-4 w-4" /></Button>
              </>
            )}
            <Button variant="ghost" size="icon" onClick={() => setIsFullscreen(f => !f)}>
              {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Side Panels + Book */}
        <div className="flex flex-1 overflow-hidden">
          {/* TOC */}
          {showToc && outline.length > 0 && (
            <div className="w-72 bg-black/50 backdrop-blur-sm p-4 overflow-y-auto border-r border-white/10">
              <h4 className="font-semibold mb-4 text-white">Contents</h4>
              <TocList items={outline} onClick={goToSpreadFromPage} />
            </div>
          )}

          {/* Bookmarks */}
          {showBookmarks && (
            <div className="w-72 bg-black/50 backdrop-blur-sm p-4 overflow-y-auto border-r border-white/10">
              <h4 className="font-semibold mb-4 text-white">Bookmarks ({bookmarks.length})</h4>
              {bookmarks.length === 0 ? (
                <p className="text-white/60">No bookmarks</p>
              ) : (
                <div className="space-y-2">
                  {bookmarks.map((b, i) => (
                    <div key={i} className="flex justify-between items-center bg-white/5 rounded px-2 py-1">
                      <Button variant="link" className="text-left p-0 text-white/90" onClick={() => goToSpreadFromPage(b.page)}>
                        Page {b.page}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeBookmark(b.page)}><X className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Book View */}
          <div className="flex-1 flex items-center justify-center overflow-hidden" ref={bookRef}>
            <Document file={pdfUrl} onLoadSuccess={(pdf) => { setNumPages(pdf.numPages); setPdfDocument(pdf); }} loading={null}>
              <Outline onLoadSuccess={handleOutlineLoad} />
              {/* TEMP: disable preloading until flipping is stable */}
              {/* <div className="absolute opacity-0 pointer-events-none -z-50">
                {preloadPages().map(p => (
                  <Page key={`pre-${p}`} pageNumber={p} width={900} renderTextLayer={false} renderAnnotationLayer={false} />
                ))}
              </div> */}

              <div
                className="relative"
                style={{
                  transform: `scale(${scale}) translate3d(0,0,0)`,
                  perspective: "3000px",
                  willChange: "transform"
                }}
                onMouseDown={handleDragStart}
                onTouchStart={handleDragStart}
              >
                <div className="relative flex shadow-2xl" style={{ transformStyle: "preserve-3d" }}>
                  {/* Spine shadow - only on desktop with two-page spread */}
                  {!isMobile && !cover && (
                    <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-6 z-30 pointer-events-none">
                      <div className="h-full bg-gradient-to-r from-transparent via-black/30 to-transparent" />
                    </div>
                  )}

                  {/* Flipping Page Layer - forward flip (right page flipping) */}
                  {(isFlipping || isDragging) && (flipDirection === "next" || dragDirection === "forward") && fromPages.right && (
                    <div
                      className="absolute flex"
                      style={{
                        left: isMobile ? 0 : pageWidth,
                        width: pageWidth,
                        height: pageHeight,
                        transformStyle: "preserve-3d",
                        transform: `rotateY(${-(isDragging ? dragProgress * 180 : 180)}deg)`,
                        transformOrigin: "left center",
                        transition: isFlipping ? "transform 0.6s cubic-bezier(0.6, 0.05, 0.4, 0.95)" : "none",
                        zIndex: 50,
                        pointerEvents: "none",
                      }}
                    >
                      {/* Front of flipping page = fromPages.right */}
                      <div className={cn("absolute inset-0 bg-paper overflow-hidden", fromPages.cover && "rounded-r-xl")} style={{ backfaceVisibility: "hidden" }}>
                        <Page key={`flip-front-${fromPages.right}`} pageNumber={fromPages.right} width={renderWidth} renderTextLayer={false} renderAnnotationLayer={false} />
                      </div>
                      {/* Back of flipping page = toPages.left (desktop) or toPages.right (mobile) */}
                      <div className="absolute inset-0 bg-paper overflow-hidden" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
                        {(isMobile ? toPages.right : toPages.left) && (
                          <Page
                            key={`flip-back-${isMobile ? toPages.right : toPages.left}`}
                            pageNumber={(isMobile ? toPages.right : toPages.left)!}
                            width={renderWidth} renderTextLayer={false} renderAnnotationLayer={false}
                          />
                        )}
                      </div>
                    </div>
                  )}

                  {/* Flipping Page Layer - backward flip (left page flipping on desktop) */}
                  {(isFlipping || isDragging) && (flipDirection === "prev" || dragDirection === "backward") && !isMobile && fromPages.left && (
                    <div
                      className="absolute flex"
                      style={{
                        left: 0,
                        width: pageWidth,
                        height: pageHeight,
                        transformStyle: "preserve-3d",
                        transform: `rotateY(${isDragging ? dragProgress * 180 : 180}deg)`,
                        transformOrigin: "right center",
                        transition: isFlipping ? "transform 0.6s cubic-bezier(0.6, 0.05, 0.4, 0.95)" : "none",
                        zIndex: 50,
                        pointerEvents: "none",
                      }}
                    >
                      {/* Front of flipping page = fromPages.left */}
                      <div className="absolute inset-0 bg-paper overflow-hidden" style={{ backfaceVisibility: "hidden" }}>
                        <Page key={`flip-back-front-${fromPages.left}`} pageNumber={fromPages.left} width={renderWidth} renderTextLayer={false} renderAnnotationLayer={false} />
                      </div>
                      {/* Back of flipping page = toPages.right */}
                      <div className="absolute inset-0 bg-paper overflow-hidden" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
                        {toPages.right && (
                          <Page key={`flip-back-back-${toPages.right}`} pageNumber={toPages.right} width={renderWidth} renderTextLayer={false} renderAnnotationLayer={false} />
                        )}
                      </div>
                    </div>
                  )}

                  {/* Next page underneath (visible during forward flip) = toPages.right */}
                  {(isFlipping || isDragging) && (flipDirection === "next" || dragDirection === "forward") && toPages.right && (
                    <div className="absolute bg-paper overflow-hidden" style={{ width: pageWidth, height: pageHeight, left: isMobile ? 0 : pageWidth, zIndex: 5 }}>
                      <Page
                        key={`under-next-${toPages.right}`}
                        pageNumber={toPages.right}
                        width={renderWidth} renderTextLayer={false} renderAnnotationLayer={false}
                      />
                    </div>
                  )}

                  {/* Previous page underneath (visible during backward flip) = toPages.left */}
                  {(isFlipping || isDragging) && (flipDirection === "prev" || dragDirection === "backward") && !isMobile && toPages.left && (
                    <div className="absolute bg-paper overflow-hidden" style={{ width: pageWidth, height: pageHeight, left: 0, zIndex: 5 }}>
                      <Page key={`under-prev-${toPages.left}`} pageNumber={toPages.left} width={renderWidth} renderTextLayer={false} renderAnnotationLayer={false} />
                    </div>
                  )}

                  {/* Static Current Spread - always visible underneath */}
                  <div className="flex">
                    {!isMobile && left && (
                      <div className="bg-paper overflow-hidden relative" style={{ width: pageWidth, height: pageHeight, backfaceVisibility: "hidden", transform: "translate3d(0,0,0)" }}>
                        <Page key={`static-left-${left}`} pageNumber={left} width={renderWidth} renderTextLayer={false} renderAnnotationLayer={false} />
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-sm text-gray-700 bg-white/70 px-2 py-1 rounded">{left}</div>
                      </div>
                    )}
                    <div className={cn("bg-paper overflow-hidden relative", cover && "rounded-r-xl")} style={{ width: pageWidth, height: pageHeight, backfaceVisibility: "hidden", transform: "translate3d(0,0,0)" }}>
                      {cover && <div className="absolute inset-0 bg-gradient-to-l from-transparent to-black/30 pointer-events-none" />}
                      <Page key={`static-right-${right}`} pageNumber={right!} width={renderWidth} renderTextLayer={false} renderAnnotationLayer={false} />
                      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-sm text-gray-700 bg-white/70 px-2 py-1 rounded">{right}</div>
                      {cover && (
                        <div className="absolute inset-0 flex items-center justify-end pr-4 md:pr-12 pointer-events-none">
                          <span className="text-white/70 text-base md:text-xl animate-pulse">{isMobile ? "Swipe →" : "Drag or click to open →"}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </Document>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-3 bg-black/60 backdrop-blur-sm border-t border-white/10">
          <Button variant="ghost" onClick={() => flipTo("prev")} disabled={currentSpread === 0 || isFlipping || isDragging}>
            <ChevronLeft className="h-5 w-5 mr-2" /> {isMobile ? "" : "Previous"}
          </Button>
          <span className="text-sm text-white/80">
            {isMobile
              ? `Page ${right || 1} of ${numPages}`
              : `${cover ? "Cover" : `Pages ${left || ''} - ${right || ''}`} of ${numPages}`}
          </span>
          <Button variant="ghost" onClick={() => flipTo("next")} disabled={currentSpread >= maxSpreads - 1 || isFlipping || isDragging}>
            {isMobile ? "" : "Next"} <ChevronRight className="h-5 w-5 ml-2" />
          </Button>
        </div>

        <style jsx global>{`
          .bg-paper {
            background: #fdfcf8;
            background-image: 
              linear-gradient(to right, rgba(0,0,0,0.03) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(0,0,0,0.03) 1px, transparent 1px);
            background-size: 20px 20px;
            box-shadow: inset 8px 0 20px -8px rgba(0,0,0,0.3), inset -8px 0 20px -8px rgba(0,0,0,0.2);
          }
          canvas {
            image-rendering: -webkit-optimize-contrast;
            will-change: transform;
            transform: translate3d(0,0,0);
          }
          .react-pdf__Page {
            will-change: transform;
            transform: translate3d(0,0,0);
          }
        `}</style>
      </div>
    );
  }

  // Library view (unchanged)
  if (pdfFiles.length === 0) {
    return (
      <Card className="glass-card">
        <CardContent className="py-16 text-center">
          <Library className="h-12 w-12 mx-auto mb-4 text-amber-400" />
          <h3 className="text-xl font-semibold mb-2">No books available</h3>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20">
          <BookOpen className="h-6 w-6 text-amber-400" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Your Library</h2>
          <p className="text-sm text-muted-foreground">{pdfFiles.length} book{pdfFiles.length !== 1 ? "s" : ""}</p>
        </div>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {pdfFiles.map((file) => {
          const prog = progressMap[file.id];
          const percent = prog ? Math.round((prog.currentPage / prog.totalPages) * 100) : 0;
          return (
            <Card key={file.id} className="glass-card cursor-pointer hover:ring-2 hover:ring-amber-400/50 transition-all" onClick={() => openBook(file)}>
              <CardContent className="p-0">
                <div className="aspect-[3/4] bg-gradient-to-br from-amber-900/40 to-stone-800/60 flex items-center justify-center relative overflow-hidden rounded-t-lg">
                  <FileText className="h-20 w-20 text-amber-300/70" />
                  <div className="absolute bottom-0 left-0 right-0 h-2 bg-black/40">
                    <div className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all" style={{ width: `${percent}%` }} />
                  </div>
                  {prog?.currentPage > 1 && <Badge className="absolute top-3 right-3 bg-amber-600">Page {prog.currentPage}</Badge>}
                </div>
                <div className="p-5">
                  <h3 className="font-semibold line-clamp-2 mb-1">{file.name.replace(/\.pdf$/i, "")}</h3>
                  <p className="text-sm text-muted-foreground mb-3">{file.project.title}</p>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{formatFileSize(file.fileSize)}</span>
                    {prog && <span className="text-amber-500">{percent}% read</span>}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function TocList({ items, onClick }: { items: OutlineItem[]; onClick: (page: number) => void }) {
  return (
    <ul className="space-y-2 text-white/90">
      {items.map((item, i) => (
        <li key={i}>
          <Button variant="link" className="p-0 h-auto text-left" onClick={() => onClick(item.page)}>
            {item.title}
          </Button>
        </li>
      ))}
    </ul>
  );
}
