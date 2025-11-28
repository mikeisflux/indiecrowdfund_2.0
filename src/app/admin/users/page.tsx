"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Users,
  Search,
  MoreHorizontal,
  Mail,
  Shield,
  Ban,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Edit,
  Trash2,
  Download,
  UserPlus,
  Crown,
  Star,
  ArrowUpRight,
  Store,
  Building,
  MapPin,
  Bell,
  RefreshCw,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// User interface
interface User {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: string;
  createdAt: string;
  emailVerified: string | null;
  projectCount: number;
  pledgeCount: number;
}

interface UserStats {
  total: number;
  users: number;
  admins: number;
  superAdmins: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

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
  yearsInBusiness: number | null;
  numberOfLocations: number | null;
  annualRevenue: string | null;
  websiteUrl: string | null;
  status: string;
  createdAt: string;
  ordersCount?: number;
  verifiedAt?: string | null;
  verificationNotes?: string | null;
}

interface RetailerStats {
  pending: number;
  underReview: number;
  approved: number;
  rejected: number;
  total: number;
}

export default function UsersPage() {
  const [activeTab, setActiveTab] = useState("users");
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [retailerStatusFilter, setRetailerStatusFilter] = useState("all");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedRetailer, setSelectedRetailer] = useState<Retailer | null>(null);
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [showRetailerDialog, setShowRetailerDialog] = useState(false);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [approvalAction, setApprovalAction] = useState<"approve" | "reject" | "request_info" | null>(null);
  const [approvalNotes, setApprovalNotes] = useState("");

  // API data state
  const [users, setUsers] = useState<User[]>([]);
  const [userStats, setUserStats] = useState<UserStats>({ total: 0, users: 0, admins: 0, superAdmins: 0 });
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  // Retailer state
  const [retailers, setRetailers] = useState<Retailer[]>([]);
  const [retailerStats, setRetailerStats] = useState<RetailerStats>({ pending: 0, underReview: 0, approved: 0, rejected: 0, total: 0 });
  const [isLoadingRetailers, setIsLoadingRetailers] = useState(false);

  // Fetch users from API
  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: "20",
      });

      if (searchQuery) {
        params.append("search", searchQuery);
      }
      if (roleFilter !== "all") {
        params.append("role", roleFilter);
      }

      const response = await fetch(`/api/admin/users?${params}`);
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
        setUserStats(data.stats || { total: 0, users: 0, admins: 0, superAdmins: 0 });
        setPagination(data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 });
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, searchQuery, roleFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Fetch retailers from API
  const fetchRetailers = useCallback(async () => {
    setIsLoadingRetailers(true);
    try {
      const params = new URLSearchParams({
        status: retailerStatusFilter === "all" ? "all" : retailerStatusFilter.toUpperCase(),
      });

      const response = await fetch(`/api/admin/retailers?${params}`);
      if (response.ok) {
        const data = await response.json();
        setRetailers(data.retailers || []);
        setRetailerStats(data.stats || { pending: 0, underReview: 0, approved: 0, rejected: 0, total: 0 });
      }
    } catch (error) {
      console.error("Error fetching retailers:", error);
    } finally {
      setIsLoadingRetailers(false);
    }
  }, [retailerStatusFilter]);

  useEffect(() => {
    if (activeTab === "retailers") {
      fetchRetailers();
    }
  }, [activeTab, fetchRetailers]);

  // Debounce search
  useEffect(() => {
    const timeout = setTimeout(() => {
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const pendingRetailerCount = retailerStats.pending + retailerStats.underReview;

  const getBusinessTypeBadge = (type: string) => {
    const types: Record<string, { label: string; color: string }> = {
      COMIC_SHOP: { label: "Comic Shop", color: "bg-blue-100 text-blue-700" },
      BOOKSTORE: { label: "Bookstore", color: "bg-amber-100 text-amber-700" },
      GAME_STORE: { label: "Game Store", color: "bg-purple-100 text-purple-700" },
      HOBBY_SHOP: { label: "Hobby Shop", color: "bg-pink-100 text-pink-700" },
      ONLINE_RETAILER: { label: "Online", color: "bg-cyan-100 text-cyan-700" },
      DISTRIBUTOR: { label: "Distributor", color: "bg-indigo-100 text-indigo-700" },
      OTHER: { label: "Other", color: "bg-zinc-100 text-zinc-700" },
    };
    const config = types[type] || types.OTHER;
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const getRetailerStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return <Badge className="bg-amber-100 text-amber-700"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
      case "UNDER_REVIEW":
        return <Badge className="bg-blue-100 text-blue-700"><Eye className="h-3 w-3 mr-1" /> Under Review</Badge>;
      case "APPROVED":
        return <Badge className="bg-emerald-100 text-emerald-700"><CheckCircle className="h-3 w-3 mr-1" /> Approved</Badge>;
      case "REJECTED":
        return <Badge className="bg-red-100 text-red-700"><XCircle className="h-3 w-3 mr-1" /> Rejected</Badge>;
      case "SUSPENDED":
        return <Badge className="bg-zinc-100 text-zinc-700"><Ban className="h-3 w-3 mr-1" /> Suspended</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleRetailerAction = (retailer: Retailer, action: "approve" | "reject" | "request_info") => {
    setSelectedRetailer(retailer);
    setApprovalAction(action);
    setApprovalNotes("");
    setShowApprovalDialog(true);
  };

  const submitApprovalAction = async () => {
    if (!selectedRetailer || !approvalAction) return;

    try {
      const statusMap = {
        approve: "APPROVED",
        reject: "REJECTED",
        request_info: "UNDER_REVIEW",
      };

      const response = await fetch("/api/admin/retailers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedRetailer.id,
          status: statusMap[approvalAction],
          verificationNotes: approvalNotes || undefined,
        }),
      });

      if (response.ok) {
        fetchRetailers();
      }
    } catch (error) {
      console.error("Error updating retailer:", error);
    }

    setShowApprovalDialog(false);
    setSelectedRetailer(null);
    setApprovalAction(null);
    setApprovalNotes("");
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return <Badge className="bg-violet-100 text-violet-700"><Crown className="h-3 w-3 mr-1" /> Admin</Badge>;
      case "creator":
        return <Badge className="bg-blue-100 text-blue-700"><Star className="h-3 w-3 mr-1" /> Creator</Badge>;
      default:
        return <Badge variant="outline">Backer</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">User Management</h1>
          <p className="text-zinc-500">Manage platform users and retailer applications</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button>
            <UserPlus className="mr-2 h-4 w-4" />
            Add User
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="retailers" className="flex items-center gap-2 relative">
            <Store className="h-4 w-4" />
            Retailer Applications
            {pendingRetailerCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 text-white text-xs items-center justify-center font-bold">
                  {pendingRetailerCount}
                </span>
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-6 mt-6">
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold">{userStats.total.toLocaleString()}</p>
            <p className="text-xs text-zinc-500">Total Users</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-emerald-600">{userStats.users.toLocaleString()}</p>
            <p className="text-xs text-zinc-500">Regular Users</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-violet-600">{userStats.admins.toLocaleString()}</p>
            <p className="text-xs text-zinc-500">Admins</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-amber-600">{userStats.superAdmins}</p>
            <p className="text-xs text-zinc-500">Super Admins</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            placeholder="Search users by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="creator">Creator</SelectItem>
            <SelectItem value="backer">Backer</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="h-8 w-8 animate-spin text-zinc-400" />
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64">
              <Users className="h-12 w-12 text-zinc-300 mb-4" />
              <p className="text-zinc-500">No users found</p>
            </div>
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-zinc-50 dark:bg-zinc-800">
                  <th className="p-4 text-left text-sm font-medium">User</th>
                  <th className="p-4 text-left text-sm font-medium">Role</th>
                  <th className="p-4 text-left text-sm font-medium">Projects</th>
                  <th className="p-4 text-left text-sm font-medium">Pledges</th>
                  <th className="p-4 text-left text-sm font-medium">Joined</th>
                  <th className="p-4 text-left text-sm font-medium w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b hover:bg-zinc-50 dark:hover:bg-zinc-800">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-200 font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                          {user.name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{user.name || "No name"}</p>
                            {user.emailVerified && (
                              <CheckCircle className="h-4 w-4 text-blue-500" />
                            )}
                          </div>
                          <p className="text-sm text-zinc-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">{getRoleBadge(user.role)}</td>
                    <td className="p-4">{user.projectCount}</td>
                    <td className="p-4">{user.pledgeCount}</td>
                    <td className="p-4 text-sm text-zinc-500">
                      {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
                    </td>
                    <td className="p-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                            setSelectedUser(user);
                            setShowUserDialog(true);
                          }}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit User
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Mail className="mr-2 h-4 w-4" />
                            Send Email
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem>
                            <Shield className="mr-2 h-4 w-4" />
                            Change Role
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete User
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          Showing {((pagination.page - 1) * pagination.limit) + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total.toLocaleString()} users
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => p - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-zinc-500">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= pagination.totalPages}
            onClick={() => setCurrentPage(p => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>
        </TabsContent>

        {/* Retailers Tab */}
        <TabsContent value="retailers" className="space-y-6 mt-6">
          {/* Pending Alert */}
          {pendingRetailerCount > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                <Bell className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-amber-800">New Retailer Applications</h3>
                <p className="text-sm text-amber-700">
                  You have {pendingRetailerCount} retailer application{pendingRetailerCount !== 1 ? "s" : ""} awaiting review.
                </p>
              </div>
            </div>
          )}

          {/* Retailer Stats */}
          <div className="grid gap-4 md:grid-cols-5">
            <Card>
              <CardContent className="p-4">
                <p className="text-2xl font-bold">{retailerStats.total}</p>
                <p className="text-xs text-zinc-500">Total Retailers</p>
              </CardContent>
            </Card>
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="p-4">
                <p className="text-2xl font-bold text-amber-600">{retailerStats.pending}</p>
                <p className="text-xs text-zinc-500">Pending</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-2xl font-bold text-blue-600">{retailerStats.underReview}</p>
                <p className="text-xs text-zinc-500">Under Review</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-2xl font-bold text-emerald-600">{retailerStats.approved}</p>
                <p className="text-xs text-zinc-500">Approved</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-2xl font-bold text-red-600">{retailerStats.rejected}</p>
                <p className="text-xs text-zinc-500">Rejected</p>
              </CardContent>
            </Card>
          </div>

          {/* Retailer Filters */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <Input
                placeholder="Search retailers by name or email..."
                className="pl-9"
              />
            </div>
            <Select value={retailerStatusFilter} onValueChange={setRetailerStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="UNDER_REVIEW">Under Review</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
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
                      <th className="p-4 text-left text-sm font-medium w-32">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingRetailers ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-zinc-500">
                          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                          Loading retailers...
                        </td>
                      </tr>
                    ) : retailers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-zinc-500">
                          <Store className="h-8 w-8 mx-auto mb-2 text-zinc-300" />
                          No retailer applications found
                        </td>
                      </tr>
                    ) : (
                      retailers.map((retailer) => (
                      <tr key={retailer.id} className="border-b hover:bg-zinc-50 dark:hover:bg-zinc-800">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                              <Store className="h-5 w-5 text-emerald-600" />
                            </div>
                            <div>
                              <p className="font-medium">{retailer.businessName}</p>
                              <p className="text-sm text-zinc-500">{retailer.yearsInBusiness ? `${retailer.yearsInBusiness} years in business` : "New business"}</p>
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
                          <p className="text-sm">{retailer.city}, {retailer.state}</p>
                        </td>
                        <td className="p-4">{getRetailerStatusBadge(retailer.status)}</td>
                        <td className="p-4 text-sm text-zinc-500">
                          {new Date(retailer.createdAt).toLocaleDateString()}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedRetailer(retailer);
                                setShowRetailerDialog(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {(retailer.status === "PENDING" || retailer.status === "UNDER_REVIEW") && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-emerald-600"
                                  onClick={() => handleRetailerAction(retailer, "approve")}
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-600"
                                  onClick={() => handleRetailerAction(retailer, "reject")}
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </>
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
        </TabsContent>
      </Tabs>

      {/* User Details Dialog */}
      <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="py-4">
              <div className="flex items-start gap-6">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-zinc-200 text-2xl font-bold text-zinc-600">
                  {selectedUser.name?.charAt(0) || selectedUser.email.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-semibold">{selectedUser.name || "No name"}</h3>
                    {getRoleBadge(selectedUser.role)}
                    {selectedUser.emailVerified && (
                      <Badge className="bg-emerald-100 text-emerald-700">
                        <CheckCircle className="h-3 w-3 mr-1" /> Verified
                      </Badge>
                    )}
                  </div>
                  <p className="text-zinc-500">{selectedUser.email}</p>
                  <p className="mt-1 text-sm text-zinc-500">
                    Member since {formatDistanceToNow(new Date(selectedUser.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <Card>
                  <CardContent className="p-4 text-center">
                    <Star className="h-6 w-6 mx-auto text-blue-500 mb-2" />
                    <p className="text-2xl font-bold">{selectedUser.pledgeCount}</p>
                    <p className="text-xs text-zinc-500">Pledges Made</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <Crown className="h-6 w-6 mx-auto text-violet-500 mb-2" />
                    <p className="text-2xl font-bold">{selectedUser.projectCount}</p>
                    <p className="text-xs text-zinc-500">Projects Created</p>
                  </CardContent>
                </Card>
              </div>

              <div className="mt-6 flex gap-3">
                <Button variant="outline" className="flex-1">
                  <Mail className="mr-2 h-4 w-4" />
                  Send Email
                </Button>
                <Button variant="outline" className="flex-1">
                  <Eye className="mr-2 h-4 w-4" />
                  View Activity
                </Button>
                <Button variant="outline" className="flex-1">
                  <ArrowUpRight className="mr-2 h-4 w-4" />
                  View Profile
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUserDialog(false)}>
              Close
            </Button>
            <Button>Edit User</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Retailer Details Dialog */}
      <Dialog open={showRetailerDialog} onOpenChange={setShowRetailerDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Retailer Application Details</DialogTitle>
            <DialogDescription>Review the retailer application information</DialogDescription>
          </DialogHeader>
          {selectedRetailer && (
            <div className="py-4 space-y-6">
              <div className="flex items-start gap-6">
                <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-emerald-100">
                  <Store className="h-8 w-8 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-semibold">{selectedRetailer.businessName}</h3>
                    {getBusinessTypeBadge(selectedRetailer.businessType)}
                    {getRetailerStatusBadge(selectedRetailer.status)}
                  </div>
                  <p className="text-zinc-500 mt-1">
                    Applied on {new Date(selectedRetailer.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Building className="h-4 w-4" />
                      Business Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Years in Business</span>
                      <span className="font-medium">{selectedRetailer.yearsInBusiness}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Locations</span>
                      <span className="font-medium">{selectedRetailer.numberOfLocations}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Annual Revenue</span>
                      <span className="font-medium">{selectedRetailer.annualRevenue}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Tax ID Type</span>
                      <span className="font-medium">{selectedRetailer.taxIdType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Tax ID</span>
                      <span className="font-medium">{selectedRetailer.taxId}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Contact Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Contact Name</span>
                      <span className="font-medium">{selectedRetailer.contactName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Email</span>
                      <span className="font-medium">{selectedRetailer.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Phone</span>
                      <span className="font-medium">{selectedRetailer.phone}</span>
                    </div>
                    {selectedRetailer.websiteUrl && (
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Website</span>
                        <a href={selectedRetailer.websiteUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline">
                          {selectedRetailer.websiteUrl}
                        </a>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="md:col-span-2">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Address
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">
                      {selectedRetailer.address}<br />
                      {selectedRetailer.city}, {selectedRetailer.state} {selectedRetailer.zipCode}<br />
                      {selectedRetailer.country}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {(selectedRetailer.status === "PENDING" || selectedRetailer.status === "UNDER_REVIEW") && (
                <div className="flex gap-3 pt-4 border-t">
                  <Button
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => {
                      setShowRetailerDialog(false);
                      handleRetailerAction(selectedRetailer, "approve");
                    }}
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setShowRetailerDialog(false);
                      handleRetailerAction(selectedRetailer, "request_info");
                    }}
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    Request Info
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
                    onClick={() => {
                      setShowRetailerDialog(false);
                      handleRetailerAction(selectedRetailer, "reject");
                    }}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRetailerDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approval Action Dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {approvalAction === "approve" && "Approve Retailer"}
              {approvalAction === "reject" && "Reject Retailer"}
              {approvalAction === "request_info" && "Request Additional Information"}
            </DialogTitle>
            <DialogDescription>
              {approvalAction === "approve" && "Approve this retailer application and grant wholesale access."}
              {approvalAction === "reject" && "Reject this retailer application. Please provide a reason."}
              {approvalAction === "request_info" && "Request additional information from the applicant."}
            </DialogDescription>
          </DialogHeader>
          {selectedRetailer && (
            <div className="py-4">
              <div className="flex items-center gap-3 mb-4 p-3 bg-zinc-50 rounded-lg">
                <Store className="h-5 w-5 text-emerald-600" />
                <div>
                  <p className="font-medium">{selectedRetailer.businessName}</p>
                  <p className="text-sm text-zinc-500">{selectedRetailer.contactName}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="notes">
                    {approvalAction === "approve" && "Notes (Optional)"}
                    {approvalAction === "reject" && "Rejection Reason (Required)"}
                    {approvalAction === "request_info" && "Information Requested (Required)"}
                  </Label>
                  <Textarea
                    id="notes"
                    value={approvalNotes}
                    onChange={(e) => setApprovalNotes(e.target.value)}
                    placeholder={
                      approvalAction === "approve"
                        ? "Add any internal notes..."
                        : approvalAction === "reject"
                        ? "Please explain why this application is being rejected..."
                        : "What additional information do you need?"
                    }
                    rows={4}
                  />
                </div>

                {approvalAction === "approve" && (
                  <div className="p-3 bg-emerald-50 rounded-lg text-sm text-emerald-800">
                    <CheckCircle className="h-4 w-4 inline mr-2" />
                    An access code will be generated and sent to the retailer&apos;s email.
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApprovalDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={submitApprovalAction}
              className={
                approvalAction === "approve"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : approvalAction === "reject"
                  ? "bg-red-600 hover:bg-red-700"
                  : ""
              }
              disabled={
                (approvalAction === "reject" || approvalAction === "request_info") &&
                !approvalNotes.trim()
              }
            >
              {approvalAction === "approve" && "Approve Retailer"}
              {approvalAction === "reject" && "Reject Application"}
              {approvalAction === "request_info" && "Send Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
