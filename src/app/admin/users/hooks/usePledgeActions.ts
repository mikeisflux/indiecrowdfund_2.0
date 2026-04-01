"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/fetch-utils";
import { toast } from "sonner";
import { User, UserPledge, EmailLogEntry } from "../components";

export function usePledgeActions(
  selectedUser: User | null,
  setSelectedUser: (user: User | null) => void,
) {
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
      const response = await apiFetch(`/api/admin/pledges/${pledgeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", },
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
      const response = await apiFetch(`/api/admin/pledges/${pledgeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", },
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
      const response = await apiFetch(`/api/admin/pledges/${pledgeId}`, {
        method: "DELETE",
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
      const response = await apiFetch(`/api/admin/pledges/${pledgeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", },
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

  const handleZeroWalletBalance = async (userId: string, users: User[]) => {
    const user = users.find(u => u.id === userId);
    const confirmed = window.confirm(
      `Are you sure you want to zero out the DivinityCoin wallet balance for ${user?.name || user?.email || "this user"}? This action cannot be undone.`
    );
    if (!confirmed) return;

    setZeroingWallet(true);
    try {
      const res = await apiFetch("/api/admin/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({ userId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to zero wallet balance");

      if (data.previousBalance > 0) {
        toast.success(`Wallet balance zeroed (was $${Number(data.previousBalance).toFixed(2)})`);
      } else {
        toast.info("Wallet balance was already zero");
      }

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

  return {
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
  };
}
