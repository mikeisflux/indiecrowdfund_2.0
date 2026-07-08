"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface BarData {
  label: string;
  value: number;
  color?: "green" | "cyan" | "purple" | "amber" | "primary";
}

interface AnimatedBarChartProps {
  title?: string;
  data: BarData[];
  height?: number;
  showValues?: boolean;
  showLabels?: boolean;
  showGlow?: boolean;
  color?: "green" | "cyan" | "purple" | "amber" | "primary";
  className?: string;
}

const barColors = {
  green: {
    bg: "bg-gradient-to-t from-emerald-600 to-emerald-400",
    glow: "shadow-[0_0_20px_rgba(16,185,129,0.5)]",
    hover: "hover:shadow-[0_0_30px_rgba(16,185,129,0.7)]",
  },
  cyan: {
    bg: "bg-gradient-to-t from-cyan-600 to-cyan-400",
    glow: "shadow-[0_0_20px_rgba(6,182,212,0.5)]",
    hover: "hover:shadow-[0_0_30px_rgba(6,182,212,0.7)]",
  },
  purple: {
    bg: "bg-gradient-to-t from-purple-600 to-purple-400",
    glow: "shadow-[0_0_20px_rgba(139,92,246,0.5)]",
    hover: "hover:shadow-[0_0_30px_rgba(139,92,246,0.7)]",
  },
  amber: {
    bg: "bg-gradient-to-t from-amber-600 to-amber-400",
    glow: "shadow-[0_0_20px_rgba(245,158,11,0.5)]",
    hover: "hover:shadow-[0_0_30px_rgba(245,158,11,0.7)]",
  },
  primary: {
    bg: "bg-gradient-to-t from-primary to-primary/70",
    glow: "shadow-[0_0_20px_hsl(var(--primary)/0.5)]",
    hover: "hover:shadow-[0_0_30px_hsl(var(--primary)/0.7)]",
  },
};

export function AnimatedBarChart({
  title,
  data,
  height = 200,
  showValues = true,
  showLabels = true,
  showGlow = false,
  color,
  className,
}: AnimatedBarChartProps) {
  const [isVisible, setIsVisible] = useState(false);
  const maxValue = Math.max(...data.map((d) => d.value));

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Card className={cn("glass-card overflow-hidden", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <span className="relative">
            {title}
            <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-gradient-to-r from-emerald-500 via-cyan-500 to-purple-500" />
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className="flex items-end justify-between gap-2 pt-4"
          style={{ height: `${height}px` }}
        >
          {data.map((item, index) => {
            const heightPercent = (item.value / maxValue) * 100;
            const colors = barColors[item.color || color || "green"];
            const delayClass = `animate-bar-delay-${Math.min(index + 1, 6)}`;

            return (
              <div
                key={item.label}
                className="flex-1 flex flex-col items-center gap-2"
              >
                {/* Value label */}
                {showValues && (
                  <span className={cn(
                    "text-sm font-semibold transition-opacity duration-500",
                    isVisible ? "opacity-100" : "opacity-0"
                  )}
                  style={{ transitionDelay: `${(index + 1) * 100 + 500}ms` }}
                  >
                    ${item.value}
                  </span>
                )}

                {/* Bar container */}
                <div
                  className="w-full relative flex items-end justify-center"
                  style={{ height: `${height - 60}px` }}
                >
                  {/* Bar */}
                  <div
                    className={cn(
                      "w-full max-w-[40px] rounded-t-lg transition-all duration-300 cursor-pointer",
                      colors.bg,
                      showGlow && colors.glow,
                      colors.hover,
                      isVisible ? "animate-bar" : "opacity-0",
                      delayClass
                    )}
                    style={{
                      height: isVisible ? `${heightPercent}%` : "0%",
                      opacity: isVisible ? 1 : 0,
                    }}
                  >
                    {/* Shimmer overlay */}
                    <div className="absolute inset-0 rounded-t-lg overflow-hidden">
                      <div className="shimmer w-full h-full" />
                    </div>
                  </div>

                  {/* Glow effect beneath bar */}
                  <div
                    className={cn(
                      "absolute bottom-0 w-full max-w-[60px] h-4 rounded-full blur-xl opacity-50 transition-opacity duration-500",
                      item.color === "cyan" ? "bg-cyan-500" :
                      item.color === "purple" ? "bg-purple-500" :
                      item.color === "amber" ? "bg-amber-500" : "bg-emerald-500"
                    )}
                    style={{
                      opacity: isVisible ? 0.5 : 0,
                      transitionDelay: `${(index + 1) * 100}ms`
                    }}
                  />
                </div>

                {/* Label */}
                {showLabels && (
                  <span className="text-xs text-muted-foreground text-center truncate w-full">
                    {item.label}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Baseline glow */}
        <div className="h-0.5 bg-gradient-to-r from-emerald-500/50 via-cyan-500/50 to-purple-500/50 mt-2 rounded-full" />
      </CardContent>
    </Card>
  );
}
