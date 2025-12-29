"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  Library,
} from "lucide-react";

// Dynamically import react-pdf components with SSR disabled
const Document = dynamic(
  () => import("react-pdf").then((mod) => mod.Document),
  { ssr: false }
);
const Page = dynamic(
  () => import("react-pdf").then((mod) => mod.Page),
  { ssr: false }
);

interface DigitalFile {
  id: string;
  name: string;
  fileName: string;
  fileSize: number;
  mimeType?: string;
  description?: string;
  project: {
    id: string;
    title: string;
    slug: string;
    imageUrl?: string;
  };
}

interface ReadingProgress {
  fileId: string;
  currentPage: number;
  totalPages: number;
  lastRead: string;
}

// Storage key prefix for reading progress
const READING_PROGRESS_KEY = "indiecrowdfund_reading_progress";

function getReadingProgress(fileId: string): ReadingProgress | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(`${READING_PROGRESS_KEY}_${fileId}`);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function saveReadingProgress(progress: ReadingProgress): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      `${READING_PROGRESS_KEY}_${progress.fileId}`,
      JSON.stringify(progress)
    );
  } catch (e) {
    console.error("Failed to save reading progress:", e);
  }
}

export function BookReaderTab() {
  const [pdfFiles, setPdfFiles] = useState<DigitalFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<DigitalFile | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentSpread, setCurrentSpread] = useState<number>(0); // 0 = cover, 1 = pages 1-2, etc.
  const [scale, setScale] = useState<number>(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [progressMap, setProgressMap] = useState<Record<string, ReadingProgress>>({});
  const [pdfReady, setPdfReady] = useState(false);
  const [isFlipping, setIsFlipping] = useState(false);
  const [flipDirection, setFlipDirection] = useState<"next" | "prev" | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragProgress, setDragProgress] = useState(0);
  const [dragStartX, setDragStartX] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [currentPage, setCurrentPage] = useState(1); // For mobile single-page view
  const bookRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const flipToNextRef = useRef<() => void>(() => {});

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Configure PDF.js worker on client side only
  useEffect(() => {
    import("react-pdf").then((pdfModule) => {
      pdfModule.pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfModule.pdfjs.version}/build/pdf.worker.min.mjs`;
      setPdfReady(true);
    });
  }, []);

  useEffect(() => {
    fetchPdfFiles();
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const fetchPdfFiles = async () => {
    try {
      const response = await fetch("/api/backer/digital-files", {
        headers: { ...getCSRFHeaders() },
      });
      if (!response.ok) {
        throw new Error("Failed to fetch digital files");
      }
      const data = await response.json();

      // Filter only PDF files
      const pdfs = (data.files || []).filter(
        (file: DigitalFile & { mimeType?: string; fileName: string }) =>
          file.mimeType === "application/pdf" ||
          file.fileName?.toLowerCase().endsWith(".pdf")
      );

      setPdfFiles(pdfs);

      // Load reading progress for each file
      const progress: Record<string, ReadingProgress> = {};
      pdfs.forEach((file: DigitalFile) => {
        const p = getReadingProgress(file.id);
        if (p) progress[file.id] = p;
      });
      setProgressMap(progress);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const openBook = async (file: DigitalFile) => {
    setLoadingPdf(true);
    setPdfError(null);
    setSelectedFile(file);

    try {
      const response = await fetch("/api/backer/digital-files", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getCSRFHeaders(),
        },
        body: JSON.stringify({ fileId: file.id }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to load PDF");
      }

      const { downloadUrl } = await response.json();
      setPdfUrl(downloadUrl);

      // Restore reading progress
      const progress = getReadingProgress(file.id);
      if (progress) {
        // Set current page for mobile view
        setCurrentPage(progress.currentPage);
        // Convert page number to spread for desktop view
        setCurrentSpread(Math.floor((progress.currentPage - 1) / 2));
      } else {
        setCurrentPage(1);
        setCurrentSpread(0);
      }
    } catch (err) {
      console.error("Error loading PDF:", err);
      setPdfError(err instanceof Error ? err.message : "Failed to load PDF");
    } finally {
      setLoadingPdf(false);
    }
  };

  // Get current page number from spread
  const getCurrentPage = useCallback(() => {
    if (currentSpread === 0) return 1; // Cover
    return currentSpread * 2; // Two pages per spread after cover
  }, [currentSpread]);

  const closeBook = useCallback(() => {
    // Save progress before closing
    if (selectedFile && numPages > 0) {
      // Use mobile currentPage state if on mobile, otherwise calculate from spread
      const pageToSave = isMobile ? currentPage : getCurrentPage();
      saveReadingProgress({
        fileId: selectedFile.id,
        currentPage: pageToSave,
        totalPages: numPages,
        lastRead: new Date().toISOString(),
      });
      setProgressMap(prev => ({
        ...prev,
        [selectedFile.id]: {
          fileId: selectedFile.id,
          currentPage: pageToSave,
          totalPages: numPages,
          lastRead: new Date().toISOString(),
        },
      }));
    }

    setSelectedFile(null);
    setPdfUrl(null);
    setNumPages(0);
    setCurrentSpread(0);
    setCurrentPage(1);
    setScale(1.0);
    setIsFullscreen(false);
    setPdfError(null);
  }, [selectedFile, numPages, getCurrentPage, isMobile, currentPage]);

  const handleDocumentLoadSuccess = useCallback(({ numPages: pages }: { numPages: number }) => {
    setNumPages(pages);
  }, []);

  const handleDocumentLoadError = useCallback((error: Error) => {
    console.error("PDF load error:", error);
    setPdfError("Failed to load PDF document");
  }, []);

  // Calculate max spreads (cover + page pairs)
  const maxSpreads = Math.ceil((numPages + 1) / 2);

  const goToSpread = (spread: number) => {
    const newSpread = Math.max(0, Math.min(spread, maxSpreads - 1));
    setCurrentSpread(newSpread);

    // Auto-save progress
    if (selectedFile) {
      const currentPage = newSpread === 0 ? 1 : newSpread * 2;
      saveReadingProgress({
        fileId: selectedFile.id,
        currentPage,
        totalPages: numPages,
        lastRead: new Date().toISOString(),
      });
    }
  };

  const flipToNext = () => {
    if (isFlipping) return;

    if (isMobile) {
      // Mobile: go page by page
      if (currentPage >= numPages) return;
      setFlipDirection("next");
      setIsFlipping(true);
      setTimeout(() => {
        setCurrentPage(prev => Math.min(prev + 1, numPages));
        // Save progress
        if (selectedFile) {
          saveReadingProgress({
            fileId: selectedFile.id,
            currentPage: currentPage + 1,
            totalPages: numPages,
            lastRead: new Date().toISOString(),
          });
        }
        setTimeout(() => {
          setIsFlipping(false);
          setFlipDirection(null);
        }, 100);
      }, 400);
    } else {
      // Desktop: go spread by spread
      if (currentSpread >= maxSpreads - 1) return;
      setFlipDirection("next");
      setIsFlipping(true);
      setTimeout(() => {
        goToSpread(currentSpread + 1);
        setTimeout(() => {
          setIsFlipping(false);
          setFlipDirection(null);
        }, 100);
      }, 500);
    }
  };

  // Keep ref updated for use in handleDragEnd
  flipToNextRef.current = flipToNext;

  const flipToPrev = () => {
    if (isFlipping) return;

    if (isMobile) {
      // Mobile: go page by page
      if (currentPage <= 1) return;
      setFlipDirection("prev");
      setIsFlipping(true);
      setTimeout(() => {
        setCurrentPage(prev => Math.max(prev - 1, 1));
        // Save progress
        if (selectedFile) {
          saveReadingProgress({
            fileId: selectedFile.id,
            currentPage: currentPage - 1,
            totalPages: numPages,
            lastRead: new Date().toISOString(),
          });
        }
        setTimeout(() => {
          setIsFlipping(false);
          setFlipDirection(null);
        }, 100);
      }, 400);
    } else {
      // Desktop: go spread by spread
      if (currentSpread <= 0) return;
      setFlipDirection("prev");
      setIsFlipping(true);
      setTimeout(() => {
        goToSpread(currentSpread - 1);
        setTimeout(() => {
          setIsFlipping(false);
          setFlipDirection(null);
        }, 100);
      }, 500);
    }
  };

  // Drag handlers for page turning
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (isFlipping) return;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    setIsDragging(true);
    setDragStartX(clientX);
    setDragProgress(0);
  };

  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging) return;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const delta = dragStartX - clientX;
    const containerWidth = bookRef.current?.offsetWidth || 800;
    const progress = Math.max(0, Math.min(1, delta / (containerWidth * 0.5)));
    setDragProgress(progress);
  }, [isDragging, dragStartX]);

  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);

    if (dragProgress > 0.3) {
      // Complete the flip using ref to avoid dependency cycle
      flipToNextRef.current();
    }
    setDragProgress(0);
  }, [isDragging, dragProgress]);

  // Attach global mouse/touch listeners for drag
  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleDragMove);
      window.addEventListener("mouseup", handleDragEnd);
      window.addEventListener("touchmove", handleDragMove);
      window.addEventListener("touchend", handleDragEnd);
    }
    return () => {
      window.removeEventListener("mousemove", handleDragMove);
      window.removeEventListener("mouseup", handleDragEnd);
      window.removeEventListener("touchmove", handleDragMove);
      window.removeEventListener("touchend", handleDragEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  const adjustScale = (delta: number) => {
    setScale((prev) => Math.max(0.5, Math.min(2.0, prev + delta)));
  };

  const resetScale = () => setScale(1.0);

  const toggleFullscreen = () => setIsFullscreen(!isFullscreen);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getProgressPercent = (fileId: string) => {
    const progress = progressMap[fileId];
    if (!progress || progress.totalPages === 0) return 0;
    return Math.round((progress.currentPage / progress.totalPages) * 100);
  };

  // Get pages for current spread
  // Spread 0 = Cover (page 1 from PDF, shown as closed book)
  // Spread 1 = Pages 2-3
  // Spread 2 = Pages 4-5, etc.
  const getSpreadPages = () => {
    if (currentSpread === 0) {
      return { left: null, right: null, cover: 1 }; // Cover page (first page of PDF)
    }
    // After cover: spread 1 = pages 2-3, spread 2 = pages 4-5, etc.
    const leftPage = currentSpread * 2;
    const rightPage = currentSpread * 2 + 1;
    return {
      left: leftPage <= numPages ? leftPage : null,
      right: rightPage <= numPages ? rightPage : null,
      cover: null,
    };
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="glass-card">
        <CardContent className="py-12 text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
          <h3 className="text-lg font-semibold mb-2">Failed to load books</h3>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={fetchPdfFiles}>Try Again</Button>
        </CardContent>
      </Card>
    );
  }

  // PDF Reader View - Book Format
  if (selectedFile && pdfUrl) {
    const spreadPages = getSpreadPages();
    const isCoverPage = currentSpread === 0;

    return (
      <div
        className={cn(
          "flex flex-col bg-gradient-to-b from-stone-900 via-stone-800 to-stone-900",
          isFullscreen
            ? "fixed inset-0 z-50"
            : "relative rounded-xl overflow-hidden"
        )}
      >
        {/* Reader Header */}
        <div className="flex items-center justify-between p-3 bg-black/40 backdrop-blur-sm border-b border-white/10">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={closeBook} className="text-white/80 hover:text-white hover:bg-white/10">
              <X className="h-5 w-5" />
            </Button>
            <div>
              <h3 className="font-semibold line-clamp-1 text-white/90">{selectedFile.name}</h3>
              <p className="text-xs text-white/50">
                {selectedFile.project.title}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Zoom controls */}
            <div className="hidden sm:flex items-center gap-1 mr-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => adjustScale(-0.1)}
                disabled={scale <= 0.5}
                className="text-white/70 hover:text-white hover:bg-white/10"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-sm w-12 text-center text-white/70">
                {Math.round(scale * 100)}%
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => adjustScale(0.1)}
                disabled={scale >= 2.0}
                className="text-white/70 hover:text-white hover:bg-white/10"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={resetScale} className="text-white/70 hover:text-white hover:bg-white/10">
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
            <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="text-white/70 hover:text-white hover:bg-white/10">
              {isFullscreen ? (
                <Minimize2 className="h-5 w-5" />
              ) : (
                <Maximize2 className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>

        {/* Book Content */}
        <div
          className={cn(
            "flex-1 overflow-hidden flex items-center justify-center p-4 md:p-8",
            isFullscreen ? "h-[calc(100vh-120px)]" : "h-[650px]"
          )}
          style={{ perspective: "2000px" }}
        >
          {loadingPdf || !pdfReady ? (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400 mb-4" />
              <p className="text-white/60">Opening book...</p>
            </div>
          ) : pdfError ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <AlertCircle className="h-12 w-12 text-red-400 mb-4" />
              <p className="text-lg font-semibold mb-2 text-white">Failed to Load PDF</p>
              <p className="text-white/60 mb-4">{pdfError}</p>
              <Button onClick={() => openBook(selectedFile)} className="bg-amber-600 hover:bg-amber-700">Try Again</Button>
            </div>
          ) : pdfReady ? (
            <>
              {/* Mobile Single Page View */}
              {isMobile ? (
                <div
                  ref={bookRef}
                  className="relative w-full h-full flex items-center justify-center"
                  style={{ perspective: "1500px" }}
                >
                  {/* Current Page */}
                  <div
                    className={cn(
                      "relative bg-[#f5f0e6] shadow-2xl overflow-hidden select-none",
                      "cursor-grab active:cursor-grabbing",
                      !isDragging && !isFlipping && "transition-transform duration-300 ease-out"
                    )}
                    style={{
                      width: "min(90vw, 380px)",
                      height: "min(130vw, 550px)",
                      boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
                      backgroundImage: "linear-gradient(to right, #e8e0d0 0%, #f5f0e6 5%, #f8f5ef 95%, #e8e0d0 100%)",
                      borderRadius: "4px",
                      transformOrigin: "left center",
                      transform: isDragging
                        ? `rotateY(${-dragProgress * 45}deg)`
                        : isFlipping && flipDirection === "next"
                        ? "rotateY(-90deg)"
                        : isFlipping && flipDirection === "prev"
                        ? "rotateY(90deg)"
                        : "rotateY(0deg)",
                      transformStyle: "preserve-3d",
                      backfaceVisibility: "hidden",
                    }}
                    onMouseDown={handleDragStart}
                    onTouchStart={handleDragStart}
                  >
                    {/* Paper Texture */}
                    <div className="absolute inset-0 opacity-20 pointer-events-none"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%' height='100%' filter='url(%23noise)' opacity='0.15'/%3E%3C/svg%3E")`,
                      }}
                    />
                    {/* Page Content */}
                    <div className="relative z-10 flex items-center justify-center h-full">
                      <Document
                        file={pdfUrl}
                        onLoadSuccess={handleDocumentLoadSuccess}
                        onLoadError={handleDocumentLoadError}
                        loading={null}
                      >
                        <Page
                          pageNumber={currentPage}
                          width={Math.min(window.innerWidth * 0.85, 360)}
                          renderTextLayer={false}
                          renderAnnotationLayer={false}
                          loading={
                            <div className="flex items-center justify-center h-full">
                              <div className="animate-pulse text-stone-400">Loading...</div>
                            </div>
                          }
                        />
                      </Document>
                    </div>
                    {/* Page Number */}
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs text-stone-500 bg-white/60 px-2 py-0.5 rounded">
                      {currentPage}
                    </div>
                    {/* Edge shadows */}
                    <div className="absolute inset-y-0 left-0 w-4 bg-gradient-to-r from-black/10 to-transparent pointer-events-none" />
                    <div className="absolute inset-y-0 right-0 w-4 bg-gradient-to-l from-black/10 to-transparent pointer-events-none" />
                  </div>

                  {/* Next Page Preview (behind current) */}
                  {isDragging && dragProgress > 0.1 && currentPage < numPages && (
                    <div
                      className="absolute bg-[#f5f0e6] shadow-xl overflow-hidden"
                      style={{
                        width: "min(90vw, 380px)",
                        height: "min(130vw, 550px)",
                        opacity: Math.min(1, dragProgress * 2),
                        zIndex: -1,
                        borderRadius: "4px",
                        backgroundImage: "linear-gradient(to right, #e8e0d0 0%, #f5f0e6 5%, #f8f5ef 95%, #e8e0d0 100%)",
                      }}
                    >
                      <div className="relative z-10 flex items-center justify-center h-full">
                        <Document file={pdfUrl} loading={null}>
                          <Page
                            pageNumber={currentPage + 1}
                            width={Math.min(window.innerWidth * 0.85, 360)}
                            renderTextLayer={false}
                            renderAnnotationLayer={false}
                            loading={<div className="animate-pulse text-stone-400">Loading...</div>}
                          />
                        </Document>
                      </div>
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs text-stone-500 bg-white/60 px-2 py-0.5 rounded">
                        {currentPage + 1}
                      </div>
                    </div>
                  )}

                  {/* Swipe hint */}
                  {currentPage === 1 && !isDragging && (
                    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-2 text-white/40 text-xs animate-pulse">
                      <span>Swipe to turn pages</span>
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  )}
                </div>
              ) : (
                /* Desktop Two-Page Spread View */
                <div
                  ref={bookRef}
                  className="relative"
                  style={{
                    transform: `scale(${scale})`,
                    transformOrigin: "center center",
                    transition: "transform 0.3s ease",
                  }}
                >
                  {/* Book Container */}
                  <div
                    className={cn(
                      "relative flex",
                      isCoverPage ? "justify-center" : "justify-center"
                    )}
                    style={{
                      transformStyle: "preserve-3d",
                    }}
                  >
                    {/* Book Spine Shadow */}
                    {!isCoverPage && (
                      <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-8 z-20 pointer-events-none">
                        <div className="h-full bg-gradient-to-r from-black/40 via-black/60 to-black/40" />
                      </div>
                    )}

                {/* Next Spread Preview - Visible when dragging any page */}
                {isDragging && dragProgress > 0.1 && (
                  <div
                    className="absolute flex"
                    style={{
                      opacity: Math.min(1, dragProgress * 2),
                      zIndex: 0,
                    }}
                  >
                    {/* Calculate next spread pages */}
                    {(() => {
                      const nextSpread = currentSpread + 1;
                      const nextLeftPage = isCoverPage ? 2 : nextSpread * 2;
                      const nextRightPage = isCoverPage ? 3 : nextSpread * 2 + 1;
                      return (
                        <>
                          {/* Left Page of Next Spread */}
                          <div
                            className="relative bg-[#f5f0e6] overflow-hidden"
                            style={{
                              width: "min(45vw, 400px)",
                              height: "min(60vw, 550px)",
                              boxShadow: "-4px 0 20px rgba(0,0,0,0.3)",
                              backgroundImage: "linear-gradient(to right, #e8e0d0 0%, #f5f0e6 3%, #f8f5ef 100%)",
                            }}
                          >
                            <div className="relative z-10 flex items-center justify-center h-full">
                              {nextLeftPage <= numPages && (
                                <Document file={pdfUrl} loading={null}>
                                  <Page
                                    pageNumber={nextLeftPage}
                                    width={Math.min(window.innerWidth * 0.4, 380)}
                                    renderTextLayer={false}
                                    renderAnnotationLayer={false}
                                    loading={<div className="animate-pulse text-stone-400">Loading...</div>}
                                  />
                                </Document>
                              )}
                            </div>
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-stone-400">{nextLeftPage}</div>
                          </div>
                          {/* Spine */}
                          <div className="w-8 bg-gradient-to-r from-black/40 via-black/60 to-black/40" />
                          {/* Right Page of Next Spread */}
                          <div
                            className="relative bg-[#f5f0e6] overflow-hidden"
                            style={{
                              width: "min(45vw, 400px)",
                              height: "min(60vw, 550px)",
                              boxShadow: "4px 0 20px rgba(0,0,0,0.3)",
                              backgroundImage: "linear-gradient(to left, #e8e0d0 0%, #f5f0e6 3%, #f8f5ef 100%)",
                            }}
                          >
                            <div className="relative z-10 flex items-center justify-center h-full">
                              {nextRightPage <= numPages && (
                                <Document file={pdfUrl} loading={null}>
                                  <Page
                                    pageNumber={nextRightPage}
                                    width={Math.min(window.innerWidth * 0.4, 380)}
                                    renderTextLayer={false}
                                    renderAnnotationLayer={false}
                                    loading={<div className="animate-pulse text-stone-400">Loading...</div>}
                                  />
                                </Document>
                              )}
                            </div>
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-stone-400">{nextRightPage}</div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* Left Page */}
                {!isCoverPage && (
                  <div
                    className={cn(
                      "relative bg-[#f5f0e6] shadow-2xl overflow-hidden",
                      "transition-transform duration-500 ease-in-out origin-right",
                      isFlipping && flipDirection === "prev" && "animate-page-flip-reverse"
                    )}
                    style={{
                      width: "min(45vw, 400px)",
                      height: "min(60vw, 550px)",
                      boxShadow: "-4px 0 20px rgba(0,0,0,0.4), inset 2px 0 8px rgba(0,0,0,0.1)",
                      backgroundImage: "linear-gradient(to right, #e8e0d0 0%, #f5f0e6 3%, #f8f5ef 100%)",
                    }}
                  >
                    {/* Paper Texture Overlay */}
                    <div className="absolute inset-0 opacity-30 pointer-events-none"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%' height='100%' filter='url(%23noise)' opacity='0.15'/%3E%3C/svg%3E")`,
                      }}
                    />
                    {/* Page Content */}
                    <div className="relative z-10 flex items-center justify-center h-full">
                      {spreadPages.left && (
                        <Document file={pdfUrl} loading={null}>
                          <Page
                            pageNumber={spreadPages.left}
                            width={Math.min(window.innerWidth * 0.4, 380)}
                            renderTextLayer={false}
                            renderAnnotationLayer={false}
                            loading={
                              <div className="flex items-center justify-center h-full">
                                <div className="animate-pulse text-stone-400">Loading...</div>
                              </div>
                            }
                          />
                        </Document>
                      )}
                    </div>
                    {/* Page Number */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-stone-400">
                      {spreadPages.left}
                    </div>
                    {/* Inner Shadow */}
                    <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-black/10 to-transparent pointer-events-none" />
                  </div>
                )}

                {/* Right Page / Cover */}
                <div
                  ref={pageRef}
                  className={cn(
                    "relative overflow-hidden select-none",
                    isCoverPage ? "cursor-grab active:cursor-grabbing" : "origin-left",
                    isFlipping && flipDirection === "next" && "animate-page-flip",
                    !isDragging && !isFlipping && "transition-transform duration-300 ease-out"
                  )}
                  style={{
                    width: isCoverPage ? "min(50vw, 450px)" : "min(45vw, 400px)",
                    height: isCoverPage ? "min(65vw, 600px)" : "min(60vw, 550px)",
                    backgroundColor: isCoverPage ? "#1a1510" : "#f5f0e6",
                    boxShadow: isCoverPage
                      ? `0 25px 50px -12px rgba(0, 0, 0, ${0.6 + dragProgress * 0.2}), ${8 - dragProgress * 8}px 0 30px rgba(0,0,0,0.4)`
                      : "4px 0 20px rgba(0,0,0,0.4), inset -2px 0 8px rgba(0,0,0,0.1)",
                    backgroundImage: isCoverPage
                      ? "linear-gradient(135deg, #2a2015 0%, #1a1510 50%, #0f0a05 100%)"
                      : "linear-gradient(to left, #e8e0d0 0%, #f5f0e6 3%, #f8f5ef 100%)",
                    borderRadius: isCoverPage ? "0 8px 8px 0" : "0",
                    transformOrigin: "left center",
                    transform: isDragging
                      ? `rotateY(${-dragProgress * 180}deg)`
                      : "rotateY(0deg)",
                    transformStyle: "preserve-3d",
                    backfaceVisibility: "hidden",
                  }}
                  onMouseDown={isCoverPage ? handleDragStart : undefined}
                  onTouchStart={isCoverPage ? handleDragStart : undefined}
                >
                  {/* Cover Design - Render PDF Page 1 */}
                  {isCoverPage && (
                    <>
                      {/* Book Cover Frame */}
                      <div className="absolute inset-0 rounded-r-lg overflow-hidden">
                        {/* Render PDF Page 1 as the cover */}
                        <Document
                          file={pdfUrl}
                          onLoadSuccess={handleDocumentLoadSuccess}
                          onLoadError={handleDocumentLoadError}
                          loading={null}
                        >
                          <Page
                            pageNumber={1}
                            width={Math.min(window.innerWidth * 0.45, 430)}
                            renderTextLayer={false}
                            renderAnnotationLayer={false}
                            className="[&>canvas]:rounded-r-lg"
                            loading={
                              <div className="flex items-center justify-center h-full bg-stone-800">
                                <div className="animate-pulse text-stone-400">Loading cover...</div>
                              </div>
                            }
                          />
                        </Document>
                      </div>
                      {/* Subtle overlay for depth */}
                      <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-black/20 pointer-events-none" />
                      {/* Gold corner accents */}
                      <div className="absolute top-3 right-3 w-8 h-8 border-t-2 border-r-2 border-amber-500/30 rounded-tr" />
                      <div className="absolute bottom-3 right-3 w-8 h-8 border-b-2 border-r-2 border-amber-500/30 rounded-br" />
                      {/* Spine Effect */}
                      <div className="absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
                      {/* Page count badge */}
                      <div className="absolute bottom-4 right-4 px-2 py-1 bg-black/60 rounded text-xs text-amber-200/80 backdrop-blur-sm">
                        {numPages} pages
                      </div>
                      {/* Drag hint */}
                      <div className="absolute top-1/2 right-2 -translate-y-1/2 flex items-center gap-1 text-white/40 text-xs animate-pulse">
                        <ChevronLeft className="h-4 w-4" />
                        <span className="hidden sm:inline">Drag to open</span>
                      </div>
                    </>
                  )}

                  {/* Regular Page Content */}
                  {!isCoverPage && (
                    <>
                      {/* Paper Texture */}
                      <div className="absolute inset-0 opacity-30 pointer-events-none"
                        style={{
                          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%' height='100%' filter='url(%23noise)' opacity='0.15'/%3E%3C/svg%3E")`,
                        }}
                      />
                      <div className="relative z-10 flex items-center justify-center h-full">
                        {spreadPages.right && (
                          <Document file={pdfUrl} loading={null}>
                            <Page
                              pageNumber={spreadPages.right}
                              width={Math.min(window.innerWidth * 0.4, 380)}
                              renderTextLayer={false}
                              renderAnnotationLayer={false}
                              loading={
                                <div className="flex items-center justify-center h-full">
                                  <div className="animate-pulse text-stone-400">Loading...</div>
                                </div>
                              }
                            />
                          </Document>
                        )}
                      </div>
                      {/* Page Number */}
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-stone-400">
                        {spreadPages.right}
                      </div>
                      {/* Inner Shadow */}
                      <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-black/10 to-transparent pointer-events-none" />
                    </>
                  )}
                </div>

                {/* Page Turn Overlay - Next */}
                {isFlipping && flipDirection === "next" && (
                  <div
                    className="absolute top-0 right-0 bg-[#f5f0e6] origin-left z-30"
                    style={{
                      width: isCoverPage ? "min(50vw, 450px)" : "min(45vw, 400px)",
                      height: isCoverPage ? "min(65vw, 600px)" : "min(60vw, 550px)",
                      animation: "pageFlip 0.6s ease-in-out forwards",
                      boxShadow: "-5px 0 30px rgba(0,0,0,0.3)",
                      backgroundImage: "linear-gradient(to left, #e8e0d0 0%, #f5f0e6 100%)",
                    }}
                  />
                )}

                {/* Page Turn Overlay - Prev */}
                {isFlipping && flipDirection === "prev" && (
                  <div
                    className="absolute top-0 left-0 bg-[#f5f0e6] origin-right z-30"
                    style={{
                      width: "min(45vw, 400px)",
                      height: "min(60vw, 550px)",
                      animation: "pageFlipReverse 0.6s ease-in-out forwards",
                      boxShadow: "5px 0 30px rgba(0,0,0,0.3)",
                      backgroundImage: "linear-gradient(to right, #e8e0d0 0%, #f5f0e6 100%)",
                    }}
                  />
                )}
              </div>

              {/* Click/Drag Areas for Page Turn */}
              {/* Left side - click to go back */}
              <div
                className="absolute top-0 left-0 w-1/3 h-full cursor-pointer z-40 group"
                onClick={flipToPrev}
                style={{ display: currentSpread === 0 ? "none" : "block" }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-black/0 to-transparent opacity-0 group-hover:opacity-20 transition-opacity" />
                <div className="absolute left-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ChevronLeft className="h-12 w-12 text-white/60" />
                </div>
              </div>
              {/* Right side - click or drag to go forward */}
              <div
                className={cn(
                  "absolute top-0 right-0 w-1/3 h-full z-40 group select-none",
                  !isCoverPage && "cursor-grab active:cursor-grabbing"
                )}
                onClick={!isDragging ? flipToNext : undefined}
                onMouseDown={!isCoverPage ? handleDragStart : undefined}
                onTouchStart={!isCoverPage ? handleDragStart : undefined}
                style={{ display: currentSpread >= maxSpreads - 1 ? "none" : "block" }}
              >
                <div className="absolute inset-0 bg-gradient-to-l from-black/0 to-transparent opacity-0 group-hover:opacity-20 transition-opacity" />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                  <span className="text-white/40 text-xs hidden sm:inline">Drag or click</span>
                  <ChevronRight className="h-12 w-12 text-white/60" />
                </div>
              </div>
            </div>
          )}
          </>
          ) : null}
        </div>

        {/* Reader Footer - Navigation */}
        <div className="flex items-center justify-between p-3 bg-black/40 backdrop-blur-sm border-t border-white/10">
          <Button
            variant="ghost"
            onClick={flipToPrev}
            disabled={isMobile ? currentPage <= 1 : currentSpread <= 0 || isFlipping}
            className="gap-2 text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30"
          >
            <ChevronLeft className="h-5 w-5" />
            <span className="hidden sm:inline">Previous</span>
          </Button>

          <div className="flex items-center gap-4">
            <span className="text-sm text-white/60 whitespace-nowrap">
              {isMobile
                ? `Page ${currentPage} of ${numPages}`
                : isCoverPage
                ? "Cover"
                : `Pages ${spreadPages.left || ""}-${spreadPages.right || ""}`} {!isMobile && `of ${numPages}`}
            </span>
            {/* Page dots indicator - only on desktop */}
            <div className="hidden md:flex gap-1.5">
              {Array.from({ length: Math.min(isMobile ? numPages : maxSpreads, 10) }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => isMobile ? setCurrentPage(i + 1) : goToSpread(i)}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all duration-300",
                    (isMobile ? currentPage === i + 1 : currentSpread === i)
                      ? "bg-amber-400 scale-125"
                      : "bg-white/30 hover:bg-white/50"
                  )}
                />
              ))}
              {(isMobile ? numPages : maxSpreads) > 10 && <span className="text-white/30 text-xs">...</span>}
            </div>
          </div>

          <Button
            variant="ghost"
            onClick={flipToNext}
            disabled={isMobile ? currentPage >= numPages : currentSpread >= maxSpreads - 1 || isFlipping}
            className="gap-2 text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {/* CSS Animations */}
        <style jsx global>{`
          @keyframes pageFlip {
            0% {
              transform: rotateY(0deg);
            }
            100% {
              transform: rotateY(-180deg);
            }
          }
          @keyframes pageFlipReverse {
            0% {
              transform: rotateY(-180deg);
            }
            100% {
              transform: rotateY(0deg);
            }
          }
          @keyframes mobilePageFlipNext {
            0% {
              transform: rotateY(0deg) scale(1);
              opacity: 1;
            }
            50% {
              transform: rotateY(-45deg) scale(0.95);
              opacity: 0.8;
            }
            100% {
              transform: rotateY(-90deg) scale(0.9);
              opacity: 0;
            }
          }
          @keyframes mobilePageFlipPrev {
            0% {
              transform: rotateY(0deg) scale(1);
              opacity: 1;
            }
            50% {
              transform: rotateY(45deg) scale(0.95);
              opacity: 0.8;
            }
            100% {
              transform: rotateY(90deg) scale(0.9);
              opacity: 0;
            }
          }
          .animate-page-flip {
            animation: pageFlip 0.6s ease-in-out forwards;
          }
          .animate-page-flip-reverse {
            animation: pageFlipReverse 0.6s ease-in-out forwards;
          }
          @media (max-width: 767px) {
            .animate-page-flip {
              animation: mobilePageFlipNext 0.4s ease-in-out forwards;
            }
            .animate-page-flip-reverse {
              animation: mobilePageFlipPrev 0.4s ease-in-out forwards;
            }
          }
        `}</style>
      </div>
    );
  }

  // Empty state
  if (pdfFiles.length === 0) {
    return (
      <Card
        className={cn(
          "glass-card transition-all duration-500",
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        )}
      >
        <CardContent className="py-16 text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 glow-pulse" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Library className="h-10 w-10 text-amber-400" />
            </div>
          </div>
          <h3 className="text-xl font-semibold mb-2">No PDF books available</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            When creators share PDF books, ebooks, or documents as digital
            rewards, they&apos;ll appear here for you to read.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Book Library View
  return (
    <div
      className={cn(
        "space-y-6 transition-all duration-500",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20">
            <BookOpen className="h-6 w-6 text-amber-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Your Library</h2>
            <p className="text-sm text-muted-foreground">
              {pdfFiles.length} PDF{pdfFiles.length !== 1 ? "s" : ""} available
            </p>
          </div>
        </div>
      </div>

      {/* Book Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pdfFiles.map((file, index) => {
          const progress = progressMap[file.id];
          const progressPercent = getProgressPercent(file.id);

          return (
            <Card
              key={file.id}
              className={cn(
                "glass-card glass-card-hover group cursor-pointer overflow-hidden transition-all duration-300",
                progress && "ring-1 ring-amber-500/30"
              )}
              style={{ animationDelay: `${index * 50}ms` }}
              onClick={() => openBook(file)}
            >
              <CardContent className="p-0">
                {/* Book Cover Placeholder */}
                <div className="relative aspect-[3/4] bg-gradient-to-br from-amber-900/40 via-stone-800/40 to-amber-900/40 flex items-center justify-center overflow-hidden">
                  <div className="absolute inset-0 bg-grid-white/5" />
                  {/* Faux book cover design */}
                  <div className="absolute inset-4 border border-amber-500/20 rounded-sm" />
                  <div className="flex flex-col items-center justify-center p-4 text-center">
                    <FileText className="h-12 w-12 text-amber-400/60 mb-2 group-hover:scale-110 transition-transform" />
                    <span className="text-amber-200/80 text-sm font-serif line-clamp-3">
                      {file.name.replace(/\.pdf$/i, "")}
                    </span>
                  </div>

                  {/* Progress indicator */}
                  {progress && progressPercent > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/40">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-orange-500"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  )}

                  {/* Continue reading badge */}
                  {progress && progress.currentPage > 1 && (
                    <Badge className="absolute top-2 right-2 bg-amber-600/90 text-white text-xs">
                      <Bookmark className="h-3 w-3 mr-1" />
                      Page {progress.currentPage}
                    </Badge>
                  )}
                </div>

                {/* Book Info */}
                <div className="p-4">
                  <h3 className="font-semibold line-clamp-2 mb-1 group-hover:text-amber-500 transition-colors">
                    {file.name}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    {file.project.title}
                  </p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatFileSize(file.fileSize)}</span>
                    {progress && (
                      <span className="text-amber-500">
                        {progressPercent}% read
                      </span>
                    )}
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
