import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  Search,
  RefreshCw,
  Loader2,
  BookOpen,
  User,
} from "lucide-react";
import { TransactionStatusBadge } from "./StatusBadges";
import { Transaction, TransactionStats } from "../types";

interface TransactionsTabProps {
  transactions: Transaction[];
  transactionStats: TransactionStats;
  isLoading: boolean;
  search: string;
  onSearchChange: (search: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onRefresh: () => void;
}

export function TransactionsTab({
  transactions,
  transactionStats,
  isLoading,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  page,
  totalPages,
  onPageChange,
  onRefresh,
}: TransactionsTabProps) {
  return (
    <div className="space-y-6">
      {/* Transaction Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <div className="p-4 rounded-xl bg-card border">
          <div className="flex items-center gap-2 text-emerald-600">
            <DollarSign className="w-4 h-4" />
            <span className="text-sm font-medium">Total Revenue</span>
          </div>
          <p className="text-2xl font-bold mt-1">${transactionStats.totalRevenue.toFixed(2)}</p>
        </div>
        <div className="p-4 rounded-xl bg-card border">
          <div className="flex items-center gap-2 text-purple-600">
            <ArrowUpRight className="w-4 h-4" />
            <span className="text-sm font-medium">Platform Fees</span>
          </div>
          <p className="text-2xl font-bold mt-1">${transactionStats.totalPlatformFees.toFixed(2)}</p>
        </div>
        <div className="p-4 rounded-xl bg-card border">
          <div className="flex items-center gap-2 text-blue-600">
            <ArrowDownRight className="w-4 h-4" />
            <span className="text-sm font-medium">Creator Payouts</span>
          </div>
          <p className="text-2xl font-bold mt-1">${transactionStats.totalCreatorPayouts.toFixed(2)}</p>
        </div>
        <div className="p-4 rounded-xl bg-card border">
          <div className="flex items-center gap-2 text-cyan-600">
            <CreditCard className="w-4 h-4" />
            <span className="text-sm font-medium">Total Transactions</span>
          </div>
          <p className="text-2xl font-bold mt-1">{transactionStats.totalTransactions}</p>
        </div>
        <div className="p-4 rounded-xl bg-card border">
          <div className="flex items-center gap-2 text-amber-600">
            <DollarSign className="w-4 h-4" />
            <span className="text-sm font-medium">Today Revenue</span>
          </div>
          <p className="text-2xl font-bold mt-1">${transactionStats.todayRevenue.toFixed(2)}</p>
        </div>
        <div className="p-4 rounded-xl bg-card border">
          <div className="flex items-center gap-2 text-pink-600">
            <ArrowUpRight className="w-4 h-4" />
            <span className="text-sm font-medium">Today Fees</span>
          </div>
          <p className="text-2xl font-bold mt-1">${transactionStats.todayPlatformFees.toFixed(2)}</p>
        </div>
        <div className="p-4 rounded-xl bg-card border">
          <div className="flex items-center gap-2 text-indigo-600">
            <CreditCard className="w-4 h-4" />
            <span className="text-sm font-medium">Today Sales</span>
          </div>
          <p className="text-2xl font-bold mt-1">{transactionStats.todayTransactions}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
          <Input
            placeholder="Search transactions..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 bg-muted/50 border-border text-foreground placeholder:text-muted-foreground/70"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          className="px-3 py-2 rounded-lg bg-muted/50 border border-border text-foreground"
        >
          <option value="all">All Status</option>
          <option value="COMPLETED">Completed</option>
          <option value="PENDING">Pending</option>
          <option value="FAILED">Failed</option>
          <option value="REFUNDED">Refunded</option>
        </select>
        <Button
          onClick={onRefresh}
          variant="outline"
          size="sm"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Transactions List */}
      <div className="rounded-xl bg-muted/50 border border-border overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="font-medium text-foreground">Transaction History</h3>
        </div>
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No transactions found</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Book</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Buyer</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Creator</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Amount</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Platform Fee</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Creator Payout</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">Payment</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                          {tx.book.coverImage ? (
                            <Image
                              src={tx.book.coverImage}
                              alt={tx.book.title}
                              width={40}
                              height={40}
                              className="object-cover w-full h-full"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <BookOpen className="w-4 h-4 text-muted-foreground/50" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate max-w-[200px]">{tx.book.title}</p>
                          <p className="text-xs text-muted-foreground">{tx.id.slice(0, 8)}...</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-muted flex-shrink-0">
                          {tx.buyer.avatar ? (
                            <Image
                              src={tx.buyer.avatar}
                              alt={tx.buyer.name || ""}
                              width={32}
                              height={32}
                              className="object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <User className="w-4 h-4 text-muted-foreground/50" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{tx.buyer.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{tx.buyer.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{tx.book.creator.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{tx.book.creator.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold text-emerald-600">${tx.amount.toFixed(2)}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-purple-600">${tx.platformFee.toFixed(2)}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-blue-600">${tx.creatorPayout.toFixed(2)}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant="outline" className="text-xs">
                        {tx.paymentProcessor === "STRIPE" ? "Stripe" : tx.paymentProcessor === "DIVINITYCOIN" ? "DivinityCoin" : tx.paymentProcessor}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <TransactionStatusBadge status={tx.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-foreground">
                        {new Date(tx.createdAt).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(tx.createdAt).toLocaleTimeString()}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-border flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(Math.max(1, page - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
