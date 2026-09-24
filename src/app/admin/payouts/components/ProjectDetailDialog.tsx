"use client";

import { useState } from "react";
import Image from "next/image";
import {
  ArrowLeft,
  User,
  Building,
  CheckCircle,
  Clock,
  CreditCard,
  Loader2,
  XCircle,
  AlertCircle,
  AlertTriangle,
  RotateCcw,
  DollarSign,
  Eye,
  FileCheck,
  FileClock,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/fetch-utils";
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
  const [sendingRequest, setSendingRequest] = useState(false);

  // Full chargeback-card reveal (decrypted server-side, audit-logged).
  interface RevealedCard {
    vaultOnly?: boolean;
    vaultId?: string | null;
    cardNumber?: string;
    expMonth?: string | number;
    expYear?: string | number;
    cvc?: string | null;
    billingName?: string | null;
    billingLine1?: string | null;
    billingLine2?: string | null;
    billingCity?: string | null;
    billingState?: string | null;
    billingZip?: string | null;
    billingCountry?: string | null;
    lastFour?: string;
    brand?: string | null;
  }
  const [revealedCard, setRevealedCard] = useState<RevealedCard | null>(null);
  const [revealedForProject, setRevealedForProject] = useState<string | null>(null);
  const [isRevealing, setIsRevealing] = useState(false);

  const handleRevealCard = async (projectId: string) => {
    if (revealedForProject === projectId && revealedCard) {
      // Toggle off
      setRevealedCard(null);
      setRevealedForProject(null);
      return;
    }
    setIsRevealing(true);
    try {
      const res = await apiFetch(`/api/projects/${projectId}/chargeback-card`, {
        method: "PUT",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to load card details");
      setRevealedCard(data);
      setRevealedForProject(projectId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load card details");
    } finally {
      setIsRevealing(false);
    }
  };

  const formatCardNumber = (num?: string) =>
    num ? num.replace(/(.{4})/g, "$1 ").trim() : "";
  // projectId -> creator email the request was sent to (this admin session
  // only). The dialog stays mounted across project selections, so track
  // per-project rather than a single flag.
  const [sentRequests, setSentRequests] = useState<Record<string, string>>({});

  const sendAgreementRequest = async (projectId: string) => {
    if (sendingRequest) return;
    setSendingRequest(true);
    try {
      const res = await apiFetch("/api/admin/grant-agreement-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || "Failed to send the agreement request");
        return;
      }
      setSentRequests((prev) => ({ ...prev, [projectId]: data?.to || "creator" }));
      toast.success(`Grant agreement request emailed to ${data?.to || "the creator"}`);
    } catch {
      toast.error("Failed to send the agreement request");
    } finally {
      setSendingRequest(false);
    }
  };

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

              {/* Grant Agreement */}
              <div>
                <h4 className="font-medium mb-3">Grant Agreement</h4>
                {selectedProject.grantAgreement?.signed ? (
                  <div className="p-4 rounded-lg border border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-900/10">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
                        <FileCheck className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm">
                          Signed
                          {selectedProject.grantAgreement.acceptedAt &&
                            ` on ${format(new Date(selectedProject.grantAgreement.acceptedAt), "MMM d, yyyy")}`}
                          {selectedProject.grantAgreement.version &&
                            ` (v${selectedProject.grantAgreement.version})`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {selectedProject.grantAgreement.taxLegalName || "No legal name on file"}
                          {selectedProject.grantAgreement.taxEntityType &&
                            ` · ${selectedProject.grantAgreement.taxEntityType.charAt(0)}${selectedProject.grantAgreement.taxEntityType.slice(1).toLowerCase()}`}
                          {selectedProject.grantAgreement.taxIdLast4 &&
                            ` · TIN ****${selectedProject.grantAgreement.taxIdLast4}`}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-900/10">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
                          <FileClock className="w-4 h-4 text-amber-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm">Not signed</p>
                          <p className="text-xs text-muted-foreground">
                            {sentRequests[selectedProject.id]
                              ? `Request emailed to ${sentRequests[selectedProject.id]}`
                              : "A signed agreement (with tax info) is required before a payout can be created."}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        disabled={sendingRequest}
                        onClick={() => sendAgreementRequest(selectedProject.id)}
                      >
                        {sendingRequest ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4 mr-2" />
                        )}
                        {sentRequests[selectedProject.id] ? "Resend request" : "Send agreement request"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

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
                      : proc === "WHOP" ? "Whop Processing Fee (3.5% + $0.37/txn)"
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
                    <span>Grant Administration Fee (3%)</span>
                    <span className="text-red-500">-{formatCurrency(selectedProject.platformFee)}</span>
                  </div>
                  {selectedProject.isInternational && (
                    <>
                      <div className="flex justify-between text-muted-foreground">
                        <span>International Wire Fee ({selectedProject.bankCountry})</span>
                        <span className="text-red-500">-{formatCurrency(selectedProject.wireFee)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Currency Conversion Fee (1.5%)</span>
                        <span className="text-red-500">-{formatCurrency(selectedProject.currencyConversionFee)}</span>
                      </div>
                    </>
                  )}
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

              {/* Chargeback Protection Card — the recoup target when the
                  balance goes negative (refunds/chargebacks after payout). */}
              <div>
                <h4 className="font-medium mb-3">Chargeback Protection Card</h4>
                {selectedProject.chargebackCard ? (
                  <div className="p-4 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <CreditCard className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">
                          {selectedProject.chargebackCard.cardBrand || "Card"} ending in ****{selectedProject.chargebackCard.cardLastFour}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Expires {String(selectedProject.chargebackCard.expMonth).padStart(2, "0")}/{selectedProject.chargebackCard.expYear}
                          {" · "}
                          {selectedProject.chargebackCard.source === "project"
                            ? "Saved for this project"
                            : "Account-wide card"}
                        </p>
                      </div>
                      <div className="ml-auto flex flex-col items-end gap-1">
                        {selectedProject.chargebackCard.expired ? (
                          <Badge className="bg-red-100 text-red-700">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Expired
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-100 text-emerald-700">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Active
                          </Badge>
                        )}
                        {selectedProject.chargebackCard.vaultTokenized ? (
                          <Badge variant="outline" className="text-emerald-700 border-emerald-300">
                            Vault — auto-chargeable
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-700 border-amber-300">
                            Card on file — charge manually
                          </Badge>
                        )}
                      </div>
                    </div>
                    {selectedProject.remainingAmount < 0 && selectedProject.chargebackCard.expired && (
                      <p className="mt-3 text-xs text-red-600">
                        This card is expired — a recoup charge for the amount owed back will decline.
                        Ask the creator to update their chargeback card.
                      </p>
                    )}

                    {selectedProject.chargebackCard.source === "project" ? (
                      <div className="mt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRevealCard(selectedProject.id)}
                          disabled={isRevealing}
                        >
                          {isRevealing
                            ? "Decrypting..."
                            : revealedForProject === selectedProject.id
                              ? "Hide card details"
                              : "View card details"}
                        </Button>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Views are audit-logged.
                        </p>
                      </div>
                    ) : (
                      <p className="mt-3 text-xs text-muted-foreground">
                        Account-wide card — the number is held in the PaymentCloud Customer Vault
                        (never stored here). Charge it from PaymentCloud using the vault record.
                      </p>
                    )}

                    {revealedForProject === selectedProject.id && revealedCard && (
                      revealedCard.vaultOnly ? (
                        <div className="mt-3 rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
                          <p className="font-medium">Stored in the PaymentCloud Customer Vault</p>
                          <p className="text-muted-foreground">
                            The full number never touches our database for vaulted cards — charge it
                            through PaymentCloud{revealedCard.vaultId ? <> (vault ID <span className="font-mono">{revealedCard.vaultId}</span>)</> : null}.
                          </p>
                        </div>
                      ) : (
                        <div className="mt-3 rounded-lg border bg-muted/40 p-3 text-sm space-y-1.5">
                          <p className="font-mono text-base tracking-wide">
                            {formatCardNumber(revealedCard.cardNumber)}
                          </p>
                          <p>
                            <span className="text-muted-foreground">Exp:</span>{" "}
                            {String(revealedCard.expMonth).padStart(2, "0")}/{revealedCard.expYear}
                            {revealedCard.cvc && (
                              <>
                                {" · "}
                                <span className="text-muted-foreground">CVC:</span> {revealedCard.cvc}
                              </>
                            )}
                          </p>
                          {revealedCard.billingName && (
                            <div className="pt-1 text-muted-foreground">
                              <p className="text-foreground">{revealedCard.billingName}</p>
                              {revealedCard.billingLine1 && <p>{revealedCard.billingLine1}</p>}
                              {revealedCard.billingLine2 && <p>{revealedCard.billingLine2}</p>}
                              <p>
                                {[revealedCard.billingCity, revealedCard.billingState, revealedCard.billingZip]
                                  .filter(Boolean)
                                  .join(", ")}
                              </p>
                              {revealedCard.billingCountry && <p>{revealedCard.billingCountry}</p>}
                            </div>
                          )}
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <Alert
                    variant={selectedProject.remainingAmount < 0 ? "destructive" : "default"}
                  >
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No chargeback card on file</AlertTitle>
                    <AlertDescription>
                      {selectedProject.remainingAmount < 0
                        ? "This creator owes money back and there is no card to recoup against. Recovery will have to be manual."
                        : "There is no card to charge if refunds or chargebacks push this project's balance negative after payout."}
                    </AlertDescription>
                  </Alert>
                )}
              </div>

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
                <div className="flex flex-col items-end gap-1.5">
                  <Button
                    onClick={() => onCreateSettlement(Number(selectedProject.remainingAmount).toFixed(2))}
                    className="bg-teal-600 hover:bg-teal-700"
                    disabled={!selectedProject.grantAgreement?.signed}
                  >
                    <DollarSign className="w-4 h-4 mr-2" />
                    Create Settlement
                  </Button>
                  {!selectedProject.grantAgreement?.signed && (
                    <p className="text-xs text-muted-foreground">
                      Blocked until the creator signs the Grant Agreement.
                    </p>
                  )}
                </div>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

