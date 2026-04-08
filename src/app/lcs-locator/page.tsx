"use client";

import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  MapPin,
  Phone,
  Mail,
  Globe,
  Store,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Sparkles,
} from "lucide-react";

interface ComicShop {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  city: string;
  state: string | null;
  zipCode: string | null;
  country: string;
  region: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
}

interface Pagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasMore: boolean;
}

interface FilterOptions {
  states: string[];
  regions: string[];
}

// Region colors for badges - theme aware
const regionColors: Record<string, string> = {
  Northeast: "bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30",
  Southeast: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  Midwest: "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30",
  Southwest: "bg-orange-500/20 text-orange-600 dark:text-orange-400 border-orange-500/30",
  West: "bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30",
  International: "bg-pink-500/20 text-pink-600 dark:text-pink-400 border-pink-500/30",
};

export default function LCSLocatorPage() {
  const [shops, setShops] = useState<ComicShop[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ states: [], regions: [] });
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedState, setSelectedState] = useState<string>("");
  const [selectedRegion, setSelectedRegion] = useState<string>("");
  const [page, setPage] = useState(1);

  const fetchShops = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", "24");
      if (search) params.set("search", search);
      if (selectedState) params.set("state", selectedState);
      if (selectedRegion) params.set("region", selectedRegion);

      const response = await fetch(`/api/lcs-locator?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setShops(data.shops);
        setPagination(data.pagination);
        setFilterOptions(data.filters);
      }
    } catch (error) {
      console.error("Error fetching shops:", error);
    } finally {
      setLoading(false);
    }
  }, [page, search, selectedState, selectedRegion]);

  useEffect(() => {
    fetchShops();
  }, [fetchShops]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchShops();
  };

  const clearFilters = () => {
    setSearch("");
    setSelectedState("");
    setSelectedRegion("");
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden border-b border-border">
        {/* Animated background */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-500/10 dark:from-emerald-900/20 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5 dark:opacity-10" />

        <div className="relative max-w-7xl mx-auto px-4 py-16 sm:py-24">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6">
              <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-emerald-600 dark:text-emerald-400 text-sm font-medium">
                {pagination?.totalCount?.toLocaleString() || "2,300+"} Comic Shops
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4">
              <span className="bg-gradient-to-r from-emerald-600 via-cyan-600 to-emerald-600 dark:from-emerald-400 dark:via-cyan-400 dark:to-emerald-400 bg-clip-text text-transparent">
                LCS Locator
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              Find your Local Comic Shop. Supporting indie comics starts with supporting your neighborhood store.
            </p>

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search by shop name or city..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-12 pr-4 py-6 text-lg bg-card border-border text-foreground placeholder:text-muted-foreground rounded-xl focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                />
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Store className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Filter by:</span>
            </div>

            <Select value={selectedRegion} onValueChange={(v) => { setSelectedRegion(v === "all" ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-40 bg-card border-border text-foreground">
                <SelectValue placeholder="Region" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Regions</SelectItem>
                {filterOptions.regions.map((region) => (
                  <SelectItem key={region} value={region}>{region}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedState} onValueChange={(v) => { setSelectedState(v === "all" ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-32 bg-card border-border text-foreground">
                <SelectValue placeholder="State" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                <SelectItem value="all">All States</SelectItem>
                {filterOptions.states.map((state) => (
                  <SelectItem key={state} value={state}>{state}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(search || selectedState || selectedRegion) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-muted-foreground hover:text-foreground"
              >
                Clear filters
              </Button>
            )}

            <div className="ml-auto text-sm text-muted-foreground">
              {pagination && (
                <span>
                  Showing {((pagination.page - 1) * pagination.limit) + 1}-
                  {Math.min(pagination.page * pagination.limit, pagination.totalCount)} of{" "}
                  {pagination.totalCount.toLocaleString()}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Shop Grid */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          </div>
        ) : shops.length === 0 ? (
          <div className="text-center py-20">
            <Store className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">No shops found</h2>
            <p className="text-muted-foreground">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {shops.map((shop) => (
              <ShopCard key={shop.id} shop={shop} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-12">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pagination.page === 1}
              className="bg-card border-border text-foreground hover:bg-muted"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(7, pagination.totalPages) }, (_, i) => {
                let pageNum: number;
                if (pagination.totalPages <= 7) {
                  pageNum = i + 1;
                } else if (pagination.page <= 4) {
                  pageNum = i + 1;
                } else if (pagination.page >= pagination.totalPages - 3) {
                  pageNum = pagination.totalPages - 6 + i;
                } else {
                  pageNum = pagination.page - 3 + i;
                }

                return (
                  <Button
                    key={pageNum}
                    variant={pageNum === pagination.page ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setPage(pageNum)}
                    className={
                      pageNum === pagination.page
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={pagination.page === pagination.totalPages}
              className="bg-card border-border text-foreground hover:bg-muted"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function ShopCard({ shop }: { shop: ComicShop }) {
  const formatAddress = () => {
    const parts = [shop.address, shop.city, shop.state, shop.zipCode].filter(Boolean);
    return parts.join(", ");
  };

  const formatPhone = (phone: string) => {
    // Format phone for display
    return phone.replace(/[^\d-()+ ]/g, "");
  };

  return (
    <Card className="group bg-card border-border hover:border-emerald-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/10 overflow-hidden">
      <CardContent className="p-0">
        {/* Header with gradient */}
        <div className="h-2 bg-gradient-to-r from-emerald-500 via-cyan-500 to-emerald-500 opacity-60 group-hover:opacity-100 transition-opacity" />

        <div className="p-5">
          {/* Shop Name */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <h3 className="font-semibold text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors line-clamp-2">
              {shop.name}
            </h3>
            {shop.region && (
              <Badge
                variant="outline"
                className={`shrink-0 text-xs ${regionColors[shop.region] || "bg-muted text-muted-foreground border-border"}`}
              >
                {shop.region}
              </Badge>
            )}
          </div>

          {/* Location */}
          <div className="flex items-start gap-2 text-sm text-muted-foreground mb-3">
            <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="line-clamp-2">{formatAddress()}</span>
          </div>

          {/* Contact Info */}
          <div className="space-y-2">
            {shop.phone && (
              <a
                href={`tel:${shop.phone}`}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
              >
                <Phone className="h-3.5 w-3.5" />
                <span>{formatPhone(shop.phone)}</span>
              </a>
            )}

            {shop.email && (
              <a
                href={`mailto:${shop.email}`}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors truncate"
              >
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{shop.email}</span>
              </a>
            )}

            {shop.website && (
              <a
                href={shop.website.startsWith("http") ? shop.website : `https://${shop.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors truncate"
              >
                <Globe className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{shop.website.replace(/^https?:\/\//, "")}</span>
              </a>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
