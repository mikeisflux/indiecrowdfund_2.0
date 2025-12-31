"use client";

import { getCSRFHeaders } from "@/lib/csrf";
import { fetchWithRetry } from "@/lib/fetch-utils";
import { toast } from "sonner";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, { label: string; className: string }> = {
    DRAFT: { label: "Draft", className: "bg-gray-500/20 text-gray-400" },
    PENDING_REVIEW: { label: "Pending Review", className: "bg-amber-500/20 text-amber-400" },
    APPROVED: { label: "Approved", className: "bg-blue-500/20 text-blue-400" },
    LIVE: { label: "Live", className: "bg-emerald-500/20 text-emerald-400" },
    REJECTED: { label: "Rejected", className: "bg-rose-500/20 text-rose-400" },
    ARCHIVED: { label: "Archived", className: "bg-zinc-500/20 text-zinc-400" },
  };

  const config = configs[status] || { label: status, className: "bg-gray-500/20 text-gray-400" };

  return (
    <Badge className={config.className}>
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
        "flex items-center gap-4 p-4 cursor-pointer rounded-lg transition-colors border border-transparent",
        isSelected
          ? "bg-primary/10 border-primary/30"
          : "hover:bg-muted/50"
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
            <BookOpen className="w-6 h-6 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-medium truncate">{book.title}</h4>
          {book.isNsfw && (
            <Badge variant="destructive" className="text-xs">
              NSFW
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
          <span>{book.creator.name}</span>
          <span>•</span>
          <span>${book.price.toFixed(2)}</span>
        </div>
        {book.submittedAt && (
          <p className="text-xs text-muted-foreground mt-1">
            Submitted {new Date(book.submittedAt).toLocaleDateString()}
          </p>
        )}
      </div>

      {/* Status */}
      <StatusBadge status={book.status} />
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
        <div className="w-24 h-24 rounded-xl overflow-hidden bg-muted flex-shrink-0">
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
              <BookOpen className="w-10 h-10 text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold">{book.title}</h2>
            <StatusBadge status={book.status} />
            {book.isNsfw && (
              <Badge variant="destructive">NSFW</Badge>
            )}
            {book.isFeatured && (
              <Badge className="bg-amber-500/20 text-amber-400">
                <Star className="w-3 h-3 mr-1 fill-current" />
                Featured
              </Badge>
            )}
            {book.isStaffPick && (
              <Badge className="bg-purple-500/20 text-purple-400">
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
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <DollarSign className="w-4 h-4" />
              Price
            </div>
            <p className="text-lg font-bold mt-1">
              ${book.price.toFixed(2)} {book.currency}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <FileText className="w-4 h-4" />
              Payment
            </div>
            <p className="text-lg font-bold mt-1">
              {book.paymentProcessor}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <User className="w-4 h-4" />
              Creator
            </div>
            <p className="text-sm font-medium mt-1 truncate">
              {book.creator.name}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Calendar className="w-4 h-4" />
              Submitted
            </div>
            <p className="text-sm font-medium mt-1">
              {book.submittedAt
                ? new Date(book.submittedAt).toLocaleDateString()
                : "Not submitted"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Description */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Description</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {book.description || "No description provided"}
          </p>
        </CardContent>
      </Card>

      {/* Creator Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Creator Information</CardTitle>
        </CardHeader>
        <CardContent>
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
                  <User className="w-6 h-6 text-muted-foreground" />
                </div>
              )}
            </div>
            <div>
              <p className="font-medium">{book.creator.name}</p>
              <p className="text-sm text-muted-foreground">{book.creator.email}</p>
            </div>
          </div>
          {book.company && (
            <div className="flex items-center gap-2 mt-4 p-3 rounded-lg bg-muted">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">Company: {book.company.name}</span>
              <Link
                href={`/marketplace/companies/${book.company.slug}`}
                target="_blank"
                className="ml-auto text-primary hover:underline text-sm"
              >
                View
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Links */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Files & Links</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <a
            href={book.pdfFileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-primary hover:underline"
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
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <Eye className="w-4 h-4" />
              View Promo Video
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </CardContent>
      </Card>

      {/* Admin Actions for Live Books */}
      {book.status === "LIVE" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Admin Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Featured</p>
                <p className="text-sm text-muted-foreground">
                  Show in Featured section on marketplace
                </p>
              </div>
              <Switch
                checked={book.isFeatured}
                onCheckedChange={onToggleFeatured}
                disabled={isSubmitting}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Staff Pick</p>
                <p className="text-sm text-muted-foreground">
                  Show in Staff Picks section on marketplace
                </p>
              </div>
              <Switch
                checked={book.isStaffPick}
                onCheckedChange={onToggleStaffPick}
                disabled={isSubmitting}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Review Actions for Pending Books */}
      {book.status === "PENDING_REVIEW" && (
        <div className="flex items-center gap-3">
          <Button
            onClick={onApprove}
            disabled={isSubmitting}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
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

  // Rejection dialog
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

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

  useEffect(() => {
    fetchBooks();
    fetchHistory();
  }, [fetchBooks, fetchHistory]);

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

  const handleToggleFeatured = async () => {
    if (!selectedBook) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/admin/marketplace/books/${selectedBook.id}/feature`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getCSRFHeaders(),
        },
        body: JSON.stringify({ featured: !selectedBook.isFeatured }),
      });

      if (!response.ok) {
        throw new Error("Failed to update featured status");
      }

      toast.success(selectedBook.isFeatured ? "Removed from featured" : "Added to featured");
      setSelectedBook({ ...selectedBook, isFeatured: !selectedBook.isFeatured });
      fetchBooks();
    } catch (error) {
      console.error("Error toggling featured:", error);
      toast.error("Failed to update featured status");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStaffPick = async () => {
    if (!selectedBook) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/admin/marketplace/books/${selectedBook.id}/staff-pick`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getCSRFHeaders(),
        },
        body: JSON.stringify({ staffPick: !selectedBook.isStaffPick }),
      });

      if (!response.ok) {
        throw new Error("Failed to update staff pick status");
      }

      toast.success(selectedBook.isStaffPick ? "Removed from staff picks" : "Added to staff picks");
      setSelectedBook({ ...selectedBook, isStaffPick: !selectedBook.isStaffPick });
      fetchBooks();
    } catch (error) {
      console.error("Error toggling staff pick:", error);
      toast.error("Failed to update staff pick status");
    } finally {
      setIsSubmitting(false);
    }
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
    <div className="container py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="w-6 h-6" />
            Marketplace Management
          </h1>
          <p className="text-muted-foreground">
            Review and manage marketplace book submissions
          </p>
        </div>
        <Button onClick={fetchBooks} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-amber-500">
              <Clock className="w-4 h-4" />
              <span className="text-sm font-medium">Pending</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.pending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-emerald-500">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm font-medium">Live</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.live}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-blue-500">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm font-medium">Approved Today</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.approvedToday}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-rose-500">
              <XCircle className="w-4 h-4" />
              <span className="text-sm font-medium">Rejected Today</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.rejectedToday}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-purple-500">
              <DollarSign className="w-4 h-4" />
              <span className="text-sm font-medium">Total Revenue</span>
            </div>
            <p className="text-2xl font-bold mt-1">${stats.totalRevenue.toFixed(0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-cyan-500">
              <Sparkles className="w-4 h-4" />
              <span className="text-sm font-medium">Total Sales</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.totalSales}</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="pending" className="relative">
              <Clock className="w-4 h-4 mr-2" />
              Pending Review
              {stats.pending > 0 && (
                <Badge className="ml-2 bg-amber-500">{stats.pending}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="live">
              <CheckCircle className="w-4 h-4 mr-2" />
              Live
            </TabsTrigger>
            <TabsTrigger value="all">
              <BookOpen className="w-4 h-4 mr-2" />
              All Books
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="w-4 h-4 mr-2" />
              History
            </TabsTrigger>
          </TabsList>

          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search books..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Pending Tab */}
        <TabsContent value="pending">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Book List */}
            <Card className="max-h-[800px] overflow-hidden">
              <CardHeader>
                <CardTitle className="text-base">
                  Pending Submissions ({filteredPending.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-y-auto max-h-[700px]">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredPending.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No pending submissions</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredPending.map((book) => (
                      <BookListItem
                        key={book.id}
                        book={book}
                        isSelected={selectedBook?.id === book.id}
                        onClick={() => setSelectedBook(book)}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Detail Panel */}
            <Card className="max-h-[800px] overflow-y-auto">
              <CardContent className="p-6">
                {selectedBook ? (
                  <BookDetailPanel
                    book={selectedBook}
                    onApprove={handleApprove}
                    onReject={() => setShowRejectDialog(true)}
                    onToggleFeatured={handleToggleFeatured}
                    onToggleStaffPick={handleToggleStaffPick}
                    isSubmitting={isSubmitting}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Eye className="w-12 h-12 mb-4 opacity-50" />
                    <p>Select a book to view details</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Live Tab */}
        <TabsContent value="live">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="max-h-[800px] overflow-hidden">
              <CardHeader>
                <CardTitle className="text-base">
                  Live Books ({filteredLive.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-y-auto max-h-[700px]">
                {filteredLive.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No live books</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredLive.map((book) => (
                      <BookListItem
                        key={book.id}
                        book={book}
                        isSelected={selectedBook?.id === book.id}
                        onClick={() => setSelectedBook(book)}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="max-h-[800px] overflow-y-auto">
              <CardContent className="p-6">
                {selectedBook ? (
                  <BookDetailPanel
                    book={selectedBook}
                    onApprove={handleApprove}
                    onReject={() => setShowRejectDialog(true)}
                    onToggleFeatured={handleToggleFeatured}
                    onToggleStaffPick={handleToggleStaffPick}
                    isSubmitting={isSubmitting}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Eye className="w-12 h-12 mb-4 opacity-50" />
                    <p>Select a book to manage</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* All Books Tab */}
        <TabsContent value="all">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                All Books ({filteredAll.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {filteredAll.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No books found</p>
                </div>
              ) : (
                <div className="divide-y">
                  {filteredAll.map((book) => (
                    <BookListItem
                      key={book.id}
                      book={book}
                      isSelected={false}
                      onClick={() => {
                        setSelectedBook(book);
                        setActiveTab(book.status === "PENDING_REVIEW" ? "pending" : "live");
                      }}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Review History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {reviewHistory.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No review history</p>
                </div>
              ) : (
                <div className="divide-y">
                  {reviewHistory.map((review) => (
                    <div key={review.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{review.bookTitle}</p>
                          <p className="text-sm text-muted-foreground">
                            {review.action} by {review.reviewedBy}
                          </p>
                        </div>
                        <Badge
                          className={
                            review.action === "APPROVED"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-rose-500/20 text-rose-400"
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
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(review.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Rejection Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Reject Book
            </DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this book. This will be sent to the creator.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Rejection Reason *</Label>
              <Textarea
                placeholder="Explain why this book is being rejected..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
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
    </div>
  );
}
