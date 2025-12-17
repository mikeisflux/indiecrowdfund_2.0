"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface BarChartProps {
  data: { label: string; value: number; secondaryValue?: number }[];
  title?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  primaryColor?: string;
  secondaryColor?: string;
  height?: number;
  showLegend?: boolean;
}

export function BarChart({
  data,
  title,
  primaryLabel = "Primary",
  secondaryLabel = "Secondary",
  primaryColor = "#4a9b9b",
  secondaryColor = "#2d6a6a",
  height = 200,
  showLegend = true,
}: BarChartProps) {
  const maxValue = useMemo(() => {
    return Math.max(...data.map(d => d.value + (d.secondaryValue || 0)));
  }, [data]);

  return (
    <Card>
      {title && (
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent>
        {showLegend && (
          <div className="flex gap-4 mb-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: primaryColor }} />
              <span className="text-muted-foreground">{primaryLabel}</span>
            </div>
            {data.some(d => d.secondaryValue !== undefined) && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: secondaryColor }} />
                <span className="text-muted-foreground">{secondaryLabel}</span>
              </div>
            )}
          </div>
        )}
        <div className="flex items-end gap-2" style={{ height }}>
          {data.map((item, i) => {
            const primaryHeight = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
            const secondaryHeight = maxValue > 0 && item.secondaryValue
              ? (item.secondaryValue / maxValue) * 100
              : 0;

            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col justify-end" style={{ height: height - 24 }}>
                  {item.secondaryValue !== undefined && (
                    <div
                      className="w-full rounded-t transition-all hover:opacity-80"
                      style={{
                        height: `${secondaryHeight}%`,
                        backgroundColor: secondaryColor,
                        minHeight: item.secondaryValue > 0 ? 4 : 0,
                      }}
                      title={`${secondaryLabel}: ${item.secondaryValue}`}
                    />
                  )}
                  <div
                    className="w-full rounded-t transition-all hover:opacity-80"
                    style={{
                      height: `${primaryHeight}%`,
                      backgroundColor: primaryColor,
                      minHeight: item.value > 0 ? 4 : 0,
                      borderTopLeftRadius: item.secondaryValue ? 0 : undefined,
                      borderTopRightRadius: item.secondaryValue ? 0 : undefined,
                    }}
                    title={`${primaryLabel}: ${item.value}`}
                  />
                </div>
                <span className="text-xs text-muted-foreground truncate w-full text-center">
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

interface DonutChartProps {
  data: { label: string; value: number; color: string }[];
  title?: string;
  size?: number;
  showLegend?: boolean;
  centerLabel?: string;
  centerValue?: string;
}

export function DonutChart({
  data,
  title,
  size = 160,
  showLegend = true,
  centerLabel,
  centerValue,
}: DonutChartProps) {
  const total = useMemo(() => data.reduce((sum, d) => sum + d.value, 0), [data]);

  const segments = useMemo(() => {
    let currentAngle = 0;
    return data.map(d => {
      const percentage = total > 0 ? (d.value / total) * 100 : 0;
      const angle = (percentage / 100) * 360;
      const segment = {
        ...d,
        percentage,
        startAngle: currentAngle,
        endAngle: currentAngle + angle,
      };
      currentAngle += angle;
      return segment;
    });
  }, [data, total]);

  const strokeWidth = size * 0.15;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;

  return (
    <Card>
      {title && (
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent>
        <div className="flex items-center gap-6">
          <div className="relative" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="transform -rotate-90">
              {segments.map((segment, i) => {
                const dashLength = (segment.percentage / 100) * circumference;
                const dashOffset = offset;
                offset -= dashLength;

                return (
                  <circle
                    key={i}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={segment.color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                    strokeDashoffset={dashOffset}
                    className="transition-all hover:opacity-80"
                  />
                );
              })}
            </svg>
            {(centerLabel || centerValue) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                {centerValue && (
                  <span className="text-2xl font-bold">{centerValue}</span>
                )}
                {centerLabel && (
                  <span className="text-xs text-muted-foreground">{centerLabel}</span>
                )}
              </div>
            )}
          </div>

          {showLegend && (
            <div className="flex-1 space-y-2">
              {segments.map((segment, i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: segment.color }}
                    />
                    <span className="text-sm">{segment.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{segment.value}</span>
                    <Badge variant="secondary" className="text-xs">
                      {segment.percentage.toFixed(0)}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface ProgressStatsProps {
  stats: {
    label: string;
    value: number;
    total: number;
    color?: string;
  }[];
  title?: string;
}

export function ProgressStats({ stats, title }: ProgressStatsProps) {
  return (
    <Card>
      {title && (
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className="space-y-4">
        {stats.map((stat, i) => {
          const percentage = stat.total > 0 ? (stat.value / stat.total) * 100 : 0;
          return (
            <div key={i}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">{stat.label}</span>
                <span className="font-medium">{stat.value} / {stat.total}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: stat.color || "#4a9b9b",
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {percentage.toFixed(0)}% complete
              </p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
