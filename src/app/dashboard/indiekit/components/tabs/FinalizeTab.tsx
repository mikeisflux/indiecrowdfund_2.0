"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, MapPin, Loader2, AlertCircle, CheckCircle } from "lucide-react";

import type { Backer, FulfillmentStats } from "../../types";

interface FinalizeTabProps {
  stats: FulfillmentStats | null;
  backers: Backer[];
  workflowActionLoading: string | null;
  onWorkflowAction: (stepId: string) => void;
}

/**
 * Finalize Tab - Lock Orders + Lock Addresses
 */
export function FinalizeTab({ stats, backers, workflowActionLoading, onWorkflowAction }: FinalizeTabProps) {
  const eligibleForLockOrders = backers.filter(b => b.surveyCompleted && b.status === "not_pushed").length;
  const eligibleForLockAddresses = backers.filter(b => b.addressComplete).length;
  const totalBackers = stats?.totalBackers || 0;

  return (
    <div className="space-y-6">
      {/* Lock Orders */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-amber-600" />
            Lock Orders
          </CardTitle>
          <CardDescription>
            Finalize what each backer is getting. Once locked, backers can no longer change their selections.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg border p-4 text-center">
              <p className="text-2xl font-bold">{totalBackers}</p>
              <p className="text-xs text-muted-foreground">Total Backers</p>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <p className="text-2xl font-bold text-amber-600">{eligibleForLockOrders}</p>
              <p className="text-xs text-muted-foreground">Ready to Lock</p>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{stats?.surveysCompleted || 0}</p>
              <p className="text-xs text-muted-foreground">Surveys Completed</p>
            </div>
          </div>

          <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg text-sm">
            <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
            <p className="text-blue-800 dark:text-blue-300">
              Locking orders prevents backers from modifying their survey responses. Make sure all surveys are collected before locking.
            </p>
          </div>

          <Button
            onClick={() => onWorkflowAction("lock_orders")}
            disabled={eligibleForLockOrders === 0 || workflowActionLoading === "lock_orders"}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {workflowActionLoading === "lock_orders" ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Locking Orders...
              </>
            ) : (
              <>
                <Lock className="h-4 w-4 mr-2" />
                Lock {eligibleForLockOrders} Orders
              </>
            )}
          </Button>
          {eligibleForLockOrders === 0 && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle className="h-4 w-4" />
              All eligible orders are locked
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lock Addresses */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-teal-600" />
            Lock Addresses
          </CardTitle>
          <CardDescription>
            Confirm shipping details. Once locked, backers can no longer change their shipping address.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg border p-4 text-center">
              <p className="text-2xl font-bold">{totalBackers}</p>
              <p className="text-xs text-muted-foreground">Total Backers</p>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <p className="text-2xl font-bold text-teal-600">{eligibleForLockAddresses}</p>
              <p className="text-xs text-muted-foreground">Addresses Complete</p>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <p className="text-2xl font-bold text-red-600">{totalBackers - eligibleForLockAddresses}</p>
              <p className="text-xs text-muted-foreground">Missing Address</p>
            </div>
          </div>

          <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg text-sm">
            <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
            <p className="text-blue-800 dark:text-blue-300">
              Locking addresses prevents backers from updating their shipping information. Only lock when you&apos;re ready to start shipping.
            </p>
          </div>

          <Button
            onClick={() => onWorkflowAction("lock_addresses")}
            disabled={eligibleForLockAddresses === 0 || workflowActionLoading === "lock_addresses"}
            className="bg-teal-600 hover:bg-teal-700 text-white"
          >
            {workflowActionLoading === "lock_addresses" ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Locking Addresses...
              </>
            ) : (
              <>
                <MapPin className="h-4 w-4 mr-2" />
                Lock {eligibleForLockAddresses} Addresses
              </>
            )}
          </Button>
          {eligibleForLockAddresses === 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary">No addresses to lock</Badge>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
