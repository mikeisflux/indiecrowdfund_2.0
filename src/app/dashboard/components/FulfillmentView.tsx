"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Truck, CheckCircle, Package, Gift, Box, Sparkles, Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CircularProgress } from "./CircularProgress";
import { useState } from "react";
import { toast } from "sonner";
import type { FulfillmentStats } from "../types";

interface FulfillmentViewProps {
  fulfillmentStats: FulfillmentStats | null;
  projectId: string;
}

export function FulfillmentView({ fulfillmentStats, projectId }: FulfillmentViewProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExportCSV = async () => {
    if (!projectId) {
      toast.error("No project selected");
      return;
    }
    setIsExporting(true);
    try {
      const response = await fetch(`/api/creator/indiekit/export?projectId=${projectId}&type=backers`);
      if (!response.ok) {
        const err = await response.json();
        toast.error(err.error || "Failed to export");
        return;
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = response.headers.get("Content-Disposition");
      const filenameMatch = disposition?.match(/filename="(.+)"/);
      a.download = filenameMatch?.[1] || `fulfillment-export-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Fulfillment data exported successfully");
    } catch {
      toast.error("Network error exporting data");
    } finally {
      setIsExporting(false);
    }
  };

  if (!fulfillmentStats || fulfillmentStats.totalBackers === 0) {
    return (
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center mb-6">
            <Truck className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="mb-2 font-semibold text-lg">Fulfillment available after funding</h3>
          <p className="mb-4 text-center text-sm text-muted-foreground max-w-md">
            Once your campaign ends successfully, you&apos;ll be able to manage
            backer surveys and reward fulfillment here
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Fulfillment Progress Overview */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Circular Progress */}
        <Card className="lg:col-span-1 bg-card/50 backdrop-blur border-border/50">
          <CardHeader>
            <CardTitle className="text-center flex items-center justify-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/20">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
              </div>
              Fulfillment Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <CircularProgress
              value={fulfillmentStats.fulfillmentPercentage}
              size={180}
              strokeWidth={12}
              color="green"
            />
            <div className="mt-4 text-center">
              <p className="text-lg font-semibold">
                {fulfillmentStats.shippedBackers} of {fulfillmentStats.totalBackers} backers
              </p>
              <p className="text-sm text-muted-foreground">marked as shipped or delivered</p>
            </div>
          </CardContent>
        </Card>

        {/* Status Breakdown */}
        <Card className="lg:col-span-2 bg-card/50 backdrop-blur border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-500/20">
                <Truck className="h-4 w-4 text-blue-500" />
              </div>
              Fulfillment Status Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 rounded-xl bg-muted/30 border border-border/50">
                <div className="w-4 h-4 rounded-full bg-gray-400 mx-auto mb-2" />
                <p className="text-2xl font-bold">{fulfillmentStats.statusBreakdown.notStarted}</p>
                <p className="text-xs text-muted-foreground">Not Started</p>
              </div>
              <div className="text-center p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <div className="w-4 h-4 rounded-full bg-blue-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-blue-500">{fulfillmentStats.statusBreakdown.inProgress}</p>
                <p className="text-xs text-muted-foreground">In Progress</p>
              </div>
              <div className="text-center p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <div className="w-4 h-4 rounded-full bg-amber-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-amber-500">{fulfillmentStats.statusBreakdown.shipped}</p>
                <p className="text-xs text-muted-foreground">Shipped</p>
              </div>
              <div className="text-center p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <div className="w-4 h-4 rounded-full bg-emerald-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-emerald-500">{fulfillmentStats.statusBreakdown.delivered}</p>
                <p className="text-xs text-muted-foreground">Delivered</p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-6">
              <div className="flex h-4 rounded-full overflow-hidden bg-muted/30">
                {fulfillmentStats.statusBreakdown.delivered > 0 && (
                  <div
                    className="bg-emerald-500 transition-all duration-500"
                    style={{
                      width: `${(fulfillmentStats.statusBreakdown.delivered / fulfillmentStats.totalBackers) * 100}%`,
                    }}
                  />
                )}
                {fulfillmentStats.statusBreakdown.shipped > 0 && (
                  <div
                    className="bg-amber-500 transition-all duration-500"
                    style={{
                      width: `${(fulfillmentStats.statusBreakdown.shipped / fulfillmentStats.totalBackers) * 100}%`,
                    }}
                  />
                )}
                {fulfillmentStats.statusBreakdown.inProgress > 0 && (
                  <div
                    className="bg-blue-500 transition-all duration-500"
                    style={{
                      width: `${(fulfillmentStats.statusBreakdown.inProgress / fulfillmentStats.totalBackers) * 100}%`,
                    }}
                  />
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Items to Fulfill */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-purple-500/20">
                  <Package className="h-4 w-4 text-purple-500" />
                </div>
                Items to Fulfill
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Complete breakdown of all items needed to fulfill your campaign
              </p>
            </div>
            <Button
              onClick={handleExportCSV}
              disabled={isExporting}
              variant="outline"
              className="border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-500"
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {fulfillmentStats.items.length > 0 ? (
            <div className="rounded-xl border border-border/50 overflow-hidden">
              <div className="grid grid-cols-12 gap-4 bg-muted/30 p-3 text-sm font-medium">
                <div className="col-span-1">Type</div>
                <div className="col-span-8">Item Name</div>
                <div className="col-span-3 text-right">Quantity Needed</div>
              </div>
              {fulfillmentStats.items.map((item, index) => (
                <div
                  key={index}
                  className="grid grid-cols-12 gap-4 p-3 text-sm border-t border-border/50 items-center hover:bg-muted/20 transition-colors animate-in fade-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="col-span-1">
                    {item.type === "reward" ? (
                      <div className="p-1.5 rounded-lg bg-primary/20 inline-block">
                        <Gift className="h-4 w-4 text-primary" />
                      </div>
                    ) : (
                      <div className="p-1.5 rounded-lg bg-amber-500/20 inline-block">
                        <Box className="h-4 w-4 text-amber-500" />
                      </div>
                    )}
                  </div>
                  <div className="col-span-8 flex items-center gap-2">
                    <span className="font-medium">{item.name}</span>
                    <Badge
                      className={cn(
                        item.type === "reward" ? "bg-primary/20 text-primary border-primary/30" : "bg-amber-500/20 text-amber-500 border-amber-500/30"
                      )}
                    >
                      {item.type === "reward" ? "Reward" : "Add-on"}
                    </Badge>
                  </div>
                  <div className="col-span-3 text-right">
                    <span className="text-lg font-bold">{item.count.toLocaleString()}</span>
                  </div>
                </div>
              ))}
              <div className="grid grid-cols-12 gap-4 p-3 bg-muted/30 border-t border-border/50 font-medium">
                <div className="col-span-9">Total Items</div>
                <div className="col-span-3 text-right text-lg text-primary">
                  {fulfillmentStats.items.reduce((sum, item) => sum + item.count, 0).toLocaleString()}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center">
              <Package className="h-12 w-12 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-muted-foreground">
                No items to fulfill yet. Reward items will appear here once backers pledge.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Link to IndieKit */}
      <Card className="bg-gradient-to-r from-primary/10 via-purple-500/10 to-blue-500/10 border-primary/20">
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold">Need more fulfillment tools?</h4>
              <p className="text-sm text-muted-foreground">
                Use IndieKit for advanced fulfillment management, backer surveys, shipping integration, and more.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/dashboard/indiekit">
                <Button className="bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90 shadow-lg shadow-primary/25">
                  <Package className="mr-2 h-4 w-4" />
                  Open IndieKit
                </Button>
              </Link>
              <Link href="/dashboard/indiekit-v2">
                <Button className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white shadow-lg shadow-teal-500/25">
                  <Sparkles className="mr-2 h-4 w-4" />
                  IndieKit 2.0
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
