"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Search,
  CheckCircle,
  XCircle,
  Eye,
  Store,
  RefreshCw,
  Bell,
  Clock,
  Ban,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Mail,
  Phone,
  MapPin,
  Building2,
  Calendar,
  FileText,
  Shield,
  Copy,
  Check,
  AlertTriangle,
  Star,
  MessageSquare,
  Package,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";

// Retailer interface
interface Retailer {
  id: string;
  businessName: string;
  businessType: string;
  contactName: string;
  email: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  country: string;
  taxId: string | null;
  taxIdType: string | null;
  resaleCertificate: string | null;
  yearsInBusiness: number | null;
  numberOfLocations: number | null;
  annualRevenue: string | null;
  websiteUrl: string | null;
  status: string;
  createdAt: string;
  verifiedAt: string | null;
  verificationNotes: string | null;
  accessCode: string | null;
  _count?: {
    pledges: number;
  };
}

interface RetailerStats {
  pending: number;
  underReview: number;
  approved: number;
  rejected: number;
  suspended: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface SatisfactionSurvey {
  id: string;
  retailerId: string;
  retailerPledgeId: string;
  rating: number | null;
  feedback: string | null;
  productQuality: number | null;
  shippingSpeed: number | null;
  packaging: number | null;
  communication: number | null;
  overallExperience: number | null;
  wouldRecommend: boolean | null;
  sentAt: string | null;
  completedAt: string | null;
  createdAt: string;
  retailer: {
    id: string;
    businessName: string;
    contactName: string;
    email: string;
  };
  order: {
    id: string;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
    status: string;
    invoiceNumber: string | null;
    project: {
      id: string;
      title: string;
      vanityUrl: string | null;
      slug: string;
      imageUrl: string | null;
    } | null;
    reward: {
      id: string;
      title: string;
      price: number;
    } | null;
  } | null;
}

interface SurveyStats {
  total: number;
  completed: number;
  pending: number;
  avgRating: number;
}

function getRetailerStatusBadge(status: string) {
  switch (status) {
    case "PENDING":
      return <Badge className="bg-amber-100 text-amber-700"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
    case "UNDER_REVIEW":
      return <Badge className="bg-blue-100 text-blue-700">Under Review</Badge>;
    case "APPROVED":
      return <Badge className="bg-emerald-100 text-emerald-700"><CheckCircle className="h-3 w-3 mr-1" /> Approved</Badge>;
    case "REJECTED":
      return <Badge className="bg-red-100 text-red-700"><XCircle className="h-3 w-3 mr-1" /> Rejected</Badge>;
    case "SUSPENDED":
      return <Badge className="bg-zinc-100 text-zinc-700"><Ban className="h-3 w-3 mr-1" /> Suspended</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function getBusinessTypeBadge(type: string) {
  const typeLabels: Record<string, string> = {
    COMIC_SHOP: "Comic Shop",
    BOOKSTORE: "Bookstore",
    GAME_STORE: "Game Store",
    HOBBY_SHOP: "Hobby Shop",
    ONLINE_RETAILER: "Online Retailer",
    DISTRIBUTOR: "Distributor",
    OTHER: "Other",
  };
  return <Badge variant="outline">{typeLabels[type] || type}</Badge>;
}

function StarRating({ rating, size = "sm" }: { rating: number | null; size?: "sm" | "lg" }) {
  if (rating === null) return <span className="text-zinc-400">-</span>;
  const stars = [];
  const starSize = size === "lg" ? "h-5 w-5" : "h-4 w-4";
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <Star
        key={i}
        className={`${starSize} ${i <= rating ? "fill-amber-400 text-amber-400" : "text-zinc-300"}`}
      />
    );
  }
  return <div className="flex items-center gap-0.5">{stars}</div>;
}

export default function RetailersPage() {
  const [retailers, setRetailers] = useState<Retailer[]>([]);
  const [stats, setStats] = useState<RetailerStats>({
    pending: 0,
    underReview: 0,
    approved: 0,
    rejected: 0,
    suspended: 0,
  });
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Dialog states
  const [selectedRetailer, setSelectedRetailer] = useState<Retailer | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isActionDialogOpen, setIsActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<string>("");
  const [actionNotes, setActionNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Satisfaction surveys state
  const [surveys, setSurveys] = useState<SatisfactionSurvey[]>([]);
  const [surveyStats, setSurveyStats] = useState<SurveyStats>({
    total: 0,
    completed: 0,
    pending: 0,
    avgRating: 0,
  });
  const [surveyPagination, setSurveyPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const [surveyFilter, setSurveyFilter] = useState("all");
  const [isSurveysLoading, setIsSurveysLoading] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState<SatisfactionSurvey | null>(null);
  const [isSurveyDetailOpen, setIsSurveyDetailOpen] = useState(false);

  const fetchRetailers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        status: statusFilter,
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      const response = await fetch(`/api/admin/retailers?${params}`);
      if (response.ok) {
        const data = await response.json();
        setRetailers(data.retailers);
        setStats(data.stats);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error("Error fetching retailers:", error);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, pagination.page, pagination.limit]);

  useEffect(() => {
    fetchRetailers();
  }, [fetchRetailers]);

  const fetchSurveys = useCallback(async () => {
    setIsSurveysLoading(true);
    try {
      const params = new URLSearchParams({
        status: surveyFilter,
        page: surveyPagination.page.toString(),
        limit: surveyPagination.limit.toString(),
      });

      const response = await fetch(`/api/admin/retailers/surveys?${params}`);
      if (response.ok) {
        const data = await response.json();
        setSurveys(data.surveys);
        setSurveyStats(data.stats);
        setSurveyPagination(data.pagination);
      }
    } catch (error) {
      console.error("Error fetching surveys:", error);
    } finally {
      setIsSurveysLoading(false);
    }
  }, [surveyFilter, surveyPagination.page, surveyPagination.limit]);

  useEffect(() => {
    fetchSurveys();
  }, [fetchSurveys]);

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleViewRetailer = (retailer: Retailer) => {
    setSelectedRetailer(retailer);
    setIsDetailsOpen(true);
  };

  const handleActionClick = (retailer: Retailer, action: string) => {
    setSelectedRetailer(retailer);
    setActionType(action);
    setActionNotes("");
    setIsActionDialogOpen(true);
  };

  const handleConfirmAction = async () => {
    if (!selectedRetailer || !actionType) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/admin/retailers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          retailerId: selectedRetailer.id,
          action: actionType,
          notes: actionNotes,
        }),
      });

      if (response.ok) {
        await fetchRetailers();
        setIsActionDialogOpen(false);
        setIsDetailsOpen(false);
      }
    } catch (error) {
      console.error("Error updating retailer:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyAccessCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const filteredRetailers = retailers.filter((r) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      r.businessName.toLowerCase().includes(query) ||
      r.contactName.toLowerCase().includes(query) ||
      r.email.toLowerCase().includes(query)
    );
  });

  const totalRetailers = stats.pending + stats.underReview + stats.approved + stats.rejected + stats.suspended;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Retailer Management</h1>
          <p className="text-zinc-500">
            Review and manage retailer applications
          </p>
        </div>
        <Button onClick={fetchRetailers} variant="outline" size="sm">
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold">{totalRetailers}</p>
            <p className="text-xs text-zinc-500">Total Applications</p>
          </CardContent>
        </Card>
        <Card className={stats.pending > 0 ? "border-amber-200 bg-amber-50" : ""}>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
            <p className="text-xs text-zinc-500">Pending Review</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-blue-600">{stats.underReview}</p>
            <p className="text-xs text-zinc-500">Under Review</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-emerald-600">{stats.approved}</p>
            <p className="text-xs text-zinc-500">Approved</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
            <p className="text-xs text-zinc-500">Rejected</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-zinc-600">{stats.suspended}</p>
            <p className="text-xs text-zinc-500">Suspended</p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Alert */}
      {stats.pending > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
            <Bell className="h-5 w-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-amber-800">New Retailer Applications</h3>
            <p className="text-sm text-amber-700">
              You have {stats.pending} retailer application{stats.pending !== 1 ? "s" : ""} awaiting review.
            </p>
          </div>
          <Button
            onClick={() => handleStatusFilterChange("PENDING")}
            className="bg-amber-600 hover:bg-amber-700"
          >
            Review Now
          </Button>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            placeholder="Search by business name, contact, or email..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Applications</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="UNDER_REVIEW">Under Review</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
            <SelectItem value="SUSPENDED">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Retailers Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-zinc-50 dark:bg-zinc-800">
                  <th className="p-4 text-left text-sm font-medium">Business</th>
                  <th className="p-4 text-left text-sm font-medium">Type</th>
                  <th className="p-4 text-left text-sm font-medium">Contact</th>
                  <th className="p-4 text-left text-sm font-medium">Location</th>
                  <th className="p-4 text-left text-sm font-medium">Status</th>
                  <th className="p-4 text-left text-sm font-medium">Applied</th>
                  <th className="p-4 text-left text-sm font-medium w-36">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-zinc-500">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                      Loading retailers...
                    </td>
                  </tr>
                ) : filteredRetailers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-zinc-500">
                      <Store className="h-8 w-8 mx-auto mb-2 text-zinc-300" />
                      No retailer applications found
                    </td>
                  </tr>
                ) : (
                  filteredRetailers.map((retailer) => (
                    <tr key={retailer.id} className="border-b hover:bg-zinc-50 dark:hover:bg-zinc-800">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                            <Store className="h-5 w-5 text-emerald-600" />
                          </div>
                          <div>
                            <p className="font-medium">{retailer.businessName}</p>
                            <p className="text-sm text-zinc-500">
                              {retailer.yearsInBusiness
                                ? `${retailer.yearsInBusiness} year${retailer.yearsInBusiness !== 1 ? "s" : ""} in business`
                                : "New business"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">{getBusinessTypeBadge(retailer.businessType)}</td>
                      <td className="p-4">
                        <div>
                          <p className="font-medium">{retailer.contactName}</p>
                          <p className="text-sm text-zinc-500">{retailer.email}</p>
                        </div>
                      </td>
                      <td className="p-4">
                        <p className="text-sm">
                          {retailer.city && retailer.state
                            ? `${retailer.city}, ${retailer.state}`
                            : retailer.country}
                        </p>
                      </td>
                      <td className="p-4">{getRetailerStatusBadge(retailer.status)}</td>
                      <td className="p-4 text-sm text-zinc-500">
                        {new Date(retailer.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewRetailer(retailer)}
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {(retailer.status === "PENDING" || retailer.status === "UNDER_REVIEW") && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                onClick={() => handleActionClick(retailer, "APPROVE")}
                                title="Approve"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleActionClick(retailer, "REJECT")}
                                title="Reject"
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {retailer.status === "APPROVED" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-zinc-600 hover:text-zinc-700"
                              onClick={() => handleActionClick(retailer, "SUSPEND")}
                              title="Suspend"
                            >
                              <Ban className="h-4 w-4" />
                            </Button>
                          )}
                          {retailer.status === "SUSPENDED" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-emerald-600 hover:text-emerald-700"
                              onClick={() => handleActionClick(retailer, "REACTIVATE")}
                              title="Reactivate"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-500">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
            {pagination.total} applications
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
              disabled={pagination.page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
              disabled={pagination.page === pagination.totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Satisfaction Surveys Section */}
      <div className="mt-12 pt-8 border-t">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Satisfaction Surveys
            </h2>
            <p className="text-zinc-500 text-sm">
              Feedback from retailers after receiving their orders
            </p>
          </div>
          <Button onClick={fetchSurveys} variant="outline" size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${isSurveysLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Survey Stats */}
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <p className="text-2xl font-bold">{surveyStats.total}</p>
              <p className="text-xs text-zinc-500">Total Surveys</p>
            </CardContent>
          </Card>
          <Card className="border-emerald-200 bg-emerald-50">
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-emerald-600">{surveyStats.completed}</p>
              <p className="text-xs text-zinc-500">Completed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-amber-600">{surveyStats.pending}</p>
              <p className="text-xs text-zinc-500">Awaiting Response</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold">{surveyStats.avgRating.toFixed(1)}</p>
                <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
              </div>
              <p className="text-xs text-zinc-500">Average Rating</p>
            </CardContent>
          </Card>
        </div>

        {/* Survey Filter */}
        <div className="flex items-center gap-4 mb-4">
          <Select value={surveyFilter} onValueChange={(value) => {
            setSurveyFilter(value);
            setSurveyPagination((prev) => ({ ...prev, page: 1 }));
          }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter surveys" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Surveys</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Surveys Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-zinc-50 dark:bg-zinc-800">
                    <th className="p-4 text-left text-sm font-medium">Retailer</th>
                    <th className="p-4 text-left text-sm font-medium">Campaign</th>
                    <th className="p-4 text-left text-sm font-medium">Order</th>
                    <th className="p-4 text-left text-sm font-medium">Rating</th>
                    <th className="p-4 text-left text-sm font-medium">Recommend?</th>
                    <th className="p-4 text-left text-sm font-medium">Status</th>
                    <th className="p-4 text-left text-sm font-medium">Date</th>
                    <th className="p-4 text-left text-sm font-medium w-20">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isSurveysLoading ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-zinc-500">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                        Loading surveys...
                      </td>
                    </tr>
                  ) : surveys.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-zinc-500">
                        <MessageSquare className="h-8 w-8 mx-auto mb-2 text-zinc-300" />
                        No satisfaction surveys found
                      </td>
                    </tr>
                  ) : (
                    surveys.map((survey) => (
                      <tr key={survey.id} className="border-b hover:bg-zinc-50 dark:hover:bg-zinc-800">
                        <td className="p-4">
                          <div>
                            <p className="font-medium">{survey.retailer.businessName}</p>
                            <p className="text-sm text-zinc-500">{survey.retailer.contactName}</p>
                          </div>
                        </td>
                        <td className="p-4">
                          {survey.order?.project ? (
                            <div className="flex items-center gap-2">
                              {survey.order.project.imageUrl && (
                                <img
                                  src={survey.order.project.imageUrl}
                                  alt=""
                                  className="h-8 w-8 rounded object-cover"
                                />
                              )}
                              <span className="text-sm font-medium truncate max-w-[150px]">
                                {survey.order.project.title}
                              </span>
                            </div>
                          ) : (
                            <span className="text-zinc-400">-</span>
                          )}
                        </td>
                        <td className="p-4">
                          {survey.order ? (
                            <div>
                              <p className="text-sm font-medium">
                                {survey.order.quantity}x {survey.order.reward?.title || "Item"}
                              </p>
                              <p className="text-xs text-zinc-500">
                                ${survey.order.totalAmount.toFixed(2)}
                              </p>
                            </div>
                          ) : (
                            <span className="text-zinc-400">-</span>
                          )}
                        </td>
                        <td className="p-4">
                          <StarRating rating={survey.rating} />
                        </td>
                        <td className="p-4">
                          {survey.wouldRecommend === null ? (
                            <span className="text-zinc-400">-</span>
                          ) : survey.wouldRecommend ? (
                            <Badge className="bg-emerald-100 text-emerald-700">
                              <ThumbsUp className="h-3 w-3 mr-1" /> Yes
                            </Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-700">
                              <ThumbsDown className="h-3 w-3 mr-1" /> No
                            </Badge>
                          )}
                        </td>
                        <td className="p-4">
                          {survey.completedAt ? (
                            <Badge className="bg-emerald-100 text-emerald-700">
                              <CheckCircle className="h-3 w-3 mr-1" /> Completed
                            </Badge>
                          ) : survey.sentAt ? (
                            <Badge className="bg-amber-100 text-amber-700">
                              <Clock className="h-3 w-3 mr-1" /> Pending
                            </Badge>
                          ) : (
                            <Badge variant="outline">Not Sent</Badge>
                          )}
                        </td>
                        <td className="p-4 text-sm text-zinc-500">
                          {survey.completedAt
                            ? new Date(survey.completedAt).toLocaleDateString()
                            : survey.sentAt
                            ? new Date(survey.sentAt).toLocaleDateString()
                            : "-"}
                        </td>
                        <td className="p-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedSurvey(survey);
                              setIsSurveyDetailOpen(true);
                            }}
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Survey Pagination */}
        {surveyPagination.totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-zinc-500">
              Showing {(surveyPagination.page - 1) * surveyPagination.limit + 1} to{" "}
              {Math.min(surveyPagination.page * surveyPagination.limit, surveyPagination.total)} of{" "}
              {surveyPagination.total} surveys
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSurveyPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                disabled={surveyPagination.page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm">
                Page {surveyPagination.page} of {surveyPagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSurveyPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                disabled={surveyPagination.page === surveyPagination.totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Survey Detail Dialog */}
      <Dialog open={isSurveyDetailOpen} onOpenChange={setIsSurveyDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedSurvey && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-100">
                      <Star className="h-6 w-6 text-amber-600" />
                    </div>
                    <div>
                      <DialogTitle>Survey Response</DialogTitle>
                      <DialogDescription>
                        From {selectedSurvey.retailer.businessName}
                      </DialogDescription>
                    </div>
                  </div>
                  {selectedSurvey.completedAt ? (
                    <Badge className="bg-emerald-100 text-emerald-700">Completed</Badge>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-700">Pending</Badge>
                  )}
                </div>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {/* Overall Rating */}
                <div className="text-center p-6 bg-zinc-50 rounded-lg">
                  <p className="text-sm text-zinc-500 mb-2">Overall Rating</p>
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <StarRating rating={selectedSurvey.rating} size="lg" />
                  </div>
                  {selectedSurvey.rating && (
                    <p className="text-2xl font-bold">{selectedSurvey.rating}/5</p>
                  )}
                </div>

                {/* Would Recommend */}
                {selectedSurvey.wouldRecommend !== null && (
                  <div className={`p-4 rounded-lg ${selectedSurvey.wouldRecommend ? "bg-emerald-50" : "bg-red-50"}`}>
                    <div className="flex items-center gap-2">
                      {selectedSurvey.wouldRecommend ? (
                        <>
                          <ThumbsUp className="h-5 w-5 text-emerald-600" />
                          <span className="font-medium text-emerald-800">Would recommend to other retailers</span>
                        </>
                      ) : (
                        <>
                          <ThumbsDown className="h-5 w-5 text-red-600" />
                          <span className="font-medium text-red-800">Would not recommend</span>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Category Ratings */}
                <div>
                  <h3 className="text-sm font-semibold mb-3">Category Ratings</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg">
                      <span className="text-sm">Product Quality</span>
                      <StarRating rating={selectedSurvey.productQuality} />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg">
                      <span className="text-sm">Shipping Speed</span>
                      <StarRating rating={selectedSurvey.shippingSpeed} />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg">
                      <span className="text-sm">Packaging</span>
                      <StarRating rating={selectedSurvey.packaging} />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg">
                      <span className="text-sm">Communication</span>
                      <StarRating rating={selectedSurvey.communication} />
                    </div>
                  </div>
                </div>

                {/* Feedback */}
                {selectedSurvey.feedback && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Feedback</h3>
                    <div className="p-4 bg-zinc-50 rounded-lg">
                      <p className="text-sm text-zinc-700 whitespace-pre-wrap">{selectedSurvey.feedback}</p>
                    </div>
                  </div>
                )}

                {/* Order Details */}
                {selectedSurvey.order && (
                  <div>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Package className="h-4 w-4" /> Order Details
                    </h3>
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          {selectedSurvey.order.project?.imageUrl && (
                            <img
                              src={selectedSurvey.order.project.imageUrl}
                              alt=""
                              className="h-16 w-16 rounded object-cover"
                            />
                          )}
                          <div className="flex-1">
                            <p className="font-medium">{selectedSurvey.order.project?.title || "Unknown Project"}</p>
                            <p className="text-sm text-zinc-500">
                              {selectedSurvey.order.quantity}x {selectedSurvey.order.reward?.title || "Item"}
                            </p>
                            <p className="text-sm font-medium mt-1">
                              ${selectedSurvey.order.totalAmount.toFixed(2)}
                            </p>
                          </div>
                          <Badge variant="outline">{selectedSurvey.order.status}</Badge>
                        </div>
                        {selectedSurvey.order.invoiceNumber && (
                          <p className="text-xs text-zinc-500 mt-2">
                            Invoice: {selectedSurvey.order.invoiceNumber}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Retailer Info */}
                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Store className="h-4 w-4" /> Retailer
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-zinc-500">Business</p>
                      <p className="font-medium">{selectedSurvey.retailer.businessName}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500">Contact</p>
                      <p className="font-medium">{selectedSurvey.retailer.contactName}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-zinc-500">Email</p>
                      <a href={`mailto:${selectedSurvey.retailer.email}`} className="font-medium text-emerald-600 hover:underline">
                        {selectedSurvey.retailer.email}
                      </a>
                    </div>
                  </div>
                </div>

                {/* Timestamps */}
                <div className="text-xs text-zinc-500 border-t pt-4">
                  <div className="flex justify-between">
                    <span>Survey sent: {selectedSurvey.sentAt ? new Date(selectedSurvey.sentAt).toLocaleString() : "Not sent"}</span>
                    <span>Completed: {selectedSurvey.completedAt ? new Date(selectedSurvey.completedAt).toLocaleString() : "Pending"}</span>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsSurveyDetailOpen(false)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Retailer Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedRetailer && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-100">
                      <Store className="h-6 w-6 text-emerald-600" />
                    </div>
                    <div>
                      <DialogTitle>{selectedRetailer.businessName}</DialogTitle>
                      <DialogDescription>
                        Application submitted {new Date(selectedRetailer.createdAt).toLocaleDateString()}
                      </DialogDescription>
                    </div>
                  </div>
                  {getRetailerStatusBadge(selectedRetailer.status)}
                </div>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {/* Access Code (for approved retailers) */}
                {selectedRetailer.status === "APPROVED" && selectedRetailer.accessCode && (
                  <Card className="border-emerald-200 bg-emerald-50">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-emerald-800">Access Code</p>
                          <p className="text-lg font-mono font-bold text-emerald-700">
                            {selectedRetailer.accessCode}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyAccessCode(selectedRetailer.accessCode!)}
                          className="border-emerald-300"
                        >
                          {copiedCode ? (
                            <><Check className="h-4 w-4 mr-1" /> Copied</>
                          ) : (
                            <><Copy className="h-4 w-4 mr-1" /> Copy</>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Verification Notes */}
                {selectedRetailer.verificationNotes && (
                  <Card className="border-blue-200 bg-blue-50">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-2">
                        <FileText className="h-4 w-4 text-blue-600 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-blue-800">Admin Notes</p>
                          <p className="text-sm text-blue-700">{selectedRetailer.verificationNotes}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Business Information */}
                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Building2 className="h-4 w-4" /> Business Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-zinc-500">Business Type</p>
                      <p className="font-medium">{getBusinessTypeBadge(selectedRetailer.businessType)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Years in Business</p>
                      <p className="font-medium">{selectedRetailer.yearsInBusiness || "Not specified"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Number of Locations</p>
                      <p className="font-medium">{selectedRetailer.numberOfLocations || "Not specified"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Annual Revenue</p>
                      <p className="font-medium">{selectedRetailer.annualRevenue || "Not specified"}</p>
                    </div>
                    {selectedRetailer.websiteUrl && (
                      <div className="col-span-2">
                        <p className="text-xs text-zinc-500">Website</p>
                        <a
                          href={selectedRetailer.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-emerald-600 hover:underline flex items-center gap-1"
                        >
                          {selectedRetailer.websiteUrl}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Contact Information */}
                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Mail className="h-4 w-4" /> Contact Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-zinc-500">Contact Name</p>
                      <p className="font-medium">{selectedRetailer.contactName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Email</p>
                      <a
                        href={`mailto:${selectedRetailer.email}`}
                        className="font-medium text-emerald-600 hover:underline flex items-center gap-1"
                      >
                        <Mail className="h-3 w-3" />
                        {selectedRetailer.email}
                      </a>
                    </div>
                    {selectedRetailer.phone && (
                      <div>
                        <p className="text-xs text-zinc-500">Phone</p>
                        <a
                          href={`tel:${selectedRetailer.phone}`}
                          className="font-medium flex items-center gap-1"
                        >
                          <Phone className="h-3 w-3" />
                          {selectedRetailer.phone}
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Address */}
                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <MapPin className="h-4 w-4" /> Address
                  </h3>
                  <div className="bg-zinc-50 rounded-lg p-3">
                    <p className="font-medium">
                      {selectedRetailer.address && <>{selectedRetailer.address}<br /></>}
                      {selectedRetailer.city}, {selectedRetailer.state} {selectedRetailer.zipCode}
                      <br />
                      {selectedRetailer.country}
                    </p>
                  </div>
                </div>

                {/* Tax Information */}
                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Shield className="h-4 w-4" /> Tax & Verification
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-zinc-500">Tax ID Type</p>
                      <p className="font-medium">{selectedRetailer.taxIdType || "Not provided"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Tax ID</p>
                      <p className="font-medium font-mono">
                        {selectedRetailer.taxId ? "••••" + selectedRetailer.taxId.slice(-4) : "Not provided"}
                      </p>
                    </div>
                    {selectedRetailer.resaleCertificate && (
                      <div className="col-span-2">
                        <p className="text-xs text-zinc-500">Resale Certificate</p>
                        <a
                          href={selectedRetailer.resaleCertificate}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-emerald-600 hover:underline flex items-center gap-1"
                        >
                          View Document
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Order Stats (if approved) */}
                {selectedRetailer.status === "APPROVED" && selectedRetailer._count && (
                  <div>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Calendar className="h-4 w-4" /> Activity
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-zinc-500">Total Orders</p>
                        <p className="font-medium">{selectedRetailer._count.pledges}</p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500">Approved On</p>
                        <p className="font-medium">
                          {selectedRetailer.verifiedAt
                            ? new Date(selectedRetailer.verifiedAt).toLocaleDateString()
                            : "N/A"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2">
                {(selectedRetailer.status === "PENDING" || selectedRetailer.status === "UNDER_REVIEW") && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsDetailsOpen(false);
                        handleActionClick(selectedRetailer, "REQUEST_INFO");
                      }}
                    >
                      Request More Info
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        setIsDetailsOpen(false);
                        handleActionClick(selectedRetailer, "REJECT");
                      }}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                    <Button
                      className="bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => {
                        setIsDetailsOpen(false);
                        handleActionClick(selectedRetailer, "APPROVE");
                      }}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve
                    </Button>
                  </>
                )}
                {selectedRetailer.status === "APPROVED" && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsDetailsOpen(false);
                      handleActionClick(selectedRetailer, "SUSPEND");
                    }}
                  >
                    <Ban className="h-4 w-4 mr-2" />
                    Suspend Account
                  </Button>
                )}
                {selectedRetailer.status === "SUSPENDED" && (
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => {
                      setIsDetailsOpen(false);
                      handleActionClick(selectedRetailer, "REACTIVATE");
                    }}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Reactivate Account
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Action Confirmation Dialog */}
      <AlertDialog open={isActionDialogOpen} onOpenChange={setIsActionDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {actionType === "APPROVE" && <CheckCircle className="h-5 w-5 text-emerald-600" />}
              {actionType === "REJECT" && <XCircle className="h-5 w-5 text-red-600" />}
              {actionType === "SUSPEND" && <Ban className="h-5 w-5 text-zinc-600" />}
              {actionType === "REACTIVATE" && <CheckCircle className="h-5 w-5 text-emerald-600" />}
              {actionType === "REQUEST_INFO" && <AlertTriangle className="h-5 w-5 text-blue-600" />}
              {actionType === "APPROVE" && "Approve Retailer Application"}
              {actionType === "REJECT" && "Reject Retailer Application"}
              {actionType === "SUSPEND" && "Suspend Retailer Account"}
              {actionType === "REACTIVATE" && "Reactivate Retailer Account"}
              {actionType === "REQUEST_INFO" && "Request Additional Information"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === "APPROVE" && (
                <>
                  This will approve <strong>{selectedRetailer?.businessName}</strong> as a retailer.
                  They will receive an access code and be able to place wholesale orders.
                </>
              )}
              {actionType === "REJECT" && (
                <>
                  This will reject the application from <strong>{selectedRetailer?.businessName}</strong>.
                  They will be notified of this decision.
                </>
              )}
              {actionType === "SUSPEND" && (
                <>
                  This will suspend <strong>{selectedRetailer?.businessName}</strong>&apos;s retailer account.
                  They will no longer be able to place orders until reactivated.
                </>
              )}
              {actionType === "REACTIVATE" && (
                <>
                  This will reactivate <strong>{selectedRetailer?.businessName}</strong>&apos;s retailer account.
                  They will be able to place orders again.
                </>
              )}
              {actionType === "REQUEST_INFO" && (
                <>
                  This will mark <strong>{selectedRetailer?.businessName}</strong>&apos;s application as under review.
                  Add notes below to specify what information is needed.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-4">
            <Label htmlFor="notes">
              {actionType === "REJECT" ? "Rejection Reason (optional)" : "Notes (optional)"}
            </Label>
            <Textarea
              id="notes"
              placeholder={
                actionType === "REJECT"
                  ? "Provide a reason for rejection..."
                  : actionType === "REQUEST_INFO"
                  ? "Specify what additional information is needed..."
                  : "Add any notes..."
              }
              value={actionNotes}
              onChange={(e) => setActionNotes(e.target.value)}
              className="mt-2"
              rows={3}
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAction}
              disabled={isSubmitting}
              className={
                actionType === "REJECT" || actionType === "SUSPEND"
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-emerald-600 hover:bg-emerald-700"
              }
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {actionType === "APPROVE" && "Approve Application"}
                  {actionType === "REJECT" && "Reject Application"}
                  {actionType === "SUSPEND" && "Suspend Account"}
                  {actionType === "REACTIVATE" && "Reactivate Account"}
                  {actionType === "REQUEST_INFO" && "Request Info"}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
