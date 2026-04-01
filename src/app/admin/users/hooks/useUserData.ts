"use client";

import { useState, useCallback } from "react";
import { apiFetch } from "@/lib/fetch-utils";
import { toast } from "sonner";
import { User, UserStats, Pagination, Retailer, RetailerStats } from "../components";

export function useUserData(
  currentPage: number,
  searchQuery: string,
  roleFilter: string,
  retailerStatusFilter: string,
) {
  const [users, setUsers] = useState<User[]>([]);
  const [userStats, setUserStats] = useState<UserStats>({ total: 0, users: 0, admins: 0, superAdmins: 0 });
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);

  const [retailers, setRetailers] = useState<Retailer[]>([]);
  const [retailerStats, setRetailerStats] = useState<RetailerStats>({ pending: 0, underReview: 0, approved: 0, rejected: 0, total: 0 });
  const [isLoadingRetailers, setIsLoadingRetailers] = useState(false);

  const [isMergingDuplicates, setIsMergingDuplicates] = useState(false);
  const [duplicateCount, setDuplicateCount] = useState<number | null>(null);

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

  const checkDuplicates = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/users/merge-duplicates");
      if (response.ok) {
        const data = await response.json();
        setDuplicateCount(data.totalGroups || 0);
      }
    } catch (error) {
      console.error("Error checking duplicates:", error);
    }
  }, []);

  const mergeDuplicates = async () => {
    if (!confirm("This will merge all duplicate email accounts (case-insensitive). The most recently active account will be kept and all data will be transferred. Continue?")) {
      return;
    }

    setIsMergingDuplicates(true);
    try {
      const response = await apiFetch("/api/admin/users/merge-duplicates", {
        method: "POST",
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message || "Duplicates merged successfully");
        setDuplicateCount(0);
        fetchUsers();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to merge duplicates");
      }
    } catch (error) {
      console.error("Error merging duplicates:", error);
      toast.error("Failed to merge duplicates");
    } finally {
      setIsMergingDuplicates(false);
    }
  };

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

  return {
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
  };
}
