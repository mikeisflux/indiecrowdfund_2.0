"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Users,
  ClipboardCheck,
  ShoppingBag,
  TrendingUp,
  Globe,
  CreditCard,
  BarChart3,
} from "lucide-react";

interface CountBreakdown {
  label: string;
  count: number;
  percentage: number;
  color?: string;
}

interface CountsTabProps {
  totalBackers?: number;
  surveysDone?: number;
  preOrders?: number;
  pledgeLevelBreakdown?: CountBreakdown[];
  surveyStatusBreakdown?: CountBreakdown[];
  shippingRegionBreakdown?: CountBreakdown[];
  paymentStatusBreakdown?: CountBreakdown[];
}

// Demo data
const demoPledgeLevelBreakdown: CountBreakdown[] = [
  { label: "Digital Only ($25)", count: 234, percentage: 34.5, color: "bg-blue-500" },
  { label: "Standard Edition ($50)", count: 289, percentage: 42.6, color: "bg-teal-500" },
  { label: "Collector's Edition ($150)", count: 89, percentage: 13.1, color: "bg-purple-500" },
  { label: "Ultimate Bundle ($250)", count: 67, percentage: 9.8, color: "bg-amber-500" },
];

const demoSurveyStatusBreakdown: CountBreakdown[] = [
  { label: "Completed", count: 612, percentage: 90.1, color: "bg-green-500" },
  { label: "Partially Completed", count: 34, percentage: 5.0, color: "bg-yellow-500" },
  { label: "Not Started", count: 33, percentage: 4.9, color: "bg-red-500" },
];

const demoShippingRegionBreakdown: CountBreakdown[] = [
  { label: "United States", count: 398, percentage: 58.6, color: "bg-blue-500" },
  { label: "Canada", count: 89, percentage: 13.1, color: "bg-red-500" },
  { label: "Europe", count: 112, percentage: 16.5, color: "bg-purple-500" },
  { label: "Asia Pacific", count: 45, percentage: 6.6, color: "bg-teal-500" },
  { label: "Rest of World", count: 35, percentage: 5.2, color: "bg-gray-500" },
];

const demoPaymentStatusBreakdown: CountBreakdown[] = [
  { label: "Collected", count: 645, percentage: 95.0, color: "bg-green-500" },
  { label: "Pending", count: 22, percentage: 3.2, color: "bg-yellow-500" },
  { label: "Failed", count: 12, percentage: 1.8, color: "bg-red-500" },
];

export function CountsTab({
  totalBackers = 679,
  surveysDone = 612,
  preOrders = 156,
  pledgeLevelBreakdown = demoPledgeLevelBreakdown,
  surveyStatusBreakdown = demoSurveyStatusBreakdown,
  shippingRegionBreakdown = demoShippingRegionBreakdown,
  paymentStatusBreakdown = demoPaymentStatusBreakdown,
}: CountsTabProps) {
  const surveyCompletionRate = Math.round((surveysDone / totalBackers) * 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6 text-teal-600" />
          <div>
            <h3 className="text-lg font-semibold">Counts</h3>
            <p className="text-sm text-muted-foreground">
              Backer statistics and breakdowns
            </p>
          </div>
        </div>
      </div>

      {/* Top Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-teal-100 flex items-center justify-center">
                <Users className="h-6 w-6 text-teal-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Backers</p>
                <p className="text-2xl font-bold">{totalBackers.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center">
                <ClipboardCheck className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Surveys Done</p>
                <p className="text-2xl font-bold">
                  {surveysDone.toLocaleString()}
                  <span className="text-sm font-normal text-muted-foreground ml-1">
                    ({surveyCompletionRate}%)
                  </span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-purple-100 flex items-center justify-center">
                <ShoppingBag className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pre-orders</p>
                <p className="text-2xl font-bold">{preOrders.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Pledge Level Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-teal-600" />
              By Pledge Level
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {pledgeLevelBreakdown.map((item) => (
              <div key={item.label} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{item.label}</span>
                  <span className="text-muted-foreground">
                    {item.count} ({item.percentage}%)
                  </span>
                </div>
                <Progress value={item.percentage} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Survey Status Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-teal-600" />
              By Survey Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {surveyStatusBreakdown.map((item) => (
              <div key={item.label} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${item.color}`}
                    />
                    {item.label}
                  </span>
                  <span className="text-muted-foreground">
                    {item.count} ({item.percentage}%)
                  </span>
                </div>
                <Progress value={item.percentage} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Shipping Region Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-teal-600" />
              By Shipping Region
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {shippingRegionBreakdown.map((item) => (
              <div key={item.label} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${item.color}`}
                    />
                    {item.label}
                  </span>
                  <span className="text-muted-foreground">
                    {item.count} ({item.percentage}%)
                  </span>
                </div>
                <Progress value={item.percentage} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Payment Status Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-teal-600" />
              By Payment Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {paymentStatusBreakdown.map((item) => (
              <div key={item.label} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${item.color}`}
                    />
                    {item.label}
                  </span>
                  <span className="text-muted-foreground">
                    {item.count} ({item.percentage}%)
                  </span>
                </div>
                <Progress value={item.percentage} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
