"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  Building2,
  Plus,
  Eye,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Edit,
  Trash2,
  ArrowLeft,
  MoreHorizontal,
  Star,
  Sparkles,
  Settings,
  ShoppingCart,
  BarChart3,
  Loader2,
  Ticket,
  Copy,
  ExternalLink,
  Mail,
  Gift,
  Users,
  Calendar,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserProfileDropdown } from "@/components/user-profile-dropdown";
import { NotificationsDropdown } from "@/components/notifications/notifications-dropdown";
import { PaymentSettings } from "@/components/payment-settings";
import { toast } from "sonner";
import { getCSRFHeaders } from "@/lib/csrf";
import { cn } from "@/lib/utils";

interface MarketplaceBook {
  id: string;
  title: string;
  slug: string;
  coverImage: string | null;
  price: number;
  currency: string;
  status: "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "LIVE" | "REJECTED" | "ARCHIVED";
  isFeatured: boolean;
  isStaffPick: boolean;
  stats: {
    purchases: number;
    views: number;
    revenue: number;
  };
  createdAt: string;
  publishedAt: string | null;
  rejectionReason: string | null;
}

interface CompanyProfile {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  logo: string | null;
  banner: string | null;
  isVerified: boolean;
  stats: {
    books: number;
    totalSales: number;
    totalRevenue: number;
  };
}

interface MarketplaceStats {
  totalBooks: number;
  liveBooks: number;
  pendingBooks: number;
  totalRevenue: number;
  totalSales: number;
  monthlyRevenue: number;
  monthlySales: number;
}

interface DiscountCodeRedemption {
  id: string;
  redeemedAt: string;
  discountAmount: number;
  customer: {
    id: string;
    name: string | null;
    email: string;
  };
  book: {
    id: string;
    title: string;
    slug: string;
  };
}

interface DiscountCode {
  id: string;
  code: string;
  type: "FREE_BOOK" | "PERCENTAGE" | "FIXED_AMOUNT";
  validFrom: string;
  validUntil: string;
  maxRedemptions: number;
  usageCount: number;
  isActive: boolean;
  createdAt: string;
  redemptions: DiscountCodeRedemption[];
}

function StatusBadge({ status }: { status: MarketplaceBook["status"] }) {
  const statusConfig = {
    DRAFT: { label: "Draft", icon: Edit, className: "bg-gray-500/20 text-gray-600 dark:text-gray-400 border-gray-500/30" },
    PENDING_REVIEW: { label: "Pending Review", icon: Clock, className: "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30" },
    APPROVED: { label: "Approved", icon: CheckCircle, className: "bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30" },
    LIVE: { label: "Live", icon: CheckCircle, className: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
    REJECTED: { label: "Rejected", icon: XCircle, className: "bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/30" },
    ARCHIVED: { label: "Archived", icon: AlertCircle, className: "bg-zinc-500/20 text-zinc-600 dark:text-zinc-400 border-zinc-500/30" },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge className={cn("border", config.className)}>
      <Icon className="w-3 h-3 mr-1" />
      {config.label}
    </Badge>
  );
}

function BookCard({
  book,
  onDelete,
  onSubmit
}: {
  book: MarketplaceBook;
  onDelete: (id: string) => void;
  onSubmit: (id: string) => void;
}) {
  return (
    <div className="group relative rounded-xl overflow-hidden bg-card border border-border hover:border-primary/30 transition-all duration-300">
      {/* Cover Image */}
      <div className="relative aspect-video">
        {book.coverImage ? (
          <Image
            src={book.coverImage}
            alt={book.title}
            fill
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
            <BookOpen className="h-12 w-12 text-muted-foreground/50" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

        {/* Badges */}
        <div className="absolute top-3 left-3 flex gap-2">
          {book.isFeatured && (
            <Badge className="bg-amber-500/90 text-white border-0 backdrop-blur-sm">
              <Star className="w-3 h-3 mr-1 fill-current" />
              Featured
            </Badge>
          )}
          {book.isStaffPick && (
            <Badge className="bg-primary/90 text-primary-foreground border-0 backdrop-blur-sm">
              <Sparkles className="w-3 h-3 mr-1" />
              Staff Pick
            </Badge>
          )}
        </div>

        {/* Actions */}
        <div className="absolute top-3 right-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 bg-black/50 backdrop-blur-sm text-white hover:bg-black/70"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/marketplace/books/${book.id}/edit`}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Link>
              </DropdownMenuItem>
              {book.status === "LIVE" && (
                <DropdownMenuItem asChild>
                  <Link href={`/marketplace/books/${book.slug}`}>
                    <Eye className="w-4 h-4 mr-2" />
                    View Live
                  </Link>
                </DropdownMenuItem>
              )}
              {book.status === "DRAFT" && (
                <DropdownMenuItem onClick={() => onSubmit(book.id)}>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Submit for Review
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => onDelete(book.id)}
                className="text-rose-500 focus:text-rose-500"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <h3 className="font-semibold text-foreground line-clamp-1">{book.title}</h3>
          <StatusBadge status={book.status} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded-lg bg-muted">
            <p className="text-lg font-bold text-emerald-500 dark:text-emerald-400">${(book.stats?.revenue ?? 0).toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Revenue</p>
          </div>
          <div className="p-2 rounded-lg bg-muted">
            <p className="text-lg font-bold text-foreground">{book.stats?.purchases ?? 0}</p>
            <p className="text-xs text-muted-foreground">Sales</p>
          </div>
          <div className="p-2 rounded-lg bg-muted">
            <p className="text-lg font-bold text-foreground">{book.stats?.views ?? 0}</p>
            <p className="text-xs text-muted-foreground">Views</p>
          </div>
        </div>

        {/* Rejection Reason */}
        {book.status === "REJECTED" && book.rejectionReason && (
          <div className="mt-3 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20">
            <p className="text-xs text-rose-500 dark:text-rose-400">
              <strong>Rejection Reason:</strong> {book.rejectionReason}
            </p>
          </div>
        )}

        {/* Price */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
          <span className="text-muted-foreground text-sm">Price</span>
          <span className="text-lg font-bold text-emerald-500 dark:text-emerald-400">
            ${(book.price ?? 0).toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}

function StatsCard({
  title,
  value,
  prefix = "",
  icon: Icon,
  color = "primary",
  subtitle,
}: {
  title: string;
  value: number | string;
  prefix?: string;
  icon: React.ElementType;
  color?: "primary" | "green" | "blue" | "purple" | "amber";
  subtitle?: string;
}) {
  const colorStyles = {
    primary: { iconBg: "bg-primary/20", iconColor: "text-primary" },
    green: { iconBg: "bg-emerald-500/20", iconColor: "text-emerald-500" },
    blue: { iconBg: "bg-blue-500/20", iconColor: "text-blue-500" },
    purple: { iconBg: "bg-primary/20", iconColor: "text-primary" },
    amber: { iconBg: "bg-amber-500/20", iconColor: "text-amber-500" },
  };

  const styles = colorStyles[color];

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={cn("p-2 rounded-xl", styles.iconBg)}>
          <Icon className={cn("h-4 w-4", styles.iconColor)} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground">
          {prefix}{typeof value === "number" ? value.toLocaleString() : value}
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function CreatorMarketplaceDashboard() {
  const [books, setBooks] = useState<MarketplaceBook[]>([]);
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [stats, setStats] = useState<MarketplaceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("books");
  const [discountCodes, setDiscountCodes] = useState<DiscountCode[]>([]);
  const [currentMonthCode, setCurrentMonthCode] = useState<DiscountCode | null>(null);
  const [hasLiveBooks, setHasLiveBooks] = useState(false);
  const [creatingCode, setCreatingCode] = useState(false);

  const fetchDiscountCodes = useCallback(async () => {
    try {
      const res = await fetch("/api/creator/marketplace/discount-codes");
      if (res.ok) {
        const data = await res.json();
        setDiscountCodes(data.discountCodes || []);
        setCurrentMonthCode(data.currentMonthCode || null);
        setHasLiveBooks(data.hasLiveBooks || false);
      }
    } catch (error) {
      console.error("Error fetching discount codes:", error);
    }
  }, []);

  const handleCreateCode = async () => {
    setCreatingCode(true);
    try {
      const res = await fetch("/api/creator/marketplace/discount-codes", {
        method: "POST",
        headers: getCSRFHeaders(),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to create promo code");
        return;
      }
      toast.success("Promo code created successfully!");
      fetchDiscountCodes();
    } catch (error) {
      console.error("Error creating promo code:", error);
      toast.error("Failed to create promo code");
    } finally {
      setCreatingCode(false);
    }
  };

  const copyCodeToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Promo code copied to clipboard!");
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/creator/marketplace");
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = "/login";
          return;
        }
        throw new Error("Failed to fetch marketplace data");
      }
      const data = await res.json();
      setBooks(data.books || []);
      setCompany(data.company || null);
      setStats(data.stats || null);
    } catch (error) {
      console.error("Error fetching marketplace data:", error);
      toast.error("Failed to load marketplace data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchDiscountCodes();
  }, [fetchData, fetchDiscountCodes]);

  const handleDelete = async (bookId: string) => {
    if (!confirm("Are you sure you want to delete this book? This action cannot be undone.")) {
      return;
    }

    try {
      const res = await fetch(`/api/creator/marketplace/books/${bookId}`, {
        method: "DELETE",
        headers: getCSRFHeaders(),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete book");
      }

      toast.success("Book deleted successfully");
      fetchData();
    } catch (error) {
      console.error("Error deleting book:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete book");
    }
  };

  const handleSubmitForReview = async (bookId: string) => {
    try {
      const res = await fetch(`/api/creator/marketplace/books/${bookId}/submit`, {
        method: "POST",
        headers: getCSRFHeaders(),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit book for review");
      }

      toast.success("Book submitted for review");
      fetchData();
    } catch (error) {
      console.error("Error submitting book:", error);
      toast.error(error instanceof Error ? error.message : "Failed to submit book");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex min-h-screen items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading marketplace dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-xl font-bold text-foreground"
            >
              IndieCrowdfund
            </Link>
            <Badge className="bg-primary/20 text-primary border-primary/30">
              <ShoppingCart className="w-3 h-3 mr-1" />
              Creator Marketplace
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <NotificationsDropdown />
            <Link href="/dashboard/settings">
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                <Settings className="h-5 w-5" />
              </Button>
            </Link>
            <UserProfileDropdown />
          </div>
        </div>
      </header>

      {/* Sub Navigation */}
      <div className="border-b border-border bg-muted/50 backdrop-blur-sm">
        <div className="container flex items-center justify-between py-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/marketplace/company">
              <Button variant="outline" className="border-border">
                <Building2 className="w-4 h-4 mr-2" />
                {company ? "Edit Company" : "Create Company"}
              </Button>
            </Link>
            <Link href="/dashboard/marketplace/books/new">
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <Plus className="w-4 h-4 mr-2" />
                New Book
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <main className="container relative py-8">
        {/* Stats Overview */}
        {stats && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
            <StatsCard
              title="Total Revenue"
              value={stats.totalRevenue ?? 0}
              prefix="$"
              icon={DollarSign}
              color="green"
              subtitle={`$${(stats.monthlyRevenue ?? 0).toFixed(2)} this month`}
            />
            <StatsCard
              title="Total Sales"
              value={stats.totalSales}
              icon={ShoppingCart}
              color="blue"
              subtitle={`${stats.monthlySales} this month`}
            />
            <StatsCard
              title="Live Books"
              value={stats.liveBooks}
              icon={BookOpen}
              color="purple"
              subtitle={`${stats.totalBooks} total`}
            />
            <StatsCard
              title="Pending Review"
              value={stats.pendingBooks}
              icon={Clock}
              color="amber"
            />
          </div>
        )}

        {/* Company Profile Card */}
        {company && (
          <Card className="bg-card border-border mb-8 overflow-hidden">
            {/* Banner */}
            <div className="relative h-32">
              {company.banner ? (
                <Image
                  src={company.banner}
                  alt={company.name}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-muted to-muted/50" />
              )}
              <div className="absolute inset-0 bg-black/10 dark:bg-black/30" />
            </div>

            {/* Logo & Info */}
            <div className="relative px-6 pb-6">
              <div className="absolute -top-10 left-6">
                <div className="w-20 h-20 rounded-xl bg-card backdrop-blur-md border border-border overflow-hidden flex items-center justify-center">
                  {company.logo ? (
                    <Image
                      src={company.logo}
                      alt={company.name}
                      width={80}
                      height={80}
                      className="object-cover"
                    />
                  ) : (
                    <Building2 className="h-10 w-10 text-muted-foreground/50" />
                  )}
                </div>
              </div>

              <div className="pt-14">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-foreground">{company.name}</h2>
                      {company.isVerified && (
                        <Badge className="bg-primary/20 text-primary border-primary/30">
                          Verified
                        </Badge>
                      )}
                    </div>
                    {company.tagline && (
                      <p className="text-muted-foreground mt-1">{company.tagline}</p>
                    )}
                  </div>
                  <Link href="/dashboard/marketplace/company">
                    <Button variant="outline" size="sm">
                      <Edit className="w-4 h-4 mr-2" />
                      Edit Profile
                    </Button>
                  </Link>
                </div>

                {/* Company Stats */}
                {company.stats && (
                  <div className="grid grid-cols-3 gap-4 mt-6">
                    <div className="p-4 rounded-xl bg-muted">
                      <p className="text-2xl font-bold text-foreground">{company.stats.books ?? 0}</p>
                      <p className="text-sm text-muted-foreground">Published Books</p>
                    </div>
                    <div className="p-4 rounded-xl bg-muted">
                      <p className="text-2xl font-bold text-foreground">{company.stats.totalSales ?? 0}</p>
                      <p className="text-sm text-muted-foreground">Total Sales</p>
                    </div>
                    <div className="p-4 rounded-xl bg-muted">
                      <p className="text-2xl font-bold text-emerald-500 dark:text-emerald-400">${(company.stats.totalRevenue ?? 0).toFixed(2)}</p>
                      <p className="text-sm text-muted-foreground">Total Revenue</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Books Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="flex items-center justify-between overflow-x-auto">
            <TabsList className="bg-muted/50 backdrop-blur-sm border border-border rounded-xl p-1 flex-wrap md:flex-nowrap">
              <TabsTrigger
                value="books"
                className="data-[state=active]:bg-primary/20 data-[state=active]:text-foreground rounded-lg px-4 py-2 text-muted-foreground"
              >
                <BookOpen className="w-4 h-4 mr-2" />
                All Books ({books.length})
              </TabsTrigger>
              <TabsTrigger
                value="live"
                className="data-[state=active]:bg-primary/20 data-[state=active]:text-foreground rounded-lg px-4 py-2 text-muted-foreground"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Live ({books.filter(b => b.status === "LIVE").length})
              </TabsTrigger>
              <TabsTrigger
                value="pending"
                className="data-[state=active]:bg-primary/20 data-[state=active]:text-foreground rounded-lg px-4 py-2 text-muted-foreground"
              >
                <Clock className="w-4 h-4 mr-2" />
                Pending ({books.filter(b => b.status === "PENDING_REVIEW").length})
              </TabsTrigger>
              <TabsTrigger
                value="drafts"
                className="data-[state=active]:bg-primary/20 data-[state=active]:text-foreground rounded-lg px-4 py-2 text-muted-foreground"
              >
                <Edit className="w-4 h-4 mr-2" />
                Drafts ({books.filter(b => b.status === "DRAFT").length})
              </TabsTrigger>
              <TabsTrigger
                value="promo-codes"
                className="data-[state=active]:bg-primary/20 data-[state=active]:text-foreground rounded-lg px-4 py-2 text-muted-foreground"
              >
                <Ticket className="w-4 h-4 mr-2" />
                Discount Codes
              </TabsTrigger>
              <TabsTrigger
                value="analytics"
                className="data-[state=active]:bg-primary/20 data-[state=active]:text-foreground rounded-lg px-4 py-2 text-muted-foreground"
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                Analytics
              </TabsTrigger>
              <TabsTrigger
                value="settings"
                className="data-[state=active]:bg-primary/20 data-[state=active]:text-foreground rounded-lg px-4 py-2 text-muted-foreground"
              >
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="books" className="space-y-4">
            {books.length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mb-6">
                    <BookOpen className="h-10 w-10 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">No books yet</h3>
                  <p className="text-muted-foreground text-center max-w-md mb-6">
                    Start selling your digital books on the marketplace. Upload your PDF,
                    set your price, and reach readers worldwide.
                  </p>
                  <Link href="/dashboard/marketplace/books/new">
                    <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                      <Plus className="w-4 h-4 mr-2" />
                      Create Your First Book
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {books.map((book) => (
                  <BookCard
                    key={book.id}
                    book={book}
                    onDelete={handleDelete}
                    onSubmit={handleSubmitForReview}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="live" className="space-y-4">
            {books.filter(b => b.status === "LIVE").length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="py-12 text-center">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-muted-foreground">No live books yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {books.filter(b => b.status === "LIVE").map((book) => (
                  <BookCard
                    key={book.id}
                    book={book}
                    onDelete={handleDelete}
                    onSubmit={handleSubmitForReview}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="pending" className="space-y-4">
            {books.filter(b => b.status === "PENDING_REVIEW").length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="py-12 text-center">
                  <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-muted-foreground">No books pending review</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {books.filter(b => b.status === "PENDING_REVIEW").map((book) => (
                  <BookCard
                    key={book.id}
                    book={book}
                    onDelete={handleDelete}
                    onSubmit={handleSubmitForReview}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="drafts" className="space-y-4">
            {books.filter(b => b.status === "DRAFT").length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="py-12 text-center">
                  <Edit className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-muted-foreground">No draft books</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {books.filter(b => b.status === "DRAFT").map((book) => (
                  <BookCard
                    key={book.id}
                    book={book}
                    onDelete={handleDelete}
                    onSubmit={handleSubmitForReview}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="promo-codes" className="space-y-6">
            {/* Current Month's Code Section */}
            <Card className="bg-card border-border">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-foreground">
                    <Gift className="h-5 w-5 text-primary" />
                    Monthly Free Book Code
                  </CardTitle>
                  {!hasLiveBooks && (
                    <Badge className="bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30">
                      Requires Live Book
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {!hasLiveBooks ? (
                  <div className="py-8 text-center">
                    <AlertCircle className="h-12 w-12 mx-auto mb-4 text-amber-500/50" />
                    <p className="text-muted-foreground mb-4">
                      You need at least one live book to create promo codes.
                    </p>
                    <Link href="/dashboard/marketplace/books/new">
                      <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                        <Plus className="w-4 h-4 mr-2" />
                        Create Your First Book
                      </Button>
                    </Link>
                  </div>
                ) : currentMonthCode ? (
                  <div className="space-y-4">
                    <div className="p-6 rounded-xl bg-primary/10 border border-primary/20">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-sm text-muted-foreground">Your promo code for this month:</span>
                        <Badge className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Active
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mb-4">
                        <code className="text-2xl font-bold tracking-wider text-foreground bg-muted px-4 py-2 rounded-lg">
                          {currentMonthCode.code}
                        </code>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => copyCodeToClipboard(currentMonthCode.code)}
                          className="shrink-0"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div className="p-3 rounded-lg bg-muted">
                          <Users className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                          <p className="text-lg font-bold text-foreground">{currentMonthCode.usageCount}/{currentMonthCode.maxRedemptions}</p>
                          <p className="text-xs text-muted-foreground">Redemptions</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted">
                          <Calendar className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                          <p className="text-lg font-bold text-foreground">
                            {new Date(currentMonthCode.validUntil).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </p>
                          <p className="text-xs text-muted-foreground">Expires</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted">
                          <Gift className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                          <p className="text-lg font-bold text-foreground">100%</p>
                          <p className="text-xs text-muted-foreground">Off 1 Book</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 border border-border">
                      <Mail className="h-5 w-5 text-primary shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">Share via Email Campaign</p>
                        <p className="text-xs text-muted-foreground">Send this code to your audience through IndieKit</p>
                      </div>
                      <Link href="/dashboard/indiekit?tab=emails">
                        <Button variant="outline" size="sm">
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Open IndieKit
                        </Button>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <Ticket className="h-12 w-12 mx-auto mb-4 text-primary/50" />
                    <p className="text-muted-foreground mb-2">
                      Generate your monthly promo code to offer one free PDF to a customer.
                    </p>
                    <p className="text-sm text-muted-foreground mb-6">
                      Each code is valid for one redemption per customer, per month.
                    </p>
                    <Button
                      onClick={handleCreateCode}
                      disabled={creatingCode}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      {creatingCode ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4 mr-2" />
                          Generate Promo Code
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Redemption History */}
            {discountCodes.length > 0 && (
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-foreground">
                    <Users className="h-5 w-5 text-primary" />
                    Redemption History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {discountCodes.flatMap(code => code.redemptions).length === 0 ? (
                    <div className="py-8 text-center">
                      <Ticket className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                      <p className="text-muted-foreground">No redemptions yet</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Share your promo code to see redemptions here
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {discountCodes.flatMap(code =>
                        code.redemptions.map(redemption => ({
                          ...redemption,
                          codeValue: code.code,
                        }))
                      ).sort((a, b) => new Date(b.redeemedAt).getTime() - new Date(a.redeemedAt).getTime())
                        .map((redemption) => (
                          <div
                            key={redemption.id}
                            className="flex items-center gap-4 p-4 rounded-lg bg-muted"
                          >
                            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                              <CheckCircle className="h-5 w-5 text-emerald-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-foreground truncate">
                                {redemption.customer.name || redemption.customer.email}
                              </p>
                              <p className="text-sm text-muted-foreground truncate">
                                Redeemed <code className="text-xs bg-muted-foreground/20 px-1.5 py-0.5 rounded">{redemption.codeValue}</code> for &quot;{redemption.book.title}&quot;
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-medium text-emerald-500">
                                -${Number(redemption.discountAmount).toFixed(2)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(redemption.redeemedAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* All Codes History */}
            {discountCodes.length > 1 && (
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-foreground">
                    <Clock className="h-5 w-5 text-primary" />
                    Past Promo Codes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {discountCodes
                      .filter(code => code.id !== currentMonthCode?.id)
                      .map((code) => (
                        <div
                          key={code.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted"
                        >
                          <div className="flex items-center gap-3">
                            <code className="text-sm font-mono bg-muted-foreground/20 px-2 py-1 rounded">
                              {code.code}
                            </code>
                            <Badge
                              className={cn(
                                "border",
                                code.isActive && new Date(code.validUntil) > new Date()
                                  ? "bg-emerald-500/20 text-emerald-600 border-emerald-500/30"
                                  : "bg-gray-500/20 text-gray-600 border-gray-500/30"
                              )}
                            >
                              {code.isActive && new Date(code.validUntil) > new Date() ? "Active" : "Expired"}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {code.usageCount}/{code.maxRedemptions} used • {new Date(code.validFrom).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Sales Analytics
                </CardTitle>
              </CardHeader>
              <CardContent>
                {books.filter(b => b.status === "LIVE").length === 0 ? (
                  <div className="py-12 text-center">
                    <TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                    <p className="text-muted-foreground">
                      Analytics will appear once you have live books with sales
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Top Performing Books */}
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-4">Top Performing Books</h4>
                      <div className="space-y-3">
                        {books
                          .filter(b => b.status === "LIVE")
                          .sort((a, b) => b.stats.revenue - a.stats.revenue)
                          .slice(0, 5)
                          .map((book, index) => (
                            <div
                              key={book.id}
                              className="flex items-center gap-4 p-3 rounded-lg bg-muted"
                            >
                              <span className="text-2xl font-bold text-muted-foreground/50">
                                #{index + 1}
                              </span>
                              <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted-foreground/10">
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
                                    <BookOpen className="h-6 w-6 text-muted-foreground/50" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1">
                                <p className="font-medium text-foreground">{book.title}</p>
                                <p className="text-sm text-muted-foreground">
                                  {book.stats?.purchases ?? 0} sales
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-bold text-emerald-500 dark:text-emerald-400">
                                  ${(book.stats?.revenue ?? 0).toFixed(2)}
                                </p>
                                <p className="text-xs text-muted-foreground">revenue</p>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <div className="max-w-2xl">
              <PaymentSettings
                compact={false}
                title="Stripe Connect"
                description="Connect your Stripe account to receive payments from marketplace sales. This is the same Stripe account used across all your IndieCrowdfund projects."
                showDivinityCoin={true}
              />
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
