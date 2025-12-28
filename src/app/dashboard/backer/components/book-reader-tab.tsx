"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { getCSRFHeaders } from "@/lib/csrf";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
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
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [progressMap, setProgressMap] = useState<Record<string, ReadingProgress>>({});
  const [pdfReady, setPdfReady] = useState(false);

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
        setPageNumber(progress.currentPage);
      } else {
        setPageNumber(1);
      }
    } catch (err) {
      console.error("Error loading PDF:", err);
      setPdfError(err instanceof Error ? err.message : "Failed to load PDF");
    } finally {
      setLoadingPdf(false);
    }
  };

  const closeBook = useCallback(() => {
    // Save progress before closing
    if (selectedFile && numPages > 0) {
      saveReadingProgress({
        fileId: selectedFile.id,
        currentPage: pageNumber,
        totalPages: numPages,
        lastRead: new Date().toISOString(),
      });
      setProgressMap(prev => ({
        ...prev,
        [selectedFile.id]: {
          fileId: selectedFile.id,
          currentPage: pageNumber,
          totalPages: numPages,
          lastRead: new Date().toISOString(),
        },
      }));
    }

    setSelectedFile(null);
    setPdfUrl(null);
    setNumPages(0);
    setPageNumber(1);
    setScale(1.0);
    setIsFullscreen(false);
    setPdfError(null);
  }, [selectedFile, numPages, pageNumber]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const onDocumentLoadError = (error: Error) => {
    console.error("PDF load error:", error);
    setPdfError("Failed to load PDF document");
  };

  const goToPage = (page: number) => {
    const newPage = Math.max(1, Math.min(page, numPages));
    setPageNumber(newPage);

    // Auto-save progress
    if (selectedFile) {
      saveReadingProgress({
        fileId: selectedFile.id,
        currentPage: newPage,
        totalPages: numPages,
        lastRead: new Date().toISOString(),
      });
    }
  };

  const prevPage = () => goToPage(pageNumber - 1);
  const nextPage = () => goToPage(pageNumber + 1);

  const adjustScale = (delta: number) => {
    setScale((prev) => Math.max(0.5, Math.min(2.5, prev + delta)));
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

  // PDF Reader View
  if (selectedFile && pdfUrl) {
    return (
      <div
        className={cn(
          "flex flex-col bg-background",
          isFullscreen
            ? "fixed inset-0 z-50"
            : "relative rounded-xl border border-border/50 overflow-hidden"
        )}
      >
        {/* Reader Header */}
        <div className="flex items-center justify-between p-4 border-b bg-card/80 backdrop-blur">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={closeBook}>
              <X className="h-5 w-5" />
            </Button>
            <div>
              <h3 className="font-semibold line-clamp-1">{selectedFile.name}</h3>
              <p className="text-xs text-muted-foreground">
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
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-sm w-12 text-center">
                {Math.round(scale * 100)}%
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => adjustScale(0.1)}
                disabled={scale >= 2.5}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={resetScale}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
            <Button variant="ghost" size="icon" onClick={toggleFullscreen}>
              {isFullscreen ? (
                <Minimize2 className="h-5 w-5" />
              ) : (
                <Maximize2 className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>

        {/* PDF Content */}
        <div
          className={cn(
            "flex-1 overflow-auto flex items-start justify-center bg-muted/30 p-4",
            isFullscreen ? "h-[calc(100vh-140px)]" : "h-[600px]"
          )}
        >
          {loadingPdf || !pdfReady ? (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4" />
              <p className="text-muted-foreground">Loading PDF...</p>
            </div>
          ) : pdfError ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <AlertCircle className="h-12 w-12 text-destructive mb-4" />
              <p className="text-lg font-semibold mb-2">Failed to Load PDF</p>
              <p className="text-muted-foreground mb-4">{pdfError}</p>
              <Button onClick={() => openBook(selectedFile)}>Try Again</Button>
            </div>
          ) : pdfReady ? (
            <Document
              file={pdfUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
                </div>
              }
              className="shadow-xl"
            >
              <Page
                pageNumber={pageNumber}
                scale={scale}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                loading={
                  <div className="flex items-center justify-center h-96 w-64 bg-white">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </div>
                }
              />
            </Document>
          ) : null}
        </div>

        {/* Reader Footer - Navigation */}
        <div className="flex items-center justify-between p-4 border-t bg-card/80 backdrop-blur">
          <Button
            variant="outline"
            onClick={prevPage}
            disabled={pageNumber <= 1}
            className="gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Previous</span>
          </Button>

          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              Page {pageNumber} of {numPages}
            </span>
            {numPages > 0 && (
              <div className="hidden sm:block w-48">
                <Slider
                  value={[pageNumber]}
                  min={1}
                  max={numPages}
                  step={1}
                  onValueChange={(value) => goToPage(value[0])}
                  className="cursor-pointer"
                />
              </div>
            )}
          </div>

          <Button
            variant="outline"
            onClick={nextPage}
            disabled={pageNumber >= numPages}
            className="gap-2"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
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
                <div className="relative aspect-[3/4] bg-gradient-to-br from-amber-500/10 via-orange-500/10 to-red-500/10 flex items-center justify-center overflow-hidden">
                  <div className="absolute inset-0 bg-grid-white/5" />
                  <FileText className="h-16 w-16 text-amber-400/50 group-hover:scale-110 transition-transform" />

                  {/* Progress indicator */}
                  {progress && progressPercent > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted/50">
                      <div
                        className="h-full bg-amber-500"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  )}

                  {/* Continue reading badge */}
                  {progress && progress.currentPage > 1 && (
                    <Badge className="absolute top-2 right-2 bg-amber-500/90 text-white text-xs">
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
