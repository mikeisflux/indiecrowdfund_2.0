"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Circle,
  AlertCircle,
  ArrowRight,
  Download,
  Mail,
  Banknote,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Backer, FulfillmentStats } from "../../types";
import { STATUS_LABELS } from "../../types";

interface OverviewTabProps {
  stats: FulfillmentStats | null;
  backers: Backer[];
}

export function OverviewTab({ stats, backers }: OverviewTabProps) {
  // Determine next action based on current state
  const surveysPending = stats?.surveysPending || 0;
  const notShipped = backers.filter(b => b.status !== "shipped").length;

  return (
    <div className="space-y-6">
      {/* What's Next Success Banner */}
      <div className="bg-teal-600 text-white rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">What&apos;s Next?</h3>
              {surveysPending > 0 ? (
                <p className="text-teal-100">
                  Send survey reminders to {surveysPending} backers who haven&apos;t completed their survey yet.
                </p>
              ) : notShipped > 0 ? (
                <p className="text-teal-100">
                  All surveys collected! Ready to start shipping {notShipped} orders.
                </p>
              ) : (
                <p className="text-teal-100">
                  All orders have been shipped! Your campaign fulfillment is complete.
                </p>
              )}
            </div>
          </div>
          <Button variant="secondary" className="bg-white text-teal-600 hover:bg-teal-50">
            {surveysPending > 0 ? "Send Reminders" : notShipped > 0 ? "Start Shipping" : "View Report"}
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>

      {/* Status Flow Component */}
      <Card>
        <CardHeader>
          <CardTitle>Fulfillment Status Flow</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between py-4">
            {Object.entries(STATUS_LABELS).map(([status, label], index) => {
              const count = backers.filter((b) => b.status === status).length;
              return (
                <div key={status} className="flex items-center">
                  <div className="text-center">
                    <div className={cn(
                      "inline-flex h-3 w-3 rounded-full mb-2",
                      status === "not_pushed" && "bg-gray-400",
                      status === "push_errored" && "bg-amber-500",
                      status === "pushed" && "bg-amber-500",
                      status === "shipped" && "bg-green-500"
                    )} />
                    <p className="text-3xl font-bold">{count}</p>
                    <p className="text-sm text-muted-foreground">{label}</p>
                  </div>
                  {index < Object.keys(STATUS_LABELS).length - 1 && (
                    <ArrowRight className="h-6 w-6 text-gray-300 mx-4" />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Charge Details Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Charge Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-lg border p-4 text-center">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 mb-2">
                <Circle className="h-5 w-5 text-gray-600" />
              </div>
              <p className="text-2xl font-bold">{stats?.chargeStats?.notCharged || 0}</p>
              <p className="text-sm text-muted-foreground">Not Charged</p>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-red-100 mb-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <p className="text-2xl font-bold">{stats?.chargeStats?.errored || 0}</p>
              <p className="text-sm text-muted-foreground">Errored</p>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-green-100 mb-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <p className="text-2xl font-bold">{stats?.chargeStats?.charged || 0}</p>
              <p className="text-sm text-muted-foreground">Charged</p>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 mb-2">
                <Banknote className="h-5 w-5 text-blue-600" />
              </div>
              <p className="text-2xl font-bold">{stats?.chargeStats?.paypalCollected || 0}</p>
              <p className="text-sm text-muted-foreground">PayPal Collected</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Activity</CardTitle>
          <Button variant="outline" size="sm">View All</Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">150 orders shipped</p>
                <p className="text-xs text-muted-foreground">US Standard package group</p>
              </div>
              <p className="text-xs text-muted-foreground">2 hours ago</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Mail className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Survey reminder sent</p>
                <p className="text-xs text-muted-foreground">34 backers reminded</p>
              </div>
              <p className="text-xs text-muted-foreground">5 hours ago</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                <Download className="h-5 w-5 text-purple-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Digital files distributed</p>
                <p className="text-xs text-muted-foreground">Soundtrack.zip sent to 320 backers</p>
              </div>
              <p className="text-xs text-muted-foreground">Yesterday</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
