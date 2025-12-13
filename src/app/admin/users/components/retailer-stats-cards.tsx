"use client";

import { Card, CardContent } from "@/components/ui/card";
import { RetailerStats } from "./types";

interface RetailerStatsCardsProps {
  stats: RetailerStats;
}

export function RetailerStatsCards({ stats }: RetailerStatsCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-5">
      <Card>
        <CardContent className="p-4">
          <p className="text-2xl font-bold">{stats.total}</p>
          <p className="text-xs text-zinc-500">Total Retailers</p>
        </CardContent>
      </Card>
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-4">
          <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
          <p className="text-xs text-zinc-500">Pending</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-2xl font-bold text-blue-600">{stats.underReview}</p>
          <p className="text-xs text-zinc-500">Under Review</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-2xl font-bold text-emerald-600">{stats.approved}</p>
          <p className="text-xs text-zinc-500">Approved</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
          <p className="text-xs text-zinc-500">Rejected</p>
        </CardContent>
      </Card>
    </div>
  );
}
