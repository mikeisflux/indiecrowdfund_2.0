"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { getCSRFHeaders } from "@/lib/csrf";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
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
  Search,
  Grid3X3,
  SortAsc,
  Filter,
  Clock,
  CheckCircle2,
  BookOpen,
  Store,
  Gift,
  Upload,
  Trash2,
  FolderOpen,
} from "lucide-react";
import { PdfPageFlipReader } from "@/components/PdfPageFlipReader";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  getAllLocalBooksMeta,
  addLocalBook,
  getLocalBookUrl,
  deleteLocalBook,
  isLocalBooksSupported,
  LocalBookMeta,
} from "@/lib/local-books-db";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

// Types
interface DigitalFile {
  id: string;
  name: string;
  fileName: string;
  fileSize: number;
  coverImageUrl?: string | null;
  totalPages?: number | null;
  project: { id: string; title: string };
  mimeType?: string;
  createdAt?: string;
}

interface MarketplacePurchase {
  id: string;
  book: {
    id: string;
    title: string;
    pdfFileUrl: string;
    pdfCoverImageUrl?: string | null;
    pdfFileName?: string | null;
    pdfFileSize?: number | null;
    pdfTotalPages?: number | null;
  };
  createdAt: string;
}

interface LibraryItem {
  id: string;
  title: string;
  subtitle: string;
  fileSize: number;
  coverImageUrl: string | null;
  totalPages: number | null;
  source: "crowdfunding" | "marketplace" | "local";
  sourceId: string;
  createdAt: string;
  originalData: DigitalFile | MarketplacePurchase | LocalBookMeta;
  coverColor?: string;
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

// Sort and filter types
type SortOption = "date-desc" | "date-asc" | "title-asc" | "title-desc" | "progress-desc" | "progress-asc" | "size-desc" | "size-asc";
type SourceFilter = "all" | "crowdfunding" | "marketplace" | "local";
type StatusFilter = "all" | "unread" | "in-progress" | "completed";
type ViewMode = "grid" | "list";

// Constants
const READING_PROGRESS_KEY = "indiecrowdfund_reading_progress";
const BOOKMARKS_KEY = "indiecrowdfund_bookmarks";
const LIBRARY_PREFS_KEY = "indiecrowdfund_library_prefs";

// Local storage helpers
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
  } catch {
    // Silently fail
  }
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
  } catch {
    // Silently fail
  }
};

const getLibraryPrefs = (): { sortBy: SortOption; viewMode: ViewMode } => {
  if (typeof window === "undefined") return { sortBy: "date-desc", viewMode: "grid" };
  try {
    const item = localStorage.getItem(LIBRARY_PREFS_KEY);
    return item ? JSON.parse(item) : { sortBy: "date-desc", viewMode: "grid" };
  } catch {
    return { sortBy: "date-desc", viewMode: "grid" };
  }
};

const saveLibraryPrefs = (prefs: { sortBy: SortOption; viewMode: ViewMode }) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LIBRARY_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Silently fail
  }
};

// Helper to format file size
const formatFileSize = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Get reading status from progress
const getReadingStatus = (progress: ReadingProgress | null): StatusFilter => {
  if (!progress) return "unread";
  const percent = (progress.currentPage / progress.totalPages) * 100;
  if (percent >= 95) return "completed";
  if (percent > 0) return "in-progress";
  return "unread";
};

// Library Card Component
function LibraryCard({
  item,
  progress,
  onClick,
  viewMode,
  onDelete,
}: {
  item: LibraryItem;
  progress: ReadingProgress | null;
  onClick: () => void;
  viewMode: ViewMode;
  onDelete?: () => void;
}) {
  const progressPercent = progress ? Math.round((progress.currentPage / progress.totalPages) * 100) : 0;
  const status = getReadingStatus(progress);

  // Determine colors based on source
  const isLocal = item.source === "local";
  const gradientColors = isLocal
    ? (item.coverColor || "from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/30")
    : "from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30";
  const iconColor = isLocal ? "text-purple-600/50" : "text-amber-600/50";

  if (viewMode === "list") {
    return (
      <div
        onClick={onClick}
        className="group flex items-center gap-4 p-4 rounded-xl bg-card/50 backdrop-blur border border-border/50 hover:border-amber-400/30 hover:shadow-lg hover:shadow-amber-500/10 transition-all duration-300 cursor-pointer"
      >
        {/* Thumbnail */}
        <div className={cn("relative w-16 h-20 rounded-lg overflow-hidden bg-gradient-to-br flex-shrink-0", gradientColors)}>
          {item.coverImageUrl ? (
            <Image
              src={item.coverImageUrl}
              alt={item.title}
              fill
              className="object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <FileText className={cn("h-8 w-8", iconColor)} />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold line-clamp-1 group-hover:text-amber-500 transition-colors">
            {item.title}
          </h3>
          <p className="text-sm text-muted-foreground line-clamp-1">{item.subtitle}</p>
          <div className="flex items-center gap-3 mt-2">
            <Badge variant={item.source === "marketplace" ? "default" : "secondary"} className="text-xs">
              {item.source === "marketplace" ? (
                <>
                  <Store className="w-3 h-3 mr-1" />
                  Purchased
                </>
              ) : item.source === "local" ? (
                <>
                  <FolderOpen className="w-3 h-3 mr-1" />
                  My Upload
                </>
              ) : (
                <>
                  <Gift className="w-3 h-3 mr-1" />
                  Reward
                </>
              )}
            </Badge>
            <span className="text-xs text-muted-foreground">{formatFileSize(item.fileSize)}</span>
          </div>
        </div>

        {/* Progress and Delete */}
        <div className="flex items-center gap-2">
          {status === "completed" ? (
            <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Completed
            </Badge>
          ) : status === "in-progress" ? (
            <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30">
              <Clock className="w-3 h-3 mr-1" />
              {progressPercent}%
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              Unread
            </Badge>
          )}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="p-1.5 rounded-full text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Grid view card
  const progressBarColor = isLocal
    ? "bg-gradient-to-r from-purple-400 to-indigo-500"
    : "bg-gradient-to-r from-amber-400 to-orange-500";
  const hoverTextColor = isLocal ? "group-hover:text-purple-400" : "group-hover:text-amber-400";
  const progressTextColor = isLocal ? "text-purple-400" : "text-amber-400";

  return (
    <Card
      onClick={onClick}
      className="group cursor-pointer overflow-hidden bg-gradient-to-br from-zinc-800/80 to-zinc-900/80 backdrop-blur-md border border-white/10 hover:border-amber-400/30 hover:shadow-lg hover:shadow-amber-500/10 transition-all duration-300"
    >
      {/* Cover Image - Aspect ratio 3:4 for book covers */}
      <div className={cn("relative aspect-[3/4] bg-gradient-to-br overflow-hidden", gradientColors)}>
        {item.coverImageUrl ? (
          <Image
            src={item.coverImageUrl}
            alt={item.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <FileText className={cn("h-16 w-16", iconColor)} />
          </div>
        )}

        {/* Progress Overlay */}
        {progress && (
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/50">
            <div
              className={cn("h-full", progressBarColor)}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}

        {/* Source Badge */}
        <div className="absolute top-2 left-2">
          <Badge
            className={cn(
              "text-[10px] backdrop-blur-sm",
              item.source === "marketplace"
                ? "bg-purple-500/80 text-white"
                : item.source === "local"
                ? "bg-indigo-500/80 text-white"
                : "bg-emerald-500/80 text-white"
            )}
          >
            {item.source === "marketplace" ? "Purchased" : item.source === "local" ? "My Upload" : "Reward"}
          </Badge>
        </div>

        {/* Status indicator or Delete button */}
        <div className="absolute top-2 right-2">
          {onDelete ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="w-6 h-6 rounded-full bg-black/50 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          ) : status === "completed" ? (
            <div className="w-6 h-6 rounded-full bg-emerald-500/90 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-white" />
            </div>
          ) : null}
        </div>
      </div>

      {/* Content */}
      <CardContent className="p-3 space-y-1">
        <h3 className={cn("font-medium text-white line-clamp-2 transition-colors", hoverTextColor)}>
          {item.title}
        </h3>
        <p className="text-xs text-zinc-400 line-clamp-1">{item.subtitle}</p>
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-zinc-500">{formatFileSize(item.fileSize)}</span>
          {progress && (
            <span className={cn("text-xs", progressTextColor)}>{progressPercent}% read</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Main Component
export function DigitalLibraryTab() {
  // State for library items
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progressMap, setProgressMap] = useState<Record<string, ReadingProgress>>({});

  // State for filters and search
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("date-desc");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  // State for reader
  const [selectedItem, setSelectedItem] = useState<LibraryItem | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [showBookmarks, setShowBookmarks] = useState(false);

  // State for local book uploads
  const [uploading, setUploading] = useState(false);
  const [supportsLocalBooks, setSupportsLocalBooks] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string; name: string }>({ open: false, id: "", name: "" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Page dimensions based on device
  const pageWidth = isMobile ? 280 : 380;
  const pageHeight = isMobile ? 430 : 580;

  // Load saved preferences
  useEffect(() => {
    const prefs = getLibraryPrefs();
    setSortBy(prefs.sortBy);
    setViewMode(prefs.viewMode);
  }, []);

  // Save preferences when changed
  useEffect(() => {
    saveLibraryPrefs({ sortBy, viewMode });
  }, [sortBy, viewMode]);

  // Check mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Check local books support on client side
  useEffect(() => {
    setSupportsLocalBooks(isLocalBooksSupported());
  }, []);

  // Fetch library data
  useEffect(() => {
    fetchLibraryData();
  }, []);

  const fetchLibraryData = async () => {
    try {
      setLoading(true);

      // Fetch crowdfunding digital files
      const filesRes = await fetch("/api/backer/digital-files", { headers: getCSRFHeaders() });
      if (!filesRes.ok) throw new Error("Failed to fetch files");
      const filesData = await filesRes.json();

      // Filter for PDFs
      const pdfFiles: DigitalFile[] = (filesData.files || []).filter(
        (f: DigitalFile) => f.mimeType === "application/pdf" || f.fileName?.toLowerCase().endsWith(".pdf")
      );

      // Transform to LibraryItem format
      const crowdfundingItems: LibraryItem[] = pdfFiles.map((file) => ({
        id: `cf_${file.id}`,
        title: file.name,
        subtitle: file.project.title,
        fileSize: file.fileSize,
        coverImageUrl: file.coverImageUrl || null,
        totalPages: file.totalPages || null,
        source: "crowdfunding" as const,
        sourceId: file.id,
        createdAt: file.createdAt || new Date().toISOString(),
        originalData: file,
      }));

      // Fetch local books from IndexedDB
      let localItems: LibraryItem[] = [];
      if (isLocalBooksSupported()) {
        try {
          const localBooks = await getAllLocalBooksMeta();
          localItems = localBooks.map((book) => ({
            id: `local_${book.id}`,
            title: book.name,
            subtitle: "My Uploads",
            fileSize: book.fileSize,
            coverImageUrl: null,
            totalPages: null,
            source: "local" as const,
            sourceId: book.id,
            createdAt: book.addedAt,
            originalData: book,
            coverColor: book.coverColor,
          }));
        } catch (err) {
          console.error("Error loading local books:", err);
        }
      }

      // TODO: Fetch marketplace purchases when API is ready
      // const purchasesRes = await fetch("/api/backer/marketplace-purchases", { headers: getCSRFHeaders() });
      // const marketplaceItems = ...

      const allItems = [...crowdfundingItems, ...localItems];
      setLibraryItems(allItems);

      // Load reading progress for all items
      const progress: Record<string, ReadingProgress> = {};
      allItems.forEach((item) => {
        const p = getReadingProgress(item.sourceId);
        if (p) progress[item.sourceId] = p;
      });
      setProgressMap(progress);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading library");
    } finally {
      setLoading(false);
    }
  };

  // Handle local book upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Please select a PDF file");
      return;
    }

    // Max size 200MB
    if (file.size > 200 * 1024 * 1024) {
      setError("File size must be less than 200MB");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      await addLocalBook(file);
      await fetchLibraryData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add book");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Handle local book deletion
  const handleDeleteLocalBook = async () => {
    const { id } = deleteConfirm;
    // Extract the actual ID (remove "local_" prefix if present)
    const actualId = id.startsWith("local_") ? id.substring(6) : id;
    try {
      await deleteLocalBook(actualId);
      setLibraryItems(prev => prev.filter(item => item.id !== `local_${actualId}` && item.sourceId !== actualId));
      setProgressMap(prev => {
        const updated = { ...prev };
        delete updated[actualId];
        return updated;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete book");
    }
    setDeleteConfirm({ open: false, id: "", name: "" });
  };

  // Filter and sort items
  const filteredAndSortedItems = useMemo(() => {
    let items = [...libraryItems];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      items = items.filter(
        (item) =>
          item.title.toLowerCase().includes(query) ||
          item.subtitle.toLowerCase().includes(query)
      );
    }

    // Source filter
    if (sourceFilter !== "all") {
      items = items.filter((item) => item.source === sourceFilter);
    }

    // Status filter
    if (statusFilter !== "all") {
      items = items.filter((item) => {
        const progress = progressMap[item.sourceId];
        const status = getReadingStatus(progress);
        return status === statusFilter;
      });
    }

    // Sort
    items.sort((a, b) => {
      const progressA = progressMap[a.sourceId];
      const progressB = progressMap[b.sourceId];
      const percentA = progressA ? (progressA.currentPage / progressA.totalPages) * 100 : 0;
      const percentB = progressB ? (progressB.currentPage / progressB.totalPages) * 100 : 0;

      switch (sortBy) {
        case "date-desc":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "date-asc":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "title-asc":
          return a.title.localeCompare(b.title);
        case "title-desc":
          return b.title.localeCompare(a.title);
        case "progress-desc":
          return percentB - percentA;
        case "progress-asc":
          return percentA - percentB;
        case "size-desc":
          return b.fileSize - a.fileSize;
        case "size-asc":
          return a.fileSize - b.fileSize;
        default:
          return 0;
      }
    });

    return items;
  }, [libraryItems, searchQuery, sourceFilter, statusFilter, sortBy, progressMap]);

  // Open book for reading
  const openBook = async (item: LibraryItem) => {
    setSelectedItem(item);
    setPdfUrl(null);
    setNumPages(0);
    setBookmarks(getBookmarks(item.sourceId));

    const saved = getReadingProgress(item.sourceId);
    setCurrentPage(saved?.currentPage ?? 1);

    try {
      if (item.source === "crowdfunding") {
        const res = await fetch("/api/backer/digital-files", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
          body: JSON.stringify({ fileId: item.sourceId }),
        });
        if (!res.ok) throw new Error("Failed to get PDF URL");
        const { downloadUrl } = await res.json();
        setPdfUrl(downloadUrl);
      } else if (item.source === "local") {
        // Local book from IndexedDB
        const url = await getLocalBookUrl(item.sourceId);
        if (url) {
          setPdfUrl(url);
        } else {
          throw new Error("Failed to load local book");
        }
      } else {
        // Marketplace purchase
        const res = await fetch(`/api/backer/marketplace-purchases/${item.sourceId}/download`, {
          headers: getCSRFHeaders(),
        });
        if (!res.ok) throw new Error("Failed to get PDF URL");
        const { downloadUrl } = await res.json();
        setPdfUrl(downloadUrl);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load PDF");
    }
  };

  // Close book
  const closeBook = useCallback(() => {
    if (selectedItem && numPages > 0) {
      const newProgress = {
        fileId: selectedItem.sourceId,
        currentPage,
        totalPages: numPages,
        lastRead: new Date().toISOString(),
      };
      saveReadingProgress(newProgress);
      saveBookmarks(selectedItem.sourceId, bookmarks);

      // Update progress map
      setProgressMap((prev) => ({
        ...prev,
        [selectedItem.sourceId]: newProgress,
      }));
    }
    // Revoke blob URL for local books to free memory
    if (selectedItem?.source === "local" && pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
    }
    setSelectedItem(null);
    setPdfUrl(null);
    setNumPages(0);
    setCurrentPage(1);
    setScale(1);
    setIsFullscreen(false);
    setShowBookmarks(false);
  }, [selectedItem, numPages, currentPage, bookmarks, pdfUrl]);

  // Handle page change
  const handlePageChange = useCallback((pageIndex: number, totalPages: number) => {
    const pageNumber = pageIndex + 1;
    setCurrentPage(pageNumber);
    setNumPages(totalPages);
    if (selectedItem) {
      saveReadingProgress({
        fileId: selectedItem.sourceId,
        currentPage: pageNumber,
        totalPages,
        lastRead: new Date().toISOString(),
      });
    }
  }, [selectedItem]);

  const handleReady = useCallback((total: number) => {
    setNumPages(total);
  }, []);

  // Bookmark handlers
  const addBookmark = () => {
    if (bookmarks.some((b) => b.page === currentPage)) return;
    const updated = [...bookmarks, { page: currentPage, timestamp: new Date().toISOString() }].sort(
      (a, b) => a.page - b.page
    );
    setBookmarks(updated);
    if (selectedItem) saveBookmarks(selectedItem.sourceId, updated);
  };

  const removeBookmark = (page: number) => {
    const updated = bookmarks.filter((b) => b.page !== page);
    setBookmarks(updated);
    if (selectedItem) saveBookmarks(selectedItem.sourceId, updated);
  };

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-4">
          <Skeleton className="h-10 flex-1 min-w-[200px]" />
          <Skeleton className="h-10 w-[140px]" />
          <Skeleton className="h-10 w-[140px]" />
          <Skeleton className="h-10 w-[160px]" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="aspect-[3/4]" />
          ))}
        </div>
      </div>
    );
  }

  // Error state (outside of reader)
  if (error && !selectedItem) {
    return (
      <Card className="glass-card">
        <CardContent className="py-12 text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
          <p className="text-lg font-semibold mb-2">Error loading library</p>
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={fetchLibraryData} className="mt-4">
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Reader view
  if (selectedItem && pdfUrl) {
    const isBookmarkPage = bookmarks.some((b) => b.page === currentPage);
    const savedProgress = getReadingProgress(selectedItem.sourceId);

    return (
      <TooltipProvider delayDuration={300}>
        <div className={cn("flex flex-col h-[100dvh] bg-neutral-200", isFullscreen && "fixed inset-0 z-50")}>
          {/* Header */}
          <div className="flex items-center justify-between p-3 bg-black/60 backdrop-blur-sm border-b border-white/10">
            <div className="flex items-center gap-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={closeBook}>
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
                    onClick={addBookmark}
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
                    onClick={() => setShowBookmarks(!showBookmarks)}
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
                    onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}
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
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:text-white hover:bg-white/10"
                    onClick={() => setScale((s) => Math.min(2, s + 0.1))}
                    disabled={scale >= 2}
                  >
                    <ZoomIn className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Zoom in (max 200%)</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:text-white hover:bg-white/10"
                    onClick={() => setScale(1)}
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
                    onClick={() => setIsFullscreen(!isFullscreen)}
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
                        onClick={() => removeBookmark(b.page)}
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
                  onPageChange={handlePageChange}
                  onReady={handleReady}
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

  // Empty library state
  if (libraryItems.length === 0) {
    return (
      <div className="space-y-6">
        <Card className="glass-card">
          <CardContent className="py-16 text-center">
            <Library className="h-12 w-12 mx-auto mb-4 text-amber-400" />
            <h3 className="text-xl font-semibold mb-2">Your Digital Library is Empty</h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
              Books from your backed projects and marketplace purchases will appear here.
              Start backing projects with digital rewards or browse the marketplace!
            </p>
            {supportsLocalBooks && (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600"
                >
                  {uploading ? (
                    <>Uploading...</>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Add Your Own Book
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground mt-2">PDF files up to 200MB</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Library view
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20">
            <Library className="h-6 w-6 text-amber-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Digital Library</h2>
            <p className="text-sm text-muted-foreground">
              {libraryItems.length} item{libraryItems.length !== 1 ? "s" : ""} in your collection
            </p>
          </div>
        </div>
        {supportsLocalBooks && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <>Uploading...</>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Add Book
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Filters and Search */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search your library..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Source Filter */}
        <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as SourceFilter)}>
          <SelectTrigger className="w-[160px]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="All Sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="crowdfunding">Crowdfunding Rewards</SelectItem>
            <SelectItem value="marketplace">Marketplace Purchases</SelectItem>
            <SelectItem value="local">My Uploads</SelectItem>
          </SelectContent>
        </Select>

        {/* Status Filter */}
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-[140px]">
            <BookOpen className="w-4 h-4 mr-2" />
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="unread">Unread</SelectItem>
            <SelectItem value="in-progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>

        {/* Sort */}
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
          <SelectTrigger className="w-[160px]">
            <SortAsc className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date-desc">Newest First</SelectItem>
            <SelectItem value="date-asc">Oldest First</SelectItem>
            <SelectItem value="title-asc">Title A-Z</SelectItem>
            <SelectItem value="title-desc">Title Z-A</SelectItem>
            <SelectItem value="progress-desc">Most Progress</SelectItem>
            <SelectItem value="progress-asc">Least Progress</SelectItem>
            <SelectItem value="size-desc">Largest</SelectItem>
            <SelectItem value="size-asc">Smallest</SelectItem>
          </SelectContent>
        </Select>

        {/* View Toggle */}
        <div className="flex border border-border rounded-lg overflow-hidden">
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("grid")}
            className="rounded-none"
          >
            <Grid3X3 className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("list")}
            className="rounded-none"
          >
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Results count */}
      {(searchQuery || sourceFilter !== "all" || statusFilter !== "all") && (
        <p className="text-sm text-muted-foreground">
          Showing {filteredAndSortedItems.length} of {libraryItems.length} items
        </p>
      )}

      {/* Library Grid/List */}
      {filteredAndSortedItems.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="py-12 text-center">
            <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">No items match your search criteria</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => {
                setSearchQuery("");
                setSourceFilter("all");
                setStatusFilter("all");
              }}
            >
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      ) : viewMode === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredAndSortedItems.map((item) => (
            <LibraryCard
              key={item.id}
              item={item}
              progress={progressMap[item.sourceId]}
              onClick={() => openBook(item)}
              viewMode="grid"
              onDelete={item.source === "local" ? () => setDeleteConfirm({ open: true, id: item.sourceId, name: item.title }) : undefined}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAndSortedItems.map((item) => (
            <LibraryCard
              key={item.id}
              item={item}
              progress={progressMap[item.sourceId]}
              onClick={() => openBook(item)}
              viewMode="list"
              onDelete={item.source === "local" ? () => setDeleteConfirm({ open: true, id: item.sourceId, name: item.title }) : undefined}
            />
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => setDeleteConfirm({ ...deleteConfirm, open })}
        title="Delete Book?"
        description={`Are you sure you want to remove "${deleteConfirm.name}" from your library? This action cannot be undone.`}
        confirmText="Delete"
        variant="destructive"
        onConfirm={handleDeleteLocalBook}
      />
    </div>
  );
}
