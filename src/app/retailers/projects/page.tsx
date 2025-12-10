/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Store,
  Search,
  Bell,
  Settings,
  LogOut,
  Filter,
  Grid3X3,
  List,
  Calendar,
  Users,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  ShoppingCart,
  Clock,
  Percent,
  ArrowUpDown,
} from "lucide-react";

interface Project {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  category: string;
  goalAmount: number;
  currentAmount: number;
  backerCount: number;
  daysLeft: number;
  retailerDiscount: number;
  retailerMinQuantity: number;
  retailerMaxQuantity: number | null;
  rewards: {
    id: string;
    title: string;
    amount: number;
    retailerPrice: number;
  }[];
  creator: {
    name: string;
  };
}

const categories = [
  "All Categories",
  "Comics",
  "Graphic Novels",
  "Art Books",
  "Games",
  "Merchandise",
  "Collectibles",
];

const sortOptions = [
  { value: "ending_soon", label: "Ending Soon" },
  { value: "most_funded", label: "Most Funded" },
  { value: "newest", label: "Newest" },
  { value: "most_backed", label: "Most Backed" },
  { value: "highest_discount", label: "Highest Discount" },
];

export default function RetailerProjectsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [sortBy, setSortBy] = useState("ending_soon");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchProjects();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, sortBy, currentPage, searchQuery]);

  const fetchProjects = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "12",
        sort: sortBy,
        search: searchQuery,
        ...(selectedCategory !== "All Categories" && { category: selectedCategory }),
      });

      const response = await fetch(`/api/retailers/projects?${params}`);
      if (!response.ok) {
        if (response.status === 401) {
          router.push("/retailers/login");
          return;
        }
        throw new Error("Failed to fetch projects");
      }

      const data = await response.json();
      setProjects(data.projects);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch {
      console.error("Failed to fetch retailer projects");
      setProjects([]);
      setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/retailers/logout", { method: "POST" });
    // Use window.location.href for full navigation to ensure session is cleared
    window.location.href = "/retailers/login";
  };

  const getFundingPercent = (current: number, goal: number) => {
    return Math.round((current / goal) * 100);
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/retailers/dashboard" className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center">
                  <Store className="h-5 w-5 text-white" />
                </div>
                <span className="font-bold text-lg">Retailer Portal</span>
              </Link>
            </div>

            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon">
                <Settings className="h-5 w-5" />
              </Button>
              <div className="h-8 w-px bg-zinc-200"></div>
              <Button variant="ghost" size="icon" onClick={handleLogout}>
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white border-b border-zinc-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-8">
            <Link
              href="/retailers/dashboard"
              className="py-4 px-1 border-b-2 border-transparent text-zinc-500 hover:text-zinc-700 font-medium text-sm"
            >
              Dashboard
            </Link>
            <Link
              href="/retailers/projects"
              className="py-4 px-1 border-b-2 border-emerald-600 text-emerald-600 font-medium text-sm"
            >
              Browse Projects
            </Link>
            <Link
              href="/retailers/orders"
              className="py-4 px-1 border-b-2 border-transparent text-zinc-500 hover:text-zinc-700 font-medium text-sm"
            >
              My Orders
            </Link>
            <Link
              href="/retailers/invoices"
              className="py-4 px-1 border-b-2 border-transparent text-zinc-500 hover:text-zinc-700 font-medium text-sm"
            >
              Invoices
            </Link>
            <Link
              href="/retailers/account"
              className="py-4 px-1 border-b-2 border-transparent text-zinc-500 hover:text-zinc-700 font-medium text-sm"
            >
              Account
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Browse Projects</h1>
          <p className="text-zinc-500">
            Discover campaigns with retailer access and get 50% wholesale discount on all orders.
          </p>
        </div>

        {/* Wholesale Banner */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl p-6 mb-8 text-white">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-white/20 flex items-center justify-center">
              <Percent className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-xl font-bold">50% Wholesale Discount</h2>
              <p className="text-emerald-100">
                All prices shown include your retailer discount. Secure checkout available.
              </p>
            </div>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <Input
              placeholder="Search projects by name, creator, or category..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex gap-3">
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[180px]">
                <ArrowUpDown className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex border rounded-lg overflow-hidden">
              <Button
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="icon"
                onClick={() => setViewMode("grid")}
                className="rounded-none"
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="icon"
                onClick={() => setViewMode("list")}
                className="rounded-none"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Results Count */}
        <p className="text-sm text-zinc-500 mb-6">
          Showing {projects.length} retailer-eligible projects
        </p>

        {/* Loading State */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
          </div>
        ) : viewMode === "grid" ? (
          /* Grid View */
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Link key={project.id} href={`/retailers/projects/${project.id}`}>
                <Card className="overflow-hidden hover:shadow-lg transition-all cursor-pointer group">
                  <div className="aspect-[4/3] bg-zinc-100 relative overflow-hidden">
                    <img
                      src={project.imageUrl}
                      alt={project.title}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <Badge className="absolute top-3 left-3 bg-emerald-600 text-white">
                      {project.retailerDiscount}% OFF
                    </Badge>
                    {project.daysLeft <= 7 && (
                      <Badge className="absolute top-3 right-3 bg-red-500 text-white">
                        <Clock className="h-3 w-3 mr-1" />
                        {project.daysLeft} days left
                      </Badge>
                    )}
                  </div>
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="text-xs">
                        {project.category}
                      </Badge>
                      <span className="text-xs text-zinc-400">
                        by {project.creator.name}
                      </span>
                    </div>

                    <h3 className="font-semibold text-lg mb-2 line-clamp-1 group-hover:text-emerald-600 transition-colors">
                      {project.title}
                    </h3>
                    <p className="text-sm text-zinc-500 mb-4 line-clamp-2">
                      {project.subtitle}
                    </p>

                    {/* Pricing */}
                    <div className="bg-emerald-50 rounded-lg p-3 mb-4">
                      <p className="text-xs text-zinc-500 mb-1">Wholesale pricing from</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-xl font-bold text-emerald-600">
                          ${project.rewards[0]?.retailerPrice.toFixed(2)}
                        </span>
                        <span className="text-sm text-zinc-400 line-through">
                          ${project.rewards[0]?.amount.toFixed(2)}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 mt-1">
                        Min order: {project.retailerMinQuantity} units
                      </p>
                    </div>

                    {/* Progress */}
                    <div className="space-y-2">
                      <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-600 rounded-full transition-all"
                          style={{
                            width: `${Math.min(
                              getFundingPercent(project.currentAmount, project.goalAmount),
                              100
                            )}%`,
                          }}
                        ></div>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-emerald-600">
                          {getFundingPercent(project.currentAmount, project.goalAmount)}% funded
                        </span>
                        <span className="text-zinc-500 flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {project.backerCount} backers
                        </span>
                      </div>
                    </div>

                    <Button className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700">
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      Place Wholesale Order
                    </Button>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          /* List View */
          <div className="space-y-4">
            {projects.map((project) => (
              <Link key={project.id} href={`/retailers/projects/${project.id}`}>
                <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex">
                    <div className="w-64 h-48 bg-zinc-100 relative flex-shrink-0">
                      <img
                        src={project.imageUrl}
                        alt={project.title}
                        className="h-full w-full object-cover"
                      />
                      <Badge className="absolute top-3 left-3 bg-emerald-600 text-white">
                        {project.retailerDiscount}% OFF
                      </Badge>
                    </div>
                    <CardContent className="flex-1 p-5">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline">{project.category}</Badge>
                            <span className="text-sm text-zinc-400">
                              by {project.creator.name}
                            </span>
                            {project.daysLeft <= 7 && (
                              <Badge className="bg-red-100 text-red-700">
                                <Clock className="h-3 w-3 mr-1" />
                                {project.daysLeft} days left
                              </Badge>
                            )}
                          </div>
                          <h3 className="font-semibold text-xl mb-2 hover:text-emerald-600 transition-colors">
                            {project.title}
                          </h3>
                          <p className="text-zinc-500 mb-4 line-clamp-2">
                            {project.subtitle}
                          </p>

                          <div className="flex items-center gap-6 text-sm">
                            <div className="flex items-center gap-1">
                              <TrendingUp className="h-4 w-4 text-emerald-600" />
                              <span className="font-medium">
                                {getFundingPercent(project.currentAmount, project.goalAmount)}%
                                funded
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-zinc-500">
                              <Users className="h-4 w-4" />
                              <span>{project.backerCount} backers</span>
                            </div>
                            <div className="flex items-center gap-1 text-zinc-500">
                              <Calendar className="h-4 w-4" />
                              <span>{project.daysLeft} days left</span>
                            </div>
                          </div>
                        </div>

                        <div className="ml-6 text-right">
                          <div className="bg-emerald-50 rounded-lg p-4 min-w-[180px]">
                            <p className="text-xs text-zinc-500 mb-1">Wholesale price from</p>
                            <div className="flex items-baseline justify-end gap-2">
                              <span className="text-2xl font-bold text-emerald-600">
                                ${project.rewards[0]?.retailerPrice.toFixed(2)}
                              </span>
                              <span className="text-sm text-zinc-400 line-through">
                                ${project.rewards[0]?.amount.toFixed(2)}
                              </span>
                            </div>
                            <p className="text-xs text-zinc-500 mt-1">
                              Min: {project.retailerMinQuantity} units
                            </p>
                          </div>
                          <Button className="mt-3 bg-emerald-600 hover:bg-emerald-700">
                            <ShoppingCart className="h-4 w-4 mr-2" />
                            Order
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-center gap-2 mt-8">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <Button
                key={page}
                variant={currentPage === page ? "default" : "outline"}
                size="sm"
                onClick={() => setCurrentPage(page)}
                className="w-10"
              >
                {page}
              </Button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </main>
    </div>
  );
}
