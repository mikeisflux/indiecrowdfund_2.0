"use client";

import { Clock, CheckCircle, AlertCircle, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PayoutStats } from "./types";

interface PayoutStatsCardsProps {
  stats: PayoutStats;
  formatCurrency: (amount: number) => string;
}

export function PayoutStatsCards({ stats, formatCurrency }: PayoutStatsCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-zinc-600">Pending</CardTitle>
          <Clock className="w-4 h-4 text-yellow-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.pendingPayouts}</div>
          <p className="text-xs text-zinc-500 mt-1">{formatCurrency(stats.totalRemaining)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-zinc-600">Processing</CardTitle>
          <Send className="w-4 h-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.processingPayouts}</div>
          <p className="text-xs text-zinc-500 mt-1">In progress</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-zinc-600">Settled</CardTitle>
          <CheckCircle className="w-4 h-4 text-emerald-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.settledPayouts}</div>
          <p className="text-xs text-zinc-500 mt-1">{formatCurrency(stats.totalAmountSettled)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-zinc-600">No Bank</CardTitle>
          <AlertCircle className="w-4 h-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">{stats.projectsWithoutBank}</div>
          <p className="text-xs text-zinc-500 mt-1">Need attention</p>
        </CardContent>
      </Card>
    </div>
  );
}
