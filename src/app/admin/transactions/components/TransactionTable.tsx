"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  AlertCircle,
  Loader2,
  Eye,
  Copy,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import type { UnifiedTransaction, TransactionStats, Pagination } from "./types";
import { getTypeBadge, getStatusBadge, getProcessorBadge } from "./TransactionBadges";
import { formatCurrency, copyToClipboard } from "./utils";

interface TransactionTableProps {
  transactions: UnifiedTransaction[];
  stats: TransactionStats | null;
  pagination: Pagination;
  isLoading: boolean;
  activeTab: string;
  setActiveTab: (value: string) => void;
  fetchDetail: (txn: UnifiedTransaction) => void;
  fetchTransactions: (page: number) => void;
}

export function TransactionTable({
  transactions,
  stats,
  pagination,
  isLoading,
  activeTab,
  setActiveTab,
  fetchDetail,
  fetchTransactions,
}: TransactionTableProps) {
  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      {/* Scrollable tab bar — prevents overflow on mobile */}
      <div className="overflow-x-auto pb-1">
        <TabsList className="inline-flex w-max min-w-full">
          <TabsTrigger value="all" className="gap-1">
            All
            {stats && <Badge variant="secondary" className="ml-1 text-xs h-5">{stats.totalTransactions}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="pledge" className="gap-1">
            Pledges
            {stats && <Badge variant="secondary" className="ml-1 text-xs h-5">{stats.byType.PLEDGE}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="marketplace" className="gap-1">
            Marketplace
            {stats && <Badge variant="secondary" className="ml-1 text-xs h-5">{stats.byType.MARKETPLACE}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="dc_transaction" className="gap-1">
            DC Txns
            {stats && <Badge variant="secondary" className="ml-1 text-xs h-5">{stats.byType.DC_TRANSACTION}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="payout" className="gap-1">
            Payouts
            {stats && <Badge variant="secondary" className="ml-1 text-xs h-5">{stats.byType.PAYOUT}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="settlement" className="gap-1">
            Settlements
            {stats && <Badge variant="secondary" className="ml-1 text-xs h-5">{stats.byType.SETTLEMENT}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="indiekit_aftersale" className="gap-1">
            IndieKit
            {stats && <Badge variant="secondary" className="ml-1 text-xs h-5">{stats.byType.INDIEKIT_AFTERSALE}</Badge>}
          </TabsTrigger>
        </TabsList>
      </div>

      {/* All tabs share the same table/card content */}
      {["all", "pledge", "marketplace", "dc_transaction", "dc_redemption", "payout", "settlement", "indiekit_aftersale"].map((tab) => (
        <TabsContent key={tab} value={tab} className="mt-4">
          {isLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
              </CardContent>
            </Card>
          ) : transactions.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No transactions found</p>
                <p className="text-muted-foreground">Try adjusting your filters or search terms</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                {/* ── Desktop table (md and up) ── */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[140px]">Date</TableHead>
                        <TableHead className="w-[100px]">Type</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Project / Item</TableHead>
                        <TableHead className="text-right w-[100px]">Amount</TableHead>
                        <TableHead className="w-[100px]">Status</TableHead>
                        <TableHead className="w-[90px]">Processor</TableHead>
                        <TableHead>Transaction ID</TableHead>
                        <TableHead className="w-[60px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((txn) => (
                        <TableRow
                          key={`${txn.type}-${txn.id}`}
                          className={`cursor-pointer hover:bg-muted/50 ${
                            txn.status === "FAILED" ? "bg-red-50/50 dark:bg-red-950/10" :
                            txn.status === "CHARGEBACK" ? "bg-purple-50/50 dark:bg-purple-950/10" :
                            ""
                          }`}
                          onClick={() => fetchDetail(txn)}
                        >
                          <TableCell className="text-xs">
                            {format(new Date(txn.createdAt), "MMM d, yyyy")}
                            <br />
                            <span className="text-muted-foreground">
                              {format(new Date(txn.createdAt), "h:mm a")}
                            </span>
                          </TableCell>
                          <TableCell>{getTypeBadge(txn.type)}</TableCell>
                          <TableCell>
                            <div className="max-w-[180px]">
                              <p className="text-sm font-medium truncate">{txn.userName || "N/A"}</p>
                              <p className="text-xs text-muted-foreground truncate">{txn.userEmail}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="max-w-[200px]">
                              <p className="text-sm truncate">{txn.projectName || txn.itemDescription}</p>
                              {txn.projectName && txn.itemDescription !== txn.projectName && (
                                <p className="text-xs text-muted-foreground truncate">{txn.itemDescription}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(txn.amount)}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {getStatusBadge(txn.status)}
                              {txn.retryCount > 0 && (
                                <span className="text-xs text-yellow-600">
                                  {txn.retryCount} retries
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{getProcessorBadge(txn.paymentProcessor)}</TableCell>
                          <TableCell>
                            <div className="max-w-[160px]">
                              {txn.externalTransactionId ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-xs font-mono truncate">
                                    {txn.externalTransactionId}
                                  </span>
                                  <Copy
                                    className="h-3 w-3 cursor-pointer text-muted-foreground hover:text-foreground flex-shrink-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      copyToClipboard(txn.externalTransactionId!);
                                    }}
                                  />
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">N/A</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                fetchDetail(txn);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* ── Mobile card list (below md) ── */}
                <div className="md:hidden divide-y">
                  {transactions.map((txn) => (
                    <div
                      key={`mobile-${txn.type}-${txn.id}`}
                      className={`px-4 py-3 ${
                        txn.status === "FAILED" ? "bg-red-50/50 dark:bg-red-950/10" :
                        txn.status === "CHARGEBACK" ? "bg-purple-50/50 dark:bg-purple-950/10" :
                        ""
                      }`}
                    >
                      {/* Row 1: date + type badge + Eye button */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(txn.createdAt), "MMM d, yyyy")} &middot; {format(new Date(txn.createdAt), "h:mm a")}
                          </span>
                          {getTypeBadge(txn.type)}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 flex-shrink-0"
                          onClick={() => fetchDetail(txn)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Row 2: user */}
                      <div className="mb-1">
                        <p className="text-sm font-medium truncate">{txn.userName || "N/A"}</p>
                        <p className="text-xs text-muted-foreground truncate">{txn.userEmail}</p>
                      </div>

                      {/* Row 3: project / item */}
                      <div className="mb-2">
                        <p className="text-sm truncate">{txn.projectName || txn.itemDescription}</p>
                        {txn.projectName && txn.itemDescription !== txn.projectName && (
                          <p className="text-xs text-muted-foreground truncate">{txn.itemDescription}</p>
                        )}
                      </div>

                      {/* Row 4: amount + status + processor */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold">{formatCurrency(txn.amount)}</span>
                        {getStatusBadge(txn.status)}
                        {txn.retryCount > 0 && (
                          <span className="text-xs text-yellow-600">{txn.retryCount} retries</span>
                        )}
                        {getProcessorBadge(txn.paymentProcessor)}
                        {txn.externalTransactionId && (
                          <button
                            className="flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-foreground max-w-[140px]"
                            onClick={() => copyToClipboard(txn.externalTransactionId!)}
                          >
                            <span className="truncate">{txn.externalTransactionId}</span>
                            <Copy className="h-3 w-3 flex-shrink-0" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination — stacks on mobile */}
                {pagination.totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t px-4 py-3">
                    <p className="text-sm text-muted-foreground text-center sm:text-left">
                      Showing {(pagination.page - 1) * pagination.limit + 1}&ndash;{Math.min(pagination.page * pagination.limit, pagination.totalCount)} of {pagination.totalCount}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pagination.page <= 1}
                        onClick={() => fetchTransactions(pagination.page - 1)}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      <span className="text-sm whitespace-nowrap">
                        Page {pagination.page} of {pagination.totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pagination.page >= pagination.totalPages}
                        onClick={() => fetchTransactions(pagination.page + 1)}
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}
