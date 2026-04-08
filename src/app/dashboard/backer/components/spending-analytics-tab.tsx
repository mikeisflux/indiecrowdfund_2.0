"use client";

import { useState, useEffect, useCallback } from "react";
import { getCSRFHeaders } from "@/lib/csrf";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  DollarSign,
  TrendingDown,
  Download,
  PieChart,
  BarChart3,
  Calendar,
  Target,
  Gift,
  Package,
  AlertCircle,
  CheckCircle,
  Clock,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

interface SpendingData {
  totalSpent: number;
  physicalRewards: number;
  digitalOnly: number;
  addons: number;
  shipping: number;
  monthlySpending: { month: string; amount: number }[];
  categoryBreakdown: { category: string; amount: number; count: number }[];
  yearlyComparison: { year: string; amount: number }[];
  successRate: { backed: number; funded: number; failed: number };
  avgDeliveryTime: number;
  projectsByStatus: { status: string; count: number }[];
}

const CATEGORY_COLORS: Record<string, string> = {
  Technology: "from-blue-500 to-cyan-500",
  Games: "from-purple-500 to-pink-500",
  Design: "from-amber-500 to-orange-500",
  Film: "from-red-500 to-rose-500",
  Music: "from-green-500 to-emerald-500",
  Art: "from-violet-500 to-purple-500",
  Publishing: "from-indigo-500 to-blue-500",
  Food: "from-yellow-500 to-amber-500",
  Fashion: "from-pink-500 to-rose-500",
  Other: "from-gray-500 to-slate-500",
};

export function SpendingAnalyticsTab() {
  const [data, setData] = useState<SpendingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [timeRange, setTimeRange] = useState("all");
  const [exporting, setExporting] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/backer/analytics?range=${timeRange}`, {
        headers: { ...getCSRFHeaders() },
      });
      if (!response.ok) throw new Error("Failed to fetch analytics");
      const analyticsData = await response.json();
      setData(analyticsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchAnalytics();
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, [fetchAnalytics]);

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const response = await fetch("/api/backer/analytics/export", {
        headers: { ...getCSRFHeaders() },
      });
      if (!response.ok) throw new Error("Failed to export");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `crowdfunding-history-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Exported successfully! Great for tax records.");
    } catch {
      toast.error("Failed to export");
    } finally {
      setExporting(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 rounded-lg bg-muted/50 animate-pulse" />
          ))}
        </div>
        <div className="h-64 rounded-lg bg-muted/50 animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="glass-card">
        <CardContent className="py-12 text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
          <h3 className="text-lg font-semibold mb-2">Failed to load analytics</h3>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={fetchAnalytics}>Try Again</Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const maxMonthlyAmount = Math.max(...data.monthlySpending.map(m => m.amount), 1);
  const totalCategoryAmount = data.categoryBreakdown.reduce((sum, c) => sum + c.amount, 0);

  return (
    <div className={cn(
      "space-y-6 transition-all duration-500",
      isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/20">
              <BarChart3 className="h-4 w-4 text-emerald-400" />
            </div>
            Spending Analytics
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Track your crowdfunding investments and export for tax records
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
              <SelectItem value="6months">Last 6 Months</SelectItem>
              <SelectItem value="3months">Last 3 Months</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={handleExportCSV}
            disabled={exporting}
            variant="outline"
            className="hover:border-primary/50"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="glass-card glass-card-hover relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-emerald-500/20 glow-pulse">
                <DollarSign className="h-6 w-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Invested</p>
                <p className="text-2xl font-bold">${data.totalSpent.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card glass-card-hover relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-purple-500/20">
                <Package className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Physical Rewards</p>
                <p className="text-2xl font-bold">${data.physicalRewards.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">
                  {((data.physicalRewards / data.totalSpent) * 100).toFixed(0)}% of total
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card glass-card-hover relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-cyan-500/20">
                <Download className="h-6 w-6 text-cyan-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Digital Only</p>
                <p className="text-2xl font-bold">${data.digitalOnly.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">
                  {((data.digitalOnly / data.totalSpent) * 100).toFixed(0)}% of total
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card glass-card-hover relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-amber-500/20">
                <Gift className="h-6 w-6 text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Add-ons</p>
                <p className="text-2xl font-bold">${data.addons.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">
                  {((data.addons / data.totalSpent) * 100).toFixed(0)}% of total
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Monthly Spending Chart */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4 text-primary" />
              Monthly Spending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] flex items-end gap-2">
              {data.monthlySpending.map((month, index) => {
                const heightPercent = (month.amount / maxMonthlyAmount) * 100;
                return (
                  <div
                    key={month.month}
                    className="flex-1 flex flex-col items-center gap-2"
                  >
                    <div className="relative w-full group">
                      <div
                        className={cn(
                          "w-full rounded-t-lg bg-gradient-to-t from-primary to-purple-500 transition-all duration-500",
                          "hover:opacity-80"
                        )}
                        style={{
                          height: `${Math.max(heightPercent, 4)}%`,
                          animationDelay: `${index * 50}ms`,
                        }}
                      />
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block bg-popover text-popover-foreground text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap z-10">
                        ${month.amount.toLocaleString()}
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {month.month}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Category Breakdown */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PieChart className="h-4 w-4 text-primary" />
              Category Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.categoryBreakdown.map((category, index) => {
                const percentage = (category.amount / totalCategoryAmount) * 100;
                const colors = CATEGORY_COLORS[category.category] || CATEGORY_COLORS.Other;
                return (
                  <div
                    key={category.category}
                    className="animate-in fade-in slide-in-from-left"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{category.category}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {category.count} projects
                        </Badge>
                      </div>
                      <span className="text-sm font-bold">
                        ${category.amount.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-500", colors)}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Success Rate Dashboard */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4 text-primary" />
            Project Success Rate
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center p-6 rounded-xl bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20">
              <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-emerald-500" />
              </div>
              <p className="text-3xl font-bold text-emerald-500">{data.successRate.funded}</p>
              <p className="text-sm text-muted-foreground">Successfully Funded</p>
              <p className="text-xs text-emerald-500 mt-1">
                {((data.successRate.funded / data.successRate.backed) * 100).toFixed(0)}% success rate
              </p>
            </div>

            <div className="text-center p-6 rounded-xl bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/20">
              <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Clock className="h-8 w-8 text-blue-500" />
              </div>
              <p className="text-3xl font-bold text-blue-500">{data.successRate.backed}</p>
              <p className="text-sm text-muted-foreground">Total Backed</p>
              <p className="text-xs text-muted-foreground mt-1">
                Avg ${(data.totalSpent / data.successRate.backed).toFixed(0)} per project
              </p>
            </div>

            <div className="text-center p-6 rounded-xl bg-gradient-to-br from-rose-500/10 to-transparent border border-rose-500/20">
              <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-rose-500/20 flex items-center justify-center">
                <TrendingDown className="h-8 w-8 text-rose-500" />
              </div>
              <p className="text-3xl font-bold text-rose-500">{data.successRate.failed}</p>
              <p className="text-sm text-muted-foreground">Not Funded</p>
              <p className="text-xs text-muted-foreground mt-1">
                Funds returned
              </p>
            </div>
          </div>

          {/* Delivery Stats */}
          <div className="mt-6 pt-6 border-t border-border/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Average Delivery Time</p>
                <p className="text-xs text-muted-foreground">From funding to delivery</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">{data.avgDeliveryTime}</p>
                <p className="text-xs text-muted-foreground">months average</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tax Export Info */}
      <Card className="glass-card border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20">
              <Sparkles className="h-4 w-4 text-amber-400" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-sm mb-1">Export for Tax Records</h4>
              <p className="text-xs text-muted-foreground">
                Download your complete crowdfunding history as a CSV file. Includes all pledges,
                amounts, dates, and project details. Perfect for tax records and expense tracking.
              </p>
            </div>
            <Button
              onClick={handleExportCSV}
              disabled={exporting}
              size="sm"
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
            >
              <Download className="h-4 w-4 mr-2" />
              Download CSV
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
