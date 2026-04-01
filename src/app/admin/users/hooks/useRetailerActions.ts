"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/fetch-utils";
import { toast } from "sonner";
import { Retailer } from "../components";

export function useRetailerActions(fetchRetailers: () => void) {
  const [selectedRetailer, setSelectedRetailer] = useState<Retailer | null>(null);
  const [showRetailerDialog, setShowRetailerDialog] = useState(false);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [approvalAction, setApprovalAction] = useState<"approve" | "reject" | "request_info" | null>(null);
  const [approvalNotes, setApprovalNotes] = useState("");
  const [showEditRetailerDialog, setShowEditRetailerDialog] = useState(false);
  const [isUpdatingRetailer, setIsUpdatingRetailer] = useState(false);

  const handleRetailerAction = (retailer: Retailer, action: "approve" | "reject" | "request_info") => {
    setSelectedRetailer(retailer);
    setApprovalAction(action);
    setApprovalNotes("");
    setShowApprovalDialog(true);
  };

  const handleSendApprovalEmail = async (retailer: Retailer) => {
    try {
      const response = await apiFetch("/api/admin/retailers/resend-approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retailerId: retailer.id }),
      });

      if (response.ok) {
        toast.success(`Account setup email sent to ${retailer.email}`);
      } else {
        const data = await response.json().catch(() => ({}));
        toast.error(data.error || "Failed to send account setup email");
      }
    } catch (error) {
      console.error("Error sending approval email:", error);
      toast.error("An error occurred while sending the email");
    }
  };

  const handleEditRetailer = (retailer: Retailer) => {
    setSelectedRetailer(retailer);
    setShowEditRetailerDialog(true);
  };

  const submitEditRetailer = async (retailerId: string, data: Record<string, unknown>) => {
    setIsUpdatingRetailer(true);
    try {
      const response = await apiFetch("/api/admin/retailers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retailerId, ...data }),
      });

      if (response.ok) {
        fetchRetailers();
        setShowEditRetailerDialog(false);
        toast.success("Retailer updated successfully");
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to update retailer");
      }
    } catch (error) {
      console.error("Error updating retailer:", error);
      toast.error("Failed to update retailer");
    } finally {
      setIsUpdatingRetailer(false);
    }
  };

  const submitApprovalAction = async () => {
    if (!selectedRetailer || !approvalAction) return;

    try {
      const statusMap = {
        approve: "APPROVED",
        reject: "REJECTED",
        request_info: "UNDER_REVIEW",
      };

      const response = await apiFetch("/api/admin/retailers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", },
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

  return {
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
  };
}
