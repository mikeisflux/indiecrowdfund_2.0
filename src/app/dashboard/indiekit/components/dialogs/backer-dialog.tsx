"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
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

interface BackerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  backer: Backer | null;
}

export function BackerDialog({ open, onOpenChange, backer }: BackerDialogProps) {
  const [activeTab, setActiveTab] = useState("order");
  const [showAddressValidation, setShowAddressValidation] = useState(false);
  const [showBalanceEditor, setShowBalanceEditor] = useState(false);
  const [showEditOrder, setShowEditOrder] = useState(false);
  const [showTracking, setShowTracking] = useState(false);
  const [showRefund, setShowRefund] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showEmailComposer, setShowEmailComposer] = useState(false);
  const [showCancelOrder, setShowCancelOrder] = useState(false);
  const [showPackingSlip, setShowPackingSlip] = useState(false);

  if (!backer) return null;

  const handleViewAsBacker = () => {
    toast.info("Opening backer survey view...");
    window.open(`/survey/${backer.id}`, '_blank');
  };

  const handleResendSurvey = async () => {
    try {
      const res = await fetch("/api/creator/indiekit/backers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        headers: { "Content-Type": "application/json" },
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              Pledge #{backer.id}
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
              <Button variant="outline" size="sm">
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
                      <span>(${backer.balance?.pledgeAmount?.toFixed(2) || "0.00"})</span>
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
                        <span>${backer.balance?.pledgeLevelAmount?.toFixed(2) || "0.00"}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">${backer.rewardAmount} - {backer.reward}</p>
                    </div>
                    <div className="flex justify-between">
                      <span>Add-ons</span>
                      <span>${backer.balance?.addonsAmount?.toFixed(2) || "0.00"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Shipping</span>
                      <span>${backer.balance?.shippingAmount?.toFixed(2) || "0.00"}</span>
                    </div>
                    <div className="border-t pt-2 mt-2 font-medium">
                      <div className="flex justify-between">
                        <span>Balance</span>
                        <span className={backer.balance?.balanceDue === 0 ? "text-green-600" : "text-red-600"}>
                          ${backer.balance?.balanceDue?.toFixed(2) || "0.00"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Items Card */}
                <div className="rounded-lg border p-4">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-medium">Items ({backer.items?.length || 0})</h4>
                    <Button variant="ghost" size="sm">Pack List</Button>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium mb-2 flex justify-between">
                        <span>Pledge Items ({backer.items?.length || 0})</span>
                        <span>QTY</span>
                      </p>
                      <div className="space-y-1">
                        {backer.items?.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span>{item.name}</span>
                            <span>{item.quantity}</span>
                          </div>
                        )) || <p className="text-sm text-muted-foreground">No items</p>}
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
                      <Button variant="outline" size="sm" className="mt-3">
                        <Plus className="h-3 w-3 mr-1" />
                        Add SKUs
                      </Button>
                    </div>
                  </div>
                </div>
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
                <Button variant="outline" size="sm" className="mt-4">
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
                  <Button variant="outline" size="sm">
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
          state: backer.shippingAddress.state,
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
        orderId={backer.id}
        backerName={backer.name}
        items={backer.items?.map(item => ({
          id: String(Math.random()),
          name: item.name,
          quantity: item.quantity,
          price: 25,
        })) || []}
        shippingAmount={backer.balance?.shippingAmount || 0}
        onSave={(updates) => {
          console.log("Order updated:", updates);
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
        onOpenChange={setShowRefund}
        backerId={backer.id}
        backerName={backer.name}
        backerEmail={backer.email}
        totalPaid={backer.balance?.pledgeAmount || 0}
        onRefund={(refund) => {
          console.log("Refund processed:", refund);
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
        onConfirm={() => {
          toast.success("Order cancelled");
        }}
      />

      <PackingSlipDialog
        open={showPackingSlip}
        onOpenChange={setShowPackingSlip}
        orderId={backer.id}
        backerName={backer.name}
        backerEmail={backer.email}
        shippingAddress={backer.shippingAddress || {
          name: backer.name,
          line1: "123 Main St",
          city: "San Francisco",
          state: "CA",
          postalCode: "94102",
          country: "United States",
        }}
        items={backer.items?.map(item => ({
          name: item.name,
          sku: `SKU-${item.name.substring(0, 3).toUpperCase()}`,
          quantity: item.quantity,
        })) || []}
        pledgeLevel={backer.reward}
      />
    </Dialog>
  );
}
