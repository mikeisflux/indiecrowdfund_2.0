"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Star,
  Send,
} from "lucide-react";
import { toast } from "sonner";

// Types
import type {
  Retailer,
  RetailerStats,
  Pagination,
  SatisfactionSurvey,
  SurveyStats,
} from "./types";

// Components
import {
  StarRating,
  getRetailerStatusBadge,
  getBusinessTypeBadge,
  SurveyDetailDialog,
  RetailerDetailDialog,
  ActionConfirmDialog,
} from "./components";

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

  const handleResendApprovalEmail = async (retailer: Retailer) => {
    try {
      const response = await apiFetch("/api/admin/retailers/resend-approval", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ retailerId: retailer.id }),
      });

      if (response.ok) {
        toast.success(`Approval email sent to ${retailer.email}`);
      } else {
        const data = await response.json().catch(() => ({}));
        toast.error(data.error || "Failed to send approval email");
      }
    } catch (error) {
      console.error("Error sending approval email:", error);
      toast.error("An error occurred while sending the approval email");
    }
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
      const response = await apiFetch("/api/admin/retailers", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          
        },
        body: JSON.stringify({
          retailerId: selectedRetailer.id,
          action: actionType,
          notes: actionNotes,
        }),
      });

      if (response.ok) {
        const actionLabels: Record<string, string> = {
          APPROVE: "approved",
          REJECT: "rejected",
          SUSPEND: "suspended",
          REACTIVATE: "reactivated",
          REQUEST_INFO: "marked for review",
        };
        toast.success(`Retailer ${actionLabels[actionType] || "updated"} successfully`);
        await fetchRetailers();
        setIsActionDialogOpen(false);
        setIsDetailsOpen(false);
      } else {
        const data = await response.json().catch(() => ({}));
        toast.error(data.error || "Failed to update retailer");
      }
    } catch (error) {
      console.error("Error updating retailer:", error);
      toast.error("An error occurred while updating the retailer");
    } finally {
      setIsSubmitting(false);
    }
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Retailer Management</h1>
          <p className="text-muted-foreground">
            Review and manage retailer applications
          </p>
        </div>
        <Button onClick={fetchRetailers} variant="outline" size="sm" className="w-full sm:w-auto">
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold">{totalRetailers}</p>
            <p className="text-xs text-muted-foreground">Total Applications</p>
          </CardContent>
        </Card>
        <Card className={stats.pending > 0 ? "border-amber-200 bg-amber-50" : ""}>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
            <p className="text-xs text-muted-foreground">Pending Review</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-blue-600">{stats.underReview}</p>
            <p className="text-xs text-muted-foreground">Under Review</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-emerald-600">{stats.approved}</p>
            <p className="text-xs text-muted-foreground">Approved</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
            <p className="text-xs text-muted-foreground">Rejected</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-muted-foreground">{stats.suspended}</p>
            <p className="text-xs text-muted-foreground">Suspended</p>
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by business name, contact, or email..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
          <SelectTrigger className="w-full sm:w-[180px]">
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
                <tr className="border-b bg-muted/50 dark:bg-zinc-800">
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
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                      Loading retailers...
                    </td>
                  </tr>
                ) : filteredRetailers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      <Store className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      No retailer applications found
                    </td>
                  </tr>
                ) : (
                  filteredRetailers.map((retailer) => (
                    <tr key={retailer.id} className="border-b hover:bg-muted/50 dark:hover:bg-zinc-800">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                            <Store className="h-5 w-5 text-emerald-600" />
                          </div>
                          <div>
                            <p className="font-medium">{retailer.businessName}</p>
                            <p className="text-sm text-muted-foreground">
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
                          <p className="text-sm text-muted-foreground">{retailer.email}</p>
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
                      <td className="p-4 text-sm text-muted-foreground">
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
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                onClick={() => handleResendApprovalEmail(retailer)}
                                title="Send Approval Email"
                              >
                                <Send className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-muted-foreground hover:text-foreground"
                                onClick={() => handleActionClick(retailer, "SUSPEND")}
                                title="Suspend"
                              >
                                <Ban className="h-4 w-4" />
                              </Button>
                            </>
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
          <p className="text-sm text-muted-foreground">
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
            <p className="text-muted-foreground text-sm">
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
              <p className="text-xs text-muted-foreground">Total Surveys</p>
            </CardContent>
          </Card>
          <Card className="border-emerald-200 bg-emerald-50">
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-emerald-600">{surveyStats.completed}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-2xl font-bold text-amber-600">{surveyStats.pending}</p>
              <p className="text-xs text-muted-foreground">Awaiting Response</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold">{Number(surveyStats.avgRating).toFixed(1)}</p>
                <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
              </div>
              <p className="text-xs text-muted-foreground">Average Rating</p>
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
                  <tr className="border-b bg-muted/50 dark:bg-zinc-800">
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
                      <td colSpan={8} className="p-8 text-center text-muted-foreground">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                        Loading surveys...
                      </td>
                    </tr>
                  ) : surveys.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-muted-foreground">
                        <MessageSquare className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                        No satisfaction surveys found
                      </td>
                    </tr>
                  ) : (
                    surveys.map((survey) => (
                      <tr key={survey.id} className="border-b hover:bg-muted/50 dark:hover:bg-zinc-800">
                        <td className="p-4">
                          <div>
                            <p className="font-medium">{survey.retailer.businessName}</p>
                            <p className="text-sm text-muted-foreground">{survey.retailer.contactName}</p>
                          </div>
                        </td>
                        <td className="p-4">
                          {survey.order?.project ? (
                            <div className="flex items-center gap-2">
                              {survey.order.project.imageUrl && (
                                <Image
                                  src={survey.order.project.imageUrl}
                                  alt=""
                                  width={32}
                                  height={32}
                                  className="h-8 w-8 rounded object-cover"
                                />
                              )}
                              <span className="text-sm font-medium truncate max-w-[150px]">
                                {survey.order.project.title}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="p-4">
                          {survey.order ? (
                            <div>
                              <p className="text-sm font-medium">
                                {survey.order.quantity}x {survey.order.reward?.title || "Item"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                ${Number(survey.order.totalAmount).toFixed(2)}
                              </p>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="p-4">
                          <StarRating rating={survey.rating} />
                        </td>
                        <td className="p-4">
                          {survey.wouldRecommend === null ? (
                            <span className="text-muted-foreground">-</span>
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
                        <td className="p-4 text-sm text-muted-foreground">
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
            <p className="text-sm text-muted-foreground">
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
      <SurveyDetailDialog
        survey={selectedSurvey}
        open={isSurveyDetailOpen}
        onOpenChange={setIsSurveyDetailOpen}
      />

      {/* Retailer Details Dialog */}
      <RetailerDetailDialog
        retailer={selectedRetailer}
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
        onAction={handleActionClick}
        onResendApprovalEmail={handleResendApprovalEmail}
      />

      {/* Action Confirmation Dialog */}
      <ActionConfirmDialog
        retailer={selectedRetailer}
        actionType={actionType}
        actionNotes={actionNotes}
        onActionNotesChange={setActionNotes}
        open={isActionDialogOpen}
        onOpenChange={setIsActionDialogOpen}
        onConfirm={handleConfirmAction}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
