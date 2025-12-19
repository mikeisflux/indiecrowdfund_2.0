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
