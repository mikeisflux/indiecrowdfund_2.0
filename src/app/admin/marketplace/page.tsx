"use client";

import { getCSRFHeaders } from "@/lib/csrf";
import { fetchWithRetry } from "@/lib/fetch-utils";
import { toast } from "sonner";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BookOpen,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  History,
  RefreshCw,
  Loader2,
  Star,
  Sparkles,
  AlertTriangle,
  DollarSign,
  ExternalLink,
  Building2,
  FileText,
  User,
  Calendar,
  ChevronUp,
  ChevronDown,
  Plus,
  X,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MarketplaceBook {
  id: string;
  title: string;
  slug: string;
  description: string;
  category: string | null;
  coverImage: string | null;
  promoVideoUrl: string | null;
  pdfFileUrl: string;
  price: number;
  currency: string;
  paymentProcessor: string;
  isNsfw: boolean;
  status: string;
  isFeatured: boolean;
  isStaffPick: boolean;
  featuredOrder: number | null;
  staffPickOrder: number | null;
  submittedAt: string | null;
  createdAt: string;
  creator: {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
  };
  company: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

interface ReviewHistory {
  id: string;
  bookId: string;
  bookTitle: string;
  action: string;
  notes: string | null;
  reviewedBy: string;
  createdAt: string;
}

interface Stats {
  pending: number;
  live: number;
  approvedToday: number;
  rejectedToday: number;
  totalRevenue: number;
  totalSales: number;
}

interface Transaction {
  id: string;
  book: {
    id: string;
    title: string;
    slug: string;
    coverImage: string | null;
    creator: {
      id: string;
      name: string;
      email: string;
    };
  };
  buyer: {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
  };
  amount: number;
  platformFee: number;
  creatorPayout: number;
  currency: string;
  paymentProcessor: string;
  transactionId: string | null;
  status: string;
  createdAt: string;
  completedAt: string | null;
  refundedAt: string | null;
  refundReason: string | null;
}

interface TransactionStats {
  totalRevenue: number;
  totalPlatformFees: number;
  totalCreatorPayouts: number;
  totalTransactions: number;
  todayRevenue: number;
  todayPlatformFees: number;
  todayTransactions: number;
}

function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, { label: string; className: string }> = {
    DRAFT: { label: "Draft", className: "bg-gray-100 text-gray-700 border-gray-200" },
    PENDING_REVIEW: { label: "Pending Review", className: "bg-amber-100 text-amber-700 border-amber-200" },
    APPROVED: { label: "Approved", className: "bg-blue-100 text-blue-700 border-blue-200" },
    LIVE: { label: "Live", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    REJECTED: { label: "Rejected", className: "bg-rose-100 text-rose-700 border-rose-200" },
    ARCHIVED: { label: "Archived", className: "bg-zinc-100 text-zinc-700 border-zinc-200" },
  };

  const config = configs[status] || { label: status, className: "bg-gray-500/20 text-gray-400 border-gray-500/30" };

  return (
    <Badge className={cn("border", config.className)}>
      {config.label}
    </Badge>
  );
}

function TransactionStatusBadge({ status }: { status: string }) {
  const configs: Record<string, { label: string; className: string }> = {
    PENDING: { label: "Pending", className: "bg-amber-100 text-amber-700 border-amber-200" },
    COMPLETED: { label: "Completed", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    FAILED: { label: "Failed", className: "bg-rose-100 text-rose-700 border-rose-200" },
    REFUNDED: { label: "Refunded", className: "bg-purple-100 text-purple-700 border-purple-200" },
  };

  const config = configs[status] || { label: status, className: "bg-gray-500/20 text-gray-400 border-gray-500/30" };

  return (
    <Badge className={cn("border", config.className)}>
      {config.label}
    </Badge>
  );
}

function BookListItem({
  book,
  isSelected,
  onClick,
}: {
  book: MarketplaceBook;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 p-4 cursor-pointer rounded-lg transition-all border",
        isSelected
          ? "bg-purple-50 border-purple-300"
          : "bg-muted/50 border-border hover:bg-muted hover:border-border"
      )}
      onClick={onClick}
    >
      {/* Cover */}
      <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
        {book.coverImage ? (
          <Image
            src={book.coverImage}
            alt={book.title}
            width={64}
            height={64}
            className="object-cover w-full h-full"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-muted-foreground/50" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-foreground truncate">{book.title}</h4>
          {book.isNsfw && (
            <Badge variant="destructive" className="text-xs">
              NSFW
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
          <span>{book.creator.name}</span>
          <span>•</span>
          <span className="text-emerald-600">${book.price.toFixed(2)}</span>
        </div>
        {book.submittedAt && (
          <p className="text-xs text-muted-foreground/70 mt-1">
            Submitted {new Date(book.submittedAt).toLocaleDateString()}
          </p>
        )}
      </div>

      {/* Badges */}
      <div className="flex items-center gap-2">
        {book.isFeatured && (
          <Badge className="bg-amber-100 text-amber-700 border border-amber-200">
            <Star className="w-3 h-3 mr-1 fill-current" />
            Featured
          </Badge>
        )}
        {book.isStaffPick && (
          <Badge className="bg-purple-100 text-purple-700 border border-purple-200">
            <Sparkles className="w-3 h-3 mr-1" />
            Staff Pick
          </Badge>
        )}
        <StatusBadge status={book.status} />
      </div>
    </div>
  );
}

// Category Management Item for Featured/Staff Picks
function CategoryBookItem({
  book,
  index,
  totalCount,
  onMoveUp,
  onMoveDown,
  onRemove,
  isUpdating,
}: {
  book: MarketplaceBook;
  index: number;
  totalCount: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  isUpdating: boolean;
}) {
  return (
    <div className="flex items-center gap-4 p-4 bg-muted/50 border border-border rounded-lg hover:bg-muted transition-colors">
      {/* Order number */}
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center text-purple-700 font-bold text-sm">
        {index + 1}
      </div>

      {/* Cover */}
      <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
        {book.coverImage ? (
          <Image
            src={book.coverImage}
            alt={book.title}
            width={48}
            height={48}
            className="object-cover w-full h-full"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-muted-foreground/50" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-foreground truncate">{book.title}</h4>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{book.creator.name}</span>
          <span>•</span>
          <span className="text-emerald-600">${book.price.toFixed(2)}</span>
        </div>
      </div>

      {/* Move buttons */}
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0"
          onClick={onMoveUp}
          disabled={index === 0 || isUpdating}
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0"
          onClick={onMoveDown}
          disabled={index === totalCount - 1 || isUpdating}
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>

      {/* Remove button */}
      <Button
        size="sm"
        variant="ghost"
        className="h-8 w-8 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
        onClick={onRemove}
        disabled={isUpdating}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

function BookDetailPanel({
  book,
  onApprove,
  onReject,
  onToggleFeatured,
  onToggleStaffPick,
  isSubmitting,
}: {
  book: MarketplaceBook;
  onApprove: () => void;
  onReject: () => void;
  onToggleFeatured: () => void;
  onToggleStaffPick: () => void;
  isSubmitting: boolean;
}) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-24 h-24 rounded-xl overflow-hidden bg-muted/50 flex-shrink-0">
          {book.coverImage ? (
            <Image
              src={book.coverImage}
              alt={book.title}
              width={96}
              height={96}
              className="object-cover w-full h-full"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <BookOpen className="w-10 h-10 text-muted-foreground/50" />
            </div>
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold text-foreground">{book.title}</h2>
            <StatusBadge status={book.status} />
            {book.isNsfw && (
              <Badge variant="destructive">NSFW</Badge>
            )}
            {book.isFeatured && (
              <Badge className="bg-amber-100 text-amber-600 border border-amber-200">
                <Star className="w-3 h-3 mr-1 fill-current" />
                Featured
              </Badge>
            )}
            {book.isStaffPick && (
              <Badge className="bg-purple-100 text-purple-600 border border-purple-200">
                <Sparkles className="w-3 h-3 mr-1" />
                Staff Pick
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1">{book.category || "Uncategorized"}</p>
        </div>
      </div>

      {/* Quick Info */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-muted/50 border border-border">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <DollarSign className="w-4 h-4" />
            Price
          </div>
          <p className="text-lg font-bold text-foreground mt-1">
            ${book.price.toFixed(2)} {book.currency}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-muted/50 border border-border">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <FileText className="w-4 h-4" />
            Payment
          </div>
          <p className="text-lg font-bold text-foreground mt-1">
            {book.paymentProcessor}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-muted/50 border border-border">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <User className="w-4 h-4" />
            Creator
          </div>
          <p className="text-sm font-medium text-foreground mt-1 truncate">
            {book.creator.name}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-muted/50 border border-border">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Calendar className="w-4 h-4" />
            Submitted
          </div>
          <p className="text-sm font-medium text-foreground mt-1">
            {book.submittedAt
              ? new Date(book.submittedAt).toLocaleDateString()
              : "Not submitted"}
          </p>
        </div>
      </div>

      {/* Description */}
      <div className="p-4 rounded-xl bg-muted/50 border border-border">
        <h3 className="text-sm font-medium text-muted-foreground mb-2">Description</h3>
        <p className="text-sm text-foreground whitespace-pre-wrap">
          {book.description || "No description provided"}
        </p>
      </div>

      {/* Creator Info */}
      <div className="p-4 rounded-xl bg-muted/50 border border-border">
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Creator Information</h3>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full overflow-hidden bg-muted">
            {book.creator.avatar ? (
              <Image
                src={book.creator.avatar}
                alt={book.creator.name}
                width={48}
                height={48}
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <User className="w-6 h-6 text-muted-foreground/50" />
              </div>
            )}
          </div>
          <div>
            <p className="font-medium text-foreground">{book.creator.name}</p>
            <p className="text-sm text-muted-foreground">{book.creator.email}</p>
          </div>
        </div>
        {book.company && (
          <div className="flex items-center gap-2 mt-4 p-3 rounded-lg bg-muted/50">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-foreground">Company: {book.company.name}</span>
            <Link
              href={`/marketplace/companies/${book.company.slug}`}
              target="_blank"
              className="ml-auto text-purple-600 hover:text-purple-700 text-sm"
            >
              View
            </Link>
          </div>
        )}
      </div>

      {/* Links */}
      <div className="p-4 rounded-xl bg-muted/50 border border-border space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Files & Links</h3>
        <a
          href={book.pdfFileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700"
        >
          <FileText className="w-4 h-4" />
          View PDF File
          <ExternalLink className="w-3 h-3" />
        </a>
        {book.promoVideoUrl && (
          <a
            href={book.promoVideoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700"
          >
            <Eye className="w-4 h-4" />
            View Promo Video
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      {/* Admin Actions for Live Books */}
      {book.status === "LIVE" && (
        <div className="p-4 rounded-xl bg-muted/50 border border-border space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground">Homepage Categories</h3>
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <p className="font-medium text-foreground flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-600" />
                Featured
              </p>
              <p className="text-sm text-muted-foreground">
                Show in Featured section on marketplace homepage
              </p>
            </div>
            <Switch
              checked={book.isFeatured}
              onCheckedChange={onToggleFeatured}
              disabled={isSubmitting}
            />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <p className="font-medium text-foreground flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                Staff Pick
              </p>
              <p className="text-sm text-muted-foreground">
                Show in Staff Picks section on marketplace homepage
              </p>
            </div>
            <Switch
              checked={book.isStaffPick}
              onCheckedChange={onToggleStaffPick}
              disabled={isSubmitting}
            />
          </div>
        </div>
      )}

      {/* Review Actions for Pending Books */}
      {book.status === "PENDING_REVIEW" && (
        <div className="flex items-center gap-3">
          <Button
            onClick={onApprove}
            disabled={isSubmitting}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4 mr-2" />
            )}
            Approve & Publish
          </Button>
          <Button
            onClick={onReject}
            disabled={isSubmitting}
            variant="destructive"
            className="flex-1"
          >
            <XCircle className="w-4 h-4 mr-2" />
            Reject
          </Button>
        </div>
      )}
    </div>
  );
}

export default function AdminMarketplacePage() {
  const [activeTab, setActiveTab] = useState("pending");
  const [pendingBooks, setPendingBooks] = useState<MarketplaceBook[]>([]);
  const [liveBooks, setLiveBooks] = useState<MarketplaceBook[]>([]);
  const [allBooks, setAllBooks] = useState<MarketplaceBook[]>([]);
  const [reviewHistory, setReviewHistory] = useState<ReviewHistory[]>([]);
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
  const [stats, setStats] = useState<Stats>({
    pending: 0,
    live: 0,
    approvedToday: 0,
    rejectedToday: 0,
    totalRevenue: 0,
    totalSales: 0,
  });
  const [selectedBook, setSelectedBook] = useState<MarketplaceBook | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReordering, setIsReordering] = useState(false);

  // Rejection dialog
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  // Add to category dialog
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addDialogCategory, setAddDialogCategory] = useState<"featured" | "staffPick">("featured");

  // Featured and Staff Pick books (sorted by order)
  const featuredBooks = liveBooks
    .filter((b) => b.isFeatured)
    .sort((a, b) => (a.featuredOrder || 999) - (b.featuredOrder || 999));

  const staffPickBooks = liveBooks
    .filter((b) => b.isStaffPick)
    .sort((a, b) => (a.staffPickOrder || 999) - (b.staffPickOrder || 999));

  // Available books for adding (live books not in the category)
  const availableForFeatured = liveBooks.filter((b) => !b.isFeatured);
  const availableForStaffPick = liveBooks.filter((b) => !b.isStaffPick);

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

  useEffect(() => {
    fetchBooks();
    fetchHistory();
  }, [fetchBooks, fetchHistory]);

  // Fetch transactions when tab changes to transactions
  useEffect(() => {
    if (activeTab === "transactions") {
      fetchTransactions(transactionPage, transactionSearch, transactionStatusFilter);
    }
  }, [activeTab, transactionPage, transactionSearch, transactionStatusFilter, fetchTransactions]);

  const handleApprove = async () => {
    if (!selectedBook) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/admin/marketplace/books/${selectedBook.id}/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getCSRFHeaders(),
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
      const response = await fetch(`/api/admin/marketplace/books/${selectedBook.id}/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getCSRFHeaders(),
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
      const response = await fetch(`/api/admin/marketplace/books/${book.id}/feature`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getCSRFHeaders(),
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
      const response = await fetch(`/api/admin/marketplace/books/${book.id}/staff-pick`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getCSRFHeaders(),
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
      const response = await fetch("/api/admin/marketplace/books/reorder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getCSRFHeaders(),
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

  const handleMoveBook = (category: "featured" | "staffPick", index: number, direction: "up" | "down") => {
    const books = category === "featured" ? [...featuredBooks] : [...staffPickBooks];
    const newIndex = direction === "up" ? index - 1 : index + 1;

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

  // Filter books based on search
  const filteredPending = pendingBooks.filter(
    (book) =>
      book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      book.creator.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredLive = liveBooks.filter(
    (book) =>
      book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      book.creator.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredAll = allBooks.filter(
    (book) =>
      book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      book.creator.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Marketplace Management</h1>
          <p className="text-muted-foreground">
            Review submissions and manage homepage categories
          </p>
        </div>
        <Button
          onClick={fetchBooks}
          variant="outline"
          size="sm"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="p-4 rounded-xl bg-card border">
          <div className="flex items-center gap-2 text-amber-600">
            <Clock className="w-4 h-4" />
            <span className="text-sm font-medium">Pending</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.pending}</p>
        </div>
        <div className="p-4 rounded-xl bg-card border">
          <div className="flex items-center gap-2 text-emerald-600">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm font-medium">Live</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.live}</p>
        </div>
        <div className="p-4 rounded-xl bg-card border">
          <div className="flex items-center gap-2 text-blue-600">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm font-medium">Approved Today</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.approvedToday}</p>
        </div>
        <div className="p-4 rounded-xl bg-card border">
          <div className="flex items-center gap-2 text-rose-600">
            <XCircle className="w-4 h-4" />
            <span className="text-sm font-medium">Rejected Today</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.rejectedToday}</p>
        </div>
        <div className="p-4 rounded-xl bg-card border">
          <div className="flex items-center gap-2 text-purple-600">
            <DollarSign className="w-4 h-4" />
            <span className="text-sm font-medium">Total Revenue</span>
          </div>
          <p className="text-2xl font-bold mt-1">${stats.totalRevenue.toFixed(0)}</p>
        </div>
        <div className="p-4 rounded-xl bg-card border">
          <div className="flex items-center gap-2 text-cyan-600">
            <Sparkles className="w-4 h-4" />
            <span className="text-sm font-medium">Total Sales</span>
          </div>
          <p className="text-2xl font-bold mt-1">{stats.totalSales}</p>
        </div>
      </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between mb-6">
            <TabsList className="bg-muted/50 border border-border">
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
                All Books
              </TabsTrigger>
              <TabsTrigger value="history" className="data-[state=active]:bg-background text-muted-foreground data-[state=active]:text-foreground">
                <History className="w-4 h-4 mr-2" />
                History
              </TabsTrigger>
              <TabsTrigger value="transactions" className="data-[state=active]:bg-background text-muted-foreground data-[state=active]:text-foreground">
                <CreditCard className="w-4 h-4 mr-2" />
                Transactions
              </TabsTrigger>
            </TabsList>

            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
              <Input
                placeholder="Search books..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-muted/50 border-border text-foreground placeholder:text-muted-foreground/70"
              />
            </div>
          </div>

          {/* Pending Tab */}
          <TabsContent value="pending">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Book List */}
              <div className="rounded-xl bg-muted/50 border border-border overflow-hidden max-h-[800px]">
                <div className="p-4 border-b border-border">
                  <h3 className="font-medium text-foreground">Pending Submissions ({filteredPending.length})</h3>
                </div>
                <div className="p-4 overflow-y-auto max-h-[700px] space-y-2">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                    </div>
                  ) : filteredPending.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No pending submissions</p>
                    </div>
                  ) : (
                    filteredPending.map((book) => (
                      <BookListItem
                        key={book.id}
                        book={book}
                        isSelected={selectedBook?.id === book.id}
                        onClick={() => setSelectedBook(book)}
                      />
                    ))
                  )}
                </div>
              </div>

              {/* Detail Panel */}
              <div className="rounded-xl bg-muted/50 border border-border overflow-hidden max-h-[800px] overflow-y-auto">
                <div className="p-6">
                  {selectedBook ? (
                    <BookDetailPanel
                      book={selectedBook}
                      onApprove={handleApprove}
                      onReject={() => setShowRejectDialog(true)}
                      onToggleFeatured={() => handleToggleFeatured()}
                      onToggleStaffPick={() => handleToggleStaffPick()}
                      isSubmitting={isSubmitting}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Eye className="w-12 h-12 mb-4 opacity-50" />
                      <p>Select a book to view details</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Featured Tab */}
          <TabsContent value="featured">
            <div className="rounded-xl bg-muted/50 border border-border overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-100">
                    <Star className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground">Featured Books</h3>
                    <p className="text-sm text-muted-foreground">Shown in the Featured section on marketplace homepage</p>
                  </div>
                </div>
                <Button
                  onClick={() => {
                    setAddDialogCategory("featured");
                    setShowAddDialog(true);
                  }}
                  className="bg-amber-100 text-amber-600 hover:bg-amber-200 border border-amber-200"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Book
                </Button>
              </div>
              <div className="p-4 space-y-2">
                {featuredBooks.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Star className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No featured books yet</p>
                    <p className="text-sm mt-2">Add books to show them in the Featured section</p>
                  </div>
                ) : (
                  featuredBooks.map((book, index) => (
                    <CategoryBookItem
                      key={book.id}
                      book={book}
                      index={index}
                      totalCount={featuredBooks.length}
                      onMoveUp={() => handleMoveBook("featured", index, "up")}
                      onMoveDown={() => handleMoveBook("featured", index, "down")}
                      onRemove={() => handleToggleFeatured(book.id)}
                      isUpdating={isReordering || isSubmitting}
                    />
                  ))
                )}
              </div>
            </div>
          </TabsContent>

          {/* Staff Picks Tab */}
          <TabsContent value="staffpicks">
            <div className="rounded-xl bg-muted/50 border border-border overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-100">
                    <Sparkles className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground">Staff Picks</h3>
                    <p className="text-sm text-muted-foreground">Shown in the Staff Picks section on marketplace homepage</p>
                  </div>
                </div>
                <Button
                  onClick={() => {
                    setAddDialogCategory("staffPick");
                    setShowAddDialog(true);
                  }}
                  className="bg-purple-100 text-purple-600 hover:bg-purple-200 border border-purple-200"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Book
                </Button>
              </div>
              <div className="p-4 space-y-2">
                {staffPickBooks.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No staff picks yet</p>
                    <p className="text-sm mt-2">Add books to show them in the Staff Picks section</p>
                  </div>
                ) : (
                  staffPickBooks.map((book, index) => (
                    <CategoryBookItem
                      key={book.id}
                      book={book}
                      index={index}
                      totalCount={staffPickBooks.length}
                      onMoveUp={() => handleMoveBook("staffPick", index, "up")}
                      onMoveDown={() => handleMoveBook("staffPick", index, "down")}
                      onRemove={() => handleToggleStaffPick(book.id)}
                      isUpdating={isReordering || isSubmitting}
                    />
                  ))
                )}
              </div>
            </div>
          </TabsContent>

          {/* Live Tab */}
          <TabsContent value="live">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-xl bg-muted/50 border border-border overflow-hidden max-h-[800px]">
                <div className="p-4 border-b border-border">
                  <h3 className="font-medium text-foreground">Live Books ({filteredLive.length})</h3>
                </div>
                <div className="p-4 overflow-y-auto max-h-[700px] space-y-2">
                  {filteredLive.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No live books</p>
                    </div>
                  ) : (
                    filteredLive.map((book) => (
                      <BookListItem
                        key={book.id}
                        book={book}
                        isSelected={selectedBook?.id === book.id}
                        onClick={() => setSelectedBook(book)}
                      />
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-xl bg-muted/50 border border-border overflow-hidden max-h-[800px] overflow-y-auto">
                <div className="p-6">
                  {selectedBook ? (
                    <BookDetailPanel
                      book={selectedBook}
                      onApprove={handleApprove}
                      onReject={() => setShowRejectDialog(true)}
                      onToggleFeatured={() => handleToggleFeatured()}
                      onToggleStaffPick={() => handleToggleStaffPick()}
                      isSubmitting={isSubmitting}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Eye className="w-12 h-12 mb-4 opacity-50" />
                      <p>Select a book to manage</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* All Books Tab */}
          <TabsContent value="all">
            <div className="rounded-xl bg-muted/50 border border-border overflow-hidden">
              <div className="p-4 border-b border-border">
                <h3 className="font-medium text-foreground">All Books ({filteredAll.length})</h3>
              </div>
              <div className="p-4 space-y-2 max-h-[700px] overflow-y-auto">
                {filteredAll.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No books found</p>
                  </div>
                ) : (
                  filteredAll.map((book) => (
                    <BookListItem
                      key={book.id}
                      book={book}
                      isSelected={false}
                      onClick={() => {
                        setSelectedBook(book);
                        setActiveTab(book.status === "PENDING_REVIEW" ? "pending" : "live");
                      }}
                    />
                  ))
                )}
              </div>
            </div>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history">
            <div className="rounded-xl bg-muted/50 border border-border overflow-hidden">
              <div className="p-4 border-b border-border">
                <h3 className="font-medium text-foreground">Review History</h3>
              </div>
              <div className="p-4 space-y-2 max-h-[700px] overflow-y-auto">
                {reviewHistory.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No review history</p>
                  </div>
                ) : (
                  reviewHistory.map((review) => (
                    <div key={review.id} className="p-4 rounded-lg bg-muted/50 border border-border">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-foreground">{review.bookTitle}</p>
                          <p className="text-sm text-muted-foreground">
                            {review.action} by {review.reviewedBy}
                          </p>
                        </div>
                        <Badge
                          className={
                            review.action === "APPROVED"
                              ? "bg-emerald-100 text-emerald-400 border-emerald-200"
                              : "bg-rose-100 text-rose-400 border-rose-200"
                          }
                        >
                          {review.action}
                        </Badge>
                      </div>
                      {review.notes && (
                        <p className="text-sm text-muted-foreground mt-2">
                          {review.notes}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground/70 mt-2">
                        {new Date(review.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </TabsContent>

          {/* Transactions Tab */}
          <TabsContent value="transactions">
            <div className="space-y-6">
              {/* Transaction Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                <div className="p-4 rounded-xl bg-card border">
                  <div className="flex items-center gap-2 text-emerald-600">
                    <DollarSign className="w-4 h-4" />
                    <span className="text-sm font-medium">Total Revenue</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">${transactionStats.totalRevenue.toFixed(2)}</p>
                </div>
                <div className="p-4 rounded-xl bg-card border">
                  <div className="flex items-center gap-2 text-purple-600">
                    <ArrowUpRight className="w-4 h-4" />
                    <span className="text-sm font-medium">Platform Fees</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">${transactionStats.totalPlatformFees.toFixed(2)}</p>
                </div>
                <div className="p-4 rounded-xl bg-card border">
                  <div className="flex items-center gap-2 text-blue-600">
                    <ArrowDownRight className="w-4 h-4" />
                    <span className="text-sm font-medium">Creator Payouts</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">${transactionStats.totalCreatorPayouts.toFixed(2)}</p>
                </div>
                <div className="p-4 rounded-xl bg-card border">
                  <div className="flex items-center gap-2 text-cyan-600">
                    <CreditCard className="w-4 h-4" />
                    <span className="text-sm font-medium">Total Transactions</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">{transactionStats.totalTransactions}</p>
                </div>
                <div className="p-4 rounded-xl bg-card border">
                  <div className="flex items-center gap-2 text-amber-600">
                    <DollarSign className="w-4 h-4" />
                    <span className="text-sm font-medium">Today Revenue</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">${transactionStats.todayRevenue.toFixed(2)}</p>
                </div>
                <div className="p-4 rounded-xl bg-card border">
                  <div className="flex items-center gap-2 text-pink-600">
                    <ArrowUpRight className="w-4 h-4" />
                    <span className="text-sm font-medium">Today Fees</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">${transactionStats.todayPlatformFees.toFixed(2)}</p>
                </div>
                <div className="p-4 rounded-xl bg-card border">
                  <div className="flex items-center gap-2 text-indigo-600">
                    <CreditCard className="w-4 h-4" />
                    <span className="text-sm font-medium">Today Sales</span>
                  </div>
                  <p className="text-2xl font-bold mt-1">{transactionStats.todayTransactions}</p>
                </div>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
                  <Input
                    placeholder="Search transactions..."
                    value={transactionSearch}
                    onChange={(e) => {
                      setTransactionSearch(e.target.value);
                      setTransactionPage(1);
                    }}
                    className="pl-10 bg-muted/50 border-border text-foreground placeholder:text-muted-foreground/70"
                  />
                </div>
                <select
                  value={transactionStatusFilter}
                  onChange={(e) => {
                    setTransactionStatusFilter(e.target.value);
                    setTransactionPage(1);
                  }}
                  className="px-3 py-2 rounded-lg bg-muted/50 border border-border text-foreground"
                >
                  <option value="all">All Status</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="PENDING">Pending</option>
                  <option value="FAILED">Failed</option>
                  <option value="REFUNDED">Refunded</option>
                </select>
                <Button
                  onClick={() => fetchTransactions(transactionPage, transactionSearch, transactionStatusFilter)}
                  variant="outline"
                  size="sm"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
              </div>

              {/* Transactions List */}
              <div className="rounded-xl bg-muted/50 border border-border overflow-hidden">
                <div className="p-4 border-b border-border">
                  <h3 className="font-medium text-foreground">Transaction History</h3>
                </div>
                <div className="overflow-x-auto">
                  {isLoadingTransactions ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                    </div>
                  ) : transactions.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No transactions found</p>
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Book</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Buyer</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Creator</th>
                          <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Amount</th>
                          <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Platform Fee</th>
                          <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Creator Payout</th>
                          <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">Payment</th>
                          <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">Status</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {transactions.map((tx) => (
                          <tr key={tx.id} className="hover:bg-muted/30">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                                  {tx.book.coverImage ? (
                                    <Image
                                      src={tx.book.coverImage}
                                      alt={tx.book.title}
                                      width={40}
                                      height={40}
                                      className="object-cover w-full h-full"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <BookOpen className="w-4 h-4 text-muted-foreground/50" />
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium text-foreground truncate max-w-[200px]">{tx.book.title}</p>
                                  <p className="text-xs text-muted-foreground">{tx.id.slice(0, 8)}...</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full overflow-hidden bg-muted flex-shrink-0">
                                  {tx.buyer.avatar ? (
                                    <Image
                                      src={tx.buyer.avatar}
                                      alt={tx.buyer.name || ""}
                                      width={32}
                                      height={32}
                                      className="object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <User className="w-4 h-4 text-muted-foreground/50" />
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-foreground truncate">{tx.buyer.name}</p>
                                  <p className="text-xs text-muted-foreground truncate">{tx.buyer.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">{tx.book.creator.name}</p>
                                <p className="text-xs text-muted-foreground truncate">{tx.book.creator.email}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="font-semibold text-emerald-600">${tx.amount.toFixed(2)}</span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="text-purple-600">${tx.platformFee.toFixed(2)}</span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="text-blue-600">${tx.creatorPayout.toFixed(2)}</span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Badge variant="outline" className="text-xs">
                                {tx.paymentProcessor === "STRIPE" ? "Stripe" : tx.paymentProcessor === "DIVINITYCOIN" ? "DivinityCoin" : tx.paymentProcessor}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <TransactionStatusBadge status={tx.status} />
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-sm text-foreground">
                                {new Date(tx.createdAt).toLocaleDateString()}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(tx.createdAt).toLocaleTimeString()}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Pagination */}
                {transactionTotalPages > 1 && (
                  <div className="p-4 border-t border-border flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Page {transactionPage} of {transactionTotalPages}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setTransactionPage((p) => Math.max(1, p - 1))}
                        disabled={transactionPage === 1}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setTransactionPage((p) => Math.min(transactionTotalPages, p + 1))}
                        disabled={transactionPage === transactionTotalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Rejection Dialog */}
        <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
          <DialogContent className="bg-background">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                Reject Book
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Please provide a reason for rejecting this book. This will be sent to the creator.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-foreground">Rejection Reason *</Label>
                <Textarea
                  placeholder="Explain why this book is being rejected..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={4}
                  className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground/70"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowRejectDialog(false);
                  setRejectionReason("");
                }}
                className="border-white/20 text-foreground hover:bg-muted"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={isSubmitting || !rejectionReason.trim()}
              >
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Reject Book
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add to Category Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="bg-background max-w-2xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {addDialogCategory === "featured" ? (
                  <>
                    <Star className="w-5 h-5 text-amber-600" />
                    Add to Featured
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 text-purple-600" />
                    Add to Staff Picks
                  </>
                )}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Select a book to add to the {addDialogCategory === "featured" ? "Featured" : "Staff Picks"} section
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              {(addDialogCategory === "featured" ? availableForFeatured : availableForStaffPick).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>All live books are already in this category</p>
                </div>
              ) : (
                (addDialogCategory === "featured" ? availableForFeatured : availableForStaffPick).map((book) => (
                  <div
                    key={book.id}
                    className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 border border-border hover:bg-muted cursor-pointer transition-colors"
                    onClick={() => handleAddToCategory(book.id)}
                  >
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted/50 flex-shrink-0">
                      {book.coverImage ? (
                        <Image
                          src={book.coverImage}
                          alt={book.title}
                          width={48}
                          height={48}
                          className="object-cover w-full h-full"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <BookOpen className="w-5 h-5 text-muted-foreground/50" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-foreground truncate">{book.title}</h4>
                      <p className="text-sm text-muted-foreground">{book.creator.name}</p>
                    </div>
                    <Button
                      size="sm"
                      className={addDialogCategory === "featured"
                        ? "bg-amber-100 text-amber-600 hover:bg-amber-200"
                        : "bg-purple-100 text-purple-600 hover:bg-purple-200"
                      }
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add
                    </Button>
                  </div>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>
    </div>
  );
}
