"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Store, RefreshCw, Download, UserPlus } from "lucide-react";
import { getCSRFHeaders } from "@/lib/csrf";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";

import {
  User,
  UserStats,
  Pagination,
  UserPledge,
  EmailLogEntry,
  Retailer,
  RetailerStats,
  UserStatsCards,
  UserFilters,
  UserTable,
  RetailerStatsCards,
  RetailerTable,
  UserDetailsDialog,
  EmailPreviewDialog,
  RetailerDetailsDialog,
  ApprovalActionDialog,
  EditUserDialog,
  RoleDialog,
  DeleteUserDialog,
  PasswordDialog,
  AddUserDialog,
  NewUserData,
} from "./components";

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

  // User edit/action states
  const [showEditUserDialog, setShowEditUserDialog] = useState(false);
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showAddUserDialog, setShowAddUserDialog] = useState(false);
  const [editUserData, setEditUserData] = useState({ name: "", email: "" });
  const [newUserData, setNewUserData] = useState<NewUserData>({ name: "", email: "", password: "", confirmPassword: "", role: "USER", retailerAccess: false });
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // User details tabs state
  const [userDetailTab, setUserDetailTab] = useState("overview");
  const [userPledges, setUserPledges] = useState<UserPledge[]>([]);
  const [userEmails, setUserEmails] = useState<EmailLogEntry[]>([]);
  const [loadingPledges, setLoadingPledges] = useState(false);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [viewingEmail, setViewingEmail] = useState<EmailLogEntry | null>(null);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [cancellingPledge, setCancellingPledge] = useState<string | null>(null);
  const [refundingPledge, setRefundingPledge] = useState<string | null>(null);
  const [resendingReceipt, setResendingReceipt] = useState<string | null>(null);
  const [zeroingWallet, setZeroingWallet] = useState(false);

  // Pledge action confirmation dialogs
  const [cancelPledgeConfirm, setCancelPledgeConfirm] = useState<{ open: boolean; pledgeId: string }>({
    open: false,
    pledgeId: "",
  });
  const [refundPledgeConfirm, setRefundPledgeConfirm] = useState<{ open: boolean; pledgeId: string }>({
    open: false,
    pledgeId: "",
  });
  const [deletePledgeConfirm, setDeletePledgeConfirm] = useState<{ open: boolean; pledgeId: string }>({
    open: false,
    pledgeId: "",
  });
  const [resendReceiptConfirm, setResendReceiptConfirm] = useState<{ open: boolean; pledgeId: string }>({
    open: false,
    pledgeId: "",
  });

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

  // Fetch user pledges when switching to the pledges tab
  useEffect(() => {
    if (showUserDialog && selectedUser && userDetailTab === "pledges") {
      fetchUserPledges(selectedUser.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showUserDialog, selectedUser?.id, userDetailTab]);

  // Fetch user emails when switching to the emails tab
  useEffect(() => {
    if (showUserDialog && selectedUser && userDetailTab === "emails") {
      fetchUserEmails(selectedUser.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showUserDialog, selectedUser?.id, userDetailTab]);

  // Debounce search
  useEffect(() => {
    const timeout = setTimeout(() => {
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const pendingRetailerCount = retailerStats.pending + retailerStats.underReview;

  // ============ Retailer Handlers ============

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
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
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

  // ============ Pledge/Email Handlers ============

  const fetchUserPledges = async (userId: string) => {
    setLoadingPledges(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}/pledges`);
      if (response.ok) {
        const data = await response.json();
        setUserPledges(data.pledges || []);
      }
    } catch (error) {
      console.error("Failed to fetch user pledges:", error);
    } finally {
      setLoadingPledges(false);
    }
  };

  const fetchUserEmails = async (userId: string) => {
    setLoadingEmails(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}/emails`);
      if (response.ok) {
        const data = await response.json();
        setUserEmails(data.emailLogs || []);
      }
    } catch (error) {
      console.error("Failed to fetch user emails:", error);
    } finally {
      setLoadingEmails(false);
    }
  };

  const handleViewEmail = (email: EmailLogEntry) => {
    setViewingEmail(email);
    setShowEmailPreview(true);
  };

  const handleCancelPledge = async () => {
    if (!selectedUser) return;
    const pledgeId = cancelPledgeConfirm.pledgeId;

    setCancellingPledge(pledgeId);
    try {
      const response = await fetch(`/api/admin/pledges/${pledgeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({ action: "cancel", reason: "Cancelled by admin" }),
      });

      if (response.ok) {
        await fetchUserPledges(selectedUser.id);
        toast.success("Pledge cancelled successfully");
      } else {
        const err = await response.json();
        toast.error(err.error || "Failed to cancel pledge");
      }
    } catch (err) {
      console.error("Failed to cancel pledge:", err);
      toast.error("Failed to cancel pledge");
    } finally {
      setCancellingPledge(null);
    }
  };

  const handleRefundPledge = async () => {
    if (!selectedUser) return;
    const pledgeId = refundPledgeConfirm.pledgeId;

    setRefundingPledge(pledgeId);
    try {
      const response = await fetch(`/api/admin/pledges/${pledgeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({ action: "refund", reason: "Refunded by admin" }),
      });

      if (response.ok) {
        await fetchUserPledges(selectedUser.id);
        toast.success("Pledge refunded successfully");
      } else {
        const err = await response.json();
        toast.error(err.error || "Failed to refund pledge");
      }
    } catch (err) {
      console.error("Failed to refund pledge:", err);
      toast.error("Failed to refund pledge");
    } finally {
      setRefundingPledge(null);
    }
  };

  const handleDeletePledge = async () => {
    if (!selectedUser) return;
    const pledgeId = deletePledgeConfirm.pledgeId;

    setCancellingPledge(pledgeId);
    try {
      const response = await fetch(`/api/admin/pledges/${pledgeId}`, {
        method: "DELETE",
        headers: getCSRFHeaders(),
      });

      if (response.ok) {
        await fetchUserPledges(selectedUser.id);
        toast.success("Pledge deleted successfully");
      } else {
        const err = await response.json();
        toast.error(err.error || "Failed to delete pledge");
      }
    } catch (err) {
      console.error("Failed to delete pledge:", err);
      toast.error("Failed to delete pledge");
    } finally {
      setCancellingPledge(null);
    }
  };

  const handleResendReceipt = async () => {
    if (!selectedUser) return;
    const pledgeId = resendReceiptConfirm.pledgeId;

    setResendingReceipt(pledgeId);
    try {
      const response = await fetch(`/api/admin/pledges/${pledgeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({ action: "resend_receipt" }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message || "Receipt email sent successfully");
        await Promise.all([
          fetchUserPledges(selectedUser.id),
          fetchUserEmails(selectedUser.id),
        ]);
      } else {
        toast.error(data.error || "Failed to send receipt email");
      }
    } catch (err) {
      console.error("Failed to resend receipt:", err);
      toast.error("Failed to send receipt email");
    } finally {
      setResendingReceipt(null);
    }
  };

  const handleDownloadEmail = async (emailId: string) => {
    window.open(`/api/admin/emails/${emailId}?download=true`, "_blank");
  };

  const handleZeroWalletBalance = async (userId: string) => {
    const user = users.find(u => u.id === userId);
    const confirmed = window.confirm(
      `Are you sure you want to zero out the DivinityCoin wallet balance for ${user?.name || user?.email || "this user"}? This action cannot be undone.`
    );
    if (!confirmed) return;

    setZeroingWallet(true);
    try {
      const res = await fetch("/api/admin/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({ userId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to zero wallet balance");

      if (data.previousBalance > 0) {
        toast.success(`Wallet balance zeroed (was $${Number(data.previousBalance).toFixed(2)})`);
      } else {
        toast.info("Wallet balance was already zero");
      }

      // Refresh users list to update the balance in the UI
      fetchUsers();
      // Update the selected user's balance locally for immediate feedback
      if (selectedUser && selectedUser.id === userId) {
        setSelectedUser({ ...selectedUser, divinityCoinBalance: 0 });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to zero wallet balance");
      console.error("Zero wallet balance error:", error);
    } finally {
      setZeroingWallet(false);
    }
  };

  // ============ User Handlers ============

  const handleViewUser = (user: User) => {
    setSelectedUser(user);
    setShowUserDialog(true);
    setUserDetailTab("overview");
    setUserPledges([]);
    setUserEmails([]);
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setEditUserData({ name: user.name || "", email: user.email });
    setShowEditUserDialog(true);
  };

  const handleChangeRole = (user: User) => {
    setSelectedUser(user);
    setSelectedRole(user.role);
    setShowRoleDialog(true);
  };

  const handleToggleRetailerAccess = async (user: User) => {
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          userId: user.id,
          action: "TOGGLE_RETAILER_ACCESS",
          data: { retailerAccess: !user.retailerAccess }
        }),
      });

      if (response.ok) {
        fetchUsers();
        toast.success("Retailer access updated");
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to update retailer access");
      }
    } catch (error) {
      console.error("Error toggling retailer access:", error);
      toast.error("Failed to update retailer access");
    }
  };

  const handleDeleteUser = (user: User) => {
    setSelectedUser(user);
    setShowDeleteDialog(true);
  };

  const handleBanUser = async (user: User) => {
    if (!confirm(`Are you sure you want to ban ${user.name || user.email}? This will:\n\n• Lock their account immediately\n• Block their IP address from creating new accounts\n• Log them out of all sessions\n\nThis action can be reversed.`)) {
      return;
    }

    try {
      const reason = prompt("Enter a reason for banning this user (optional):");

      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          userId: user.id,
          action: "BAN_USER",
          data: { reason: reason || "Banned by administrator" },
        }),
      });

      if (response.ok) {
        fetchUsers();
        toast.success(`${user.name || user.email} has been banned`);
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to ban user");
      }
    } catch (error) {
      console.error("Error banning user:", error);
      toast.error("Failed to ban user");
    }
  };

  const handleUnbanUser = async (user: User) => {
    if (!confirm(`Are you sure you want to unban ${user.name || user.email}?`)) {
      return;
    }

    try {
      const removeIPBlock = confirm("Also remove the IP block so they can create new accounts?");

      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          userId: user.id,
          action: "UNBAN_USER",
          data: { removeIPBlock },
        }),
      });

      if (response.ok) {
        fetchUsers();
        toast.success(`${user.name || user.email} has been unbanned`);
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to unban user");
      }
    } catch (error) {
      console.error("Error unbanning user:", error);
      toast.error("Failed to unban user");
    }
  };

  const submitEditUser = async () => {
    if (!selectedUser) return;
    setIsUpdating(true);

    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          userId: selectedUser.id,
          action: "UPDATE_INFO",
          data: {
            name: editUserData.name,
            email: editUserData.email,
          },
        }),
      });

      if (response.ok) {
        fetchUsers();
        setShowEditUserDialog(false);
        setSelectedUser(null);
        toast.success("User updated successfully");
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to update user");
      }
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error("Failed to update user");
    } finally {
      setIsUpdating(false);
    }
  };

  const submitRoleChange = async () => {
    if (!selectedUser) return;
    setIsUpdating(true);

    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          userId: selectedUser.id,
          action: "UPDATE_ROLE",
          data: { role: selectedRole },
        }),
      });

      if (response.ok) {
        fetchUsers();
        setShowRoleDialog(false);
        setSelectedUser(null);
        toast.success("Role updated successfully");
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to change role");
      }
    } catch (error) {
      console.error("Error changing role:", error);
      toast.error("Failed to change role");
    } finally {
      setIsUpdating(false);
    }
  };

  const submitDeleteUser = async () => {
    if (!selectedUser) return;
    setIsUpdating(true);

    try {
      const response = await fetch(`/api/admin/users?userId=${selectedUser.id}`, {
        method: "DELETE",
        headers: getCSRFHeaders(),
      });

      if (response.ok) {
        fetchUsers();
        setShowDeleteDialog(false);
        setSelectedUser(null);
        toast.success("User deleted successfully");
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to delete user");
      }
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error("Failed to delete user");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSendEmail = (user: User) => {
    window.location.href = `mailto:${user.email}`;
  };

  const handleVerifyEmail = async (user: User) => {
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          userId: user.id,
          action: "VERIFY_EMAIL",
        }),
      });

      if (response.ok) {
        fetchUsers();
        toast.success("Email verified successfully");
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to verify email");
      }
    } catch (error) {
      console.error("Error verifying email:", error);
      toast.error("Failed to verify email");
    }
  };

  const handleSetPassword = (user: User) => {
    setSelectedUser(user);
    setNewPassword("");
    setConfirmPassword("");
    setShowPasswordDialog(true);
  };

  const submitSetPassword = async () => {
    if (!selectedUser) return;
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsUpdating(true);
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          userId: selectedUser.id,
          action: "SET_PASSWORD",
          data: { password: newPassword },
        }),
      });

      if (response.ok) {
        toast.success("Password updated successfully");
        setShowPasswordDialog(false);
        setSelectedUser(null);
        setNewPassword("");
        setConfirmPassword("");
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to set password");
      }
    } catch (error) {
      console.error("Error setting password:", error);
      toast.error("Failed to set password");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSendResetEmail = async (user: User) => {
    // Using toast confirmation pattern - send directly since action is recoverable
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          userId: user.id,
          action: "SEND_RESET_EMAIL",
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message || "Password reset email sent");
      } else {
        toast.error(data.error || "Failed to send reset email");
      }
    } catch (error) {
      console.error("Error sending reset email:", error);
      toast.error("Failed to send reset email");
    }
  };

  const submitCreateUser = async () => {
    if (!newUserData.email) {
      toast.error("Email is required");
      return;
    }
    if (!newUserData.password || newUserData.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (newUserData.password !== newUserData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          email: newUserData.email,
          name: newUserData.name || null,
          password: newUserData.password,
          role: newUserData.role,
          retailerAccess: newUserData.retailerAccess,
        }),
      });

      if (response.ok) {
        fetchUsers();
        setShowAddUserDialog(false);
        setNewUserData({ name: "", email: "", password: "", confirmPassword: "", role: "USER", retailerAccess: false });
        toast.success("User created successfully");
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to create user");
      }
    } catch (error) {
      console.error("Error creating user:", error);
      toast.error("Failed to create user");
    } finally {
      setIsCreating(false);
    }
  };

  const exportUsers = async () => {
    try {
      const response = await fetch("/api/admin/users?limit=10000");
      if (!response.ok) {
        toast.error("Failed to fetch users for export");
        return;
      }

      const data = await response.json();
      const exportedUsers = data.users || [];

      if (exportedUsers.length === 0) {
        toast.error("No users to export");
        return;
      }

      const csv = [
        ["ID", "Name", "Email", "Role", "Email Verified", "Projects", "Pledges", "Created At"].join(","),
        ...exportedUsers.map((user: User) =>
          [
            user.id,
            `"${(user.name || "").replace(/"/g, '""')}"`,
            `"${user.email}"`,
            user.role,
            user.emailVerified ? "Yes" : "No",
            user.projectCount,
            user.pledgeCount,
            new Date(user.createdAt).toISOString(),
          ].join(",")
        ),
      ].join("\n");

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `users-export-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success("Users exported successfully");
    } catch (error) {
      console.error("Error exporting users:", error);
      toast.error("Failed to export users");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white">User Management</h1>
          <p className="text-zinc-500">Manage platform users and retailer applications</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Button variant="outline" onClick={() => { fetchUsers(); if (activeTab === "retailers") fetchRetailers(); }} disabled={isLoading || isLoadingRetailers} className="flex-1 sm:flex-none">
            <RefreshCw className={`h-4 w-4 sm:mr-2 ${isLoading || isLoadingRetailers ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button variant="outline" onClick={exportUsers} className="flex-1 sm:flex-none">
            <Download className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Export</span>
          </Button>
          <Button onClick={() => setShowAddUserDialog(true)} className="flex-1 sm:flex-none">
            <UserPlus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Add User</span>
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
          <UserStatsCards stats={userStats} />
          <UserFilters
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            roleFilter={roleFilter}
            onRoleFilterChange={setRoleFilter}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
          />
          <UserTable
            users={users}
            isLoading={isLoading}
            pagination={pagination}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            onViewUser={handleViewUser}
            onEditUser={handleEditUser}
            onSendEmail={handleSendEmail}
            onVerifyEmail={handleVerifyEmail}
            onChangeRole={handleChangeRole}
            onToggleRetailerAccess={handleToggleRetailerAccess}
            onSendResetEmail={handleSendResetEmail}
            onSetPassword={handleSetPassword}
            onDeleteUser={handleDeleteUser}
            onBanUser={handleBanUser}
            onUnbanUser={handleUnbanUser}
          />
        </TabsContent>

        {/* Retailers Tab */}
        <TabsContent value="retailers" className="space-y-6 mt-6">
          <RetailerStatsCards stats={retailerStats} />
          <RetailerTable
            retailers={retailers}
            stats={retailerStats}
            isLoading={isLoadingRetailers}
            statusFilter={retailerStatusFilter}
            onStatusFilterChange={setRetailerStatusFilter}
            onViewRetailer={(retailer) => {
              setSelectedRetailer(retailer);
              setShowRetailerDialog(true);
            }}
            onApproveRetailer={(retailer) => handleRetailerAction(retailer, "approve")}
            onRejectRetailer={(retailer) => handleRetailerAction(retailer, "reject")}
          />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <UserDetailsDialog
        open={showUserDialog}
        onOpenChange={setShowUserDialog}
        user={selectedUser}
        activeTab={userDetailTab}
        onTabChange={setUserDetailTab}
        pledges={userPledges}
        emails={userEmails}
        loadingPledges={loadingPledges}
        loadingEmails={loadingEmails}
        cancellingPledge={cancellingPledge}
        refundingPledge={refundingPledge}
        resendingReceipt={resendingReceipt}
        onCancelPledge={(pledgeId) => setCancelPledgeConfirm({ open: true, pledgeId })}
        onRefundPledge={(pledgeId) => setRefundPledgeConfirm({ open: true, pledgeId })}
        onDeletePledge={(pledgeId) => setDeletePledgeConfirm({ open: true, pledgeId })}
        onResendReceipt={(pledgeId) => setResendReceiptConfirm({ open: true, pledgeId })}
        onViewEmail={handleViewEmail}
        onDownloadEmail={handleDownloadEmail}
        onEditUser={handleEditUser}
        onZeroWalletBalance={handleZeroWalletBalance}
        zeroingWallet={zeroingWallet}
      />

      <EmailPreviewDialog
        open={showEmailPreview}
        onOpenChange={setShowEmailPreview}
        email={viewingEmail}
        onDownloadEmail={handleDownloadEmail}
      />

      <RetailerDetailsDialog
        open={showRetailerDialog}
        onOpenChange={setShowRetailerDialog}
        retailer={selectedRetailer}
        onApprove={(retailer) => handleRetailerAction(retailer, "approve")}
        onRequestInfo={(retailer) => handleRetailerAction(retailer, "request_info")}
        onReject={(retailer) => handleRetailerAction(retailer, "reject")}
      />

      <ApprovalActionDialog
        open={showApprovalDialog}
        onOpenChange={setShowApprovalDialog}
        retailer={selectedRetailer}
        action={approvalAction}
        notes={approvalNotes}
        onNotesChange={setApprovalNotes}
        onSubmit={submitApprovalAction}
      />

      <EditUserDialog
        open={showEditUserDialog}
        onOpenChange={setShowEditUserDialog}
        user={selectedUser}
        editData={editUserData}
        onEditDataChange={setEditUserData}
        onSubmit={submitEditUser}
        isUpdating={isUpdating}
      />

      <RoleDialog
        open={showRoleDialog}
        onOpenChange={setShowRoleDialog}
        user={selectedUser}
        selectedRole={selectedRole}
        onRoleChange={setSelectedRole}
        onSubmit={submitRoleChange}
        isUpdating={isUpdating}
      />

      <DeleteUserDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        user={selectedUser}
        onSubmit={submitDeleteUser}
        isUpdating={isUpdating}
      />

      <PasswordDialog
        open={showPasswordDialog}
        onOpenChange={setShowPasswordDialog}
        user={selectedUser}
        newPassword={newPassword}
        confirmPassword={confirmPassword}
        onNewPasswordChange={setNewPassword}
        onConfirmPasswordChange={setConfirmPassword}
        onSubmit={submitSetPassword}
        onClose={() => {
          setShowPasswordDialog(false);
          setNewPassword("");
          setConfirmPassword("");
        }}
        isUpdating={isUpdating}
      />

      <AddUserDialog
        open={showAddUserDialog}
        onOpenChange={setShowAddUserDialog}
        userData={newUserData}
        onUserDataChange={setNewUserData}
        onSubmit={submitCreateUser}
        onClose={() => {
          setShowAddUserDialog(false);
          setNewUserData({ name: "", email: "", password: "", confirmPassword: "", role: "USER", retailerAccess: false });
        }}
        isCreating={isCreating}
      />

      {/* Pledge Action Confirmation Dialogs */}
      <ConfirmDialog
        open={cancelPledgeConfirm.open}
        onOpenChange={(open) => setCancelPledgeConfirm({ ...cancelPledgeConfirm, open })}
        title="Cancel Pledge?"
        description="Are you sure you want to cancel this pledge? This will remove the backer and amount from the campaign."
        confirmText="Cancel Pledge"
        variant="destructive"
        onConfirm={handleCancelPledge}
        loading={cancellingPledge === cancelPledgeConfirm.pledgeId}
      />

      <ConfirmDialog
        open={refundPledgeConfirm.open}
        onOpenChange={(open) => setRefundPledgeConfirm({ ...refundPledgeConfirm, open })}
        title="Refund Pledge?"
        description="Are you sure you want to refund this pledge? This will process a refund via Stripe and remove the backer from the campaign."
        confirmText="Refund"
        variant="destructive"
        onConfirm={handleRefundPledge}
        loading={refundingPledge === refundPledgeConfirm.pledgeId}
      />

      <ConfirmDialog
        open={deletePledgeConfirm.open}
        onOpenChange={(open) => setDeletePledgeConfirm({ ...deletePledgeConfirm, open })}
        title="Delete Pledge?"
        description="Are you sure you want to DELETE this pledge? This will permanently remove it from the database. This action cannot be undone."
        confirmText="Delete Permanently"
        variant="destructive"
        onConfirm={handleDeletePledge}
        loading={cancellingPledge === deletePledgeConfirm.pledgeId}
      />

      <ConfirmDialog
        open={resendReceiptConfirm.open}
        onOpenChange={(open) => setResendReceiptConfirm({ ...resendReceiptConfirm, open })}
        title="Resend Receipt?"
        description="Resend the pledge receipt email to this backer?"
        confirmText="Send Receipt"
        onConfirm={handleResendReceipt}
        loading={resendingReceipt === resendReceiptConfirm.pledgeId}
      />
    </div>
  );
}
