"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { getCSRFHeaders } from "@/lib/csrf";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertCircle,
  Library,
  Search,
  Upload,
} from "lucide-react";
import { prefetchThumbnail } from "@/components/PdfThumbnail";
import {
  getAllLocalBooksMeta,
  addLocalBook,
  getLocalBookUrl,
  deleteLocalBook,
  isLocalBooksSupported,
} from "@/lib/local-books-db";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  LibraryItem,
  ReadingProgress,
  SortOption,
  SourceFilter,
  StatusFilter,
  ViewMode,
  getReadingProgress,
  saveReadingProgress,
  getBookmarks,
  saveBookmarks,
  getLibraryPrefs,
  saveLibraryPrefs,
  getReadingStatus,
  LibraryCard,
  ReaderView,
  LibraryToolbar,
} from "./digital-library-sections";

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
  const [bookmarks, setBookmarks] = useState<{ page: number; timestamp: string }[]>([]);
  const [showBookmarks, setShowBookmarks] = useState(false);

  // State for local book uploads
  const [uploading, setUploading] = useState(false);
  const [supportsLocalBooks, setSupportsLocalBooks] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string; name: string }>({ open: false, id: "", name: "" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const readerContainerRef = useRef<HTMLDivElement>(null);

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

  // Ctrl+wheel zoom handler
  useEffect(() => {
    const container = readerContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setScale(s => Math.min(4, Math.max(0.5, s + delta)));
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [selectedItem]);

  // Check local books support on client side
  useEffect(() => {
    setSupportsLocalBooks(isLocalBooksSupported());
  }, []);

  // Fetch library data
  const fetchLibraryData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch unified digital library (crowdfunding + marketplace purchases including discount code redemptions)
      const libraryRes = await fetch("/api/backer/digital-library", { headers: getCSRFHeaders() });
      if (!libraryRes.ok) throw new Error("Failed to fetch library");
      const libraryData = await libraryRes.json();

      // Transform API response to LibraryItem format with originalData
      const apiItems: LibraryItem[] = (libraryData.items || []).map((item: {
        id: string;
        title: string;
        subtitle: string;
        fileSize: number;
        coverImageUrl: string | null;
        totalPages: number | null;
        source: "crowdfunding" | "marketplace";
        sourceId: string;
        createdAt: string;
        mimeType: string | null;
      }) => ({
        id: item.id,
        title: item.title,
        subtitle: item.subtitle,
        fileSize: item.fileSize,
        coverImageUrl: item.coverImageUrl,
        totalPages: item.totalPages,
        source: item.source,
        sourceId: item.sourceId,
        createdAt: item.createdAt,
        originalData: item,
      }));

      // For crowdfunding items, trigger cover extraction for PDFs without covers
      const crowdfundingItemsNeedingCovers = apiItems.filter(
        (item) => item.source === "crowdfunding" && !item.coverImageUrl
      );
      if (crowdfundingItemsNeedingCovers.length > 0) {
        // Extract covers in background without blocking UI
        extractCoversInBackgroundForItems(crowdfundingItemsNeedingCovers);
      }

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

          // Prefetch thumbnails for local books in background
          prefetchLocalThumbnails(localBooks.map(b => b.id));
        } catch (err) {
          console.error("Error loading local books:", err);
        }
      }

      const allItems = [...apiItems, ...localItems];
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
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchLibraryData();
  }, [fetchLibraryData]);

  // Extract covers for crowdfunding PDFs in background
  const extractCoversInBackgroundForItems = async (items: LibraryItem[]) => {
    for (const item of items) {
      // Only extract covers for crowdfunding items (they use file IDs)
      if (item.source !== "crowdfunding") continue;

      try {
        const res = await fetch("/api/backer/digital-files/extract-cover", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
          body: JSON.stringify({ fileId: item.sourceId }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.coverUrl) {
            // Update the library item with the new cover
            setLibraryItems((prev) =>
              prev.map((libItem) =>
                libItem.sourceId === item.sourceId
                  ? { ...libItem, coverImageUrl: data.coverUrl, totalPages: data.totalPages }
                  : libItem
              )
            );
          }
        }
      } catch (err) {
        console.error(`Failed to extract cover for ${item.title}:`, err);
      }
    }
  };

  // Prefetch thumbnails for local books
  const prefetchLocalThumbnails = async (bookIds: string[]) => {
    for (const bookId of bookIds) {
      try {
        const blobUrl = await getLocalBookUrl(bookId);
        if (blobUrl) {
          await prefetchThumbnail(blobUrl, bookId);
          // Force re-render by triggering a small state update
          setLibraryItems(prev => [...prev]);
        }
      } catch (err) {
        console.error(`Failed to prefetch thumbnail for ${bookId}:`, err);
      }
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
    console.log("[openBook] Starting to open book:", {
      id: item.id,
      title: item.title,
      source: item.source,
      sourceId: item.sourceId,
    });

    setSelectedItem(item);
    setPdfUrl(null);
    setNumPages(0);
    setBookmarks(getBookmarks(item.sourceId));

    const saved = getReadingProgress(item.sourceId);
    setCurrentPage(saved?.currentPage ?? 1);

    try {
      if (item.source === "crowdfunding") {
        console.log("[openBook] Fetching crowdfunding file:", item.sourceId);
        const res = await fetch("/api/backer/digital-files", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
          body: JSON.stringify({ fileId: item.sourceId }),
        });
        console.log("[openBook] Crowdfunding response status:", res.status);
        if (!res.ok) throw new Error("Failed to get PDF URL");
        const { downloadUrl } = await res.json();
        console.log("[openBook] Got crowdfunding download URL");
        setPdfUrl(downloadUrl);
      } else if (item.source === "local") {
        // Local book from IndexedDB
        console.log("[openBook] Loading local book:", item.sourceId);
        const url = await getLocalBookUrl(item.sourceId);
        if (url) {
          console.log("[openBook] Got local book URL");
          setPdfUrl(url);
        } else {
          throw new Error("Failed to load local book");
        }
      } else {
        // Marketplace purchase
        console.log("[openBook] Fetching marketplace purchase:", item.sourceId);
        const apiUrl = `/api/backer/marketplace-purchases/${item.sourceId}/download`;
        console.log("[openBook] API URL:", apiUrl);
        const res = await fetch(apiUrl, {
          headers: getCSRFHeaders(),
        });
        console.log("[openBook] Marketplace response status:", res.status);
        if (!res.ok) {
          const errorText = await res.text();
          console.error("[openBook] Marketplace error response:", errorText);
          throw new Error(`Failed to get PDF URL: ${res.status}`);
        }
        const data = await res.json();
        console.log("[openBook] Got marketplace download URL:", data.downloadUrl ? "yes" : "no");
        setPdfUrl(data.downloadUrl);
      }
    } catch (err) {
      console.error("[openBook] Error:", err);
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
    return (
      <ReaderView
        selectedItem={selectedItem}
        pdfUrl={pdfUrl}
        currentPage={currentPage}
        numPages={numPages}
        scale={scale}
        isFullscreen={isFullscreen}
        isMobile={isMobile}
        bookmarks={bookmarks}
        showBookmarks={showBookmarks}
        readerContainerRef={readerContainerRef}
        onClose={closeBook}
        onAddBookmark={addBookmark}
        onRemoveBookmark={removeBookmark}
        onToggleBookmarks={() => setShowBookmarks(!showBookmarks)}
        onZoomIn={() => setScale((s) => Math.min(4, s + 0.1))}
        onZoomOut={() => setScale((s) => Math.max(0.5, s - 0.1))}
        onResetZoom={() => setScale(1)}
        onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
        onPageChange={handlePageChange}
        onReady={handleReady}
      />
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
      <LibraryToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sourceFilter={sourceFilter}
        onSourceFilterChange={setSourceFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        sortBy={sortBy}
        onSortChange={setSortBy}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

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
