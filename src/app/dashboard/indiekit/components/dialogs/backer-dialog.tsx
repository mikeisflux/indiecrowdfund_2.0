"use client";

import { useState, useEffect, useCallback } from "react";
import { getCSRFHeaders } from "@/lib/csrf";
import { fetchWithRetry } from "@/lib/fetch-utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Eye,
  Edit,
  Mail,
  AlertCircle,
  Circle,
  Check,
  Download,
  FileText,
  Package,
  Truck,
  History,
  MoreHorizontal,
  RefreshCw,
  Link2,
  HelpCircle,
  Users,
  Plus,
  ExternalLink,
  DollarSign,
  MessageSquare,
  Printer,
  Undo2,
  ClipboardList,
  Loader2,
  Layers,
  ArrowRight,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import type { Backer } from "../../types";
import { STATUS_COLORS, STATUS_LABELS } from "../../types";
import { AddressValidationDialog } from "./address-validation-dialog";
import { BalanceEditorDialog } from "./balance-editor-dialog";
import { EditOrderDialog } from "./edit-order-dialog";
import { TrackingDialog } from "./tracking-dialog";
import { RefundDialog } from "./refund-dialog";
import { NotesDialog } from "./notes-dialog";
import { EmailComposerDialog } from "./email-composer-dialog";
import { CancelOrderDialog } from "./confirm-dialog";
import { PackingSlipDialog } from "./packing-slip-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface BackerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  backer: Backer | null;
  availableAddons?: { id: string; name: string; price: number }[];
  onRefresh?: () => void;
}

interface SurveyData {
  survey: {
    id: string;
    introTitle?: string;
    introMessage?: string;
    collectAddresses: boolean;
    status: string;
    addressesLocked: boolean;
  } | null;
  questions: {
    itemQuestions: {
      id: string;
      itemName: string;
      itemDescription?: string;
      variants: { id: string; variantType: string; options: string[] }[];
      customQuestions: { id: string; question: string; questionType: string; options: string[] }[];
    }[];
    backerQuestions: {
      id: string;
      question: string;
      questionType: string;
      options: string[];
    }[];
  };
  response: {
    itemResponses?: Record<string, { variants?: Record<string, string>; customAnswers?: Record<string, string | string[]> }>;
    backerResponses?: Record<string, string | string[]>;
    shippingAddress?: Record<string, string>;
    isComplete: boolean;
    completedAt?: string;
  } | null;
}

export function BackerDialog({ open, onOpenChange, backer, availableAddons = [], onRefresh }: BackerDialogProps) {
  const [activeTab, setActiveTab] = useState("order");
  const [showAddressValidation, setShowAddressValidation] = useState(false);
  const [showBalanceEditor, setShowBalanceEditor] = useState(false);
  const [showEditOrder, setShowEditOrder] = useState(false);
  const [showTracking, setShowTracking] = useState(false);
  const [showRefund, setShowRefund] = useState(false);
  const [refundSuggestedAmount, setRefundSuggestedAmount] = useState<number | undefined>(undefined);
  const [refundSuggestedReason, setRefundSuggestedReason] = useState<string | undefined>(undefined);
  const [showNotes, setShowNotes] = useState(false);
  const [showEmailComposer, setShowEmailComposer] = useState(false);
  const [showCancelOrder, setShowCancelOrder] = useState(false);
  const [showPackingSlip, setShowPackingSlip] = useState(false);
  const [resendingCharge, setResendingCharge] = useState(false);

  // Survey data state
  const [surveyData, setSurveyData] = useState<SurveyData | null>(null);
  const [surveyLoading, setSurveyLoading] = useState(false);
  const [surveyError, setSurveyError] = useState<string | null>(null);

  // Modifier assignment state
  const [modifierAssignmentSaving, setModifierAssignmentSaving] = useState(false);
  const [pendingAssignments, setPendingAssignments] = useState<Record<string, string>>({});


  // Fetch survey data when switching to survey tab
  const fetchSurveyData = useCallback(async () => {
    if (!backer) return;

    setSurveyLoading(true);
    setSurveyError(null);

    try {
      const res = await fetchWithRetry(`/api/creator/indiekit/surveys/${backer.id}`);
      if (!res.ok) {
        throw new Error("Failed to load survey data");
      }
      const data = await res.json();
      setSurveyData(data);
    } catch (error) {
      console.error("Error fetching survey data:", error);
      setSurveyError("Failed to load survey responses");
    } finally {
      setSurveyLoading(false);
    }
  }, [backer]);

  // Fetch survey data when tab changes to survey
  useEffect(() => {
    if (activeTab === "survey" && backer && !surveyData) {
      fetchSurveyData();
    }
  }, [activeTab, backer, surveyData, fetchSurveyData]);

  // Reset survey data when dialog closes or backer changes
  useEffect(() => {
    if (!open) {
      setSurveyData(null);
      setSurveyError(null);
    }
  }, [open]);

  if (!backer) return null;

  const handleViewAsBacker = () => {
    // Open creator view of the backer's survey in new tab
    window.open(`/dashboard/indiekit/survey/${backer.id}`, '_blank');
  };

  const handleCancelOrder = async () => {
    try {
      const res = await fetch("/api/creator/indiekit/backers", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          action: "cancel_order",
          pledgeIds: [backer.id],
          projectId: backer.projectId,
        }),
      });
      if (!res.ok) throw new Error("Failed to cancel order");
      toast.success("Order cancelled");
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to cancel order");
      console.error("Cancel order error:", error);
    }
  };

  const handleResendSurvey = async () => {
    try {
      const res = await fetch("/api/creator/indiekit/backers", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          action: "send_survey_reminder",
          pledgeIds: [backer.id],
          projectId: backer.projectId,
        }),
      });
      if (!res.ok) throw new Error("Failed to resend survey");
      toast.success(`Survey resent to ${backer.email}`);
    } catch (error) {
      toast.error("Failed to resend survey");
      console.error("Resend survey error:", error);
    }
  };

  const handlePushToFulfillment = async () => {
    try {
      const res = await fetch("/api/creator/indiekit/backers", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          action: "push_to_fulfillment",
          pledgeIds: [backer.id],
          projectId: backer.projectId,
        }),
      });
      if (!res.ok) throw new Error("Failed to push to fulfillment");
      toast.success(`Order pushed to fulfillment`);
    } catch (error) {
      toast.error("Failed to push to fulfillment");
      console.error("Push to fulfillment error:", error);
    }
  };

  const handleResendChargeRequest = async () => {
    if (!backer?.projectId) {
      toast.error("Missing project information");
      return;
    }

    const balanceDue = Number(backer.balance?.balanceDue || 0);

    if (balanceDue <= 0) {
      toast.info("No balance due for this backer");
      return;
    }

    setResendingCharge(true);
    try {
      const res = await fetch("/api/creator/indiekit/orders/notify-balance", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          pledgeId: backer.id,
          projectId: backer.projectId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send charge request");
      }

      const data = await res.json();
      toast.success(`Charge request sent to ${backer.email} for $${data.balanceDue.toFixed(2)}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send charge request");
      console.error("Resend charge request error:", error);
    } finally {
      setResendingCharge(false);
    }
  };

  const handleSaveModifierAssignment = async (modifierAddonId: string, rewardId: string) => {
    if (!backer?.projectId) return;

    setModifierAssignmentSaving(true);
    try {
      const res = await fetch("/api/creator/indiekit/modifiers", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          projectId: backer.projectId,
          action: "manual_assign",
          pledgeId: backer.id,
          rewardId,
          modifierAddonId,
        }),
      });
      if (!res.ok) throw new Error("Failed to save modifier assignment");
      toast.success("Modifier assignment saved");
      // Update pending assignments to show the saved value
      setPendingAssignments(prev => ({ ...prev, [modifierAddonId]: rewardId }));
    } catch (error) {
      toast.error("Failed to save modifier assignment");
      console.error("Modifier assignment error:", error);
    } finally {
      setModifierAssignmentSaving(false);
    }
  };

  // Get modifier addons from the backer's addons
  const modifierAddons = backer?.addons?.filter(addon => addon.isModifier) || [];
  const hasModifierAddons = modifierAddons.length > 0;

  // Build a list of base rewards from items (pledge level items)
  // This is a simplified version - in production, you'd want to fetch actual tier rewards
  const baseRewardOptions = backer?.items?.map(item => ({
    id: item.sku || item.name,
    name: item.name,
  })) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              {backer.backerNumber ? `Backer #${backer.backerNumber}` : "Backer"} — {backer.name}
              <span className="text-sm font-normal text-muted-foreground">({backer.email})</span>
              <Button variant="outline" size="sm" className="ml-2" onClick={handleViewAsBacker}>
                <Eye className="h-3 w-3 mr-1" />
                View as Backer
              </Button>
              <Button variant="outline" size="sm" onClick={handleResendSurvey}>
                <RefreshCw className="h-3 w-3 mr-1" />
                Resend
              </Button>
              <Button variant="outline" size="sm" onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/survey/${backer.id}`);
                toast.success("Survey link copied to clipboard");
              }}>
                <Link2 className="h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open('/docs/backer-management', '_blank')}
                title="Open backer management help"
              >
                <HelpCircle className="h-3 w-3" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Actions
                    <MoreHorizontal className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setShowEmailComposer(true)}>
                    <Mail className="h-4 w-4 mr-2" />
                    Send Email
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleResendSurvey}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Resend Survey
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowNotes(true)}>
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Add Note
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setShowEditOrder(true)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Order
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowBalanceEditor(true)}>
                    <DollarSign className="h-4 w-4 mr-2" />
                    Adjust Balance
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleResendChargeRequest}
                    disabled={resendingCharge || ((Number(backer.balance?.pledgeLevelAmount || 0) + Number(backer.balance?.addonsAmount || 0) + Number(backer.balance?.shippingAmount || 0)) - Number(backer.balance?.pledgeAmount || 0)) <= 0}
                  >
                    {resendingCharge ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                    {resendingCharge ? "Sending..." : "Resend Charge Request"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowRefund(true)}>
                    <Undo2 className="h-4 w-4 mr-2" />
                    Issue Refund
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setShowTracking(true)}>
                    <Truck className="h-4 w-4 mr-2" />
                    Add Tracking
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowPackingSlip(true)}>
                    <Printer className="h-4 w-4 mr-2" />
                    Packing Slip
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handlePushToFulfillment}>
                    <Package className="h-4 w-4 mr-2" />
                    Push to Fulfillment
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-red-600" onClick={() => setShowCancelOrder(true)}>
                    Cancel Order
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </DialogTitle>
          </div>
          <DialogDescription className="sr-only">
            View and manage backer details, order status, and fulfillment
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status and Shipping Info Cards */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Status Card */}
            <div className="rounded-lg border p-4">
              <h4 className="font-medium mb-3">Status</h4>
              {!backer.surveyCompleted ? (
                <div>
                  <Badge className="bg-red-600 text-white mb-2">SURVEY NOT COMPLETED</Badge>
                  <ul className="text-sm text-muted-foreground space-y-1 mt-2">
                    {!backer.addressComplete && (
                      <li className="flex items-center gap-2">
                        <Circle className="h-2 w-2" />
                        Address information required
                      </li>
                    )}
                    <li className="flex items-center gap-2">
                      <Circle className="h-2 w-2" />
                      Survey question completion required
                    </li>
                  </ul>
                </div>
              ) : (
                <Badge className="bg-green-600 text-white">SURVEY COMPLETE</Badge>
              )}
              <div className="mt-4 flex items-center gap-2">
                <Badge className={STATUS_COLORS[backer.status]}>
                  {STATUS_LABELS[backer.status]}
                </Badge>
              </div>
            </div>

            {/* Shipping Address Card */}
            <div className="rounded-lg border p-4">
              <div className="flex justify-between items-start mb-3">
                <h4 className="font-medium">Shipping Information</h4>
                <Button variant="ghost" size="sm" onClick={() => setShowAddressValidation(true)}>
                  <Edit className="h-3 w-3 mr-1" />
                  Edit
                </Button>
              </div>
              {backer.shippingAddress ? (
                <div className="text-sm">
                  <p>{backer.shippingAddress.name}</p>
                  <p>{backer.shippingAddress.line1}</p>
                  {backer.shippingAddress.line2 && <p>{backer.shippingAddress.line2}</p>}
                  <p>
                    {backer.shippingAddress.city}, {backer.shippingAddress.state} {backer.shippingAddress.postalCode}
                  </p>
                  <p>{backer.shippingAddress.country}</p>
                </div>
              ) : (
                <div className="text-center py-4">
                  <AlertCircle className="h-6 w-6 text-amber-500 mx-auto mb-2" />
                  <p className="text-sm text-red-600 font-medium">Address Incomplete</p>
                  <p className="text-xs text-muted-foreground">
                    Address City, Line 1, Postal Code, Phone Number, and State are missing
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full justify-start flex-wrap">
              <TabsTrigger value="order">Order</TabsTrigger>
              <TabsTrigger value="survey">Survey</TabsTrigger>
              <TabsTrigger value="digital">Digital Downloads</TabsTrigger>
              <TabsTrigger value="shipping">Shipping</TabsTrigger>
              <TabsTrigger value="packages">Packages</TabsTrigger>
              <TabsTrigger value="emails">Emails</TabsTrigger>
              <TabsTrigger value="segments">Segments</TabsTrigger>
              <TabsTrigger value="changelog">Changelog</TabsTrigger>
            </TabsList>

            {/* Order Tab */}
            <TabsContent value="order" className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                {/* Balance Card */}
                <div className="rounded-lg border p-4">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-medium">Balance</h4>
                    <Button variant="ghost" size="sm" onClick={() => setShowBalanceEditor(true)}>
                      <DollarSign className="h-3 w-3 mr-1" />
                      Adjust
                    </Button>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span>Amount Pledged</span>
                        <Check className="h-3 w-3 text-green-500" />
                      </div>
                      <span>(${Number(backer.balance?.pledgeAmount || 0).toFixed(2)})</span>
                    </div>
                    <div className="text-xs">
                      <span className="text-muted-foreground">Indiecrowdfund</span>
                      <span className="text-muted-foreground"> (Collected)</span>
                    </div>
                    <Button
                      variant="link"
                      size="sm"
                      className="text-teal-600 p-0 h-auto text-xs"
                      onClick={() => window.open(`/projects/pledge/${backer.id}`, '_blank')}
                    >
                      View pledge on Indiecrowdfund
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </Button>
                    <div className="border-t pt-2 mt-2">
                      <div className="flex justify-between">
                        <span>Pledge Level</span>
                        <span>${Number(backer.balance?.pledgeLevelAmount || 0).toFixed(2)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">${backer.rewardAmount} - {backer.reward}</p>
                    </div>
                    <div className="flex justify-between">
                      <span>Add-ons</span>
                      <span>${Number(backer.balance?.addonsAmount || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Shipping</span>
                      <span>${Number(backer.balance?.shippingAmount || 0).toFixed(2)}</span>
                    </div>
                    <div className="border-t pt-2 mt-2 font-medium">
                      {(() => {
                        const diff = Number(backer.balance?.balanceDue || 0);
                        if (diff < -0.005) {
                          // Credit owed to customer (order total is less than what they paid)
                          const creditAmount = Math.abs(diff);
                          return (
                            <>
                              <div className="flex justify-between">
                                <span>Credit (Refund Owed)</span>
                                <span className="text-green-600">
                                  ${creditAmount.toFixed(2)}
                                </span>
                              </div>
                              <Button
                                variant="link"
                                size="sm"
                                className="text-teal-600 p-0 h-auto text-xs mt-1"
                                onClick={() => {
                                  setRefundSuggestedAmount(creditAmount);
                                  setRefundSuggestedReason("overcharge");
                                  setShowRefund(true);
                                }}
                              >
                                <Undo2 className="h-3 w-3 mr-1" />
                                Issue Refund
                              </Button>
                            </>
                          );
                        } else if (diff > 0.005) {
                          // Balance due from customer
                          return (
                            <>
                              <div className="flex justify-between">
                                <span>Balance Due</span>
                                <span className="text-red-600">
                                  ${diff.toFixed(2)}
                                </span>
                              </div>
                              <Button
                                variant="link"
                                size="sm"
                                className="text-teal-600 p-0 h-auto text-xs mt-1"
                                onClick={handleResendChargeRequest}
                                disabled={resendingCharge}
                              >
                                {resendingCharge ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Send className="h-3 w-3 mr-1" />}
                                {resendingCharge ? "Sending..." : "Send Charge Request"}
                              </Button>
                            </>
                          );
                        } else {
                          // Balanced
                          return (
                            <div className="flex justify-between">
                              <span>Balance</span>
                              <span className="text-green-600">$0.00</span>
                            </div>
                          );
                        }
                      })()}
                    </div>
                  </div>
                </div>

                {/* Items Card */}
                <div className="rounded-lg border p-4">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-medium">Items ({(backer.items?.length || 0) + (backer.addons?.length || 0)})</h4>
                    <Button variant="ghost" size="sm" onClick={() => setShowPackingSlip(true)}>Pack List</Button>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium mb-2 flex justify-between">
                        <span>Main Reward</span>
                        <span>QTY</span>
                      </p>
                      <div className="space-y-1">
                        {backer.items?.length ? backer.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span>{item.name}</span>
                            <span>{item.quantity}</span>
                          </div>
                        )) : <p className="text-sm text-muted-foreground italic">No reward selected</p>}
                      </div>
                    </div>
                    {backer.addons && backer.addons.length > 0 && (
                      <div className="border-t pt-2">
                        <p className="text-xs text-muted-foreground font-medium mb-2 flex justify-between">
                          <span>Add-ons ({backer.addons.length})</span>
                          <span>QTY</span>
                        </p>
                        <div className="space-y-1">
                          {backer.addons.map((addon) => (
                            <div key={addon.id} className="flex justify-between text-sm">
                              <span>{addon.name}</span>
                              <span>{addon.quantity}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Manually Added Items */}
                    <div className="border-t pt-2">
                      <p className="text-xs text-muted-foreground font-medium mb-2 flex justify-between">
                        <span>Manually Added Items (0)</span>
                        <span>QTY</span>
                      </p>
                      <p className="text-sm text-muted-foreground italic">nothing added</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() => toast.info("SKU management coming soon")}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add SKUs
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modifier Assignment Section - only show if backer has modifier addons */}
              {hasModifierAddons && (
                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Layers className="h-5 w-5 text-purple-600" />
                    <h4 className="font-medium">Modifier Assignments</h4>
                    {backer.needsModifierAssignment && (
                      <Badge className="bg-amber-100 text-amber-700">Needs Assignment</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">
                    Assign which item each upgrade/modifier addon applies to. This determines the final SKU for fulfillment.
                  </p>
                  <div className="space-y-3">
                    {modifierAddons.map((addon) => {
                      // Find existing assignment for this modifier
                      const existingAssignment = backer.modifierAssignments?.find(
                        (a) => a.modifierAddonId === addon.id
                      );
                      const currentValue = pendingAssignments[addon.id] || existingAssignment?.rewardId || "";

                      return (
                        <div key={addon.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                          <div className="flex-1">
                            <p className="text-sm font-medium flex items-center gap-2">
                              {addon.name}
                              {addon.quantity > 1 && (
                                <Badge variant="secondary" className="text-xs">
                                  x{addon.quantity}
                                </Badge>
                              )}
                            </p>
                            {existingAssignment && (
                              <p className="text-xs text-muted-foreground">
                                {existingAssignment.isAutoAssigned ? "Auto-assigned" : "Manually assigned"}
                                {existingAssignment.rewardTitle && ` to: ${existingAssignment.rewardTitle}`}
                              </p>
                            )}
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          <div className="w-48">
                            <Select
                              value={currentValue}
                              onValueChange={(value) => {
                                handleSaveModifierAssignment(addon.id, value);
                              }}
                              disabled={modifierAssignmentSaving}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Select item to modify" />
                              </SelectTrigger>
                              <SelectContent>
                                {baseRewardOptions.map((item) => (
                                  <SelectItem key={item.id} value={item.id}>
                                    {item.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {modifierAssignmentSaving && (
                    <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Saving assignment...
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            {/* Survey Tab */}
            <TabsContent value="survey" className="space-y-4">
              <div className="rounded-lg border p-4">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <ClipboardList className="h-5 w-5 text-teal-600" />
                    Survey Responses
                  </h4>
                  <Badge variant={backer.surveyCompleted ? "default" : "secondary"}>
                    {backer.surveyCompleted ? "Completed" : "Pending"}
                  </Badge>
                </div>

                {surveyLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : surveyError ? (
                  <div className="text-center py-6">
                    <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
                    <p className="text-sm text-red-600">{surveyError}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={fetchSurveyData}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Retry
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Status message */}
                    {backer.surveyCompleted ? (
                      <p className="text-sm text-muted-foreground">
                        This backer has completed their survey. View their responses below.
                      </p>
                    ) : (
                      <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-200">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-amber-600" />
                          <p className="text-sm text-amber-800">
                            This backer has not yet completed their survey.
                          </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={handleResendSurvey}>
                          <RefreshCw className="h-4 w-4 mr-1" />
                          Remind
                        </Button>
                      </div>
                    )}

                    {/* Survey not configured/sent yet */}
                    {!surveyData?.survey ? (
                      <div className="bg-muted/50 rounded-lg p-4 text-center">
                        <p className="text-sm text-muted-foreground">No survey has been configured or sent for this project yet.</p>
                      </div>
                    ) : (
                      <>
                        {/* Display survey questions and responses */}
                        <div className="space-y-3 pt-2 border-t">
                          {/* Item Questions & Responses */}
                          {surveyData?.questions?.itemQuestions?.map((item) => {
                            const itemResponse = surveyData?.response?.itemResponses?.[item.id];
                            return (
                              <div key={item.id} className="bg-muted/50 rounded-lg p-4">
                                <p className="text-sm font-medium mb-2">{item.itemName}</p>
                                {item.itemDescription && (
                                  <p className="text-xs text-muted-foreground mb-2">{item.itemDescription}</p>
                                )}

                                {/* Variant selections */}
                                {item.variants.map((variant) => {
                                  const selection = itemResponse?.variants?.[variant.id];
                                  return (
                                    <div key={variant.id} className="flex justify-between text-sm py-1 border-b last:border-0">
                                      <span className="text-muted-foreground">{variant.variantType}:</span>
                                      <span className="font-medium">{selection || <span className="text-amber-600 italic">Not selected</span>}</span>
                                    </div>
                                  );
                                })}

                                {/* Custom question answers */}
                                {item.customQuestions.map((q) => {
                                  const answer = itemResponse?.customAnswers?.[q.id];
                                  return (
                                    <div key={q.id} className="mt-2">
                                      <p className="text-xs text-muted-foreground">{q.question}</p>
                                      <p className="text-sm">
                                        {answer
                                          ? Array.isArray(answer)
                                            ? answer.join(", ")
                                            : answer
                                          : <span className="text-amber-600 italic">No answer</span>}
                                      </p>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })}

                          {/* Backer Questions & Responses */}
                          {surveyData?.questions?.backerQuestions?.map((q) => {
                            const answer = surveyData?.response?.backerResponses?.[q.id];
                            return (
                              <div key={q.id} className="bg-muted/50 rounded-lg p-4">
                                <p className="text-xs text-muted-foreground font-medium mb-1">{q.question}</p>
                                <p className="text-sm">
                                  {answer
                                    ? Array.isArray(answer)
                                      ? answer.join(", ")
                                      : answer
                                    : <span className="text-amber-600 italic">No answer</span>}
                                </p>
                              </div>
                            );
                          })}

                          {/* No questions configured message */}
                          {(!surveyData?.questions?.itemQuestions?.length &&
                            !surveyData?.questions?.backerQuestions?.length) && (
                            <div className="bg-muted/50 rounded-lg p-4">
                              <p className="text-xs text-muted-foreground font-medium mb-1">Survey questions</p>
                              <p className="text-sm">No detailed survey questions configured for this backer&apos;s reward tier.</p>
                            </div>
                          )}
                        </div>

                        <Button variant="outline" size="sm" onClick={handleViewAsBacker}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Full Survey
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Digital Downloads Tab */}
            <TabsContent value="digital" className="space-y-4">
              {backer.digitalDownloads && backer.digitalDownloads.length > 0 ? (
                <div className="space-y-3">
                  {backer.digitalDownloads.map((download, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-purple-600" />
                        <div>
                          <p className="font-medium text-sm">{download.name}</p>
                          {download.distributedAt && (
                            <p className="text-xs text-muted-foreground">Distributed {download.distributedAt}</p>
                          )}
                        </div>
                      </div>
                      <Badge variant={download.downloaded ? "default" : "secondary"}>
                        {download.downloaded ? "Downloaded" : "Not Downloaded"}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border p-4 text-center">
                  <Download className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No digital downloads for this backer</p>
                </div>
              )}
            </TabsContent>

            {/* Shipping Tab */}
            <TabsContent value="shipping" className="space-y-4">
              <div className="rounded-lg border p-4">
                <h4 className="font-medium mb-3">Shipping Status</h4>
                <div className="flex items-center gap-3">
                  <Truck className="h-5 w-5 text-teal-600" />
                  <div>
                    <p className="font-medium">{STATUS_LABELS[backer.status]}</p>
                    {backer.status === "shipped" && (
                      <p className="text-sm text-muted-foreground">
                        Tracking information available
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Packages Tab */}
            <TabsContent value="packages" className="space-y-4">
              <div className="rounded-lg border p-4 text-center">
                <Package className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Package information will appear here</p>
              </div>
            </TabsContent>

            {/* Emails Tab */}
            <TabsContent value="emails" className="space-y-4">
              <div className="rounded-lg border p-4 text-center">
                <Mail className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Email history for this backer will appear here</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => setShowEmailComposer(true)}
                >
                  <Mail className="h-3 w-3 mr-1" />
                  Send Email
                </Button>
              </div>
            </TabsContent>

            {/* Segments Tab */}
            <TabsContent value="segments" className="space-y-4">
              <div className="rounded-lg border p-4">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-medium">Backer Segments</h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toast.info("Segment management coming soon")}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add to Segment
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Segments help you organize backers for targeted communication and fulfillment.
                </p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-teal-600" />
                      <span className="text-sm font-medium">Early Bird Backers</span>
                    </div>
                    <Badge variant="secondary">Auto</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-teal-600" />
                      <span className="text-sm font-medium">Premium Tier</span>
                    </div>
                    <Badge variant="secondary">Auto</Badge>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Changelog Tab */}
            <TabsContent value="changelog" className="space-y-4">
              {backer.activity && backer.activity.length > 0 ? (
                <div className="space-y-3">
                  {backer.activity.map((entry, idx) => (
                    <div key={idx} className="flex items-start gap-3 text-sm">
                      <div className="h-2 w-2 rounded-full bg-teal-500 mt-1.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium">{entry.action}</p>
                        {entry.details && <p className="text-muted-foreground">{entry.details}</p>}
                        <p className="text-xs text-muted-foreground">{entry.date}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border p-4 text-center">
                  <History className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No activity recorded yet</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => setShowEmailComposer(true)}>
            <Mail className="h-4 w-4 mr-2" />
            Contact Backer
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Sub-dialogs */}
      <AddressValidationDialog
        open={showAddressValidation}
        onOpenChange={setShowAddressValidation}
        originalAddress={backer.shippingAddress ? {
          line1: backer.shippingAddress.line1,
          line2: backer.shippingAddress.line2,
          city: backer.shippingAddress.city,
          state: backer.shippingAddress.state || "",
          postalCode: backer.shippingAddress.postalCode,
          country: backer.shippingAddress.country,
        } : null}
        onConfirm={(address) => {
          console.log("Address updated:", address);
        }}
      />

      <BalanceEditorDialog
        open={showBalanceEditor}
        onOpenChange={setShowBalanceEditor}
        backerId={backer.id}
        backerName={backer.name}
        currentBalance={backer.balance?.balanceDue || 0}
        onSave={(adjustment) => {
          console.log("Balance adjustment:", adjustment);
        }}
      />

      <EditOrderDialog
        open={showEditOrder}
        onOpenChange={setShowEditOrder}
        pledgeId={backer.id}
        projectId={backer.projectId || ""}
        backerName={backer.name}
        backerEmail={backer.email}
        reward={backer.reward ? { name: backer.reward, amount: backer.rewardAmount } : null}
        rewardId={backer.rewardId}
        currentAddons={backer.addons || []}
        availableAddons={availableAddons}
        shippingAmount={backer.balance?.shippingAmount || 0}
        originalPledgeAmount={backer.pledgeAmount}
        onSaved={onRefresh}
        onRefundNeeded={(amount) => {
          setRefundSuggestedAmount(amount);
          setRefundSuggestedReason("overcharge");
          setShowRefund(true);
        }}
      />

      <TrackingDialog
        open={showTracking}
        onOpenChange={setShowTracking}
        orderId={backer.id}
        backerName={backer.name}
        backerEmail={backer.email}
        onSave={(tracking) => {
          console.log("Tracking added:", tracking);
        }}
      />

      <RefundDialog
        open={showRefund}
        onOpenChange={(open) => {
          setShowRefund(open);
          if (!open) {
            // Clear suggested amount when dialog closes
            setRefundSuggestedAmount(undefined);
            setRefundSuggestedReason(undefined);
          }
        }}
        pledgeId={backer.id}
        backerName={backer.name}
        backerEmail={backer.email}
        totalPaid={backer.balance?.pledgeAmount || 0}
        paymentProcessor={backer.paymentProcessor as "STRIPE" | "DIVINITYCOIN"}
        suggestedAmount={refundSuggestedAmount}
        suggestedReason={refundSuggestedReason}
        onRefundComplete={() => {
          setRefundSuggestedAmount(undefined);
          setRefundSuggestedReason(undefined);
          onRefresh?.();
          onOpenChange(false); // Close backer dialog after refund
        }}
      />

      <NotesDialog
        open={showNotes}
        onOpenChange={setShowNotes}
        backerId={backer.id}
        backerName={backer.name}
        onSave={(note) => {
          console.log("Note added:", note);
        }}
      />

      <EmailComposerDialog
        open={showEmailComposer}
        onOpenChange={setShowEmailComposer}
        recipientEmail={backer.email}
        recipientName={backer.name}
        onSend={(email) => {
          console.log("Email sent:", email);
        }}
      />

      <CancelOrderDialog
        open={showCancelOrder}
        onOpenChange={setShowCancelOrder}
        orderId={backer.id}
        backerName={backer.name}
        onConfirm={handleCancelOrder}
      />

      <PackingSlipDialog
        open={showPackingSlip}
        onOpenChange={setShowPackingSlip}
        orderId={backer.id}
        backerName={backer.name}
        backerEmail={backer.email}
        shippingAddress={backer.shippingAddress ? {
          name: backer.shippingAddress.name || backer.name,
          line1: backer.shippingAddress.line1,
          line2: backer.shippingAddress.line2,
          city: backer.shippingAddress.city,
          state: backer.shippingAddress.state || "",
          postalCode: backer.shippingAddress.postalCode,
          country: backer.shippingAddress.country,
        } : {
          name: backer.name,
          line1: "Address not provided",
          city: "Unknown",
          state: "",
          postalCode: "",
          country: "United States",
        }}
        items={[
          ...(backer.items?.map(item => ({
            name: item.name,
            sku: item.sku || `SKU-${item.name.substring(0, 3).toUpperCase()}`,
            quantity: item.quantity,
          })) || []),
          ...(backer.addons?.map(addon => ({
            name: addon.name,
            sku: `ADDON-${addon.name.substring(0, 3).toUpperCase()}`,
            quantity: addon.quantity,
          })) || []),
        ]}
        pledgeLevel={backer.reward}
      />
    </Dialog>
  );
}
