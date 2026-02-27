"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DollarSign,
  ShoppingCart,
  CreditCard,
  Search,
  RefreshCw,
  Loader2,
  Receipt,
} from "lucide-react";
import { toast } from "sonner";

interface Transaction {
  id: string;
  type: "pledge" | "aftersale";
  backerName: string | null;
  backerEmail: string;
  amount: number;
  description: string;
  paymentProcessor: string;
  stripePaymentIntentId: string | null;
  status: string;
  date: string;
}

interface TransactionStats {
  totalPledges: number;
  totalPledgeRevenue: number;
  aftersaleCount: number;
  totalAftersaleRevenue: number;
  totalRevenue: number;
}

interface TransactionHistoryTabProps {
  projectId: string;
}

export function TransactionHistoryTab({ projectId }: TransactionHistoryTabProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<TransactionStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "pledge" | "aftersale">("all");

  const fetchTransactions = useCallback(async () => {
    if (!projectId) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/creator/indiekit/transactions?projectId=${projectId}`);
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      setTransactions(data.transactions);
      setStats(data.stats);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      toast.error("Failed to load transaction history");
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const filtered = transactions.filter((t) => {
    if (typeFilter !== "all" && t.type !== typeFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        (t.backerName?.toLowerCase().includes(q)) ||
        t.backerEmail.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.stripePaymentIntentId?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-100">
                  <DollarSign className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100">
                  <CreditCard className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatCurrency(stats.totalPledgeRevenue)}</p>
                  <p className="text-sm text-muted-foreground">{stats.totalPledges} Pledges</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-100">
                  <ShoppingCart className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatCurrency(stats.totalAftersaleRevenue)}</p>
                  <p className="text-sm text-muted-foreground">{stats.aftersaleCount} Aftersales</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-100">
                  <Receipt className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{transactions.length}</p>
                  <p className="text-sm text-muted-foreground">Total Transactions</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Transaction History
          </CardTitle>
          <CardDescription>
            All payments including original pledges and post-campaign add-on purchases from surveys
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as "all" | "pledge" | "aftersale")}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="pledge">Pledges Only</SelectItem>
                <SelectItem value="aftersale">Aftersales Only</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={fetchTransactions}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <Receipt className="h-12 w-12 mx-auto text-zinc-300 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Transactions Found</h3>
              <p className="text-zinc-500">
                {searchQuery || typeFilter !== "all"
                  ? "Try adjusting your search or filters"
                  : "No completed transactions yet for this project"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Backer</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Processor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((txn) => (
                    <TableRow key={txn.id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {formatDate(txn.date)}
                      </TableCell>
                      <TableCell>
                        {txn.type === "pledge" ? (
                          <Badge variant="default">Pledge</Badge>
                        ) : (
                          <Badge className="bg-purple-100 text-purple-800">Aftersale</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[180px]">
                          <p className="text-sm font-medium truncate">{txn.backerName || "N/A"}</p>
                          <p className="text-xs text-muted-foreground truncate">{txn.backerEmail}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm max-w-[200px] truncate">{txn.description}</p>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(txn.amount)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {txn.paymentProcessor === "STRIPE" ? "Stripe" : "DC"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-green-100 text-green-800">{txn.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {filtered.length > 0 && (
            <p className="text-sm text-muted-foreground mt-3">
              Showing {filtered.length} of {transactions.length} transactions
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
