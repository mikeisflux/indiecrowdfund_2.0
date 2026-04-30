"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Check, Lock, ChevronRight, Loader2, ClipboardList } from "lucide-react";
import type { WorkflowStep, Backer, FulfillmentStats } from "../../types";

interface WorkflowProgressProps {
  workflowSteps: WorkflowStep[];
  stats: FulfillmentStats | null;
  backers: Backer[];
  workflowActionLoading: string | null;
  onWorkflowAction: (stepId: string) => void;
  onNavigateToTab: (tab: string) => void;
  onGiveFeedback?: () => void;
}

export function WorkflowProgress({
  workflowSteps,
  stats,
  backers,
  workflowActionLoading,
  onWorkflowAction,
  onNavigateToTab,
  onGiveFeedback,
}: WorkflowProgressProps) {
  const fulfillmentPercent = stats ? (stats.fulfilledBackers / stats.totalBackers) * 100 : 0;
  const surveyPercent = stats ? (stats.surveysCompleted / stats.totalBackers) * 100 : 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-4 w-4 text-teal-600" />
            Take Action
          </CardTitle>
          <CardDescription>Fulfillment workflow</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {workflowSteps.map((step) => {
            const actionCount = step.actionCount ?? (() => {
              switch (step.id) {
                case "surveys":
                  return stats?.surveysPending || 0;
                case "lock_orders":
                  return backers.filter(b => b.surveyCompleted && b.status === "not_pushed").length;
                case "charge_cards":
                  return stats?.chargeStats?.notCharged || 0;
                case "lock_addresses":
                  return backers.filter(b => b.addressComplete).length;
                case "start_shipping":
                  return backers.filter(b => b.status === "not_pushed").length;
                case "shipped":
                  return backers.filter(b => b.status === "pushed").length;
                default:
                  return 0;
              }
            })();
            const isClickable = step.status !== "locked";
            const isLoading = workflowActionLoading === step.id;
            const hasAction = ["lock_orders", "charge_cards", "lock_addresses", "start_shipping", "shipped"].includes(step.id);

            return (
              <div key={step.id} className="space-y-1">
                <button
                  onClick={() => {
                    if (isClickable && step.targetTab) {
                      onNavigateToTab(step.targetTab);
                    }
                  }}
                  disabled={step.status === "locked"}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-lg p-3 transition-colors text-left",
                    step.status === "in_progress" && "bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800",
                    step.status === "completed" && "bg-green-50 dark:bg-green-950/30",
                    step.status === "pending" && "bg-muted/50 hover:bg-muted",
                    step.status === "locked" && "opacity-50 cursor-not-allowed",
                    isClickable && "cursor-pointer hover:ring-2 hover:ring-teal-200 dark:hover:ring-teal-800"
                  )}
                >
                  <div className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full",
                    step.status === "completed" && "bg-green-500 text-white",
                    step.status === "in_progress" && "bg-teal-500 text-white",
                    step.status === "pending" && "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400",
                    step.status === "locked" && "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600"
                  )}>
                    {step.status === "completed" ? (
                      <Check className="h-4 w-4" />
                    ) : step.status === "locked" ? (
                      <Lock className="h-4 w-4" />
                    ) : (
                      <step.icon className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-sm font-medium truncate",
                      step.status === "locked" && "text-muted-foreground"
                    )}>
                      {step.label}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{step.description}</p>
                  </div>
                  {actionCount > 0 && step.status !== "completed" && (
                    <Badge variant="secondary" className={cn(
                      "text-xs",
                      step.status === "in_progress" && "bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300",
                      step.status === "pending" && "bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300"
                    )}>
                      {actionCount}
                    </Badge>
                  )}
                  {step.status === "in_progress" && (
                    <ChevronRight className="h-4 w-4 text-teal-600" />
                  )}
                </button>
                {hasAction && step.status !== "locked" && step.status !== "completed" && actionCount > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs h-7 border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950"
                    onClick={(e) => {
                      e.stopPropagation();
                      onWorkflowAction(step.id);
                    }}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        {step.id === "lock_orders" && `Lock ${actionCount} Orders`}
                        {step.id === "charge_cards" && `Charge ${actionCount} Cards`}
                        {step.id === "lock_addresses" && `Lock ${actionCount} Addresses`}
                        {step.id === "start_shipping" && `Push ${actionCount} to Fulfillment`}
                        {step.id === "shipped" && `Mark ${actionCount} Shipped`}
                      </>
                    )}
                  </Button>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Quick Stats</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">Fulfillment</span>
              <span className="font-medium">{stats?.fulfilledBackers || 0}/{stats?.totalBackers || 0}</span>
            </div>
            <Progress value={fulfillmentPercent} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">{fulfillmentPercent.toFixed(0)}% complete</p>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">Surveys</span>
              <span className="font-medium">{stats?.surveysCompleted || 0}/{stats?.totalBackers || 0}</span>
            </div>
            <Progress value={surveyPercent} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">{surveyPercent.toFixed(0)}% collected</p>
          </div>
          {onGiveFeedback && (
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2"
              onClick={onGiveFeedback}
            >
              Give Feedback
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
