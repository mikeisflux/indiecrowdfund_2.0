"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditCard, DollarSign, AlertCircle, CheckCircle, XCircle, Users } from "lucide-react";

import type { FulfillmentStats } from "../../types";

interface PaymentsTabProps {
  stats: FulfillmentStats | null;
}

/**
 * Payments Tab — a read-only view of what backers have paid.
 *
 * There is no creator-initiated charge here, and the button that used to
 * open one has gone: the API rejects bulk charging outright, so it could
 * only ever fail. Backers pay add-on and balance amounts themselves when
 * they complete their survey. The figures stay because knowing how much is
 * uncollected is still worth seeing.
 */
export function PaymentsTab({ stats }: PaymentsTabProps) {
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

          {/* Where the "Charge N Cards" button used to be. It opened a
              preview whose Confirm always failed, because the API has no
              creator-initiated bulk charge. Saying who still owes, and how
              they pay, is the honest version of the same information. */}
          {(chargeStats?.notCharged || 0) > 0 && (
            <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">
                {chargeStats?.notCharged} backer
                {chargeStats?.notCharged === 1 ? "" : "s"} still owe a balance
              </p>
              <p className="mt-1">
                Backers pay add-on and shipping balances themselves when they complete
                their survey — there is no charge to run from here. Chase anyone
                outstanding with a survey reminder from the Backers tab.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
