"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Users,
  UserCheck,
  Layers,
  Mail,
  Search,
  MoreHorizontal,
  Trash2,
  Download,
  Upload,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { getCSRFHeaders } from "@/lib/csrf";

interface Subscriber {
  id: string;
  email: string;
  name: string | null;
  source: string;
  subscribedAt: string | null;
  category: string;
}

interface SubscriberCounts {
  newsletter: number;
  verified: number;
  backers: number;
  creators: number;
  retailers: number;
  total: number;
}

interface SubscriberListTabProps {
  onImportCSV?: () => void;
}

const categoryInfo = {
  newsletter: {
    label: "Newsletter Subscribers",
    description: "Imported from CSV or signed up via forms",
    icon: Mail,
    color: "bg-blue-100 text-blue-700",
  },
  verified: {
    label: "Verified Users",
    description: "Registered users with verified emails",
    icon: UserCheck,
    color: "bg-emerald-100 text-emerald-700",
  },
  backers: {
    label: "Backers",
    description: "Users who have backed projects",
    icon: Users,
    color: "bg-violet-100 text-violet-700",
  },
  creators: {
    label: "Creators",
    description: "Users who have created projects",
    icon: Layers,
    color: "bg-amber-100 text-amber-700",
  },
  retailers: {
    label: "Retailers",
    description: "Retail partners and stockists",
    icon: Users,
    color: "bg-orange-100 text-orange-700",
  },
};

export function SubscriberListTab({ onImportCSV }: SubscriberListTabProps) {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [counts, setCounts] = useState<SubscriberCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchSubscribers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        category: selectedCategory,
        search: searchQuery,
        page: page.toString(),
        limit: "50",
      });

      const response = await fetch(`/api/admin/ai-marketing/subscribers?${params}`, {
        headers: getCSRFHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        setSubscribers(data.subscribers);
        setCounts(data.counts);
        setTotalPages(data.pagination.totalPages);
      }
    } catch (error) {
      console.error("Error fetching subscribers:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, searchQuery, page]);

  useEffect(() => {
    fetchSubscribers();
  }, [fetchSubscribers]);

  const handleDelete = async (id: string, category: string) => {
    if (!confirm("Are you sure you want to remove this subscriber?")) return;

    try {
      const response = await fetch(
        `/api/admin/ai-marketing/subscribers?id=${id}&category=${category}`,
        {
          method: "DELETE",
          headers: getCSRFHeaders(),
        }
      );

      if (response.ok) {
        fetchSubscribers();
      }
    } catch (error) {
      console.error("Error deleting subscriber:", error);
    }
  };

  const exportCSV = () => {
    const csvContent = [
      ["Email", "Name", "Source", "Category", "Subscribed At"].join(","),
      ...subscribers.map(s => [
        s.email,
        s.name || "",
        s.source,
        s.category,
        s.subscribedAt || "",
      ].map(field => `"${field}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `subscribers-${selectedCategory}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <div className="mt-6 space-y-6">
      {/* Category Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {Object.entries(categoryInfo).map(([key, info]) => {
          const Icon = info.icon;
          const count = counts?.[key as keyof SubscriberCounts] || 0;
          const isSelected = selectedCategory === key;

          return (
            <Card
              key={key}
              className={`cursor-pointer transition-all ${
                isSelected ? "ring-2 ring-emerald-500" : "hover:border-zinc-400"
              }`}
              onClick={() => {
                setSelectedCategory(key);
                setPage(1);
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`rounded-full p-2 ${info.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{info.label}</p>
                    <p className="text-2xl font-bold">{count.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* All Subscribers Card */}
      <Card
        className={`cursor-pointer transition-all ${
          selectedCategory === "all" ? "ring-2 ring-emerald-500" : "hover:border-zinc-400"
        }`}
        onClick={() => {
          setSelectedCategory("all");
          setPage(1);
        }}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-zinc-100 p-2">
                <Users className="h-5 w-5 text-zinc-600" />
              </div>
              <div>
                <p className="font-medium">All Subscribers</p>
                <p className="text-sm text-zinc-500">Combined view of all lists</p>
              </div>
            </div>
            <p className="text-2xl font-bold">{counts?.total.toLocaleString() || 0}</p>
          </div>
        </CardContent>
      </Card>

      {/* Subscriber List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>
                {selectedCategory === "all"
                  ? "All Subscribers"
                  : categoryInfo[selectedCategory as keyof typeof categoryInfo]?.label}
              </CardTitle>
              <CardDescription>
                {selectedCategory === "all"
                  ? "View and manage all email lists"
                  : categoryInfo[selectedCategory as keyof typeof categoryInfo]?.description}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onImportCSV}>
                <Upload className="mr-2 h-4 w-4" />
                Import CSV
              </Button>
              <Button variant="outline" size="sm" onClick={exportCSV}>
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
              <Button variant="outline" size="sm" onClick={fetchSubscribers}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="mb-4 flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <Input
                placeholder="Search by email or name..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>

          {/* Table */}
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto text-zinc-400" />
                    </TableCell>
                  </TableRow>
                ) : subscribers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-zinc-500">
                      No subscribers found
                    </TableCell>
                  </TableRow>
                ) : (
                  subscribers.map((subscriber) => (
                    <TableRow key={`${subscriber.category}-${subscriber.id}`}>
                      <TableCell className="font-medium">{subscriber.email}</TableCell>
                      <TableCell>{subscriber.name || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{subscriber.source}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            categoryInfo[subscriber.category as keyof typeof categoryInfo]?.color ||
                            "bg-zinc-100 text-zinc-700"
                          }
                        >
                          {categoryInfo[subscriber.category as keyof typeof categoryInfo]?.label ||
                            subscriber.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-zinc-500">
                        {formatDate(subscriber.subscribedAt)}
                      </TableCell>
                      <TableCell>
                        {subscriber.category === "newsletter" && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => handleDelete(subscriber.id, subscriber.category)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Remove
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-zinc-500">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
