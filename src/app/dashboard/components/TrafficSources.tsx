"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target } from "lucide-react";
import type { Referrer } from "../types";

interface TrafficSourcesProps {
  referrers: Referrer[];
}

export function TrafficSources({ referrers }: TrafficSourcesProps) {
  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-purple-500/20">
            <Target className="h-4 w-4 text-purple-500" />
          </div>
          Traffic Sources
        </CardTitle>
      </CardHeader>
      <CardContent>
        {referrers.length > 0 ? (
          <div className="overflow-x-auto">
            <div className="space-y-4 min-w-[430px]">
            {referrers.map((referrer, i) => (
              <div key={i} className="flex items-center gap-4 p-2 rounded-xl hover:bg-muted/20 transition-colors">
                <div className="w-28 text-sm font-medium truncate">
                  {referrer.source}
                </div>
                <div className="flex-1">
                  <div className="flex h-2 overflow-hidden rounded-full bg-muted/30">
                    <div
                      className="bg-gradient-to-r from-primary to-purple-500 rounded-full transition-all duration-500"
                      style={{ width: `${referrer.percentage}%` }}
                    />
                  </div>
                </div>
                <div className="w-16 text-right text-sm text-muted-foreground">
                  {referrer.visits.toLocaleString()}
                </div>
                <div className="w-16 text-right text-sm font-medium">
                  {referrer.pledges}
                </div>
                <div className="w-24 text-right text-sm font-bold text-primary">
                  ${Number(referrer.amount).toLocaleString()}
                </div>
              </div>
            ))}
            <div className="flex items-center gap-4 border-t border-border/50 pt-4 text-xs text-muted-foreground">
              <div className="w-28" />
              <div className="flex-1" />
              <div className="w-16 text-right">Visits</div>
              <div className="w-16 text-right">Pledges</div>
              <div className="w-24 text-right">Amount</div>
            </div>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center">
            <Target className="h-12 w-12 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-muted-foreground">No traffic data yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
