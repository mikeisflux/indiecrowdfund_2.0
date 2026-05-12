"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BarChart3 } from "lucide-react";
import { AnimatedBarChart } from "./AnimatedBarChart";
import type { FundingDataPoint } from "../types";

interface FundingChartProps {
  fundingData: FundingDataPoint[];
  timeRange: string;
  onTimeRangeChange: (value: string) => void;
}

export function FundingChart({
  fundingData,
  timeRange,
  onTimeRangeChange,
}: FundingChartProps) {
  // Plot running total (cumulative) rather than daily delta — this
  // is the "Funding Progress" chart so the line should grow with
  // the campaign over time. On a day with no new pledges the bar
  // still reflects the actual total raised so far, instead of $0.
  const chartData = fundingData.slice(-10).map(d => ({
    label: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    value: d.cumulative,
  }));

  return (
    <Card className="md:col-span-2 bg-card/50 backdrop-blur border-border/50">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/20">
            <BarChart3 className="h-4 w-4 text-primary" />
          </div>
          Funding Progress
        </CardTitle>
        <Select value={timeRange} onValueChange={onTimeRangeChange}>
          <SelectTrigger className="w-[120px] bg-card/50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="14">Last 14 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">All time</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {chartData.length > 0 ? (
          <AnimatedBarChart data={chartData} height={250} color="primary" />
        ) : (
          <div className="flex h-[250px] items-center justify-center text-muted-foreground">
            <div className="text-center">
              <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p>No funding data yet</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
