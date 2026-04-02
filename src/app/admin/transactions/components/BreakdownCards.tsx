"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard,
  Coins,
} from "lucide-react";
import type { TransactionStats } from "./types";
import { getTypeBadge } from "./TransactionBadges";

interface BreakdownCardsProps {
  stats: TransactionStats;
}

export function BreakdownCards({ stats }: BreakdownCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">By Payment Processor</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-blue-600" />
                <span className="text-sm">Stripe</span>
              </div>
              <Badge variant="secondary">{stats.stripeTransactions}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-blue-400" />
                <span className="text-sm">PayPal</span>
              </div>
              <Badge variant="secondary">{stats.paypalTransactions ?? 0}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-amber-600" />
                <span className="text-sm">DivinityCoin</span>
              </div>
              <Badge variant="secondary">{stats.dcTransactions}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-purple-600" />
                <span className="text-sm">Whop</span>
              </div>
              <Badge variant="secondary">{stats.whopTransactions ?? 0}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">By Transaction Type</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Object.entries(stats.byType)
              .filter(([, count]) => count > 0)
              .map(([type, count]) => (
                <div key={type} className="flex items-center justify-between">
                  <span className="text-sm">{getTypeBadge(type)}</span>
                  <Badge variant="secondary">{count}</Badge>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
