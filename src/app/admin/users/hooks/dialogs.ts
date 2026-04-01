"use client";

import { useState } from "react";
import { User } from "./components";

// ============ User Dialog Hook ============
export function useUserDialog() {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [userDetailTab, setUserDetailTab] = useState("overview");

  return {
    selectedUser,
    setSelectedUser,
    showUserDialog,
    setShowUserDialog,
    userDetailTab,
    setUserDetailTab,
  };
}

// ============ Ban Dialog Hook ============
export function useBanDialog() {
  const [showBanDialog, setShowBanDialog] = useState(false);
  const [banReason, setBanReason] = useState("");
  const [banningUser, setBanningUser] = useState<User | null>(null);

  return {
    showBanDialog,
    setShowBanDialog,
    banReason,
    setBanReason,
    banningUser,
    setBanningUser,
  };
}

// ============ Edit User Dialog Hook ============
export function useEditUserDialog() {
  const [showEditUserDialog, setShowEditUserDialog] = useState(false);
  const [editUserData, setEditUserData] = useState({ name: "", email: "" });
  const [isUpdating, setIsUpdating] = useState(false);

  return {
    showEditUserDialog,
    setShowEditUserDialog,
    editUserData,
    setEditUserData,
    isUpdating,
    setIsUpdating,
  };
}

// ============ Role Dialog Hook ============
export function useRoleDialog() {
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [selectedRole, setSelectedRole] = useState("");

  return {
    showRoleDialog,
    setShowRoleDialog,
    selectedRole,
    setSelectedRole,
  };
}

// ============ Password Dialog Hook ============
export function usePasswordDialog() {
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  return {
    showPasswordDialog,
    setShowPasswordDialog,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
  };
}
