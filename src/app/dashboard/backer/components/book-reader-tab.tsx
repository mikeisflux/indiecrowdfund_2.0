"use client";

import React, { useState, useEffect, useCallback } from "react";
import { getCSRFHeaders } from "@/lib/csrf";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  BookOpen,
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
import { PdfPageFlipReader } from "@/components/PdfPageFlipReader";

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
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [progressMap, setProgressMap] = useState<Record<string, ReadingProgress>>({});
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [showBookmarks, setShowBookmarks] = useState(false);

  // Page dimensions based on device - sized to fit comfortably in viewport
  // Account for header (~60px), padding (64px), and page indicator (~50px)
  const pageWidth = isMobile ? 280 : 380;
  const pageHeight = isMobile ? 380 : 520;

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
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
    setBookmarks(getBookmarks(file.id));

    // Get initial page from saved progress
    const saved = getReadingProgress(file.id);
    setCurrentPage(saved?.currentPage ?? 1);

    try {
      const res = await fetch("/api/backer/digital-files", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({ fileId: file.id }),
      });
      if (!res.ok) throw new Error("Failed to get PDF URL");
      const { downloadUrl } = await res.json();
      setPdfUrl(downloadUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load PDF");
    }
  };

  const closeBook = useCallback(() => {
    if (selectedFile && numPages > 0) {
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
    setCurrentPage(1);
    setScale(1);
    setIsFullscreen(false);
    setShowBookmarks(false);
  }, [selectedFile, numPages, currentPage, bookmarks]);

  // pageIndex is 0-based from the flip component
  const handlePageChange = useCallback((pageIndex: number, totalPages: number) => {
    const pageNumber = pageIndex + 1; // Convert to 1-based for storage/display
    setCurrentPage(pageNumber);
    setNumPages(totalPages);
    if (selectedFile) {
      saveReadingProgress({
        fileId: selectedFile.id,
        currentPage: pageNumber,
        totalPages,
        lastRead: new Date().toISOString(),
      });
    }
  }, [selectedFile]);

  const handleReady = useCallback((total: number) => {
    setNumPages(total);
  }, []);

  const addBookmark = () => {
    if (bookmarks.some(b => b.page === currentPage)) return;
    const updated = [...bookmarks, { page: currentPage, timestamp: new Date().toISOString() }].sort((a, b) => a.page - b.page);
    setBookmarks(updated);
    if (selectedFile) saveBookmarks(selectedFile.id, updated);
  };

  const removeBookmark = (page: number) => {
    const updated = bookmarks.filter(b => b.page !== page);
    setBookmarks(updated);
    if (selectedFile) saveBookmarks(selectedFile.id, updated);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) return <div className="grid gap-4 md:grid-cols-3">{[1,2,3].map(i => <Skeleton key={i} className="h-64" />)}</div>;
  if (error && !selectedFile) return <Card><CardContent className="py-12 text-center"><AlertCircle className="h-12 w-12 mx-auto mb-4" /><p>{error}</p></CardContent></Card>;

  // Book reader view
  if (selectedFile && pdfUrl) {
    const isBookmarkPage = bookmarks.some(b => b.page === currentPage);
    const savedProgress = getReadingProgress(selectedFile.id);

    return (
      <div className={cn("flex flex-col h-[100dvh] bg-gradient-to-b from-stone-900 to-stone-950", isFullscreen && "fixed inset-0 z-50")}>
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
            <Button variant="ghost" size="icon" className="text-white hover:text-white hover:bg-white/10" onClick={addBookmark} disabled={isBookmarkPage}>
              {isBookmarkPage ? <Bookmark className="h-5 w-5 text-amber-400 fill-amber-400" /> : <BookmarkPlus className="h-5 w-5" />}
            </Button>
            <Button variant="ghost" size="icon" className="text-white hover:text-white hover:bg-white/10" onClick={() => setShowBookmarks(!showBookmarks)}>
              <List className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-white hover:text-white hover:bg-white/10" onClick={() => setScale(s => Math.max(0.5, s - 0.1))} disabled={scale <= 0.5}>
              <ZoomOut className="h-5 w-5" />
            </Button>
            <span className="text-xs text-white min-w-[3rem] text-center">{Math.round(scale * 100)}%</span>
            <Button variant="ghost" size="icon" className="text-white hover:text-white hover:bg-white/10" onClick={() => setScale(s => Math.min(2, s + 0.1))} disabled={scale >= 2}>
              <ZoomIn className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-white hover:text-white hover:bg-white/10" onClick={() => setScale(1)}><RotateCcw className="h-5 w-5" /></Button>
            <Button variant="ghost" size="icon" className="text-white hover:text-white hover:bg-white/10" onClick={() => setIsFullscreen(!isFullscreen)}>
              {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Bookmarks Panel */}
        {showBookmarks && (
          <div className="absolute top-16 right-4 w-64 max-h-80 overflow-y-auto bg-stone-800/95 backdrop-blur-sm rounded-lg border border-white/10 z-50 shadow-xl">
            <div className="p-3 border-b border-white/10">
              <h4 className="font-semibold text-white text-sm">Bookmarks</h4>
            </div>
            {bookmarks.length === 0 ? (
              <p className="p-4 text-center text-white/40 text-sm">No bookmarks yet</p>
            ) : (
              <div className="p-2">
                {bookmarks.map((b) => (
                  <div key={b.page} className="flex items-center justify-between p-2 hover:bg-white/5 rounded group">
                    <span className="flex items-center gap-2 text-white/80 text-sm">
                      <Bookmark className="h-4 w-4 text-amber-400" />
                      Page {b.page}
                    </span>
                    <button onClick={() => removeBookmark(b.page)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Book View */}
        <div className="flex-1 min-h-0 flex items-center justify-center overflow-auto p-4">
          <div
            className="flex flex-col items-center"
            style={{
              transform: `scale(${scale})`,
              transformOrigin: "center center",
              transition: "transform 0.2s",
            }}
          >
            <PdfPageFlipReader
              pdfUrl={pdfUrl}
              fileId={selectedFile.id}
              initialPageIndex={Math.max(0, (savedProgress?.currentPage ?? 1) - 1)}
              onPageChange={handlePageChange}
              onReady={handleReady}
              width={pageWidth}
              height={pageHeight}
              singlePage={isMobile}
            />
          </div>
        </div>
      </div>
    );
  }

  // Library view
  if (pdfFiles.length === 0) {
    return (
      <Card className="glass-card">
        <CardContent className="py-16 text-center">
          <Library className="h-12 w-12 mx-auto mb-4 text-amber-400" />
          <h3 className="text-xl font-semibold mb-2">No books available</h3>
          <p className="text-muted-foreground">Books from your backed projects will appear here</p>
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
          <h2 className="text-xl font-bold">My Library</h2>
          <p className="text-sm text-muted-foreground">{pdfFiles.length} book{pdfFiles.length !== 1 ? 's' : ''} available</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {pdfFiles.map((file) => {
          const progress = progressMap[file.id];
          const progressPercent = progress ? Math.round((progress.currentPage / progress.totalPages) * 100) : 0;

          return (
            <Card
              key={file.id}
              className="group cursor-pointer hover:shadow-lg transition-all duration-300 hover:scale-[1.02] overflow-hidden"
              onClick={() => openBook(file)}
            >
              <div className="relative h-40 bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 flex items-center justify-center">
                <FileText className="h-16 w-16 text-amber-600/50" />
                {progress && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/30">
                    <div className="h-full bg-amber-500" style={{ width: `${progressPercent}%` }} />
                  </div>
                )}
              </div>
              <CardContent className="p-4">
                <h3 className="font-semibold line-clamp-1 group-hover:text-amber-600 transition-colors">{file.name}</h3>
                <p className="text-sm text-muted-foreground line-clamp-1">{file.project.title}</p>
                <div className="flex items-center justify-between mt-3">
                  <Badge variant="secondary" className="text-xs">{formatFileSize(file.fileSize)}</Badge>
                  {progress && (
                    <span className="text-xs text-muted-foreground">
                      {progressPercent}% read
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
