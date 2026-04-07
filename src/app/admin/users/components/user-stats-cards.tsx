"use client";

import { Card, CardContent } from "@/components/ui/card";
import { UserStats } from "./types";

interface UserStatsCardsProps {
  stats: UserStats;
}

export function UserStatsCards({ stats }: UserStatsCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardContent className="p-4">
          <p className="text-2xl font-bold">{stats.total.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Total Users</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-2xl font-bold text-emerald-600">{stats.users.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Regular Users</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-2xl font-bold text-violet-600">{stats.admins.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Admins</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-2xl font-bold text-amber-600">{stats.superAdmins}</p>
          <p className="text-xs text-muted-foreground">Super Admins</p>
        </CardContent>
      </Card>
    </div>
  );
}
