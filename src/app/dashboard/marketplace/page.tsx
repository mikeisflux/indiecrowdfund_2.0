"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BookOpen,
  Building2,
  Plus,
  DollarSign,
  Clock,
  CheckCircle,
  Edit,
  ArrowLeft,
  Settings,
  ShoppingCart,
  BarChart3,
  Loader2,
  Ticket,
} from "lucide-react";
import { UserProfileDropdown } from "@/components/user-profile-dropdown";
import { NotificationsDropdown } from "@/components/notifications/notifications-dropdown";
import { MarketplacePaymentSettings } from "@/components/marketplace/marketplace-payment-settings";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { StatsCard } from "./components/StatsCard";
import { CompanyProfileCard } from "./components/CompanyProfileCard";
import { BooksGrid } from "./components/BooksGrid";
import { PromoCodesTab } from "./components/PromoCodesTab";
import { AnalyticsTab } from "./components/AnalyticsTab";
import {
  MarketplaceBook,
  CompanyProfile,
  MarketplaceStats,
  DiscountCode,
  LiveBook,
} from "./components/types";

export default function CreatorMarketplaceDashboard() {
  const searchParams = useSearchParams();
  const [books, setBooks] = useState<MarketplaceBook[]>([]);
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [stats, setStats] = useState<MarketplaceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("books");
  const [discountCodes, setDiscountCodes] = useState<DiscountCode[]>([]);
  const [currentMonthCode, setCurrentMonthCode] = useState<DiscountCode | null>(null);
  const [hasLiveBooks, setHasLiveBooks] = useState(false);
  const [liveBooksList, setLiveBooksList] = useState<LiveBook[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<string>("");
  const [creatingCode, setCreatingCode] = useState(false);
  const [editingCodeId, setEditingCodeId] = useState<string | null>(null);
  const [deletingCodeId, setDeletingCodeId] = useState<string | null>(null);

  const fetchDiscountCodes = useCallback(async () => {
    try {
      const res = await fetch("/api/creator/marketplace/discount-codes");
      if (res.ok) {
        const data = await res.json();
        setDiscountCodes(data.discountCodes || []);
        setCurrentMonthCode(data.currentMonthCode || null);
        setHasLiveBooks(data.hasLiveBooks || false);
        setLiveBooksList(data.liveBooks || []);
      }
    } catch (error) {
      console.error("Error fetching discount codes:", error);
    }
  }, []);

  const handleCreateCode = async () => {
    if (!selectedBookId) {
      toast.error("Please select a book for the promo code");
      return;
    }
    setCreatingCode(true);
    try {
      const res = await apiFetch("/api/creator/marketplace/discount-codes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ bookId: selectedBookId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to create promo code");
        return;
      }
      toast.success("Promo code created successfully!");
      setSelectedBookId("");
      fetchDiscountCodes();
    } catch (error) {
      console.error("Error creating promo code:", error);
      toast.error("Failed to create promo code");
    } finally {
      setCreatingCode(false);
    }
  };

  const handleUpdateCode = async (codeId: string, bookId: string) => {
    setEditingCodeId(codeId);
    try {
      const res = await apiFetch("/api/creator/marketplace/discount-codes", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ codeId, bookId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to update promo code");
        return;
      }
      toast.success("Promo code updated successfully!");
      fetchDiscountCodes();
    } catch (error) {
      console.error("Error updating promo code:", error);
      toast.error("Failed to update promo code");
    } finally {
      setEditingCodeId(null);
    }
  };

  const handleDeleteCode = async (codeId: string) => {
    if (!confirm("Are you sure you want to delete this promo code?")) {
      return;
    }
    setDeletingCodeId(codeId);
    try {
      const res = await apiFetch(`/api/creator/marketplace/discount-codes?codeId=${codeId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to delete promo code");
        return;
      }
      if (data.deactivated) {
        toast.success("Promo code deactivated (has existing redemptions)");
      } else {
        toast.success("Promo code deleted successfully!");
      }
      fetchDiscountCodes();
    } catch (error) {
      console.error("Error deleting promo code:", error);
      toast.error("Failed to delete promo code");
    } finally {
      setDeletingCodeId(null);
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
      const res = await apiFetch(`/api/creator/marketplace/books/${bookId}`, {
        method: "DELETE",
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
      const res = await apiFetch(`/api/creator/marketplace/books/${bookId}/submit`, {
        method: "POST",
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
        <div className="container flex flex-wrap items-center gap-3 py-3">
          <Link
            href={`/dashboard?project=${searchParams?.get("project") || ""}`}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <div className="flex items-center gap-2 ml-auto">
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
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
        {company && <CompanyProfileCard company={company} />}

        {/* Books Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="overflow-x-auto pb-1">
            <TabsList className="bg-muted/50 backdrop-blur-sm border border-border rounded-xl p-1 inline-flex w-max">
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
            <BooksGrid
              books={books}
              onDelete={handleDelete}
              onSubmit={handleSubmitForReview}
              emptyIcon={BookOpen}
              emptyMessage="No books yet"
              showCreateButton={true}
            />
          </TabsContent>

          <TabsContent value="live" className="space-y-4">
            <BooksGrid
              books={books.filter(b => b.status === "LIVE")}
              onDelete={handleDelete}
              onSubmit={handleSubmitForReview}
              emptyIcon={CheckCircle}
              emptyMessage="No live books yet"
            />
          </TabsContent>

          <TabsContent value="pending" className="space-y-4">
            <BooksGrid
              books={books.filter(b => b.status === "PENDING_REVIEW")}
              onDelete={handleDelete}
              onSubmit={handleSubmitForReview}
              emptyIcon={Clock}
              emptyMessage="No books pending review"
            />
          </TabsContent>

          <TabsContent value="drafts" className="space-y-4">
            <BooksGrid
              books={books.filter(b => b.status === "DRAFT")}
              onDelete={handleDelete}
              onSubmit={handleSubmitForReview}
              emptyIcon={Edit}
              emptyMessage="No draft books"
            />
          </TabsContent>

          <TabsContent value="promo-codes" className="space-y-6">
            <PromoCodesTab
              hasLiveBooks={hasLiveBooks}
              liveBooksList={liveBooksList}
              currentMonthCode={currentMonthCode}
              discountCodes={discountCodes}
              selectedBookId={selectedBookId}
              setSelectedBookId={setSelectedBookId}
              creatingCode={creatingCode}
              editingCodeId={editingCodeId}
              deletingCodeId={deletingCodeId}
              onCreateCode={handleCreateCode}
              onUpdateCode={handleUpdateCode}
              onDeleteCode={handleDeleteCode}
              onCopyCode={copyCodeToClipboard}
            />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <AnalyticsTab books={books} />
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <div className="max-w-2xl">
              <MarketplacePaymentSettings />
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
