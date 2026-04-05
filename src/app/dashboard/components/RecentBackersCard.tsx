"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Backer } from "../types";

interface RecentBackersCardProps {
  backers: Backer[];
}

export function RecentBackersCard({ backers }: RecentBackersCardProps) {
  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-500/20">
            <Users className="h-4 w-4 text-blue-500" />
          </div>
          Recent Backers
        </CardTitle>
      </CardHeader>
      <CardContent>
        {backers.length > 0 ? (
          <div className="space-y-4">
            {backers.slice(0, 5).map((backer, index) => (
              <div
                key={backer.id}
                className="flex items-center justify-between p-2 rounded-xl hover:bg-muted/30 transition-all duration-300 animate-in fade-in slide-in-from-right"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8 ring-2 ring-primary/20">
                    {backer.image && <AvatarImage src={backer.image} />}
                    <AvatarFallback className="text-xs bg-gradient-to-br from-primary/20 to-purple-500/20">
                      {backer.name[0]?.toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{backer.name}</p>
                      <Badge
                        variant={backer.status === "COMPLETED" ? "default" : "secondary"}
                        className={cn(
                          "text-[10px] px-1.5 py-0",
                          backer.status === "COMPLETED" && "bg-emerald-500/20 text-emerald-500 border-emerald-500/30"
                        )}
                      >
                        {backer.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {backer.reward}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-primary">${Number(backer.amount).toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">
                    {backer.time}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center">
            <Users className="h-12 w-12 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-muted-foreground">No backers yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
