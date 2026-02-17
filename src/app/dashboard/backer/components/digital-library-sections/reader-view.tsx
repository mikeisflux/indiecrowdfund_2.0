"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  X,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Bookmark,
  BookmarkPlus,
  List,
} from "lucide-react";
import { PdfPageFlipReader } from "@/components/PdfPageFlipReader";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LibraryItem, BookmarkItem, ReadingProgress } from "./types";
import { getReadingProgress } from "./constants";

interface ReaderViewProps {
  selectedItem: LibraryItem;
  pdfUrl: string;
  currentPage: number;
  numPages: number;
  scale: number;
  isFullscreen: boolean;
  isMobile: boolean;
  bookmarks: BookmarkItem[];
  showBookmarks: boolean;
  readerContainerRef: React.RefObject<HTMLDivElement>;
  onClose: () => void;
  onAddBookmark: () => void;
  onRemoveBookmark: (page: number) => void;
  onToggleBookmarks: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onToggleFullscreen: () => void;
  onPageChange: (pageIndex: number, totalPages: number) => void;
  onReady: (total: number) => void;
}

export function ReaderView({
  selectedItem,
  pdfUrl,
  currentPage,
  scale,
  isFullscreen,
  isMobile,
  bookmarks,
  showBookmarks,
  readerContainerRef,
  onClose,
  onAddBookmark,
  onRemoveBookmark,
  onToggleBookmarks,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onToggleFullscreen,
  onPageChange,
  onReady,
}: ReaderViewProps) {
  const isBookmarkPage = bookmarks.some((b) => b.page === currentPage);
  const savedProgress: ReadingProgress | null = getReadingProgress(selectedItem.sourceId);

  // Page dimensions based on device
  const pageWidth = isMobile ? 280 : 380;
  const pageHeight = isMobile ? 430 : 580;

  return (
    <TooltipProvider delayDuration={300}>
      <div ref={readerContainerRef} className={cn("flex flex-col h-[100dvh] bg-neutral-200", isFullscreen && "fixed inset-0 z-50")}>
        {/* Header */}
        <div className="flex items-center justify-between p-3 bg-black/60 backdrop-blur-sm border-b border-white/10">
          <div className="flex items-center gap-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <X className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Close book and return to library</p>
              </TooltipContent>
            </Tooltip>
            <div>
              <h3 className="font-semibold text-white line-clamp-1">{selectedItem.title}</h3>
              <p className="text-xs text-white/60">{selectedItem.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:text-white hover:bg-white/10"
                  onClick={onAddBookmark}
                  disabled={isBookmarkPage}
                >
                  {isBookmarkPage ? (
                    <Bookmark className="h-5 w-5 text-amber-400 fill-amber-400" />
                  ) : (
                    <BookmarkPlus className="h-5 w-5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{isBookmarkPage ? "Page already bookmarked" : "Bookmark this page"}</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:text-white hover:bg-white/10"
                  onClick={onToggleBookmarks}
                >
                  <List className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{showBookmarks ? "Hide bookmarks" : "View saved bookmarks"}</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:text-white hover:bg-white/10"
                  onClick={onZoomOut}
                  disabled={scale <= 0.5}
                >
                  <ZoomOut className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Zoom out (min 50%)</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-xs text-white min-w-[3rem] text-center cursor-default">
                  {Math.round(scale * 100)}%
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Current zoom level</p>
                <p className="text-xs text-muted-foreground">Ctrl + scroll to zoom</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:text-white hover:bg-white/10"
                  onClick={onZoomIn}
                  disabled={scale >= 4}
                >
                  <ZoomIn className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Zoom in (max 400%)</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:text-white hover:bg-white/10"
                  onClick={onResetZoom}
                >
                  <RotateCcw className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Reset zoom to 100%</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:text-white hover:bg-white/10"
                  onClick={onToggleFullscreen}
                >
                  {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{isFullscreen ? "Exit fullscreen" : "Enter fullscreen mode"}</p>
              </TooltipContent>
            </Tooltip>
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
                  <div
                    key={b.page}
                    className="flex items-center justify-between p-2 hover:bg-white/5 rounded group"
                  >
                    <span className="flex items-center gap-2 text-white/80 text-sm">
                      <Bookmark className="h-4 w-4 text-amber-400" />
                      Page {b.page}
                    </span>
                    <button
                      onClick={() => onRemoveBookmark(b.page)}
                      className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Book View */}
        <div className="flex-1 overflow-auto py-4">
          <div
            style={{
              minWidth: scale > 1 ? `${100 * scale}%` : "100%",
              minHeight: scale > 1 ? `${100 * scale}%` : "100%",
              display: "flex",
              justifyContent: "center",
              transition: "min-width 0.2s, min-height 0.2s",
            }}
          >
            <div
              style={{
                transform: `scale(${scale})`,
                transformOrigin: "top center",
                transition: "transform 0.2s",
              }}
            >
              <PdfPageFlipReader
                pdfUrl={pdfUrl}
                fileId={selectedItem.sourceId}
                initialPageIndex={Math.max(0, (savedProgress?.currentPage ?? 1) - 1)}
                onPageChange={onPageChange}
                onReady={onReady}
                width={pageWidth}
                height={pageHeight}
                singlePage={isMobile}
              />
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
