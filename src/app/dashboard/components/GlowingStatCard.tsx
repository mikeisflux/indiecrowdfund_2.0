"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface GlowingStatCardProps {
  title: string;
  value: number | string;
  prefix?: string;
  suffix?: string;
  icon: React.ElementType;
  color?: "primary" | "green" | "blue" | "purple" | "amber" | "rose" | "cyan";
  trend?: { value: number; isPositive?: boolean; label?: string };
  subtitle?: string;
  delay?: number;
  pulse?: boolean;
}

export function GlowingStatCard({
  title,
  value,
  prefix = "",
  suffix = "",
  icon: Icon,
  color = "primary",
  trend,
  subtitle,
  delay = 0,
  pulse = false,
}: GlowingStatCardProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  useEffect(() => {
    if (!isVisible || typeof value !== "number") return;
    const duration = 1500;
    const steps = 60;
    const stepDuration = duration / steps;
    const increment = value / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(current));
      }
    }, stepDuration);
    return () => clearInterval(timer);
  }, [isVisible, value]);

  const colorStyles = {
    primary: {
      bg: "from-primary/10 to-primary/5",
      iconBg: "bg-primary/20",
      iconColor: "text-primary",
      glow: "group-hover:shadow-primary/20",
    },
    green: {
      bg: "from-emerald-500/10 to-emerald-500/5",
      iconBg: "bg-emerald-500/20",
      iconColor: "text-emerald-500",
      glow: "group-hover:shadow-emerald-500/20",
    },
    blue: {
      bg: "from-blue-500/10 to-blue-500/5",
      iconBg: "bg-blue-500/20",
      iconColor: "text-blue-500",
      glow: "group-hover:shadow-blue-500/20",
    },
    purple: {
      bg: "from-purple-500/10 to-purple-500/5",
      iconBg: "bg-purple-500/20",
      iconColor: "text-purple-500",
      glow: "group-hover:shadow-purple-500/20",
    },
    amber: {
      bg: "from-amber-500/10 to-amber-500/5",
      iconBg: "bg-amber-500/20",
      iconColor: "text-amber-500",
      glow: "group-hover:shadow-amber-500/20",
    },
    rose: {
      bg: "from-rose-500/10 to-rose-500/5",
      iconBg: "bg-rose-500/20",
      iconColor: "text-rose-500",
      glow: "group-hover:shadow-rose-500/20",
    },
    cyan: {
      bg: "from-cyan-500/10 to-cyan-500/5",
      iconBg: "bg-cyan-500/20",
      iconColor: "text-cyan-500",
      glow: "group-hover:shadow-cyan-500/20",
    },
  };

  const styles = colorStyles[color];

  return (
    <Card
      className={cn(
        "group relative overflow-hidden bg-card/50 backdrop-blur border-border/50 transition-all duration-500 hover:border-primary/30",
        styles.glow,
        "hover:shadow-lg",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      )}
    >
      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-50", styles.bg)} />
      <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />

      <CardHeader className="relative flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={cn(
          "p-2 rounded-xl transition-transform group-hover:scale-110",
          styles.iconBg,
          pulse && "animate-pulse"
        )}>
          <Icon className={cn("h-4 w-4", styles.iconColor)} />
        </div>
      </CardHeader>
      <CardContent className="relative">
        <div className="text-2xl font-bold tabular-nums">
          {prefix}
          {typeof value === "number" ? displayValue.toLocaleString() : value}
          {suffix}
        </div>
        {trend && (
          <p className={cn(
            "flex items-center text-xs mt-1",
            trend.isPositive !== false ? "text-emerald-500" : "text-rose-500"
          )}>
            {trend.isPositive !== false ? (
              <ArrowUpRight className="mr-1 h-3 w-3" />
            ) : (
              <ArrowDownRight className="mr-1 h-3 w-3" />
            )}
            {trend.isPositive !== false ? "+" : ""}{trend.value}% {trend.label || ""}
          </p>
        )}
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}
