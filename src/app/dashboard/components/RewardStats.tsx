"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Gift, MoreHorizontal, Pencil, Eye, Copy } from "lucide-react";
import { toast } from "sonner";
import type { RewardStat } from "../types";

interface RewardStatsProps {
  rewardStats: RewardStat[];
  projectUrl: string;
}

export function RewardStats({ rewardStats, projectUrl }: RewardStatsProps) {
  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-purple-500/20">
            <Gift className="h-4 w-4 text-purple-500" />
          </div>
          Reward Performance
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rewardStats.length > 0 ? (
          <div className="space-y-4">
            {rewardStats.map((reward, index) => (
              <div
                key={reward.id}
                className="flex items-center justify-between rounded-xl border border-border/50 p-4 bg-gradient-to-r from-muted/20 to-transparent hover:border-primary/30 transition-all animate-in fade-in slide-in-from-left"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div>
                  <p className="font-medium">{reward.title}</p>
                  <p className="text-sm text-muted-foreground">
                    ${reward.amount}
                  </p>
                </div>
                <div className="flex items-center gap-8">
                  <div className="text-center">
                    <p className="text-lg font-bold">{reward.backers}</p>
                    <p className="text-xs text-muted-foreground">Backers</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-primary">
                      ${Number(reward.total).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                  {reward.remaining !== null && (
                    <div className="text-center">
                      <p className="text-lg font-bold">{reward.remaining}</p>
                      <p className="text-xs text-muted-foreground">
                        Remaining
                      </p>
                    </div>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="hover:bg-primary/10">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`${projectUrl}/edit?tab=rewards`}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit Reward
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={projectUrl}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Project
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          navigator.clipboard.writeText(`${reward.title} — $${reward.amount}`);
                          toast.success("Reward info copied");
                        }}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copy Reward Info
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center">
            <Gift className="h-12 w-12 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-muted-foreground">No rewards created yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
