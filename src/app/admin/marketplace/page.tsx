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
} from "lucide-react";

import {
  MarketplaceBook,
  ReviewHistory,
  Stats,
  Transaction,
  TransactionStats,
  PdfBook,
  PdfStats,
} from "./types";

import { StatsCards } from "./components/StatsCards";
import { BookListPanel } from "./components/BookListPanel";
import { CategoryManagementTab } from "./components/CategoryManagementTab";
import { AllBooksTab } from "./components/AllBooksTab";
import { HistoryTab } from "./components/HistoryTab";
import { TransactionsTab } from "./components/TransactionsTab";
import { PdfManagementTab } from "./components/PdfManagementTab";
import { RejectDialog } from "./components/RejectDialog";
import { AddToCategoryDialog } from "./components/AddToCategoryDialog";

// ─── Category config ─────────────────────────────────────────────────

const CATEGORIES = [
  { value: "comics", label: "Comics", icon: BookOpen, color: "text-blue-500" },
  { value: "music", label: "Music", icon: Music, color: "text-emerald-500" },
  { value: "movies", label: "Movies", icon: Film, color: "text-rose-500" },
] as const;

type MediaCategory = "comics" | "music" | "movies";

// ─── Main Component ──────────────────────────────────────────────────

export default function AdminMarketplacePage() {
  const searchParams = useSearchParams();
  const categoryFromUrl = (searchParams?.get("category") as MediaCategory) || "comics";
  const tabFromUrl = searchParams?.get("tab") || "pending";

  // Top-level category
  const [activeCategory, setActiveCategory] = useState<MediaCategory>(categoryFromUrl);
  // Sub-tab within category
  const [activeTab, setActiveTab] = useState(tabFromUrl);

  // Books state
  const [pendingBooks, setPendingBooks] = useState<MarketplaceBook[]>([]);
  const [liveBooks, setLiveBooks] = useState<MarketplaceBook[]>([]);
  const [allBooks, setAllBooks] = useState<MarketplaceBook[]>([]);
  const [selectedBook, setSelectedBook] = useState<MarketplaceBook | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReordering, setIsReordering] = useState(false);

  // Stats
  const [stats, setStats] = useState<Stats>({ pending: 0, live: 0, approvedToday: 0, rejectedToday: 0, totalRevenue: 0, totalSales: 0 });

  // Review history
  const [reviewHistory, setReviewHistory] = useState<ReviewHistory[]>([]);

  // Transactions
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionStats, setTransactionStats] = useState<TransactionStats>({
    totalRevenue: 0, totalPlatformFees: 0, totalCreatorPayouts: 0,
    totalTransactions: 0, todayRevenue: 0, todayPlatformFees: 0, todayTransactions: 0,
  });
  const [transactionPage, setTransactionPage] = useState(1);
  const [transactionTotalPages, setTransactionTotalPages] = useState(1);
  const [transactionSearch, setTransactionSearch] = useState("");
  const [transactionStatusFilter, setTransactionStatusFilter] = useState("all");
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);

  // File management
  const [pdfBooks, setPdfBooks] = useState<PdfBook[]>([]);
  const [pdfStats, setPdfStats] = useState<PdfStats>({ total: 0, withPdf: 0, missingPdf: 0, missingSize: 0, liveWithIssues: 0 });
  const [pdfFilter, setPdfFilter] = useState<"all" | "missing-pdf" | "has-pdf">("all");
  const [pdfSearch, setPdfSearch] = useState("");
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [isSavingPdf, setIsSavingPdf] = useState(false);

  // Dialogs
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addDialogCategory, setAddDialogCategory] = useState<"featured" | "staffPick">("featured");

  // ─── Filtered lists by active media category ─────────────────────

  const byCat = (b: MarketplaceBook) => b.mediaCategory === activeCategory;
  const bySearch = (b: MarketplaceBook) =>
    b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.creator.name.toLowerCase().includes(searchQuery.toLowerCase());

  const catPending = pendingBooks.filter((b) => byCat(b) && bySearch(b));
  const catLive = liveBooks.filter((b) => byCat(b) && bySearch(b));
  const catAll = allBooks.filter((b) => byCat(b) && bySearch(b));
  const catFeatured = liveBooks
    .filter((b) => byCat(b) && b.isFeatured)
    .sort((a, b) => (a.featuredOrder || 999) - (b.featuredOrder || 999));
  const catStaffPicks = liveBooks
    .filter((b) => byCat(b) && b.isStaffPick)
    .sort((a, b) => (a.staffPickOrder || 999) - (b.staffPickOrder || 999));
  const catAvailableFeatured = liveBooks.filter((b) => byCat(b) && !b.isFeatured);
  const catAvailableStaffPick = liveBooks.filter((b) => byCat(b) && !b.isStaffPick);

  // Category-specific counts
  const catPendingCount = pendingBooks.filter(byCat).length;

  // Category label for messages
  const categoryLabel = CATEGORIES.find((c) => c.value === activeCategory)?.label || "Items";

  // ─── Fetch functions ─────────────────────────────────────────────

  const fetchBooks = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetchWithRetry("/api/admin/marketplace/books");
      if (response.ok) {
        const data = await response.json();
        setPendingBooks(data.pendingBooks || []);
        setLiveBooks(data.liveBooks || []);
        setAllBooks(data.allBooks || []);
        setStats(data.stats || { pending: 0, live: 0, approvedToday: 0, rejectedToday: 0, totalRevenue: 0, totalSales: 0 });
      }
    } catch (error) {
      console.error("Error fetching books:", error);
      toast.error("Failed to fetch marketplace data");
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
      const params = new URLSearchParams({ page: String(page), limit: "50", status, search });
      const response = await fetchWithRetry(`/api/admin/marketplace/transactions?${params}`);
      if (response.ok) {
        const data = await response.json();
        setTransactions(data.transactions || []);
        setTransactionStats(data.stats || { totalRevenue: 0, totalPlatformFees: 0, totalCreatorPayouts: 0, totalTransactions: 0, todayRevenue: 0, todayPlatformFees: 0, todayTransactions: 0 });
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
      const params = new URLSearchParams({ filter, search, limit: "100" });
      const response = await fetchWithRetry(`/api/admin/marketplace/pdf-management?${params}`);
      if (response.ok) {
        const data = await response.json();
        setPdfBooks(data.books || []);
        setPdfStats(data.stats || { total: 0, withPdf: 0, missingPdf: 0, missingSize: 0, liveWithIssues: 0 });
      }
    } catch (error) {
      console.error("Error fetching file data:", error);
      toast.error("Failed to fetch file data");
    } finally {
      setIsLoadingPdf(false);
    }
  }, []);

  // ─── Effects ─────────────────────────────────────────────────────

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
    if (activeTab === "files") {
      fetchPdfBooks(pdfFilter, pdfSearch);
    }
  }, [activeTab, pdfFilter, pdfSearch, fetchPdfBooks]);

  // Clear selected book when switching categories
  useEffect(() => {
    setSelectedBook(null);
    setSearchQuery("");
  }, [activeCategory]);

  // ─── Handlers ────────────────────────────────────────────────────

  const handleApprove = async () => {
    if (!selectedBook) return;
    setIsSubmitting(true);
    try {
      const response = await apiFetch(`/api/admin/marketplace/books/${selectedBook.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      if (!response.ok) { const d = await response.json(); throw new Error(d.error || "Failed"); }
      toast.success(`${categoryLabel.slice(0, -1)} approved and published!`);
      setSelectedBook(null);
      fetchBooks();
      fetchHistory();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to approve");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!selectedBook || !rejectionReason.trim()) { toast.error("Please provide a rejection reason"); return; }
    setIsSubmitting(true);
    try {
      const response = await apiFetch(`/api/admin/marketplace/books/${selectedBook.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", reason: rejectionReason.trim() }),
      });
      if (!response.ok) { const d = await response.json(); throw new Error(d.error || "Failed"); }
      toast.success(`${categoryLabel.slice(0, -1)} rejected`);
      setShowRejectDialog(false);
      setRejectionReason("");
      setSelectedBook(null);
      fetchBooks();
      fetchHistory();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reject");
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featured: !book.isFeatured }),
      });
      if (!response.ok) throw new Error("Failed");
      toast.success(book.isFeatured ? "Removed from Featured" : "Added to Featured");
      if (selectedBook?.id === book.id) setSelectedBook({ ...selectedBook, isFeatured: !selectedBook.isFeatured });
      fetchBooks();
    } catch { toast.error("Failed to update featured status"); }
    finally { setIsSubmitting(false); }
  };

  const handleToggleStaffPick = async (bookId?: string) => {
    const book = bookId ? liveBooks.find((b) => b.id === bookId) : selectedBook;
    if (!book) return;
    setIsSubmitting(true);
    try {
      const response = await apiFetch(`/api/admin/marketplace/books/${book.id}/staff-pick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffPick: !book.isStaffPick }),
      });
      if (!response.ok) throw new Error("Failed");
      toast.success(book.isStaffPick ? "Removed from Staff Picks" : "Added to Staff Picks");
      if (selectedBook?.id === book.id) setSelectedBook({ ...selectedBook, isStaffPick: !selectedBook.isStaffPick });
      fetchBooks();
    } catch { toast.error("Failed to update staff pick status"); }
    finally { setIsSubmitting(false); }
  };

  const handleReorder = async (category: "featured" | "staffPick", bookIds: string[]) => {
    setIsReordering(true);
    try {
      const response = await apiFetch("/api/admin/marketplace/books/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, bookIds }),
      });
      if (!response.ok) throw new Error("Failed");
      toast.success("Order updated");
      fetchBooks();
    } catch { toast.error("Failed to update order"); }
    finally { setIsReordering(false); }
  };

  const handleMoveBook = (category: "featured" | "staffPick", index: number) => {
    const books = category === "featured" ? [...catFeatured] : [...catStaffPicks];
    if (index - 1 < 0) return;
    [books[index], books[index - 1]] = [books[index - 1], books[index]];
    handleReorder(category, books.map((b) => b.id));
  };

  const handleMoveBookDown = (category: "featured" | "staffPick", index: number) => {
    const books = category === "featured" ? [...catFeatured] : [...catStaffPicks];
    if (index + 1 >= books.length) return;
    [books[index], books[index + 1]] = [books[index + 1], books[index]];
    handleReorder(category, books.map((b) => b.id));
  };

  const handleAddToCategory = async (bookId: string) => {
    if (addDialogCategory === "featured") await handleToggleFeatured(bookId);
    else await handleToggleStaffPick(bookId);
    setShowAddDialog(false);
  };

  const handleBulkFixSizes = async () => {
    setIsSavingPdf(true);
    try {
      const response = await apiFetch("/api/admin/marketplace/pdf-management", { method: "PATCH", headers: { "Content-Type": "application/json" } });
      if (!response.ok) { const d = await response.json(); throw new Error(d.error || "Failed"); }
      const result = await response.json();
      if (result.fixed > 0) toast.success(`Fixed ${result.fixed} file sizes`);
      else toast.info(result.message || "No files needed fixing");
      fetchPdfBooks(pdfFilter, pdfSearch);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Failed to fix file sizes"); }
    finally { setIsSavingPdf(false); }
  };

  const handleR2Scan = async (autoFix: boolean) => {
    setIsSavingPdf(true);
    try {
      const response = await apiFetch("/api/admin/marketplace/pdf-management", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: autoFix ? "auto-fix" : "scan" }),
      });
      if (!response.ok) { const d = await response.json(); throw new Error(d.error || "Failed"); }
      const result = await response.json();
      if (autoFix && result.fixed > 0) toast.success(`Auto-fixed ${result.fixed} files`);
      else if (!autoFix && result.matched > 0) toast.success(`Found ${result.matched} potential matches. Click Auto-Fix to apply.`, { duration: 8000 });
      else toast.info(`No matches found. ${result.r2FileCount || 0} files in R2.`);
      fetchPdfBooks(pdfFilter, pdfSearch);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Failed"); }
    finally { setIsSavingPdf(false); }
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });
      if (!response.ok) { const d = await response.json(); throw new Error(d.error || "Failed"); }
      toast.success("File info updated");
      fetchPdfBooks(pdfFilter, pdfSearch);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Failed to update"); }
    finally { setIsSavingPdf(false); }
  };

  // ─── Render ──────────────────────────────────────────────────────

  const activeCatConfig = CATEGORIES.find((c) => c.value === activeCategory)!;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Marketplace Management</h1>
          <p className="text-muted-foreground">Review submissions, curate featured content, and manage transactions</p>
        </div>
        <Button
          variant="outline"
          onClick={() => { fetchBooks(); fetchHistory(); }}
          className="w-full sm:w-auto"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <StatsCards stats={stats} />

      {/* ─── Top-Level Category Selector ─────────────────────────── */}
      <div className="border-b border-border">
        <div className="flex">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.value;
            const catCount = pendingBooks.filter((b) => b.mediaCategory === cat.value).length;
            return (
              <button
                key={cat.value}
                onClick={() => setActiveCategory(cat.value as MediaCategory)}
                className={`flex items-center gap-2 px-4 sm:px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? `border-current ${cat.color}`
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{cat.label}</span>
                {catCount > 0 && (
                  <Badge className="bg-amber-100 text-amber-600 border-amber-200 text-[10px] px-1.5 py-0">
                    {catCount}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Sub-Tabs for Active Category ────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div className="overflow-x-auto pb-1">
            <TabsList className="inline-flex w-max bg-muted/50 border border-border">
              <TabsTrigger value="pending" className="data-[state=active]:bg-background text-muted-foreground data-[state=active]:text-foreground">
                <Clock className="w-4 h-4 mr-1.5" />
                Pending
                {catPendingCount > 0 && (
                  <Badge className="ml-1.5 bg-amber-100 text-amber-600 border-amber-200 text-[10px] px-1.5">{catPendingCount}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="featured" className="data-[state=active]:bg-background text-muted-foreground data-[state=active]:text-foreground">
                <Star className="w-4 h-4 mr-1.5" />
                Featured
                <Badge className="ml-1.5 bg-amber-100 text-amber-600 border-amber-200 text-[10px] px-1.5">{catFeatured.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="staffpicks" className="data-[state=active]:bg-background text-muted-foreground data-[state=active]:text-foreground">
                <Sparkles className="w-4 h-4 mr-1.5" />
                Staff Picks
                <Badge className="ml-1.5 bg-purple-100 text-purple-600 border-purple-200 text-[10px] px-1.5">{catStaffPicks.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="live" className="data-[state=active]:bg-background text-muted-foreground data-[state=active]:text-foreground">
                <CheckCircle className="w-4 h-4 mr-1.5" />
                Live
              </TabsTrigger>
              <TabsTrigger value="all" className="data-[state=active]:bg-background text-muted-foreground data-[state=active]:text-foreground">
                <activeCatConfig.icon className="w-4 h-4 mr-1.5" />
                All {categoryLabel}
              </TabsTrigger>
              <TabsTrigger value="history" className="data-[state=active]:bg-background text-muted-foreground data-[state=active]:text-foreground">
                <History className="w-4 h-4 mr-1.5" />
                History
              </TabsTrigger>
              <TabsTrigger value="transactions" className="data-[state=active]:bg-background text-muted-foreground data-[state=active]:text-foreground">
                <CreditCard className="w-4 h-4 mr-1.5" />
                Transactions
              </TabsTrigger>
              <TabsTrigger value="files" className="data-[state=active]:bg-background text-muted-foreground data-[state=active]:text-foreground">
                <HardDrive className="w-4 h-4 mr-1.5" />
                Files
                {pdfStats.liveWithIssues > 0 && (
                  <Badge className="ml-1.5 bg-rose-100 text-rose-600 border-rose-200 text-[10px] px-1.5">{pdfStats.liveWithIssues}</Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Search — only for content tabs */}
          {["pending", "live", "all", "featured", "staffpicks"].includes(activeTab) && (
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
              <Input
                placeholder={`Search ${categoryLabel.toLowerCase()}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-muted/50 border-border"
              />
            </div>
          )}
        </div>

        {/* ─── Tab Content ────────────────────────────────────────── */}

        <TabsContent value="pending">
          <BookListPanel
            books={catPending}
            selectedBook={selectedBook}
            onSelectBook={setSelectedBook}
            onApprove={handleApprove}
            onReject={() => setShowRejectDialog(true)}
            onToggleFeatured={() => handleToggleFeatured()}
            onToggleStaffPick={() => handleToggleStaffPick()}
            isLoading={isLoading}
            isSubmitting={isSubmitting}
            emptyMessage={`No pending ${categoryLabel.toLowerCase()}`}
            title={`Pending ${categoryLabel}`}
          />
        </TabsContent>

        <TabsContent value="featured">
          <CategoryManagementTab
            category="featured"
            books={catFeatured}
            onMoveUp={(index) => handleMoveBook("featured", index)}
            onMoveDown={(index) => handleMoveBookDown("featured", index)}
            onRemove={(bookId) => handleToggleFeatured(bookId)}
            onAddClick={() => { setAddDialogCategory("featured"); setShowAddDialog(true); }}
            isUpdating={isReordering || isSubmitting}
          />
        </TabsContent>

        <TabsContent value="staffpicks">
          <CategoryManagementTab
            category="staffPick"
            books={catStaffPicks}
            onMoveUp={(index) => handleMoveBook("staffPick", index)}
            onMoveDown={(index) => handleMoveBookDown("staffPick", index)}
            onRemove={(bookId) => handleToggleStaffPick(bookId)}
            onAddClick={() => { setAddDialogCategory("staffPick"); setShowAddDialog(true); }}
            isUpdating={isReordering || isSubmitting}
          />
        </TabsContent>

        <TabsContent value="live">
          <BookListPanel
            books={catLive}
            selectedBook={selectedBook}
            onSelectBook={setSelectedBook}
            onApprove={handleApprove}
            onReject={() => setShowRejectDialog(true)}
            onToggleFeatured={() => handleToggleFeatured()}
            onToggleStaffPick={() => handleToggleStaffPick()}
            isLoading={isLoading}
            isSubmitting={isSubmitting}
            emptyMessage={`No live ${categoryLabel.toLowerCase()}`}
            title={`Live ${categoryLabel}`}
          />
        </TabsContent>

        <TabsContent value="all">
          <AllBooksTab
            books={catAll}
            onBookClick={(book) => {
              setSelectedBook(book);
              setActiveTab(book.status === "PENDING_REVIEW" ? "pending" : "live");
            }}
          />
        </TabsContent>

        <TabsContent value="history">
          <HistoryTab reviewHistory={reviewHistory} />
        </TabsContent>

        <TabsContent value="transactions">
          <TransactionsTab
            transactions={transactions}
            transactionStats={transactionStats}
            isLoading={isLoadingTransactions}
            search={transactionSearch}
            onSearchChange={(s) => { setTransactionSearch(s); setTransactionPage(1); }}
            statusFilter={transactionStatusFilter}
            onStatusFilterChange={(s) => { setTransactionStatusFilter(s); setTransactionPage(1); }}
            page={transactionPage}
            totalPages={transactionTotalPages}
            onPageChange={setTransactionPage}
            onRefresh={() => fetchTransactions(transactionPage, transactionSearch, transactionStatusFilter)}
          />
        </TabsContent>

        <TabsContent value="files">
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
        availableBooks={addDialogCategory === "featured" ? catAvailableFeatured : catAvailableStaffPick}
        onAdd={handleAddToCategory}
      />
    </div>
  );
}
