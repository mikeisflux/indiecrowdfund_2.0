"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  ArrowLeft,
  AlertTriangle,
  ExternalLink,
  Copy,
} from "lucide-react";
import { format } from "date-fns";
import type { UnifiedTransaction, TransactionDetail } from "./types";
import { getTypeBadge, getStatusBadge, getProcessorBadge } from "./TransactionBadges";
import { formatCurrency, copyToClipboard } from "./utils";

interface TransactionDetailDialogProps {
  selectedTransaction: UnifiedTransaction | null;
  transactionDetail: TransactionDetail | null;
  isLoadingDetail: boolean;
  onClose: () => void;
  onStripeLookup: (id: string) => void;
}

export function TransactionDetailDialog({
  selectedTransaction,
  transactionDetail,
  isLoadingDetail,
  onClose,
  onStripeLookup,
}: TransactionDetailDialogProps) {
  if (!selectedTransaction) return null;

  return (
    <Dialog
      open={!!selectedTransaction}
      onOpenChange={() => {
        onClose();
      }}
    >
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeft
              className="h-5 w-5 cursor-pointer hover:text-emerald-600"
              onClick={() => {
                onClose();
              }}
            />
            Transaction Detail
            {getTypeBadge(selectedTransaction.type)}
            {getStatusBadge(selectedTransaction.status)}
          </DialogTitle>
        </DialogHeader>

        {isLoadingDetail ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          </div>
        ) : transactionDetail ? (
          <div className="space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Amount</p>
                <p className="text-lg font-bold">{formatCurrency(selectedTransaction.amount)}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Processor</p>
                <p className="text-sm font-medium mt-1">{getProcessorBadge(selectedTransaction.paymentProcessor)}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Created</p>
                <p className="text-sm font-medium">{format(new Date(selectedTransaction.createdAt), "MMM d, yyyy h:mm a")}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">ID</p>
                <div className="flex items-center gap-1">
                  <p className="text-xs font-mono truncate">{selectedTransaction.id}</p>
                  <Copy className="h-3 w-3 cursor-pointer text-muted-foreground hover:text-foreground flex-shrink-0" onClick={() => copyToClipboard(selectedTransaction.id)} />
                </div>
              </div>
            </div>

            {/* User Info */}
            {transactionDetail.user && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">User Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Name:</span>{" "}
                      <span className="font-medium">{transactionDetail.user.name || "N/A"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Email:</span>{" "}
                      <span className="font-medium">{transactionDetail.user.email}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">User ID:</span>{" "}
                      <span className="font-mono text-xs">{transactionDetail.user.id}</span>
                    </div>
                    {transactionDetail.user.stripeCustomerId && (
                      <div>
                        <span className="text-muted-foreground">Stripe Customer:</span>{" "}
                        <span className="font-mono text-xs">{transactionDetail.user.stripeCustomerId}</span>
                      </div>
                    )}
                    {transactionDetail.user.divinityCoinBalance !== undefined && (
                      <div>
                        <span className="text-muted-foreground">DC Balance:</span>{" "}
                        <span className="font-medium">{formatCurrency(transactionDetail.user.divinityCoinBalance)}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Project/Book Info */}
            {(transactionDetail.project || transactionDetail.book) && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">
                    {transactionDetail.book ? "Book Information" : "Project Information"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {transactionDetail.project && (
                      <>
                        <div>
                          <span className="text-muted-foreground">Title:</span>{" "}
                          <span className="font-medium">{transactionDetail.project.title}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Status:</span>{" "}
                          <span>{transactionDetail.project.status}</span>
                        </div>
                        {transactionDetail.project.fundingGoal && (
                          <div>
                            <span className="text-muted-foreground">Funding:</span>{" "}
                            <span>{formatCurrency(transactionDetail.project.currentFunding)} / {formatCurrency(transactionDetail.project.fundingGoal)}</span>
                          </div>
                        )}
                        {transactionDetail.project.creator && (
                          <div>
                            <span className="text-muted-foreground">Creator:</span>{" "}
                            <span>{transactionDetail.project.creator.name || transactionDetail.project.creator.email}</span>
                          </div>
                        )}
                      </>
                    )}
                    {transactionDetail.book && (
                      <>
                        <div>
                          <span className="text-muted-foreground">Title:</span>{" "}
                          <span className="font-medium">{transactionDetail.book.title}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Price:</span>{" "}
                          <span>{formatCurrency(transactionDetail.book.price)}</span>
                        </div>
                        {transactionDetail.book.creator && (
                          <div>
                            <span className="text-muted-foreground">Creator:</span>{" "}
                            <span>{transactionDetail.book.creator.name || transactionDetail.book.creator.email}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Payment Details */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Payment Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {transactionDetail.record.stripePaymentIntentId && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Stripe Payment Intent:</span>{" "}
                      <span className="font-mono text-xs">{transactionDetail.record.stripePaymentIntentId}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1 ml-1"
                        onClick={() => {
                          onStripeLookup(transactionDetail.record.stripePaymentIntentId);
                        }}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1"
                        onClick={() => copyToClipboard(transactionDetail.record.stripePaymentIntentId)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  {transactionDetail.record.stripeSetupIntentId && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Stripe Setup Intent:</span>{" "}
                      <span className="font-mono text-xs">{transactionDetail.record.stripeSetupIntentId}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1 ml-1"
                        onClick={() => {
                          onStripeLookup(transactionDetail.record.stripeSetupIntentId);
                        }}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1"
                        onClick={() => copyToClipboard(transactionDetail.record.stripeSetupIntentId)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  {transactionDetail.record.stripePaymentMethodId && (
                    <div>
                      <span className="text-muted-foreground">Payment Method:</span>{" "}
                      <span className="font-mono text-xs">{transactionDetail.record.stripePaymentMethodId}</span>
                    </div>
                  )}
                  {transactionDetail.record.stripeCustomerId && (
                    <div>
                      <span className="text-muted-foreground">Stripe Customer:</span>{" "}
                      <span className="font-mono text-xs">{transactionDetail.record.stripeCustomerId}</span>
                    </div>
                  )}
                  {transactionDetail.record.divinityCoinPaymentId && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">DC Payment ID:</span>{" "}
                      <span className="font-mono text-xs">{transactionDetail.record.divinityCoinPaymentId}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1 ml-1"
                        onClick={() => copyToClipboard(transactionDetail.record.divinityCoinPaymentId)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  {transactionDetail.record.chargedImmediately !== undefined && (
                    <div>
                      <span className="text-muted-foreground">Charged Immediately:</span>{" "}
                      <span>{transactionDetail.record.chargedImmediately ? "Yes" : "No"}</span>
                    </div>
                  )}
                  {transactionDetail.record.backerNumber && (
                    <div>
                      <span className="text-muted-foreground">Backer #:</span>{" "}
                      <span className="font-medium">#{transactionDetail.record.backerNumber}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Amount Breakdown (for pledges) */}
            {transactionDetail.record.rewardAmount !== undefined && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Amount Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Reward Amount:</span>
                      <span>{formatCurrency(transactionDetail.record.rewardAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Add-ons Amount:</span>
                      <span>{formatCurrency(transactionDetail.record.addonsAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Shipping Amount:</span>
                      <span>{formatCurrency(transactionDetail.record.shippingAmount)}</span>
                    </div>
                    <div className="flex justify-between font-medium border-t pt-1 mt-1">
                      <span>Total:</span>
                      <span>{formatCurrency(transactionDetail.record.amount)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Fee Breakdown (for payouts) */}
            {transactionDetail.record.grossAmount !== undefined && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Fee Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Gross Amount:</span>
                      <span>{formatCurrency(transactionDetail.record.grossAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Processor Fees:</span>
                      <span className="text-red-600">-{formatCurrency(transactionDetail.record.processorFees)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Platform Fees:</span>
                      <span className="text-red-600">-{formatCurrency(transactionDetail.record.platformFees)}</span>
                    </div>
                    <div className="flex justify-between font-medium border-t pt-1 mt-1">
                      <span>Net Payout:</span>
                      <span>{formatCurrency(transactionDetail.record.amount)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Marketplace Fee Breakdown */}
            {transactionDetail.record.platformFee !== undefined && transactionDetail.type === "MARKETPLACE" && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Fee Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sale Amount:</span>
                      <span>{formatCurrency(transactionDetail.record.amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Platform Fee:</span>
                      <span className="text-red-600">-{formatCurrency(transactionDetail.record.platformFee)}</span>
                    </div>
                    <div className="flex justify-between font-medium border-t pt-1 mt-1">
                      <span>Creator Payout:</span>
                      <span>{formatCurrency(transactionDetail.record.creatorPayout)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Retry Info */}
            {transactionDetail.record.retryCount > 0 && (
              <Card className="border-yellow-200 dark:border-yellow-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    Retry Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Retry Count:</span>{" "}
                      <span className="font-medium">{transactionDetail.record.retryCount}</span>
                    </div>
                    {transactionDetail.record.nextRetryAt && (
                      <div>
                        <span className="text-muted-foreground">Next Retry:</span>{" "}
                        <span>{format(new Date(transactionDetail.record.nextRetryAt), "MMM d, yyyy h:mm a")}</span>
                      </div>
                    )}
                    {transactionDetail.record.lastFailureReason && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Last Failure:</span>{" "}
                        <span className="text-red-600">{transactionDetail.record.lastFailureReason}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Reward & Addons */}
            {transactionDetail.reward && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Reward</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm">
                    <p className="font-medium">{transactionDetail.reward.title}</p>
                    <p className="text-muted-foreground">{formatCurrency(transactionDetail.reward.amount)} - {transactionDetail.reward.type}</p>
                  </div>
                  {transactionDetail.addons && transactionDetail.addons.length > 0 && (
                    <div className="mt-3 border-t pt-3">
                      <p className="text-sm font-medium mb-2">Add-ons:</p>
                      {transactionDetail.addons.map((addon: { id: string; addon: { title: string }; quantity: number; amount: number }) => (
                        <div key={addon.id} className="flex justify-between text-sm">
                          <span>{addon.addon.title} x{addon.quantity}</span>
                          <span>{formatCurrency(addon.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Timeline */}
            {transactionDetail.timeline && transactionDetail.timeline.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Event Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {transactionDetail.timeline.map((event: { event: string; detail?: string; date: string }, idx: number) => (
                      <div key={idx} className="flex gap-3 text-sm">
                        <div className="flex-shrink-0 w-2 h-2 rounded-full bg-emerald-500 mt-1.5" />
                        <div>
                          <p className="font-medium">{event.event}</p>
                          {event.detail && (
                            <p className="text-muted-foreground text-xs">{event.detail}</p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(event.date), "MMM d, yyyy h:mm:ss a")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Fulfillment Status */}
            {transactionDetail.record.fulfillmentStatus && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Fulfillment</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Status:</span>{" "}
                      {getStatusBadge(transactionDetail.record.fulfillmentStatus)}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Survey:</span>{" "}
                      <span>{transactionDetail.record.surveyCompleted ? "Completed" : "Not completed"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Confirmation Email:</span>{" "}
                      <span>{transactionDetail.record.confirmationEmailSent ? "Sent" : "Not sent"}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Download Info (for marketplace) */}
            {transactionDetail.record.downloadCount !== undefined && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Delivery Info</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Downloads:</span>{" "}
                      <span className="font-medium">{transactionDetail.record.downloadCount}</span>
                    </div>
                    {transactionDetail.record.lastDownloadedAt && (
                      <div>
                        <span className="text-muted-foreground">Last Download:</span>{" "}
                        <span>{format(new Date(transactionDetail.record.lastDownloadedAt), "MMM d, yyyy")}</span>
                      </div>
                    )}
                    {transactionDetail.record.deliveredAt && (
                      <div>
                        <span className="text-muted-foreground">Delivered:</span>{" "}
                        <span>{format(new Date(transactionDetail.record.deliveredAt), "MMM d, yyyy")}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Discount Code (for marketplace) */}
            {transactionDetail.discountCode && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Discount Code Used</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Code:</span>{" "}
                      <span className="font-mono">{transactionDetail.discountCode.code}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Type:</span>{" "}
                      <span>{transactionDetail.discountCode.type}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Discount:</span>{" "}
                      <span>{formatCurrency(transactionDetail.discountCode.discountAmount)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Raw Data */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  Raw Record Data
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 px-2 text-xs"
                    onClick={() => copyToClipboard(JSON.stringify(transactionDetail.record, null, 2))}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-muted/50 rounded-lg p-3 overflow-x-auto max-h-60 overflow-y-auto">
                  {JSON.stringify(transactionDetail.record, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">Failed to load details</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
