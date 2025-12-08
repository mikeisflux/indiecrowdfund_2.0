"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  RefreshCw,
  Search,
  CheckCircle,
  Clock,
  Users,
  MapPin,
  Eye,
  Package,
  FileJson,
  FileSpreadsheet,
} from "lucide-react";

interface Reward {
  id: string;
  title: string;
}

interface ShippingAddress {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
}

interface Pledge {
  id: string;
  amount: number;
  user: {
    id: string;
    name: string;
    email: string;
  };
  reward: {
    id: string;
    title: string;
  };
  addons: {
    addon: {
      id: string;
      title: string;
    };
  }[];
}

interface SurveyResponse {
  id: string;
  pledgeId: string;
  isComplete: boolean;
  completedAt: string | null;
  createdAt: string;
  itemResponses: Record<string, {
    variants?: Record<string, string>;
    customAnswers?: Record<string, string | string[]>;
  }> | null;
  backerResponses: Record<string, string | string[]> | null;
  shippingAddress: ShippingAddress | null;
  addressLocked: boolean;
  pledge: Pledge;
}

interface Stats {
  total: number;
  completed: number;
  incomplete: number;
  responseRate: number;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function SurveyResponsesPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, completed: 0, incomplete: 0, responseRate: 0 });
  const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, limit: 50, totalPages: 0 });
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // Filters
  const [filter, setFilter] = useState<"all" | "complete" | "incomplete">("all");
  const [rewardFilter, setRewardFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Detail dialog
  const [selectedResponse, setSelectedResponse] = useState<SurveyResponse | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  const fetchResponses = useCallback(async () => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        filter,
      });
      if (rewardFilter !== "all") {
        queryParams.set("rewardId", rewardFilter);
      }

      const response = await fetch(`/api/projects/${projectId}/survey/responses?${queryParams}`);
      if (response.ok) {
        const data = await response.json();
        setResponses(data.responses || []);
        setStats(data.stats || { total: 0, completed: 0, incomplete: 0, responseRate: 0 });
        setPagination(data.pagination || { total: 0, page: 1, limit: 50, totalPages: 0 });
      }
    } catch (error) {
      console.error("Error fetching responses:", error);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, pagination.page, pagination.limit, filter, rewardFilter]);

  const fetchRewards = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/survey`);
      if (response.ok) {
        const data = await response.json();
        setRewards(data.rewards || []);
      }
    } catch (error) {
      console.error("Error fetching rewards:", error);
    }
  }, [projectId]);

  useEffect(() => {
    fetchRewards();
  }, [fetchRewards]);

  useEffect(() => {
    fetchResponses();
  }, [fetchResponses]);

  const handleExport = async (format: "csv" | "json") => {
    setIsExporting(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/survey/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format }),
      });

      if (response.ok) {
        if (format === "csv") {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `survey-responses-${projectId}.csv`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        } else {
          const data = await response.json();
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `survey-responses-${projectId}.json`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        }
      }
    } catch (error) {
      console.error("Error exporting:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const filteredResponses = responses.filter((r) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      r.pledge?.user?.name?.toLowerCase().includes(query) ||
      r.pledge?.user?.email?.toLowerCase().includes(query) ||
      r.shippingAddress?.name?.toLowerCase().includes(query)
    );
  });

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading && responses.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push(`/dashboard/projects/${projectId}/survey`)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Survey
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Survey Responses</h1>
            <p className="text-zinc-500">View and export backer survey responses</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => handleExport("csv")}
            disabled={isExporting}
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => handleExport("json")}
            disabled={isExporting}
          >
            <FileJson className="mr-2 h-4 w-4" />
            Export JSON
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-zinc-100 rounded-lg">
                <Users className="h-5 w-5 text-zinc-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-zinc-500">Total Responses</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.completed}</p>
                <p className="text-sm text-zinc-500">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.incomplete}</p>
                <p className="text-sm text-zinc-500">Incomplete</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <MapPin className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.responseRate}%</p>
                <p className="text-sm text-zinc-500">Response Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filter} onValueChange={(v: "all" | "complete" | "incomplete") => setFilter(v)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Responses</SelectItem>
                <SelectItem value="complete">Completed</SelectItem>
                <SelectItem value="incomplete">Incomplete</SelectItem>
              </SelectContent>
            </Select>
            {rewards.length > 0 && (
              <Select value={rewardFilter} onValueChange={setRewardFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by reward" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Rewards</SelectItem>
                  {rewards.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button variant="outline" onClick={fetchResponses} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Responses Table */}
      <Card>
        <CardHeader>
          <CardTitle>Responses</CardTitle>
          <CardDescription>
            {filteredResponses.length} of {pagination.total} responses
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredResponses.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-zinc-300 mb-4" />
              <p className="text-zinc-500">No responses found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Backer</TableHead>
                  <TableHead>Reward</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Shipping Address</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredResponses.map((response) => (
                  <TableRow key={response.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{response.pledge?.user?.name || "Unknown"}</p>
                        <p className="text-sm text-zinc-500">{response.pledge?.user?.email || ""}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{response.pledge?.reward?.title || "Unknown"}</p>
                        {response.pledge?.addons?.length > 0 && (
                          <p className="text-sm text-zinc-500">
                            +{response.pledge.addons.length} addon(s)
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {response.isComplete ? (
                        <Badge className="bg-emerald-100 text-emerald-700">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Complete
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-600 border-amber-200">
                          <Clock className="h-3 w-3 mr-1" />
                          Incomplete
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {response.shippingAddress ? (
                        <div className="text-sm">
                          <p>{response.shippingAddress.city}, {response.shippingAddress.state}</p>
                          <p className="text-zinc-500">{response.shippingAddress.country}</p>
                        </div>
                      ) : (
                        <span className="text-zinc-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-zinc-500">
                        {formatDate(response.completedAt)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedResponse(response);
                          setShowDetailDialog(true);
                        }}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-zinc-500">
                Page {pagination.page} of {pagination.totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Response Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Response Details</DialogTitle>
          </DialogHeader>
          {selectedResponse && (
            <div className="space-y-6">
              {/* Backer Info */}
              <div>
                <h3 className="font-semibold text-sm text-zinc-500 uppercase tracking-wide mb-3">
                  Backer Information
                </h3>
                <Card>
                  <CardContent className="py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-zinc-500">Name</p>
                        <p className="font-medium">{selectedResponse.pledge?.user?.name || "-"}</p>
                      </div>
                      <div>
                        <p className="text-sm text-zinc-500">Email</p>
                        <p className="font-medium">{selectedResponse.pledge?.user?.email || "-"}</p>
                      </div>
                      <div>
                        <p className="text-sm text-zinc-500">Reward</p>
                        <p className="font-medium">{selectedResponse.pledge?.reward?.title || "-"}</p>
                      </div>
                      <div>
                        <p className="text-sm text-zinc-500">Status</p>
                        <div>
                          {selectedResponse.isComplete ? (
                            <Badge className="bg-emerald-100 text-emerald-700">Complete</Badge>
                          ) : (
                            <Badge variant="outline" className="text-amber-600">Incomplete</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Shipping Address */}
              {selectedResponse.shippingAddress && (
                <div>
                  <h3 className="font-semibold text-sm text-zinc-500 uppercase tracking-wide mb-3">
                    <MapPin className="h-4 w-4 inline mr-1" />
                    Shipping Address
                    {selectedResponse.addressLocked && (
                      <Badge variant="outline" className="ml-2">Locked</Badge>
                    )}
                  </h3>
                  <Card>
                    <CardContent className="py-4">
                      <p className="font-medium">{selectedResponse.shippingAddress.name}</p>
                      <p>{selectedResponse.shippingAddress.line1}</p>
                      {selectedResponse.shippingAddress.line2 && (
                        <p>{selectedResponse.shippingAddress.line2}</p>
                      )}
                      <p>
                        {selectedResponse.shippingAddress.city}, {selectedResponse.shippingAddress.state} {selectedResponse.shippingAddress.postalCode}
                      </p>
                      <p>{selectedResponse.shippingAddress.country}</p>
                      {selectedResponse.shippingAddress.phone && (
                        <p className="text-zinc-500 mt-2">Phone: {selectedResponse.shippingAddress.phone}</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Item Responses */}
              {selectedResponse.itemResponses && Object.keys(selectedResponse.itemResponses).length > 0 && (
                <div>
                  <h3 className="font-semibold text-sm text-zinc-500 uppercase tracking-wide mb-3">
                    <Package className="h-4 w-4 inline mr-1" />
                    Item Selections
                  </h3>
                  <Card>
                    <CardContent className="py-4 space-y-4">
                      {Object.entries(selectedResponse.itemResponses).map(([itemId, itemResponse]) => (
                        <div key={itemId}>
                          {itemResponse.variants && Object.entries(itemResponse.variants).map(([variantId, value]) => (
                            <div key={variantId} className="flex items-center gap-2">
                              <Badge variant="outline">{value}</Badge>
                            </div>
                          ))}
                          {itemResponse.customAnswers && Object.entries(itemResponse.customAnswers).map(([qId, answer]) => (
                            <div key={qId} className="text-sm">
                              <span className="text-zinc-500">Answer:</span> {Array.isArray(answer) ? answer.join(", ") : answer}
                            </div>
                          ))}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Backer Responses */}
              {selectedResponse.backerResponses && Object.keys(selectedResponse.backerResponses).length > 0 && (
                <div>
                  <h3 className="font-semibold text-sm text-zinc-500 uppercase tracking-wide mb-3">
                    <Users className="h-4 w-4 inline mr-1" />
                    Backer Answers
                  </h3>
                  <Card>
                    <CardContent className="py-4 space-y-3">
                      {Object.entries(selectedResponse.backerResponses).map(([questionId, answer]) => (
                        <div key={questionId}>
                          <p className="text-sm text-zinc-500">Question {questionId}</p>
                          <p className="font-medium">
                            {Array.isArray(answer) ? answer.join(", ") : answer || "-"}
                          </p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Timestamps */}
              <div className="text-sm text-zinc-500 pt-4 border-t">
                <p>Created: {formatDate(selectedResponse.createdAt)}</p>
                {selectedResponse.completedAt && (
                  <p>Completed: {formatDate(selectedResponse.completedAt)}</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
