"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Users,
  ClipboardCheck,
  ShoppingBag,
  ShoppingCart,
  TrendingUp,
  Globe,
  CreditCard,
  BarChart3,
  Inbox,
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
  backersWithAddons?: number;
  totalAddonItems?: number;
  pledgeLevelBreakdown?: CountBreakdown[];
  surveyStatusBreakdown?: CountBreakdown[];
  shippingRegionBreakdown?: CountBreakdown[];
  paymentStatusBreakdown?: CountBreakdown[];
}

export function CountsTab({
  totalBackers = 0,
  surveysDone = 0,
  preOrders = 0,
  backersWithAddons = 0,
  totalAddonItems = 0,
  pledgeLevelBreakdown = [],
  surveyStatusBreakdown = [],
  shippingRegionBreakdown = [],
  paymentStatusBreakdown = [],
}: CountsTabProps) {
  const surveyCompletionRate = totalBackers > 0 ? Math.round((surveysDone / totalBackers) * 100) : 0;
  const addonsRate = totalBackers > 0 ? Math.round((backersWithAddons / totalBackers) * 100) : 0;

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
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
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
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-orange-100 flex items-center justify-center">
                <ShoppingCart className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Backers w/ Add-ons</p>
                <p className="text-2xl font-bold">
                  {backersWithAddons.toLocaleString()}
                  <span className="text-sm font-normal text-muted-foreground ml-1">
                    ({addonsRate}%)
                  </span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
                <ShoppingBag className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Add-on Items</p>
                <p className="text-2xl font-bold">{totalAddonItems.toLocaleString()}</p>
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
            {pledgeLevelBreakdown.length > 0 ? pledgeLevelBreakdown.map((item) => (
              <div key={item.label} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{item.label}</span>
                  <span className="text-muted-foreground">
                    {item.count} ({item.percentage}%)
                  </span>
                </div>
                <Progress value={item.percentage} className="h-2" />
              </div>
            )) : (
              <div className="text-center py-4 text-muted-foreground">
                <Inbox className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No pledge level data yet</p>
              </div>
            )}
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
            {surveyStatusBreakdown.length > 0 ? surveyStatusBreakdown.map((item) => (
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
            )) : (
              <div className="text-center py-4 text-muted-foreground">
                <Inbox className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No survey data yet</p>
              </div>
            )}
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
            {shippingRegionBreakdown.length > 0 ? shippingRegionBreakdown.map((item) => (
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
            )) : (
              <div className="text-center py-4 text-muted-foreground">
                <Inbox className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No shipping data yet</p>
              </div>
            )}
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
            {paymentStatusBreakdown.length > 0 ? paymentStatusBreakdown.map((item) => (
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
            )) : (
              <div className="text-center py-4 text-muted-foreground">
                <Inbox className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No payment data yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
