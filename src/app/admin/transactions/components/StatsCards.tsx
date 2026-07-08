"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  CheckCircle,
  XCircle,
  DollarSign,
  TrendingUp,
  Activity,
  Clock,
} from "lucide-react";
import type { TransactionStats } from "./types";
import { formatCurrency } from "./utils";

interface StatsCardsProps {
  stats: TransactionStats;
}

export function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
      <Card>
        <CardContent className="pt-4 pb-3 px-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-600" />
            <span className="text-xs text-muted-foreground">Total</span>
          </div>
          <p className="text-xl font-bold mt-1">{stats.totalTransactions}</p>
          <p className="text-xs text-muted-foreground">{formatCurrency(stats.totalVolume)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4 pb-3 px-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-600" />
            <span className="text-xs text-muted-foreground">Today</span>
          </div>
          <p className="text-xl font-bold mt-1">{stats.todayTransactions}</p>
          <p className="text-xs text-muted-foreground">{formatCurrency(stats.todayVolume)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4 pb-3 px-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-xs text-muted-foreground">Completed</span>
          </div>
          <p className="text-xl font-bold mt-1">{stats.byStatus.COMPLETED || 0}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4 pb-3 px-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-yellow-600" />
            <span className="text-xs text-muted-foreground">Pending</span>
          </div>
          <p className="text-xl font-bold mt-1">{stats.byStatus.PENDING || 0}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4 pb-3 px-4">
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-red-600" />
            <span className="text-xs text-muted-foreground">Failed</span>
          </div>
          <p className="text-xl font-bold mt-1 text-red-600">{stats.failedTransactions}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4 pb-3 px-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-emerald-600" />
            <span className="text-xs text-muted-foreground">Platform Fees</span>
          </div>
          <p className="text-xl font-bold mt-1">{formatCurrency(stats.totalPlatformFees)}</p>
        </CardContent>
      </Card>
    </div>
  );
}
