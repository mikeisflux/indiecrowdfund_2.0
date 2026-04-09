"use client";

import { fetchWithRetry, apiFetch } from "@/lib/fetch-utils";
import { toast } from "sonner";
import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BookOpen,
  Search,
  Clock,
  CheckCircle,
  History,
  RefreshCw,
  Star,
  Sparkles,
  CreditCard,
  HardDrive,
  Music,
  Film,
  Filter,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Import types
import {
  MarketplaceBook,
  ReviewHistory,
  Stats,
  Transaction,
  TransactionStats,
  PdfBook,
  PdfStats,
} from "./types";

// Import components
import { StatsCards } from "./components/StatsCards";
import { BookListPanel } from "./components/BookListPanel";
import { CategoryManagementTab } from "./components/CategoryManagementTab";
import { AllBooksTab } from "./components/AllBooksTab";
import { HistoryTab } from "./components/HistoryTab";
import { TransactionsTab } from "./components/TransactionsTab";
import { PdfManagementTab } from "./components/PdfManagementTab";
import { RejectDialog } from "./components/RejectDialog";
import { AddToCategoryDialog } from "./components/AddToCategoryDialog";

export default function AdminMarketplacePage() {
  const searchParams = useSearchParams();
  const tabFromUrl = searchParams?.get("tab");
  const [activeTab, setActiveTab] = useState(tabFromUrl || "pending");

  // Books state
  const [pendingBooks, setPendingBooks] = useState<MarketplaceBook[]>([]);
  const [liveBooks, setLiveBooks] = useState<MarketplaceBook[]>([]);
  const [allBooks, setAllBooks] = useState<MarketplaceBook[]>([]);
  const [selectedBook, setSelectedBook] = useState<MarketplaceBook | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [mediaCategoryFilter, setMediaCategoryFilter] = useState<"all" | "comics" | "music" | "movies">("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReordering, setIsReordering] = useState(false);

  // Stats state
  const [stats, setStats] = useState<Stats>({
    pending: 0,
    live: 0,
    approvedToday: 0,
    rejectedToday: 0,
    totalRevenue: 0,
    totalSales: 0,
  });

  // Review history state
  const [reviewHistory, setReviewHistory] = useState<ReviewHistory[]>([]);

  // Transactions state
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionStats, setTransactionStats] = useState<TransactionStats>({
    totalRevenue: 0,
    totalPlatformFees: 0,
    totalCreatorPayouts: 0,
    totalTransactions: 0,
    todayRevenue: 0,
    todayPlatformFees: 0,
    todayTransactions: 0,
  });
  const [transactionPage, setTransactionPage] = useState(1);
  const [transactionTotalPages, setTransactionTotalPages] = useState(1);
  const [transactionSearch, setTransactionSearch] = useState("");
  const [transactionStatusFilter, setTransactionStatusFilter] = useState("all");
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);

  // PDF Management state
  const [pdfBooks, setPdfBooks] = useState<PdfBook[]>([]);
  const [pdfStats, setPdfStats] = useState<PdfStats>({
    total: 0,
    withPdf: 0,
    missingPdf: 0,
    missingSize: 0,
    liveWithIssues: 0,
  });
  const [pdfFilter, setPdfFilter] = useState<"all" | "missing-pdf" | "has-pdf">("all");
  const [pdfSearch, setPdfSearch] = useState("");
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [isSavingPdf, setIsSavingPdf] = useState(false);

  // Dialog state
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addDialogCategory, setAddDialogCategory] = useState<"featured" | "staffPick">("featured");

  // Computed values
  const featuredBooks = liveBooks
    .filter((b) => b.isFeatured)
    .sort((a, b) => (a.featuredOrder || 999) - (b.featuredOrder || 999));

  const staffPickBooks = liveBooks
    .filter((b) => b.isStaffPick)
    .sort((a, b) => (a.staffPickOrder || 999) - (b.staffPickOrder || 999));

  const availableForFeatured = liveBooks.filter((b) => !b.isFeatured);
  const availableForStaffPick = liveBooks.filter((b) => !b.isStaffPick);

  const matchesMediaFilter = (book: MarketplaceBook) =>
    mediaCategoryFilter === "all" || book.mediaCategory === mediaCategoryFilter;

  const matchesSearch = (book: MarketplaceBook) =>
    book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    book.creator.name.toLowerCase().includes(searchQuery.toLowerCase());

  const filteredPending = pendingBooks.filter((b) => matchesMediaFilter(b) && matchesSearch(b));
  const filteredLive = liveBooks.filter((b) => matchesMediaFilter(b) && matchesSearch(b));
  const filteredAll = allBooks.filter((b) => matchesMediaFilter(b) && matchesSearch(b));

  // Fetch functions
  const fetchBooks = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetchWithRetry("/api/admin/marketplace/books");
      if (response.ok) {
        const data = await response.json();
        setPendingBooks(data.pendingBooks || []);
        setLiveBooks(data.liveBooks || []);
        setAllBooks(data.allBooks || []);
        setStats(data.stats || {
          pending: 0,
          live: 0,
          approvedToday: 0,
          rejectedToday: 0,
          totalRevenue: 0,
          totalSales: 0,
        });
      }
    } catch (error) {
      console.error("Error fetching books:", error);
      toast.error("Failed to fetch marketplace books");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const response = await fetchWithRetry("/api/admin/marketplace/history");
      if (response.ok) {
        const data = await response.json();
        setReviewHistory(data.reviews || []);
      }
    } catch (error) {
      console.error("Error fetching history:", error);
    }
  }, []);

  const fetchTransactions = useCallback(async (page = 1, search = "", status = "all") => {
    try {
      setIsLoadingTransactions(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: "50",
        status,
        search,
      });
      const response = await fetchWithRetry(`/api/admin/marketplace/transactions?${params}`);
      if (response.ok) {
        const data = await response.json();
        setTransactions(data.transactions || []);
        setTransactionStats(data.stats || {
          totalRevenue: 0,
          totalPlatformFees: 0,
          totalCreatorPayouts: 0,
          totalTransactions: 0,
          todayRevenue: 0,
          todayPlatformFees: 0,
          todayTransactions: 0,
        });
        setTransactionPage(data.pagination?.page || 1);
        setTransactionTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (error) {
      console.error("Error fetching transactions:", error);
      toast.error("Failed to fetch transactions");
    } finally {
      setIsLoadingTransactions(false);
    }
  }, []);

  const fetchPdfBooks = useCallback(async (filter = "all", search = "") => {
    try {
      setIsLoadingPdf(true);
      const params = new URLSearchParams({
        filter,
        search,
        limit: "100",
      });
      const response = await fetchWithRetry(`/api/admin/marketplace/pdf-management?${params}`);
      if (response.ok) {
        const data = await response.json();
        setPdfBooks(data.books || []);
        setPdfStats(data.stats || {
          total: 0,
          withPdf: 0,
          missingPdf: 0,
          missingSize: 0,
          liveWithIssues: 0,
        });
      }
    } catch (error) {
      console.error("Error fetching PDF management data:", error);
      toast.error("Failed to fetch PDF data");
    } finally {
      setIsLoadingPdf(false);
    }
  }, []);

  // Effects
  useEffect(() => {
    fetchBooks();
    fetchHistory();
  }, [fetchBooks, fetchHistory]);

  useEffect(() => {
    if (activeTab === "transactions") {
      fetchTransactions(transactionPage, transactionSearch, transactionStatusFilter);
    }
  }, [activeTab, transactionPage, transactionSearch, transactionStatusFilter, fetchTransactions]);

  useEffect(() => {
    if (activeTab === "pdf-management") {
      fetchPdfBooks(pdfFilter, pdfSearch);
    }
  }, [activeTab, pdfFilter, pdfSearch, fetchPdfBooks]);

  // Event handlers
  const handleApprove = async () => {
    if (!selectedBook) return;

    setIsSubmitting(true);
    try {
      const response = await apiFetch(`/api/admin/marketplace/books/${selectedBook.id}/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          
        },
        body: JSON.stringify({ action: "approve" }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to approve book");
      }

      toast.success("Book approved and published!");
      setSelectedBook(null);
      fetchBooks();
      fetchHistory();
    } catch (error) {
      console.error("Error approving book:", error);
      toast.error(error instanceof Error ? error.message : "Failed to approve book");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!selectedBook || !rejectionReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await apiFetch(`/api/admin/marketplace/books/${selectedBook.id}/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          
        },
        body: JSON.stringify({
          action: "reject",
          reason: rejectionReason.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to reject book");
      }

      toast.success("Book rejected");
      setShowRejectDialog(false);
      setRejectionReason("");
      setSelectedBook(null);
      fetchBooks();
      fetchHistory();
    } catch (error) {
      console.error("Error rejecting book:", error);
      toast.error(error instanceof Error ? error.message : "Failed to reject book");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleFeatured = async (bookId?: string) => {
    const book = bookId ? liveBooks.find((b) => b.id === bookId) : selectedBook;
    if (!book) return;

    setIsSubmitting(true);
    try {
      const response = await apiFetch(`/api/admin/marketplace/books/${book.id}/feature`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          
        },
        body: JSON.stringify({ featured: !book.isFeatured }),
      });

      if (!response.ok) {
        throw new Error("Failed to update featured status");
      }

      toast.success(book.isFeatured ? "Removed from Featured" : "Added to Featured");
      if (selectedBook?.id === book.id) {
        setSelectedBook({ ...selectedBook, isFeatured: !selectedBook.isFeatured });
      }
      fetchBooks();
    } catch (error) {
      console.error("Error toggling featured:", error);
      toast.error("Failed to update featured status");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStaffPick = async (bookId?: string) => {
    const book = bookId ? liveBooks.find((b) => b.id === bookId) : selectedBook;
    if (!book) return;

    setIsSubmitting(true);
    try {
      const response = await apiFetch(`/api/admin/marketplace/books/${book.id}/staff-pick`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          
        },
        body: JSON.stringify({ staffPick: !book.isStaffPick }),
      });

      if (!response.ok) {
        throw new Error("Failed to update staff pick status");
      }

      toast.success(book.isStaffPick ? "Removed from Staff Picks" : "Added to Staff Picks");
      if (selectedBook?.id === book.id) {
        setSelectedBook({ ...selectedBook, isStaffPick: !selectedBook.isStaffPick });
      }
      fetchBooks();
    } catch (error) {
      console.error("Error toggling staff pick:", error);
      toast.error("Failed to update staff pick status");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReorder = async (category: "featured" | "staffPick", bookIds: string[]) => {
    setIsReordering(true);
    try {
      const response = await apiFetch("/api/admin/marketplace/books/reorder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          
        },
        body: JSON.stringify({ category, bookIds }),
      });

      if (!response.ok) {
        throw new Error("Failed to update order");
      }

      toast.success("Order updated");
      fetchBooks();
    } catch (error) {
      console.error("Error reordering:", error);
      toast.error("Failed to update order");
    } finally {
      setIsReordering(false);
    }
  };

  const handleMoveBook = (category: "featured" | "staffPick", index: number) => {
    const books = category === "featured" ? [...featuredBooks] : [...staffPickBooks];
    const newIndex = index - 1;

    if (newIndex < 0 || newIndex >= books.length) return;

    [books[index], books[newIndex]] = [books[newIndex], books[index]];
    handleReorder(category, books.map((b) => b.id));
  };

  const handleMoveBookDown = (category: "featured" | "staffPick", index: number) => {
    const books = category === "featured" ? [...featuredBooks] : [...staffPickBooks];
    const newIndex = index + 1;

    if (newIndex < 0 || newIndex >= books.length) return;

    [books[index], books[newIndex]] = [books[newIndex], books[index]];
    handleReorder(category, books.map((b) => b.id));
  };

  const handleAddToCategory = async (bookId: string) => {
    if (addDialogCategory === "featured") {
      await handleToggleFeatured(bookId);
    } else {
      await handleToggleStaffPick(bookId);
    }
    setShowAddDialog(false);
  };

  const handleBulkFixSizes = async () => {
    setIsSavingPdf(true);
    try {
      const response = await apiFetch("/api/admin/marketplace/pdf-management", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to fix file sizes");
      }

      const result = await response.json();

      if (result.fixed > 0 && result.failed === 0) {
        toast.success(`Fixed all ${result.fixed} books successfully`);
      } else if (result.fixed > 0 && result.failed > 0) {
        toast.success(`Fixed ${result.fixed} of ${result.total} books`);
        // Show details of failures
        const failedResults = (result.results || []).filter(
          (r: { status: string }) => r.status !== "fixed"
        );
        if (failedResults.length > 0) {
          const failureDetails = failedResults
            .slice(0, 5)
            .map((r: { title?: string; status: string }) => `${r.title || "Unknown"}: ${r.status}`)
            .join("\n");
          toast.error(
            `${result.failed} books could not be fixed:\n${failureDetails}${failedResults.length > 5 ? `\n...and ${failedResults.length - 5} more` : ""}`,
            { duration: 10000 }
          );
        }
      } else if (result.fixed === 0 && result.failed > 0) {
        const failedResults = (result.results || []).filter(
          (r: { status: string }) => r.status !== "fixed"
        );
        const failureDetails = failedResults
          .slice(0, 5)
          .map((r: { title?: string; status: string }) => `${r.title || "Unknown"}: ${r.status}`)
          .join("\n");
        toast.error(
          `Could not fix any of the ${result.total} books:\n${failureDetails}${failedResults.length > 5 ? `\n...and ${failedResults.length - 5} more` : ""}`,
          { duration: 10000 }
        );
      } else {
        toast.info(result.message || "No books needed fixing");
      }

      fetchPdfBooks(pdfFilter, pdfSearch);
    } catch (error) {
      console.error("Error bulk-fixing sizes:", error);
      toast.error(error instanceof Error ? error.message : "Failed to fix file sizes");
    } finally {
      setIsSavingPdf(false);
    }
  };

  const handleR2Scan = async (autoFix: boolean) => {
    setIsSavingPdf(true);
    try {
      const response = await apiFetch("/api/admin/marketplace/pdf-management", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          
        },
        body: JSON.stringify({ action: autoFix ? "auto-fix" : "scan" }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to scan R2");
      }

      const result = await response.json();

      if (autoFix && result.fixed > 0) {
        toast.success(`Auto-fixed ${result.fixed} books by matching R2 files`);
      } else if (autoFix && result.fixed === 0 && result.matched === 0) {
        toast.error(
          `No matches found. ${result.r2FileCount} files in R2, ${result.booksWithIssues} books with issues.`,
          { duration: 8000 }
        );
      } else if (!autoFix) {
        // Scan mode - show results
        if (result.matched > 0) {
          toast.success(
            `Found ${result.matched} potential matches out of ${result.booksWithIssues} books. ${result.r2FileCount} total files in R2. Click "Auto-Fix R2 URLs" to apply.`,
            { duration: 10000 }
          );
        } else {
          toast.error(
            `No matches found. ${result.r2FileCount} files in R2, ${result.booksWithIssues} books with issues. Files may need to be re-uploaded.`,
            { duration: 10000 }
          );
        }
      }

      if (result.unmatched > 0 && autoFix) {
        const unmatchedBooks = (result.matches || [])
          .filter((m: { matchedKey: string | null }) => !m.matchedKey)
          .slice(0, 5)
          .map((m: { bookTitle: string; creatorFiles: number }) =>
            `${m.bookTitle} (${m.creatorFiles} files by creator)`
          )
          .join("\n");
        toast.error(
          `${result.unmatched} books still unmatched:\n${unmatchedBooks}`,
          { duration: 10000 }
        );
      }

      fetchPdfBooks(pdfFilter, pdfSearch);
    } catch (error) {
      console.error("Error scanning R2:", error);
      toast.error(error instanceof Error ? error.message : "Failed to scan R2");
    } finally {
      setIsSavingPdf(false);
    }
  };

  const handleSavePdf = async (bookId: string, url: string, fileName: string, fileSize: string) => {
    setIsSavingPdf(true);
    try {
      const updateData: Record<string, string | number | null> = {};
      if (url) updateData.pdfFileUrl = url;
      if (fileName) updateData.pdfFileName = fileName;
      if (fileSize) updateData.pdfFileSize = parseInt(fileSize, 10);

      const response = await apiFetch(`/api/admin/marketplace/books/${bookId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update book");
      }

      toast.success("PDF info updated successfully");
      fetchPdfBooks(pdfFilter, pdfSearch);
    } catch (error) {
      console.error("Error updating book:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update book");
    } finally {
      setIsSavingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Marketplace Management</h1>
          <p className="text-muted-foreground">
            Review submissions and manage homepage categories
          </p>
        </div>
        <Button
          onClick={fetchBooks}
          variant="outline"
          size="sm"
          className="w-full sm:w-auto"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <StatsCards stats={stats} />

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div className="overflow-x-auto pb-1">
          <TabsList className="inline-flex w-max bg-muted/50 border border-border">
            <TabsTrigger value="pending" className="data-[state=active]:bg-background text-muted-foreground data-[state=active]:text-foreground">
              <Clock className="w-4 h-4 mr-2" />
              Pending
              {stats.pending > 0 && (
                <Badge className="ml-2 bg-amber-100 text-amber-600 border-amber-200">{stats.pending}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="featured" className="data-[state=active]:bg-background text-muted-foreground data-[state=active]:text-foreground">
              <Star className="w-4 h-4 mr-2" />
              Featured
              <Badge className="ml-2 bg-amber-100 text-amber-600 border-amber-200">{featuredBooks.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="staffpicks" className="data-[state=active]:bg-background text-muted-foreground data-[state=active]:text-foreground">
              <Sparkles className="w-4 h-4 mr-2" />
              Staff Picks
              <Badge className="ml-2 bg-purple-100 text-purple-600 border-purple-200">{staffPickBooks.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="live" className="data-[state=active]:bg-background text-muted-foreground data-[state=active]:text-foreground">
              <CheckCircle className="w-4 h-4 mr-2" />
              Live
            </TabsTrigger>
            <TabsTrigger value="all" className="data-[state=active]:bg-background text-muted-foreground data-[state=active]:text-foreground">
              <BookOpen className="w-4 h-4 mr-2" />
              All Items
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-background text-muted-foreground data-[state=active]:text-foreground">
              <History className="w-4 h-4 mr-2" />
              History
            </TabsTrigger>
            <TabsTrigger value="transactions" className="data-[state=active]:bg-background text-muted-foreground data-[state=active]:text-foreground">
              <CreditCard className="w-4 h-4 mr-2" />
              Transactions
            </TabsTrigger>
            <TabsTrigger value="pdf-management" className="data-[state=active]:bg-background text-muted-foreground data-[state=active]:text-foreground">
              <HardDrive className="w-4 h-4 mr-2" />
              PDF Files
              {pdfStats.liveWithIssues > 0 && (
                <Badge className="ml-2 bg-rose-100 text-rose-600 border-rose-200">{pdfStats.liveWithIssues}</Badge>
              )}
            </TabsTrigger>
          </TabsList>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Select value={mediaCategoryFilter} onValueChange={(v) => setMediaCategoryFilter(v as "all" | "comics" | "music" | "movies")}>
              <SelectTrigger className="w-[130px] bg-muted/50 border-border">
                <Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="comics">
                  <span className="flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" /> Comics</span>
                </SelectItem>
                <SelectItem value="music">
                  <span className="flex items-center gap-1.5"><Music className="w-3.5 h-3.5" /> Music</span>
                </SelectItem>
                <SelectItem value="movies">
                  <span className="flex items-center gap-1.5"><Film className="w-3.5 h-3.5" /> Movies</span>
                </SelectItem>
              </SelectContent>
            </Select>
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
              <Input
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-muted/50 border-border text-foreground placeholder:text-muted-foreground/70"
              />
            </div>
          </div>
        </div>

        {/* Pending Tab */}
        <TabsContent value="pending">
          <BookListPanel
            books={filteredPending}
            selectedBook={selectedBook}
            onSelectBook={setSelectedBook}
            onApprove={handleApprove}
            onReject={() => setShowRejectDialog(true)}
            onToggleFeatured={() => handleToggleFeatured()}
            onToggleStaffPick={() => handleToggleStaffPick()}
            isLoading={isLoading}
            isSubmitting={isSubmitting}
            emptyMessage="No pending submissions"
            title="Pending Submissions"
          />
        </TabsContent>

        {/* Featured Tab */}
        <TabsContent value="featured">
          <CategoryManagementTab
            category="featured"
            books={featuredBooks}
            onMoveUp={(index) => handleMoveBook("featured", index)}
            onMoveDown={(index) => handleMoveBookDown("featured", index)}
            onRemove={(bookId) => handleToggleFeatured(bookId)}
            onAddClick={() => {
              setAddDialogCategory("featured");
              setShowAddDialog(true);
            }}
            isUpdating={isReordering || isSubmitting}
          />
        </TabsContent>

        {/* Staff Picks Tab */}
        <TabsContent value="staffpicks">
          <CategoryManagementTab
            category="staffPick"
            books={staffPickBooks}
            onMoveUp={(index) => handleMoveBook("staffPick", index)}
            onMoveDown={(index) => handleMoveBookDown("staffPick", index)}
            onRemove={(bookId) => handleToggleStaffPick(bookId)}
            onAddClick={() => {
              setAddDialogCategory("staffPick");
              setShowAddDialog(true);
            }}
            isUpdating={isReordering || isSubmitting}
          />
        </TabsContent>

        {/* Live Tab */}
        <TabsContent value="live">
          <BookListPanel
            books={filteredLive}
            selectedBook={selectedBook}
            onSelectBook={setSelectedBook}
            onApprove={handleApprove}
            onReject={() => setShowRejectDialog(true)}
            onToggleFeatured={() => handleToggleFeatured()}
            onToggleStaffPick={() => handleToggleStaffPick()}
            isLoading={isLoading}
            isSubmitting={isSubmitting}
            emptyMessage="No live books"
            title="Live Books"
          />
        </TabsContent>

        {/* All Books Tab */}
        <TabsContent value="all">
          <AllBooksTab
            books={filteredAll}
            onBookClick={(book) => {
              setSelectedBook(book);
              setActiveTab(book.status === "PENDING_REVIEW" ? "pending" : "live");
            }}
          />
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <HistoryTab reviewHistory={reviewHistory} />
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions">
          <TransactionsTab
            transactions={transactions}
            transactionStats={transactionStats}
            isLoading={isLoadingTransactions}
            search={transactionSearch}
            onSearchChange={(search) => {
              setTransactionSearch(search);
              setTransactionPage(1);
            }}
            statusFilter={transactionStatusFilter}
            onStatusFilterChange={(status) => {
              setTransactionStatusFilter(status);
              setTransactionPage(1);
            }}
            page={transactionPage}
            totalPages={transactionTotalPages}
            onPageChange={setTransactionPage}
            onRefresh={() => fetchTransactions(transactionPage, transactionSearch, transactionStatusFilter)}
          />
        </TabsContent>

        {/* PDF Management Tab */}
        <TabsContent value="pdf-management">
          <PdfManagementTab
            pdfBooks={pdfBooks}
            pdfStats={pdfStats}
            isLoading={isLoadingPdf}
            filter={pdfFilter}
            onFilterChange={setPdfFilter}
            search={pdfSearch}
            onSearchChange={setPdfSearch}
            onRefresh={() => fetchPdfBooks(pdfFilter, pdfSearch)}
            onSave={handleSavePdf}
            onBulkFixSizes={handleBulkFixSizes}
            onR2Scan={() => handleR2Scan(false)}
            onR2AutoFix={() => handleR2Scan(true)}
            isSaving={isSavingPdf}
          />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <RejectDialog
        open={showRejectDialog}
        onOpenChange={setShowRejectDialog}
        rejectionReason={rejectionReason}
        onReasonChange={setRejectionReason}
        onReject={handleReject}
        isSubmitting={isSubmitting}
      />

      <AddToCategoryDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        category={addDialogCategory}
        availableBooks={addDialogCategory === "featured" ? availableForFeatured : availableForStaffPick}
        onAdd={handleAddToCategory}
      />
    </div>
  );
}
