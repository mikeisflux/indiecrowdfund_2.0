"use client";

import { useEffect, useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface GlowingStatCardProps {
  title: string;
  value: number | string;
  prefix?: string;
  suffix?: string;
  icon: LucideIcon;
  color?: "green" | "cyan" | "purple" | "amber" | "rose";
  trend?: {
    value: number;
    isPositive: boolean;
  };
  subtitle?: string;
  animate?: boolean;
  delay?: number;
}

const colorClasses = {
  green: {
    glow: "glow-pulse",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    icon: "text-emerald-500",
    gradient: "from-emerald-500 to-emerald-600",
    neon: "neon-text-green",
  },
  cyan: {
    glow: "glow-pulse-cyan",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/20",
    icon: "text-cyan-500",
    gradient: "from-cyan-500 to-cyan-600",
    neon: "neon-text-cyan",
  },
  purple: {
    glow: "glow-pulse-purple",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
    icon: "text-purple-500",
    gradient: "from-purple-500 to-purple-600",
    neon: "neon-text-purple",
  },
  amber: {
    glow: "glow-pulse",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    icon: "text-amber-500",
    gradient: "from-amber-500 to-amber-600",
    neon: "",
  },
  rose: {
    glow: "glow-pulse",
    bg: "bg-rose-500/10",
    border: "border-rose-500/20",
    icon: "text-rose-500",
    gradient: "from-rose-500 to-rose-600",
    neon: "",
  },
};

function AnimatedNumber({ value, prefix = "", suffix = "" }: { value: number | string; prefix?: string; suffix?: string }) {
  const [displayValue, setDisplayValue] = useState(0);
  const countRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof value !== "number") {
      return;
    }

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

    countRef.current = timer as unknown as number;

    return () => {
      if (countRef.current) {
        clearInterval(countRef.current as unknown as NodeJS.Timeout);
      }
    };
  }, [value]);

  if (typeof value === "string") {
    return <span>{prefix}{value}{suffix}</span>;
  }

  return (
    <span className="tabular-nums">
      {prefix}{displayValue.toLocaleString()}{suffix}
    </span>
  );
}

export function GlowingStatCard({
  title,
  value,
  prefix = "",
  suffix = "",
  icon: Icon,
  color = "green",
  trend,
  subtitle,
  animate = true,
  delay = 0,
}: GlowingStatCardProps) {
  const colors = colorClasses[color];
  const [isVisible, setIsVisible] = useState(!animate);

  useEffect(() => {
    if (animate) {
      const timer = setTimeout(() => setIsVisible(true), delay);
      return () => clearTimeout(timer);
    }
  }, [animate, delay]);

  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-all duration-500 glass-card glass-card-hover",
        colors.border,
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {/* Animated gradient border */}
      <div className="absolute inset-0 animated-border rounded-lg" />

      <CardContent className="p-6 relative z-10">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <div className={cn("text-3xl font-bold animate-count", colors.neon)}>
              <AnimatedNumber value={value} prefix={prefix} suffix={suffix} />
            </div>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
            {trend && (
              <div className={cn(
                "flex items-center gap-1 text-sm",
                trend.isPositive ? "text-emerald-500" : "text-rose-500"
              )}>
                <span>{trend.isPositive ? "+" : ""}{trend.value}%</span>
                <span className="text-muted-foreground">vs last month</span>
              </div>
            )}
          </div>

          {/* Glowing icon container */}
          <div className={cn(
            "relative p-3 rounded-xl",
            colors.bg,
            colors.glow
          )}>
            <Icon className={cn("h-6 w-6", colors.icon)} />
            {/* Icon glow backdrop */}
            <div className={cn(
              "absolute inset-0 rounded-xl opacity-50 blur-xl",
              colors.bg
            )} />
          </div>
        </div>
      </CardContent>

      {/* Bottom gradient line */}
      <div className={cn(
        "absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r opacity-50",
        colors.gradient
      )} />
    </Card>
  );
}
