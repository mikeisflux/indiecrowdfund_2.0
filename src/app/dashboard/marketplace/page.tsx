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

function StatusBadge({ status }: { status: MarketplaceBook["status"] }) {
  const statusConfig = {
    DRAFT: { label: "Draft", icon: Edit, className: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
    PENDING_REVIEW: { label: "Pending Review", icon: Clock, className: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
    APPROVED: { label: "Approved", icon: CheckCircle, className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
    LIVE: { label: "Live", icon: CheckCircle, className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
    REJECTED: { label: "Rejected", icon: XCircle, className: "bg-rose-500/20 text-rose-400 border-rose-500/30" },
    ARCHIVED: { label: "Archived", icon: AlertCircle, className: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30" },
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
    <div className="group relative rounded-xl overflow-hidden bg-card border border-border hover:border-purple-400/30 transition-all duration-300">
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
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/50 to-indigo-900/50 flex items-center justify-center">
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
            <Badge className="bg-purple-500/90 text-white border-0 backdrop-blur-sm">
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
            <p className="text-lg font-bold text-emerald-500 dark:text-emerald-400">${book.stats.revenue.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Revenue</p>
          </div>
          <div className="p-2 rounded-lg bg-muted">
            <p className="text-lg font-bold text-foreground">{book.stats.purchases}</p>
            <p className="text-xs text-muted-foreground">Sales</p>
          </div>
          <div className="p-2 rounded-lg bg-muted">
            <p className="text-lg font-bold text-foreground">{book.stats.views}</p>
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
            ${book.price.toFixed(2)}
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
    purple: { iconBg: "bg-purple-500/20", iconColor: "text-purple-500" },
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
  }, [fetchData]);

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
            <Loader2 className="h-8 w-8 animate-spin text-purple-500 dark:text-purple-400" />
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
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 dark:from-purple-400 dark:to-pink-400 bg-clip-text text-transparent"
            >
              IndieCrowdfund
            </Link>
            <Badge className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-600 dark:text-purple-300 border-purple-500/30">
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
              <Button className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white">
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
              value={stats.totalRevenue}
              prefix="$"
              icon={DollarSign}
              color="green"
              subtitle={`$${stats.monthlyRevenue.toFixed(2)} this month`}
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
                <div className="absolute inset-0 bg-gradient-to-br from-purple-200 to-cyan-200 dark:from-purple-900/50 dark:to-cyan-900/50" />
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
                        <Badge className="bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border-cyan-500/30">
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
                <div className="grid grid-cols-3 gap-4 mt-6">
                  <div className="p-4 rounded-xl bg-muted">
                    <p className="text-2xl font-bold text-foreground">{company.stats.books}</p>
                    <p className="text-sm text-muted-foreground">Published Books</p>
                  </div>
                  <div className="p-4 rounded-xl bg-muted">
                    <p className="text-2xl font-bold text-foreground">{company.stats.totalSales}</p>
                    <p className="text-sm text-muted-foreground">Total Sales</p>
                  </div>
                  <div className="p-4 rounded-xl bg-muted">
                    <p className="text-2xl font-bold text-emerald-500 dark:text-emerald-400">${company.stats.totalRevenue.toFixed(2)}</p>
                    <p className="text-sm text-muted-foreground">Total Revenue</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Books Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="flex items-center justify-between">
            <TabsList className="bg-muted/50 backdrop-blur-sm border border-border rounded-xl p-1">
              <TabsTrigger
                value="books"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500/30 data-[state=active]:to-pink-500/30 data-[state=active]:text-foreground rounded-lg px-4 py-2 text-muted-foreground"
              >
                <BookOpen className="w-4 h-4 mr-2" />
                All Books ({books.length})
              </TabsTrigger>
              <TabsTrigger
                value="live"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500/30 data-[state=active]:to-pink-500/30 data-[state=active]:text-foreground rounded-lg px-4 py-2 text-muted-foreground"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Live ({books.filter(b => b.status === "LIVE").length})
              </TabsTrigger>
              <TabsTrigger
                value="pending"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500/30 data-[state=active]:to-pink-500/30 data-[state=active]:text-foreground rounded-lg px-4 py-2 text-muted-foreground"
              >
                <Clock className="w-4 h-4 mr-2" />
                Pending ({books.filter(b => b.status === "PENDING_REVIEW").length})
              </TabsTrigger>
              <TabsTrigger
                value="drafts"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500/30 data-[state=active]:to-pink-500/30 data-[state=active]:text-foreground rounded-lg px-4 py-2 text-muted-foreground"
              >
                <Edit className="w-4 h-4 mr-2" />
                Drafts ({books.filter(b => b.status === "DRAFT").length})
              </TabsTrigger>
              <TabsTrigger
                value="analytics"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500/30 data-[state=active]:to-pink-500/30 data-[state=active]:text-foreground rounded-lg px-4 py-2 text-muted-foreground"
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                Analytics
              </TabsTrigger>
              <TabsTrigger
                value="settings"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500/30 data-[state=active]:to-pink-500/30 data-[state=active]:text-foreground rounded-lg px-4 py-2 text-muted-foreground"
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
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center mb-6">
                    <BookOpen className="h-10 w-10 text-purple-500 dark:text-purple-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">No books yet</h3>
                  <p className="text-muted-foreground text-center max-w-md mb-6">
                    Start selling your digital books on the marketplace. Upload your PDF,
                    set your price, and reach readers worldwide.
                  </p>
                  <Link href="/dashboard/marketplace/books/new">
                    <Button className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white">
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

          <TabsContent value="analytics" className="space-y-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <BarChart3 className="h-5 w-5 text-purple-500 dark:text-purple-400" />
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
                                  {book.stats.purchases} sales
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-bold text-emerald-500 dark:text-emerald-400">
                                  ${book.stats.revenue.toFixed(2)}
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
                compact={true}
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
