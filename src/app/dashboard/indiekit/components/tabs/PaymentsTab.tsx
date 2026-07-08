"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditCard, DollarSign, AlertCircle, CheckCircle, XCircle, Users } from "lucide-react";

import type { FulfillmentStats } from "../../types";

interface PaymentsTabProps {
  stats: FulfillmentStats | null;
  onOpenChargePreview: () => void;
}

/**
 * Payments Tab - Charge Cards overview
 */
export function PaymentsTab({ stats, onOpenChargePreview }: PaymentsTabProps) {
  const chargeStats = stats?.chargeStats;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-teal-600" />
            Payment Status
          </CardTitle>
          <CardDescription>
            Process additional payments for add-ons and extras purchased through the survey.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            <div className="rounded-lg border p-4 text-center">
              <div className="flex items-center justify-center gap-1 mb-2">
                <AlertCircle className="h-4 w-4 text-gray-500" />
              </div>
              <p className="text-2xl font-bold">{chargeStats?.notCharged || 0}</p>
              <p className="text-xs text-muted-foreground">Not Charged</p>
            </div>
            <div className="rounded-lg border border-red-200 dark:border-red-800 p-4 text-center bg-red-50/50 dark:bg-red-950/20">
              <div className="flex items-center justify-center gap-1 mb-2">
                <XCircle className="h-4 w-4 text-red-500" />
              </div>
              <p className="text-2xl font-bold text-red-600">{chargeStats?.errored || 0}</p>
              <p className="text-xs text-muted-foreground">Errored</p>
            </div>
            <div className="rounded-lg border border-green-200 dark:border-green-800 p-4 text-center bg-green-50/50 dark:bg-green-950/20">
              <div className="flex items-center justify-center gap-1 mb-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
              </div>
              <p className="text-2xl font-bold text-green-600">{chargeStats?.charged || 0}</p>
              <p className="text-xs text-muted-foreground">Charged</p>
            </div>
            <div className="rounded-lg border border-blue-200 dark:border-blue-800 p-4 text-center bg-blue-50/50 dark:bg-blue-950/20">
              <div className="flex items-center justify-center gap-1 mb-2">
                <DollarSign className="h-4 w-4 text-blue-500" />
              </div>
              <p className="text-2xl font-bold text-blue-600">{chargeStats?.paypalCollected || 0}</p>
              <p className="text-xs text-muted-foreground">PayPal Collected</p>
            </div>
          </div>

          {/* Add-on Revenue - post-campaign only */}
          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Add-on Revenue</p>
                <p className="text-sm text-muted-foreground">Additional revenue from post-campaign order edits</p>
              </div>
              <p className="text-2xl font-bold text-teal-600">${(stats?.postSurveyAddonRevenue || 0).toLocaleString()}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-sm py-1 px-3">
              <Users className="h-3 w-3 mr-1" />
              {stats?.backersWithBalanceDue || 0} backers with balance due
            </Badge>
          </div>

          {/* Charge action */}
          {(chargeStats?.notCharged || 0) > 0 && (
            <button
              onClick={onOpenChargePreview}
              className="w-full rounded-lg border-2 border-dashed border-teal-300 dark:border-teal-700 p-6 text-center hover:bg-teal-50 dark:hover:bg-teal-950/30 transition-colors cursor-pointer"
            >
              <CreditCard className="h-8 w-8 mx-auto text-teal-600 mb-2" />
              <p className="font-medium text-teal-700 dark:text-teal-300">Charge {chargeStats?.notCharged} Cards</p>
              <p className="text-sm text-muted-foreground mt-1">Click to preview and confirm charges</p>
            </button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
