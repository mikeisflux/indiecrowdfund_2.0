"use client";

import Image from "next/image";
import {
  ArrowLeft,
  User,
  Building,
  CheckCircle,
  Clock,
  Loader2,
  XCircle,
  AlertCircle,
  AlertTriangle,
  RotateCcw,
  DollarSign,
  Eye,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { format } from "date-fns";
import { CreatorProject } from "./types";
import { getSettlementBadge } from "./SettlementBadge";

interface ProjectDetailDialogProps {
  selectedProject: CreatorProject | null;
  onClose: () => void;
  onViewBankDetails: (bankAccountId: string) => void;
  onCreateSettlement: (amount: string) => void;
  formatCurrency: (amount: number) => string;
}

export function ProjectDetailDialog({
  selectedProject,
  onClose,
  onViewBankDetails,
  onCreateSettlement,
  formatCurrency,
}: ProjectDetailDialogProps) {
  return (
    <Dialog open={!!selectedProject} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {selectedProject && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2"
                  onClick={onClose}
                >
                  <ArrowLeft className="w-3 h-3 mr-1" />
                  Back
                </Button>
              </div>
              <DialogTitle className="flex items-center gap-3">
                {selectedProject.imageUrl && (
                  <Image
                    src={selectedProject.imageUrl}
                    alt={selectedProject.title}
                    width={64}
                    height={48}
                    className="w-16 h-12 rounded object-cover"
                  />
                )}
                <div>
                  <span className="block">{selectedProject.title}</span>
                  <span className="text-sm font-normal text-muted-foreground">
                    by {selectedProject.creator.name || "Unknown"}
                  </span>
                </div>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6 mt-4">
              {/* Payout Status */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 dark:bg-zinc-800">
                <div>
                  <p className="text-sm text-muted-foreground">Payout Status</p>
                  <div className="mt-1">{getSettlementBadge(selectedProject.settlementStatus)}</div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">
                    {selectedProject.remainingAmount < 0 ? "Creator Owes Back" : "Remaining to Pay"}
                  </p>
                  <p className={`text-2xl font-bold ${
                    selectedProject.remainingAmount < 0 ? "text-red-600" :
                    selectedProject.remainingAmount > 0 ? "text-yellow-600" : "text-emerald-600"
                  }`}>
                    {selectedProject.remainingAmount < 0
                      ? `-${formatCurrency(Math.abs(selectedProject.remainingAmount))}`
                      : formatCurrency(selectedProject.remainingAmount)
                    }
                  </p>
                </div>
              </div>

              {/* Overpaid Warning */}
              {selectedProject.remainingAmount < 0 && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <AlertTitle className="text-red-800">Creator Overpaid</AlertTitle>
                  <AlertDescription className="text-red-700">
                    This creator has been paid {formatCurrency(Math.abs(selectedProject.remainingAmount))} more than owed due to refunds issued after settlement.
                    This amount should be recovered from the creator or deducted from future payouts.
                  </AlertDescription>
                </Alert>
              )}

              {/* No Bank Warning */}
              {!selectedProject.hasBank && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>No Bank Account</AlertTitle>
                  <AlertDescription>
                    This creator has not added a bank account. Contact them to add their bank details before processing payout.
                  </AlertDescription>
                </Alert>
              )}

              {/* Fee Breakdown */}
              <div>
                <h4 className="font-medium mb-3">Financial Summary</h4>
                <div className="space-y-2 text-sm bg-muted/50 dark:bg-zinc-800 rounded-lg p-4">
                  <div className="flex justify-between">
                    <span>Total Raised (Completed Pledges)</span>
                    <span className="font-medium">{formatCurrency(selectedProject.totalRaised)}</span>
                  </div>
                  {selectedProject.totalRefunded > 0 && (
                    <>
                      {selectedProject.fullRefundTotal > 0 && (
                        <div className="flex justify-between text-red-500">
                          <span>Full Refunds ({selectedProject.fullRefundCount} pledge{selectedProject.fullRefundCount !== 1 ? "s" : ""})</span>
                          <span>already excluded</span>
                        </div>
                      )}
                      {selectedProject.partialRefundTotal > 0 && (
                        <div className="flex justify-between text-red-500">
                          <span>Partial Refunds ({selectedProject.partialRefundCount})</span>
                          <span>-{formatCurrency(selectedProject.partialRefundTotal)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-medium">
                        <span>Effective Revenue</span>
                        <span>{formatCurrency(selectedProject.effectiveRevenue)}</span>
                      </div>
                    </>
                  )}
                  {(() => {
                    const proc = selectedProject.paymentProcessor;
                    const label =
                      proc === "DIVINITYCOIN" ? "Divinity Payments Partner Fee (3%)"
                      : proc === "WHOP" ? "Whop Processing Fee (~3%)"
                      : proc === "PAYPAL" ? "PayPal Processing Fee (3.49%)"
                      : "Processor Fee";
                    const perTxnRate =
                      proc === "DIVINITYCOIN" ? 0.30
                      : proc === "PAYPAL" ? 0.49
                      : 0;
                    return (
                      <>
                        <div className="flex justify-between text-muted-foreground">
                          <span>{label}</span>
                          <span className="text-red-500">-{formatCurrency(selectedProject.processorFee)}</span>
                        </div>
                        {perTxnRate > 0 && (
                          <div className="flex justify-between text-muted-foreground">
                            <span>Per-Transaction Fee ({selectedProject.backerCount} × ${perTxnRate.toFixed(2)})</span>
                            <span className="text-red-500">-{formatCurrency(selectedProject.perTransactionFee)}</span>
                          </div>
                        )}
                      </>
                    );
                  })()}
                  <div className="flex justify-between text-muted-foreground">
                    <span>Platform Fee (3%)</span>
                    <span className="text-red-500">-{formatCurrency(selectedProject.platformFee)}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between font-bold">
                    <span>Amount Owed to Creator</span>
                    <span>{formatCurrency(selectedProject.amountOwed)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-600">
                    <span>Already Settled</span>
                    <span>-{formatCurrency(selectedProject.amountSettled)}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between font-bold text-lg">
                    <span>{selectedProject.remainingAmount < 0 ? "Creator Owes Back" : "Remaining"}</span>
                    <span className={
                      selectedProject.remainingAmount < 0 ? "text-red-600" :
                      selectedProject.remainingAmount > 0 ? "text-yellow-600" : "text-emerald-600"
                    }>
                      {selectedProject.remainingAmount < 0
                        ? `-${formatCurrency(Math.abs(selectedProject.remainingAmount))}`
                        : formatCurrency(selectedProject.remainingAmount)
                      }
                    </span>
                  </div>
                </div>
              </div>

              {/* Refund History */}
              {selectedProject.refunds.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 text-red-500" />
                    Refund History ({selectedProject.refunds.length})
                  </h4>
                  <div className="space-y-2">
                    {selectedProject.refunds.map((refund) => (
                      <div key={refund.id} className="flex items-center justify-between p-3 rounded-lg border border-red-100 bg-red-50/50">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center bg-red-100">
                            <RotateCcw className="w-4 h-4 text-red-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">
                              {refund.type === "full" ? "Full Refund" : "Partial Refund"}: {formatCurrency(refund.amount)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {refund.backerName || refund.backerEmail || "Unknown backer"}
                              {refund.reason && ` — ${refund.reason}`}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" className="text-red-600 border-red-300 text-xs">
                            {refund.type === "full" ? "Full" : "Partial"}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(refund.date), "MMM d, yyyy")}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-red-200">
                      <div className="flex justify-between text-sm font-bold text-red-600">
                        <span>Total Refunded</span>
                        <span>{formatCurrency(selectedProject.totalRefunded)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Creator & Bank Info */}
              <div>
                <h4 className="font-medium mb-3">Creator Information</h4>
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                      <User className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">{selectedProject.creator.name || "Unknown"}</p>
                      <p className="text-sm text-muted-foreground">{selectedProject.creator.email}</p>
                    </div>
                  </div>
                  {selectedProject.creator.bankAccount && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onViewBankDetails(selectedProject.creator.bankAccount!.id)}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View Bank Details
                    </Button>
                  )}
                </div>
              </div>

              {/* Bank Account Preview */}
              {selectedProject.creator.bankAccount && (
                <div>
                  <h4 className="font-medium mb-3">Bank Account</h4>
                  <div className="p-4 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <Building className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{selectedProject.creator.bankAccount.bankName || "Bank Account"}</p>
                        <p className="text-sm text-muted-foreground">
                          {selectedProject.creator.bankAccount.accountType} ending in ****{selectedProject.creator.bankAccount.accountLastFour}
                        </p>
                      </div>
                      {selectedProject.creator.bankAccount.isVerified ? (
                        <Badge className="ml-auto bg-emerald-100 text-emerald-700">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Verified
                        </Badge>
                      ) : (
                        <Badge className="ml-auto bg-yellow-100 text-yellow-700">
                          <Clock className="w-3 h-3 mr-1" />
                          Unverified
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Settlement History */}
              {selectedProject.settlements.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3">Settlement History</h4>
                  <div className="space-y-2">
                    {selectedProject.settlements.map((settlement) => (
                      <div key={settlement.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            settlement.status === "COMPLETED" ? "bg-emerald-100" :
                            settlement.status === "PROCESSING" ? "bg-blue-100" :
                            settlement.status === "FAILED" ? "bg-red-100" : "bg-yellow-100"
                          }`}>
                            {settlement.status === "COMPLETED" ? (
                              <CheckCircle className="w-4 h-4 text-emerald-600" />
                            ) : settlement.status === "PROCESSING" ? (
                              <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                            ) : settlement.status === "FAILED" ? (
                              <XCircle className="w-4 h-4 text-red-600" />
                            ) : (
                              <Clock className="w-4 h-4 text-yellow-600" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">{formatCurrency(settlement.amount)}</p>
                            <p className="text-xs text-muted-foreground">
                              {settlement.completedAt
                                ? `Completed ${format(new Date(settlement.completedAt), "MMM d, yyyy")}`
                                : settlement.processedAt
                                ? `Processing since ${format(new Date(settlement.processedAt), "MMM d, yyyy")}`
                                : "Pending"
                              }
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline">
                          {settlement.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="mt-6">
              {selectedProject.hasBank && selectedProject.remainingAmount > 0 && (
                <Button
                  onClick={() => onCreateSettlement(Number(selectedProject.remainingAmount).toFixed(2))}
                  className="bg-teal-600 hover:bg-teal-700"
                >
                  <DollarSign className="w-4 h-4 mr-2" />
                  Create Settlement
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

