"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/fetch-utils";
import { toast } from "sonner";
import { User, NewUserData } from "../components";

export function useUserActions(
  fetchUsers: () => void,
  setSelectedUser: (user: User | null) => void,
  setShowUserDialog: (open: boolean) => void,
  setUserDetailTab: (tab: string) => void,
  setUserPledges: (pledges: []) => void,
  setUserEmails: (emails: []) => void,
  setEditUserData: (data: { name: string; email: string }) => void,
  setShowEditUserDialog: (open: boolean) => void,
  setSelectedRole: (role: string) => void,
  setShowRoleDialog: (open: boolean) => void,
  setBanningUser: (user: User | null) => void,
  setBanReason: (reason: string) => void,
  setShowBanDialog: (open: boolean) => void,
  setIsUpdating: (updating: boolean) => void,
  isUpdating: boolean,
  selectedUser: User | null,
  editUserData: { name: string; email: string },
  selectedRole: string,
  banningUser: User | null,
  banReason: string,
  newPassword: string,
  confirmPassword: string,
  setNewPassword: (password: string) => void,
  setConfirmPassword: (password: string) => void,
  setShowPasswordDialog: (open: boolean) => void,
) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showSendEmailDialog, setShowSendEmailDialog] = useState(false);
  const [emailTargetUser, setEmailTargetUser] = useState<User | null>(null);
  const [showAddUserDialog, setShowAddUserDialog] = useState(false);
  const [newUserData, setNewUserData] = useState<NewUserData>({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "USER",
    retailerAccess: false,
  });
  const [isCreating, setIsCreating] = useState(false);

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

  return {
    showDeleteDialog,
    setShowDeleteDialog,
    showSendEmailDialog,
    setShowSendEmailDialog,
    emailTargetUser,
    showAddUserDialog,
    setShowAddUserDialog,
    newUserData,
    setNewUserData,
    isCreating,
    handleViewUser,
    handleEditUser,
    handleChangeRole,
    handleToggleRetailerAccess,
    handleDeleteUser,
    handleBanUser,
    confirmBanUser,
    handleUnbanUser,
    submitEditUser,
    submitRoleChange,
    submitDeleteUser,
    handleSendEmail,
    handleVerifyEmail,
    handleSetPassword,
    submitSetPassword,
    handleSendResetEmail,
    submitCreateUser,
    isUpdating,
  };
}
