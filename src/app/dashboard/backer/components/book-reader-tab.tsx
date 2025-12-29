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
  Library,
} from "lucide-react";

const Document = dynamic(() => import("react-pdf").then((mod) => mod.Document), { ssr: false });
const Page = dynamic(() => import("react-pdf").then((mod) => mod.Page), { ssr: false });

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

const READING_PROGRESS_KEY = "indiecrowdfund_reading_progress";

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
  } catch (e) {
    console.error("Failed to save progress:", e);
  }
};

export function BookReaderTab() {
  const [pdfFiles, setPdfFiles] = useState<DigitalFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<DigitalFile | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1); // Unified page tracking (1-based)
  const [scale, setScale] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isTurning, setIsTurning] = useState(false);
  const [turnDirection, setTurnDirection] = useState<"next" | "prev" | null>(null);
  const [progressMap, setProgressMap] = useState<Record<string, ReadingProgress>>({});

  const bookRef = useRef<HTMLDivElement>(null);

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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (f: any) => f.mimeType === "application/pdf" || f.fileName?.toLowerCase().endsWith(".pdf")
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
      setPageNumber(saved?.currentPage || 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load PDF");
    }
  };

  const closeBook = useCallback(() => {
    if (selectedFile && numPages > 0) {
      saveReadingProgress({
        fileId: selectedFile.id,
        currentPage: pageNumber,
        totalPages: numPages,
        lastRead: new Date().toISOString(),
      });
      setProgressMap(prev => ({
        ...prev,
        [selectedFile.id]: { fileId: selectedFile.id, currentPage: pageNumber, totalPages: numPages, lastRead: new Date().toISOString() }
      }));
    }
    setSelectedFile(null);
    setPdfUrl(null);
    setNumPages(0);
    setPageNumber(1);
    setScale(1);
    setIsFullscreen(false);
  }, [selectedFile, numPages, pageNumber]);

  const turnPage = useCallback((direction: "next" | "prev") => {
    if (isTurning || !numPages) return;

    const newPage = direction === "next" ? pageNumber + (isMobile ? 1 : 2) : pageNumber - (isMobile ? 1 : 2);
    if (newPage < 1 || newPage > numPages) return;

    setTurnDirection(direction);
    setIsTurning(true);

    setTimeout(() => {
      setPageNumber(newPage);
      saveReadingProgress({
        fileId: selectedFile!.id,
        currentPage: newPage,
        totalPages: numPages,
        lastRead: new Date().toISOString(),
      });
      setIsTurning(false);
      setTurnDirection(null);
    }, 600);
  }, [isTurning, pageNumber, numPages, isMobile, selectedFile]);

  const preloadPages = () => {
    const range = 6;
    const pages = [];
    for (let i = -range; i <= range; i++) {
      const p = pageNumber + i;
      if (p >= 1 && p <= numPages) pages.push(p);
    }
    return pages;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) return <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{[1,2,3].map(i => <Skeleton key={i} className="h-64" />)}</div>;
  if (error && !selectedFile) return <Card className="glass-card"><CardContent className="py-12 text-center"><AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" /><p>{error}</p><Button onClick={fetchPdfFiles}>Retry</Button></CardContent></Card>;

  if (selectedFile && pdfUrl) {
    const isCover = pageNumber === 1;
    const leftPage = isMobile ? null : (isCover ? null : pageNumber);
    const rightPage = isMobile ? pageNumber : (isCover ? 1 : pageNumber + 1);

    return (
      <div className={cn("flex flex-col h-screen bg-gradient-to-b from-stone-900 to-stone-950", isFullscreen && "fixed inset-0 z-50")}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-black/50 backdrop-blur border-b border-white/10">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={closeBook}><X className="h-5 w-5" /></Button>
            <div>
              <h3 className="font-semibold text-white">{selectedFile.name}</h3>
              <p className="text-xs text-white/60">{selectedFile.project.title}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isMobile && (
              <>
                <Button variant="ghost" size="icon" onClick={() => setScale(s => Math.max(0.5, s - 0.2))}><ZoomOut className="h-4 w-4" /></Button>
                <span className="text-sm w-12 text-center">{Math.round(scale * 100)}%</span>
                <Button variant="ghost" size="icon" onClick={() => setScale(s => Math.min(3, s + 0.2))}><ZoomIn className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => setScale(1)}><RotateCcw className="h-4 w-4" /></Button>
              </>
            )}
            <Button variant="ghost" size="icon" onClick={() => setIsFullscreen(!isFullscreen)}>
              {isFullscreen ? <Minimize2 /> : <Maximize2 />}
            </Button>
          </div>
        </div>

        {/* Book View */}
        <div className="flex-1 flex items-center justify-center overflow-hidden" ref={bookRef}>
          <Document file={pdfUrl} onLoadSuccess={({ numPages }) => setNumPages(numPages)} loading={null}>
            {/* Off-screen preloading */}
            <div className="absolute opacity-0 pointer-events-none -z-10">
              {preloadPages().map(p => (
                <Page key={`preload-${p}`} pageNumber={p} width={800} renderTextLayer={false} renderAnnotationLayer={false} />
              ))}
            </div>

            <div className="relative" style={{ transform: `scale(${scale})`, perspective: "2000px" }}>
              <div className={cn("relative flex", isMobile ? "flex-col" : "flex")}>
                {/* Turning Page (Front) */}
                {isTurning && (
                  <div
                    className="absolute inset-0 flex"
                    style={{
                      transformStyle: "preserve-3d",
                      transform: turnDirection === "next" ? `rotateY(-180deg)` : `rotateY(0deg)`,
                      transition: "transform 0.6s cubic-bezier(0.65, 0, 0.35, 1)",
                      transformOrigin: turnDirection === "next" ? "left center" : "right center",
                      zIndex: 50,
                      pointerEvents: "none",
                    }}
                  >
                    {/* Render previous visible page(s) on the "front" of flipping page */}
                    {!isMobile && leftPage && <Page pageNumber={leftPage - 2} width={400} renderTextLayer={false} renderAnnotationLayer={false} />}
                    <Page pageNumber={rightPage - (isMobile ? 1 : 2)} width={isMobile ? 400 : 400} renderTextLayer={false} renderAnnotationLayer={false} />
                  </div>
                )}

                {/* Current Spread */}
                <div className={cn("flex", isMobile && "flex-col")}>
                  {!isMobile && leftPage && (
                    <div className="relative bg-paper shadow-2xl overflow-hidden" style={{ width: "400px", height: "600px" }}>
                      <Page pageNumber={leftPage} width={380} renderTextLayer={false} renderAnnotationLayer={false} />
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-gray-600">{leftPage}</div>
                    </div>
                  )}

                  <div
                    className={cn(
                      "relative bg-paper shadow-2xl overflow-hidden cursor-grab active:cursor-grabbing",
                      isCover && "rounded-r-lg"
                    )}
                    style={{ width: "400px", height: isCover ? "620px" : "600px" }}
                    onClick={() => !isTurning && turnPage("next")}
                  >
                    {isCover && <div className="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent pointer-events-none" />}
                    <Page pageNumber={rightPage} width={380} renderTextLayer={false} renderAnnotationLayer={false} />
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-gray-600">{rightPage}</div>
                    {isCover && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <span className="text-white/60 text-lg animate-pulse">Click or swipe to open →</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Click zones */}
                <div className="absolute inset-0 flex">
                  <div className="w-1/3" onClick={() => !isTurning && pageNumber > 1 && turnPage("prev")} />
                  <div className="flex-1" />
                  <div className="w-1/3" onClick={() => !isTurning && pageNumber < numPages && turnPage("next")} />
                </div>
              </div>
            </div>
          </Document>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 bg-black/50 backdrop-blur border-t border-white/10">
          <Button variant="ghost" onClick={() => turnPage("prev")} disabled={pageNumber <= 1 || isTurning}>
            <ChevronLeft className="h-5 w-5 mr-2" /> Previous
          </Button>
          <span className="text-sm text-white/80">
            Page {pageNumber} of {numPages}
          </span>
          <Button variant="ghost" onClick={() => turnPage("next")} disabled={pageNumber >= numPages || isTurning}>
            Next <ChevronRight className="h-5 w-5 ml-2" />
          </Button>
        </div>

        <style jsx global>{`
          .bg-paper {
            background: #f8f5ef;
            background-image: linear-gradient(to bottom, transparent 95%, #e8e0d0 100%);
          }
          canvas { image-rendering: -webkit-optimize-contrast; }
        `}</style>
      </div>
    );
  }

  // Library view
  if (pdfFiles.length === 0) {
    return (
      <Card className="glass-card">
        <CardContent className="py-16 text-center">
          <Library className="h-12 w-12 mx-auto mb-4 text-amber-400" />
          <h3 className="text-xl font-semibold mb-2">No books yet</h3>
          <p className="text-muted-foreground">PDF rewards will appear here when unlocked.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20">
            <BookOpen className="h-6 w-6 text-amber-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Your Library</h2>
            <p className="text-sm text-muted-foreground">{pdfFiles.length} book{pdfFiles.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pdfFiles.map((file) => {
          const prog = progressMap[file.id];
          const percent = prog ? Math.round((prog.currentPage / prog.totalPages) * 100) : 0;

          return (
            <Card key={file.id} className="glass-card hover:ring-2 hover:ring-amber-500/50 cursor-pointer transition-all" onClick={() => openBook(file)}>
              <CardContent className="p-0">
                <div className="aspect-[3/4] bg-gradient-to-br from-amber-900/30 to-stone-800/50 flex items-center justify-center relative overflow-hidden">
                  <FileText className="h-16 w-16 text-amber-400/60" />
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30">
                    <div className="h-full bg-amber-500 transition-all" style={{ width: `${percent}%` }} />
                  </div>
                  {prog && prog.currentPage > 1 && (
                    <Badge className="absolute top-2 right-2">Page {prog.currentPage}</Badge>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold line-clamp-2">{file.name.replace(/\.pdf$/i, "")}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{file.project.title}</p>
                  <div className="flex justify-between text-xs text-muted-foreground mt-3">
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
