"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useState, useEffect } from "react";
import { useUserDialog, useBanDialog, useEditUserDialog, useRoleDialog, usePasswordDialog } from "./hooks/dialogs";
import { useUserData } from "./hooks/useUserData";
import { useRetailerActions } from "./hooks/useRetailerActions";
import { usePledgeActions } from "./hooks/usePledgeActions";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, Store, RefreshCw, Download, UserPlus, AlertTriangle, Loader2, Merge } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";

import {
  User,
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
  EditRetailerDialog,
  RoleDialog,
  DeleteUserDialog,
  PasswordDialog,
  AddUserDialog,
  SendEmailDialog,
  NewUserData,
} from "./components";

export default function UsersPage() {
  const [activeTab, setActiveTab] = useState("users");
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [retailerStatusFilter, setRetailerStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  // Dialog state hooks
  const { selectedUser, setSelectedUser, showUserDialog, setShowUserDialog, userDetailTab, setUserDetailTab } = useUserDialog();
  const { showBanDialog, setShowBanDialog, banReason, setBanReason, banningUser, setBanningUser } = useBanDialog();
  const { showEditUserDialog, setShowEditUserDialog, editUserData, setEditUserData, isUpdating, setIsUpdating } = useEditUserDialog();
  const { showRoleDialog, setShowRoleDialog, selectedRole, setSelectedRole } = useRoleDialog();
  const { showPasswordDialog, setShowPasswordDialog, newPassword, setNewPassword, confirmPassword, setConfirmPassword } = usePasswordDialog();

  // Add/create user state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showSendEmailDialog, setShowSendEmailDialog] = useState(false);
  const [emailTargetUser, setEmailTargetUser] = useState<User | null>(null);
  const [showAddUserDialog, setShowAddUserDialog] = useState(false);
  const [newUserData, setNewUserData] = useState<NewUserData>({ name: "", email: "", password: "", confirmPassword: "", role: "USER", retailerAccess: false });
  const [isCreating, setIsCreating] = useState(false);

  // Data fetching hook
  const {
    users,
    userStats,
    pagination,
    isLoading,
    retailers,
    retailerStats,
    isLoadingRetailers,
    isMergingDuplicates,
    duplicateCount,
    fetchUsers,
    checkDuplicates,
    mergeDuplicates,
    fetchRetailers,
    exportUsers,
  } = useUserData(currentPage, searchQuery, roleFilter, retailerStatusFilter);

  // Retailer actions hook
  const {
    selectedRetailer,
    setSelectedRetailer,
    showRetailerDialog,
    setShowRetailerDialog,
    showApprovalDialog,
    setShowApprovalDialog,
    approvalAction,
    approvalNotes,
    setApprovalNotes,
    showEditRetailerDialog,
    setShowEditRetailerDialog,
    isUpdatingRetailer,
    handleRetailerAction,
    handleSendApprovalEmail,
    handleEditRetailer,
    submitEditRetailer,
    submitApprovalAction,
  } = useRetailerActions(fetchRetailers);

  // Pledge/email actions hook
  const {
    userPledges,
    userEmails,
    setUserPledges,
    setUserEmails,
    loadingPledges,
    loadingEmails,
    viewingEmail,
    showEmailPreview,
    setShowEmailPreview,
    cancellingPledge,
    refundingPledge,
    resendingReceipt,
    zeroingWallet,
    cancelPledgeConfirm,
    setCancelPledgeConfirm,
    refundPledgeConfirm,
    setRefundPledgeConfirm,
    deletePledgeConfirm,
    setDeletePledgeConfirm,
    resendReceiptConfirm,
    setResendReceiptConfirm,
    fetchUserPledges,
    fetchUserEmails,
    handleViewEmail,
    handleCancelPledge,
    handleRefundPledge,
    handleDeletePledge,
    handleResendReceipt,
    handleDownloadEmail,
    handleZeroWalletBalance,
  } = usePledgeActions(selectedUser, setSelectedUser);

  useEffect(() => {
    fetchUsers();
    checkDuplicates();
  }, [fetchUsers, checkDuplicates]);

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
      const response = await apiFetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", },
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

  const handleBanUser = (user: User) => {
    setBanningUser(user);
    setBanReason("");
    setShowBanDialog(true);
  };

  const confirmBanUser = async () => {
    if (!banningUser) return;

    try {
      const response = await apiFetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({
          userId: banningUser.id,
          action: "BAN_USER",
          data: { reason: banReason.trim() || "Banned by administrator" },
        }),
      });

      if (response.ok) {
        fetchUsers();
        toast.success(`${banningUser.name || banningUser.email} has been banned`);
        setShowBanDialog(false);
        setBanningUser(null);
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

      const response = await apiFetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", },
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
      const response = await apiFetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", },
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
      const response = await apiFetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", },
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
      const response = await apiFetch(`/api/admin/users?userId=${selectedUser.id}`, {
        method: "DELETE",
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
    setEmailTargetUser(user);
    setShowSendEmailDialog(true);
  };

  const handleVerifyEmail = async (user: User) => {
    try {
      const response = await apiFetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", },
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
      const response = await apiFetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", },
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
      const response = await apiFetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", },
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
      const response = await apiFetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", },
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white">User Management</h1>
          <p className="text-muted-foreground">Manage platform users and retailer applications</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {duplicateCount !== null && duplicateCount > 0 && (
            <Button variant="destructive" onClick={mergeDuplicates} disabled={isMergingDuplicates} className="flex-1 sm:flex-none">
              {isMergingDuplicates ? <Loader2 className="h-4 w-4 sm:mr-2 animate-spin" /> : <Merge className="h-4 w-4 sm:mr-2" />}
              <span className="hidden sm:inline">Merge Duplicates ({duplicateCount})</span>
              <span className="sm:hidden">{duplicateCount}</span>
            </Button>
          )}
          <Button variant="outline" onClick={() => { fetchUsers(); checkDuplicates(); if (activeTab === "retailers") fetchRetailers(); }} disabled={isLoading || isLoadingRetailers} className="flex-1 sm:flex-none">
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
        <TabsList className="grid w-full sm:max-w-md grid-cols-2">
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
            onSendApprovalEmail={handleSendApprovalEmail}
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
        onZeroWalletBalance={(userId) => handleZeroWalletBalance(userId, users)}
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
        onEdit={handleEditRetailer}
        onSendApprovalEmail={handleSendApprovalEmail}
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

      <EditRetailerDialog
        open={showEditRetailerDialog}
        onOpenChange={setShowEditRetailerDialog}
        retailer={selectedRetailer}
        onSubmit={submitEditRetailer}
        isUpdating={isUpdatingRetailer}
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

      <SendEmailDialog
        open={showSendEmailDialog}
        onOpenChange={setShowSendEmailDialog}
        user={emailTargetUser}
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

      {/* Ban User Dialog */}
      <Dialog open={showBanDialog} onOpenChange={(open) => {
        setShowBanDialog(open);
        if (!open) {
          setBanningUser(null);
          setBanReason("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Ban User
            </DialogTitle>
            <DialogDescription>
              Ban {banningUser?.name || banningUser?.email}? This will lock their account, block their IP, and log them out of all sessions. This action can be reversed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="ban-reason">Reason for ban (optional)</Label>
            <Input
              id="ban-reason"
              placeholder="Enter a reason..."
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              maxLength={500}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBanDialog(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={confirmBanUser}
              disabled={isUpdating}
            >
              {isUpdating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Confirm Ban
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
