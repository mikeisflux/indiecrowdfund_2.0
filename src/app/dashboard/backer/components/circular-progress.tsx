"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface CircularProgressProps {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  color?: "green" | "cyan" | "purple" | "amber";
  showValue?: boolean;
  label?: string;
  sublabel?: string;
  animate?: boolean;
  glowing?: boolean;
  className?: string;
}

const colorStyles = {
  green: {
    stroke: "stroke-emerald-500",
    fill: "fill-emerald-500",
    glow: "drop-shadow(0 0 10px rgba(16, 185, 129, 0.6))",
    text: "text-emerald-500",
  },
  cyan: {
    stroke: "stroke-cyan-500",
    fill: "fill-cyan-500",
    glow: "drop-shadow(0 0 10px rgba(6, 182, 212, 0.6))",
    text: "text-cyan-500",
  },
  purple: {
    stroke: "stroke-purple-500",
    fill: "fill-purple-500",
    glow: "drop-shadow(0 0 10px rgba(139, 92, 246, 0.6))",
    text: "text-purple-500",
  },
  amber: {
    stroke: "stroke-amber-500",
    fill: "fill-amber-500",
    glow: "drop-shadow(0 0 10px rgba(245, 158, 11, 0.6))",
    text: "text-amber-500",
  },
};

export function CircularProgress({
  value,
  max = 100,
  size = 120,
  strokeWidth = 8,
  color = "green",
  showValue = true,
  label,
  sublabel,
  animate = true,
  glowing = true,
  className,
}: CircularProgressProps) {
  const [animatedValue, setAnimatedValue] = useState(animate ? 0 : value);
  const colors = colorStyles[color];

  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percentage = (animatedValue / max) * 100;
  const offset = circumference - (percentage / 100) * circumference;

  useEffect(() => {
    if (!animate) {
      setAnimatedValue(value);
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
        setAnimatedValue(value);
        clearInterval(timer);
      } else {
        setAnimatedValue(current);
      }
    }, stepDuration);

    return () => clearInterval(timer);
  }, [value, animate]);

  return (
    <div className={cn("relative inline-flex flex-col items-center", className)}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
        style={{ filter: glowing ? colors.glow : undefined }}
      >
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/20"
        />

        {/* Gradient definition */}
        <defs>
          <linearGradient id={`gradient-${color}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" className={colors.fill} stopOpacity="1" />
            <stop offset="100%" className={colors.fill} stopOpacity="0.6" />
          </linearGradient>
        </defs>

        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#gradient-${color})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn(
            "transition-all duration-1000 ease-out",
            animate && "animate-circle"
          )}
        />

        {/* Animated glow dot at the end of progress */}
        {glowing && percentage > 0 && (
          <circle
            cx={size / 2 + radius * Math.cos(((percentage / 100) * 360 - 90) * (Math.PI / 180))}
            cy={size / 2 + radius * Math.sin(((percentage / 100) * 360 - 90) * (Math.PI / 180))}
            r={strokeWidth / 2 + 2}
            className={cn(colors.fill, "animate-pulse")}
            style={{ filter: colors.glow }}
          />
        )}
      </svg>

      {/* Center content */}
      {showValue && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("text-2xl font-bold tabular-nums", colors.text)}>
            {Math.round(percentage)}%
          </span>
          {label && (
            <span className="text-xs text-muted-foreground mt-1">{label}</span>
          )}
        </div>
      )}

      {/* Sublabel below */}
      {sublabel && (
        <span className="text-sm text-muted-foreground mt-2">{sublabel}</span>
      )}
    </div>
  );
}
