"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface CircularProgressProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  color?: "primary" | "green" | "blue" | "purple";
}

export function CircularProgress({
  value,
  size = 120,
  strokeWidth = 8,
  color = "primary",
}: CircularProgressProps) {
  const [animatedValue, setAnimatedValue] = useState(0);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (animatedValue / 100) * circumference;

  useEffect(() => {
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
  }, [value]);

  const colorStyles = {
    primary: "stroke-primary",
    green: "stroke-emerald-500",
    blue: "stroke-blue-500",
    purple: "stroke-purple-500",
  };

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/20"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn(colorStyles[color], "transition-all duration-1000 ease-out")}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold">{Math.round(animatedValue)}%</span>
        <span className="text-xs text-muted-foreground">Fulfilled</span>
      </div>
    </div>
  );
}
