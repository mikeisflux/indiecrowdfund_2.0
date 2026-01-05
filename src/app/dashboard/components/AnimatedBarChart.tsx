"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface AnimatedBarChartProps {
  data: { label: string; value: number }[];
  height?: number;
  color?: "primary" | "green" | "blue" | "purple";
}

export function AnimatedBarChart({
  data,
  height = 200,
  color = "primary",
}: AnimatedBarChartProps) {
  const [isVisible, setIsVisible] = useState(false);
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 300);
    return () => clearTimeout(timer);
  }, []);

  const colorStyles = {
    primary: "from-primary to-purple-500",
    green: "from-emerald-500 to-cyan-500",
    blue: "from-blue-500 to-indigo-500",
    purple: "from-purple-500 to-pink-500",
  };

  return (
    <div style={{ height }} className="flex items-end gap-2">
      {data.map((item, index) => {
        const heightPercent = (item.value / maxValue) * 100;
        return (
          <div key={index} className="flex-1 flex flex-col items-center gap-2">
            <div className="relative w-full group">
              <div
                className={cn(
                  "w-full rounded-t-lg bg-gradient-to-t transition-all duration-1000 ease-out",
                  colorStyles[color],
                  "group-hover:opacity-80"
                )}
                style={{
                  height: isVisible ? `${Math.max(heightPercent, 2)}%` : "0%",
                  minHeight: isVisible ? "4px" : "0",
                  transitionDelay: `${index * 50}ms`,
                }}
              />
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block bg-popover text-popover-foreground text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap z-10">
                ${item.value.toLocaleString()}
              </div>
            </div>
            <span className="text-[10px] text-muted-foreground truncate w-full text-center">
              {item.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
