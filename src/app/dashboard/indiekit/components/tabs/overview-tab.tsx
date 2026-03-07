"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  DollarSign,
  Users,
  ShoppingCart,
  Inbox,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getCSRFHeaders } from "@/lib/csrf";
import type { Backer, FulfillmentStats } from "../../types";
import { STATUS_LABELS } from "../../types";

interface TimelineEntry {
  id: string;
  type: string;
  time: string;
  title: string;
  detail: string;
  date: string;
}

interface OverviewTabProps {
  stats: FulfillmentStats | null;
  backers: Backer[];
  timeline?: TimelineEntry[];
  projectId?: string;
  onSwitchTab?: (tab: string) => void;
}

export function OverviewTab({ stats, backers, timeline = [], projectId, onSwitchTab }: OverviewTabProps) {
  const [isSendingReminders, setIsSendingReminders] = useState(false);

  const handleWhatsNextAction = async () => {
    const surveysPendingCount = stats?.surveysPending || 0;
    const notShippedCount = backers.filter(b => b.status !== "shipped").length;

    if (surveysPendingCount > 0) {
      // Send survey reminders
      if (!projectId) {
        toast.error("No project selected");
        return;
      }

      setIsSendingReminders(true);
      try {
        const res = await apiFetch("/api/creator/indiekit/backers", {
          method: "POST",
          headers: { "Content-Type": "application/json", },
          body: JSON.stringify({
            action: "send_survey_reminder",
            projectId,
            sendToAll: true,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to send reminders");
        }

        toast.success(`Sent reminders to ${surveysPendingCount} backers`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to send reminders");
      } finally {
        setIsSendingReminders(false);
      }
    } else if (notShippedCount > 0) {
      // Switch to packages tab for shipping workflow
      if (onSwitchTab) {
        onSwitchTab("packages");
      } else {
        window.location.href = "/dashboard/indiekit?tab=packages";
      }
    } else {
      // View fulfillment report - switch to timeline tab
      if (onSwitchTab) {
        onSwitchTab("timeline");
      } else {
        window.location.href = "/dashboard/indiekit?tab=timeline";
      }
    }
  };

  // Determine next action based on current state
  const surveysPending = stats?.surveysPending || 0;
  const notShipped = backers.filter(b => b.status !== "shipped").length;

  // Calculate post-campaign raised amounts across all projects
  const postCampaignTotal = stats?.postCampaignTotalRaised || 0;
  const postCampaignPerProject = stats?.postCampaignPerProject || [];

  // Color palette for per-project chart segments
  const projectColors = ["bg-teal-600", "bg-teal-400", "bg-emerald-500", "bg-cyan-500", "bg-sky-500", "bg-indigo-400"];
  const raisedChartData = postCampaignPerProject.map((p, idx) => ({
    label: p.projectTitle,
    amount: p.amount,
    color: projectColors[idx % projectColors.length],
  }));

  // Get recent activity (last 5 entries)
  const recentActivity = timeline.slice(0, 5);

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
          <Button
            variant="secondary"
            className="bg-white text-teal-600 hover:bg-teal-50"
            onClick={handleWhatsNextAction}
            disabled={isSendingReminders}
          >
            {isSendingReminders ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                {surveysPending > 0 ? "Send Reminders" : notShipped > 0 ? "Start Shipping" : "View Report"}
                <ChevronRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Post-Campaign Sales Card with Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-teal-600" />
            Post-Campaign Sales
          </CardTitle>
        </CardHeader>
        <CardContent>
          {postCampaignTotal > 0 ? (
            <div className="grid gap-6 md:grid-cols-2">
              {/* Chart Side */}
              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-4xl font-bold">${postCampaignTotal.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Total Post-Campaign Sales</p>
                </div>

                {/* Horizontal stacked bar chart */}
                <div className="flex h-10 rounded-lg overflow-hidden">
                  {raisedChartData.map((item, idx) => (
                    <div
                      key={idx}
                      className={cn(item.color, "flex items-center justify-center text-white text-xs font-medium")}
                      style={{ width: `${(Number(item.amount) / postCampaignTotal) * 100}%` }}
                    >
                      {(Number(item.amount) / postCampaignTotal) * 100 > 15 && `$${(Number(item.amount) / 1000).toFixed(1)}k`}
                    </div>
                  ))}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap justify-center gap-4">
                  {raisedChartData.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className={cn("w-3 h-3 rounded-sm", item.color)} />
                      <span className="text-sm text-muted-foreground">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Details Side */}
              <div className="space-y-3">
                {raisedChartData.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center py-2 border-b last:border-0">
                    <div className="flex items-center gap-2">
                      <div className={cn("w-3 h-3 rounded-sm", item.color)} />
                      <span className="text-sm font-medium">{item.label}</span>
                    </div>
                    <span className="font-semibold">${item.amount.toLocaleString()}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-2 border-t-2">
                  <span className="font-semibold">Total</span>
                  <span className="text-lg font-bold">${postCampaignTotal.toLocaleString()}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No post-campaign sales yet</p>
              <p className="text-sm">Sales from survey add-on purchases will appear here after your campaign closes</p>
            </div>
          )}
        </CardContent>
      </Card>

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

      {/* Key Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total Backers</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats?.totalBackers || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Surveys Completed</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {stats?.surveysCompleted || 0}
              <span className="text-sm font-normal text-muted-foreground ml-1">
                ({((stats?.surveysCompleted || 0) / (stats?.totalBackers || 1) * 100).toFixed(0)}%)
              </span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Purchased Add-ons</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {stats?.backersWithAddons || 0}
              <span className="text-sm font-normal text-muted-foreground ml-1">
                ({((stats?.backersWithAddons || 0) / (stats?.totalBackers || 1) * 100).toFixed(0)}%)
              </span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-sm text-muted-foreground">Fulfilled</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {stats?.fulfilledBackers || 0}
              <span className="text-sm font-normal text-muted-foreground ml-1">
                ({((stats?.fulfilledBackers || 0) / (stats?.totalBackers || 1) * 100).toFixed(0)}%)
              </span>
            </p>
          </CardContent>
        </Card>
      </div>

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
          <Button variant="outline" size="sm" onClick={() => {
            if (onSwitchTab) {
              onSwitchTab("timeline");
            } else {
              window.location.href = "/dashboard/indiekit?tab=timeline";
            }
          }}>View All</Button>
        </CardHeader>
        <CardContent>
          {recentActivity.length > 0 ? (
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-center gap-4">
                  <div className={cn(
                    "h-10 w-10 rounded-full flex items-center justify-center",
                    activity.type === "survey_completed" && "bg-green-100",
                    activity.type === "order_shipped" && "bg-green-100",
                    activity.type === "survey_reminder" && "bg-blue-100",
                    activity.type === "digital_download" && "bg-purple-100",
                    activity.type === "cards_charged" && "bg-green-100",
                    activity.type === "charge_failed" && "bg-red-100",
                    !["survey_completed", "order_shipped", "survey_reminder", "digital_download", "cards_charged", "charge_failed"].includes(activity.type) && "bg-gray-100"
                  )}>
                    {activity.type === "survey_completed" && <CheckCircle2 className="h-5 w-5 text-green-600" />}
                    {activity.type === "order_shipped" && <CheckCircle2 className="h-5 w-5 text-green-600" />}
                    {activity.type === "survey_reminder" && <Mail className="h-5 w-5 text-blue-600" />}
                    {activity.type === "digital_download" && <Download className="h-5 w-5 text-purple-600" />}
                    {activity.type === "cards_charged" && <CheckCircle2 className="h-5 w-5 text-green-600" />}
                    {activity.type === "charge_failed" && <AlertCircle className="h-5 w-5 text-red-600" />}
                    {!["survey_completed", "order_shipped", "survey_reminder", "digital_download", "cards_charged", "charge_failed"].includes(activity.type) && <Circle className="h-5 w-5 text-gray-600" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{activity.title}</p>
                    <p className="text-xs text-muted-foreground">{activity.detail}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{activity.time}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Inbox className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No recent activity</p>
              <p className="text-sm">Activity will appear here as you manage your fulfillment</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
