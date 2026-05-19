"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatsCard({
  title,
  value,
  prefix = "",
  icon: Icon,
  color = "primary",
  subtitle,
}: {
  title: string;
  value: number | string;
  prefix?: string;
  icon: React.ElementType;
  color?: "primary" | "green" | "blue" | "purple" | "amber";
  subtitle?: string;
}) {
  const colorStyles = {
    primary: { iconBg: "bg-primary/20", iconColor: "text-primary" },
    green: { iconBg: "bg-emerald-500/20", iconColor: "text-emerald-500" },
    blue: { iconBg: "bg-blue-500/20", iconColor: "text-blue-500" },
    purple: { iconBg: "bg-primary/20", iconColor: "text-primary" },
    amber: { iconBg: "bg-amber-500/20", iconColor: "text-amber-500" },
  };

  const styles = colorStyles[color];

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={cn("p-2 rounded-xl", styles.iconBg)}>
          <Icon className={cn("h-4 w-4", styles.iconColor)} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground">
          {prefix}{typeof value === "number" ? value.toLocaleString() : value}
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}
