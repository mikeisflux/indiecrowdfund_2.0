"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import {
  Search,
  Filter,
  Download,
  Send,
  MoreHorizontal,
  Eye,
  Mail,
  Check,
  Clock,
  CreditCard,
  Lock,
  MapPin,
  ChevronDown,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { getCSRFHeaders } from "@/lib/csrf";
import type { Backer } from "../../types";
import { STATUS_COLORS, STATUS_LABELS } from "../../types";

interface BackersTabProps {
  backers: Backer[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  selectedBackers: string[];
  onToggleBackerSelection: (backerId: string) => void;
  onSelectAllBackers: () => void;
  onOpenBackerDetail: (backer: Backer) => void;
  onPushSelectedOrders: () => void;
  hasActiveCampaign?: boolean;
  projectId?: string;
  onRefresh?: () => void;
}

export function BackersTab({
  backers,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  selectedBackers,
  onToggleBackerSelection,
  onSelectAllBackers,
  onOpenBackerDetail,
  onPushSelectedOrders,
  hasActiveCampaign = true,
  projectId,
  onRefresh,
}: BackersTabProps) {
  const [showChargeDialog, setShowChargeDialog] = useState(false);
  const [isCharging, setIsCharging] = useState(false);
  const [chargeProgress, setChargeProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  // Helper function for bulk actions
  const performBulkAction = async (action: string, successMessage: string) => {
    if (!projectId || selectedBackers.length === 0) {
      toast.error("No backers selected or no project");
      return;
    }

    setIsProcessing(true);
    try {
      const res = await fetch("/api/creator/indiekit/backers", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          action,
          pledgeIds: selectedBackers,
          projectId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Action failed");
      }

      toast.success(successMessage.replace("{count}", String(data.results?.success || selectedBackers.length)));
      onRefresh?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    } finally {
      setIsProcessing(false);
    }
  };

  // Show message if no active campaign
  if (!hasActiveCampaign) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Active Campaign</h3>
            <p className="text-muted-foreground">
              You must have an active campaign to see data here.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const filteredBackers = backers
    .filter((backer) => {
      const matchesSearch = backer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        backer.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || backer.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      // Sort by backer number, backers without numbers go to the end
      const aNum = a.backerNumber || Infinity;
      const bNum = b.backerNumber || Infinity;
      return aNum - bNum;
    });

  // Calculate stats for selected backers
  const selectedBackerData = backers.filter(b => selectedBackers.includes(b.id));
  const totalToCharge = selectedBackerData.reduce((sum, b) => sum + (b.balance?.balanceDue || 0), 0);
  const backersNeedingCharge = selectedBackerData.filter(b => (b.balance?.balanceDue || 0) > 0).length;

  // Handle bulk charge cards
  const handleChargeCards = async () => {
    if (!projectId) {
      toast.error("No project selected");
      return;
    }

    setIsCharging(true);
    setChargeProgress(10);

    try {
      const res = await fetch("/api/creator/indiekit/backers", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          action: "charge_cards",
          pledgeIds: selectedBackers,
          projectId,
        }),
      });

      setChargeProgress(50);
      const data = await res.json();
      setChargeProgress(100);

      if (!res.ok) {
        throw new Error(data.error || "Charge failed");
      }

      toast.success(`Successfully charged ${data.results?.success || backersNeedingCharge} backers`);
      onRefresh?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to charge cards");
    } finally {
      setIsCharging(false);
      setShowChargeDialog(false);
    }
  };

  // Handle bulk send survey reminder
  const handleSendSurveyReminder = async () => {
    const pendingSurveys = selectedBackerData.filter(b => !b.surveyCompleted).length;
    if (pendingSurveys === 0) {
      toast.info("All selected backers have completed their surveys");
      return;
    }
    await performBulkAction("send_survey_reminder", "Sent survey reminders to {count} backers");
  };

  // Handle bulk lock orders
  const handleLockOrders = async () => {
    await performBulkAction("lock_orders", "Locked orders for {count} backers");
  };

  // Handle bulk lock addresses
  const handleLockAddresses = async () => {
    const withAddresses = selectedBackerData.filter(b => b.addressComplete).length;
    if (withAddresses === 0) {
      toast.error("No selected backers have complete addresses");
      return;
    }
    await performBulkAction("lock_addresses", "Locked addresses for {count} backers");
  };

  // Handle push to fulfillment
  const handlePushToFulfillment = async () => {
    await performBulkAction("push_to_fulfillment", "Pushed {count} orders to fulfillment");
  };

  // Handle export
  const handleExport = async () => {
    if (!projectId) {
      toast.error("No project selected");
      return;
    }

    try {
      const res = await fetch(`/api/creator/indiekit/export?projectId=${projectId}&type=backers`, {
        headers: getCSRFHeaders(),
      });

      if (!res.ok) {
        throw new Error("Export failed");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backers-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Export downloaded");
    } catch (error) {
      toast.error("Failed to export data");
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters and Actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-1 gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search backers..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={onStatusFilterChange}>
            <SelectTrigger className="w-[140px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="not_pushed">Not Pushed</SelectItem>
              <SelectItem value="push_errored">Push Errored</SelectItem>
              <SelectItem value="pushed">Pushed</SelectItem>
              <SelectItem value="shipped">Shipped</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-2">
          {selectedBackers.length > 0 && (
            <>
              {/* Bulk Actions Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="whitespace-nowrap">
                    Bulk Actions ({selectedBackers.length})
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={handleSendSurveyReminder}>
                    <Mail className="h-4 w-4 mr-2" />
                    Send Survey Reminder
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowChargeDialog(true)}>
                    <CreditCard className="h-4 w-4 mr-2" />
                    Charge Cards
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLockOrders}>
                    <Lock className="h-4 w-4 mr-2" />
                    Lock Orders
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLockAddresses}>
                    <MapPin className="h-4 w-4 mr-2" />
                    Lock Addresses
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handlePushToFulfillment} disabled={isProcessing}>
                    <Send className="h-4 w-4 mr-2" />
                    Push to Fulfillment
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                onClick={handlePushToFulfillment}
                className="bg-teal-600 hover:bg-teal-700"
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Push {selectedBackers.length} Orders
              </Button>
            </>
          )}
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Card Charging Dialog */}
      <Dialog open={showChargeDialog} onOpenChange={setShowChargeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-teal-600" />
              Charge Cards
            </DialogTitle>
            <DialogDescription>
              Review and process card charges for selected backers
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Charge Summary */}
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Selected Backers</span>
                <span className="font-medium">{selectedBackers.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Backers with Balance Due</span>
                <span className="font-medium">{backersNeedingCharge}</span>
              </div>
              <div className="flex justify-between text-sm border-t pt-3">
                <span className="font-medium">Total to Charge</span>
                <span className="font-bold text-lg text-teal-600">${totalToCharge.toFixed(2)}</span>
              </div>
            </div>

            {/* Warning */}
            {backersNeedingCharge === 0 ? (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
                <p className="text-amber-800">No selected backers have a balance due.</p>
              </div>
            ) : (
              <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
                <p className="text-blue-800">
                  Cards will be charged for add-ons, shipping, and any balance adjustments.
                  Backers will receive email receipts.
                </p>
              </div>
            )}

            {/* Progress */}
            {isCharging && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Processing charges...</span>
                  <span>{chargeProgress}%</span>
                </div>
                <Progress value={chargeProgress} className="h-2" />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowChargeDialog(false)} disabled={isCharging}>
              Cancel
            </Button>
            <Button
              className="bg-teal-600 hover:bg-teal-700"
              onClick={handleChargeCards}
              disabled={isCharging || backersNeedingCharge === 0}
            >
              {isCharging ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Charge ${totalToCharge.toFixed(2)}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Backers Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedBackers.length === filteredBackers.length && filteredBackers.length > 0}
                    onCheckedChange={onSelectAllBackers}
                  />
                </TableHead>
                <TableHead className="w-16">#</TableHead>
                <TableHead>Backer</TableHead>
                <TableHead>Reward</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Survey</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBackers.map((backer) => (
                <TableRow key={backer.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedBackers.includes(backer.id)}
                      onCheckedChange={() => onToggleBackerSelection(backer.id)}
                    />
                  </TableCell>
                  <TableCell onClick={() => onOpenBackerDetail(backer)} className="font-medium text-muted-foreground">
                    {backer.backerNumber || "—"}
                  </TableCell>
                  <TableCell onClick={() => onOpenBackerDetail(backer)}>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        {backer.avatar && <AvatarImage src={backer.avatar} />}
                        <AvatarFallback>{backer.name[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{backer.name}</p>
                        <p className="text-xs text-muted-foreground">{backer.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell onClick={() => onOpenBackerDetail(backer)}>{backer.reward}</TableCell>
                  <TableCell onClick={() => onOpenBackerDetail(backer)}>${backer.pledgeAmount}</TableCell>
                  <TableCell onClick={() => onOpenBackerDetail(backer)}>
                    {backer.surveyCompleted ? (
                      <Badge variant="outline" className="text-green-600 border-green-200">
                        <Check className="h-3 w-3 mr-1" />
                        Complete
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-600 border-amber-200">
                        <Clock className="h-3 w-3 mr-1" />
                        Pending
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell onClick={() => onOpenBackerDetail(backer)}>
                    <Badge className={STATUS_COLORS[backer.status]}>
                      {STATUS_LABELS[backer.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onOpenBackerDetail(backer)}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {
                          // Open email composer with this backer's email pre-filled
                          window.location.href = `mailto:${backer.email}?subject=Regarding%20Your%20Pledge`;
                        }}>
                          <Mail className="h-4 w-4 mr-2" />
                          Send Email
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={async () => {
                          if (!projectId) {
                            toast.error("No project selected");
                            return;
                          }
                          try {
                            const res = await fetch("/api/creator/indiekit/backers", {
                              method: "POST",
                              headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
                              body: JSON.stringify({
                                action: "push_to_fulfillment",
                                pledgeIds: [backer.id],
                                projectId,
                              }),
                            });
                            if (!res.ok) {
                              const data = await res.json();
                              throw new Error(data.error || "Push failed");
                            }
                            toast.success(`Pushed order for ${backer.name} to fulfillment`);
                            onRefresh?.();
                          } catch (error) {
                            toast.error(error instanceof Error ? error.message : "Push failed");
                          }
                        }}>
                          <Send className="h-4 w-4 mr-2" />
                          Push to Fulfillment
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
