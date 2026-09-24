"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/fetch-utils";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DollarSign,
  Users,
  UserCheck,
  UserPlus,
  AlertCircle,
} from "lucide-react";
import type { FulfillmentStats } from "../../types";

interface PreOrdersTabProps {
  stats: FulfillmentStats | null;
  hasActiveCampaign?: boolean;
  projectId?: string;
}

export function PreOrdersTab({ stats, hasActiveCampaign = false, projectId }: PreOrdersTabProps) {
  const [preOrdersEnabled, setPreOrdersEnabled] = useState(false);
  const [projectSlug, setProjectSlug] = useState<string | null>(null);
  const [projectStatus, setProjectStatus] = useState<string | null>(null);
  const [projectEndDate, setProjectEndDate] = useState<string | null>(null);
  const [campaignType, setCampaignType] = useState<string | null>(null);
  const [storeLoading, setStoreLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);

  const loadStoreState = useCallback(async () => {
    if (!projectId) {
      setStoreLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/creator/indiekit/settings?projectId=${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setPreOrdersEnabled(!!data.project?.preOrdersEnabled);
        setProjectSlug(data.project?.slug || null);
        setProjectStatus(data.project?.status || null);
        setProjectEndDate(data.project?.endDate || null);
        setCampaignType(data.project?.campaignType || null);
      }
    } catch {
      // Card shows the toggle with defaults.
    } finally {
      setStoreLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadStoreState();
  }, [loadStoreState]);

  const handleTogglePreOrders = async (checked: boolean) => {
    if (!projectId) return;
    setIsToggling(true);
    try {
      const res = await apiFetch("/api/creator/indiekit/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, action: "update_general", preOrdersEnabled: checked }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to update");
      setPreOrdersEnabled(checked);
      toast.success(
        checked
          ? "Pre-orders on — your campaign page keeps taking orders after the end date"
          : "Pre-orders off — the campaign page closes at the end date"
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update");
    } finally {
      setIsToggling(false);
    }
  };

  const hasCampaignEnded = projectEndDate ? new Date(projectEndDate) < new Date() : false;
  // Mirror of the pledge API's settle rule, for honest status copy.
  const storeCanRun =
    campaignType === "KEEP_IT_ALL" ||
    projectStatus === "FUNDED" ||
    !hasCampaignEnded;
  const storeLiveNow =
    preOrdersEnabled &&
    hasCampaignEnded &&
    (projectStatus === "LIVE" || projectStatus === "FUNDED") &&
    storeCanRun;
  if (!hasActiveCampaign) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Active Campaign</h3>
            <p className="text-muted-foreground">
              You must have an active campaign to see data here.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalBackers = stats?.totalBackers || 0;
  const returningBackers = stats?.returningBackers || 0;
  const newBackers = stats?.newBackers || 0;
  // totalRaised available for future use
  const _totalRaised = stats?.totalRaised || 0;
  void _totalRaised;

  // Calculate percentages
  const returningPercent = totalBackers > 0 ? (returningBackers / totalBackers) * 100 : 0;
  const newPercent = totalBackers > 0 ? (newBackers / totalBackers) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Pre-Order Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Pre-Order Revenue</span>
            </div>
            <p className="text-2xl font-bold mt-1">${(stats?.preOrderRevenue || 0).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Pre-Order Backers</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats?.preOrderBackers || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Returning Backers</span>
            </div>
            <p className="text-2xl font-bold mt-1">{returningBackers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">New Backers</span>
            </div>
            <p className="text-2xl font-bold mt-1">{newBackers}</p>
          </CardContent>
        </Card>
      </div>

      {/* New vs Returning Backers */}
      <Card>
        <CardHeader>
          <CardTitle>New vs Returning Backers</CardTitle>
          <CardDescription>Breakdown of backer acquisition</CardDescription>
        </CardHeader>
        <CardContent>
          {totalBackers > 0 ? (
            <>
              {/* Legend - shown above the bar for clarity */}
              <div className="flex justify-center gap-6 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-teal-300" />
                  <span className="text-sm">Returning Backers ({returningPercent.toFixed(0)}%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-teal-600" />
                  <span className="text-sm">New Backers ({newPercent.toFixed(0)}%)</span>
                </div>
              </div>

              {/* Proportion Bar - without text inside */}
              <div className="flex h-10 rounded-lg overflow-hidden mb-6">
                {returningPercent > 0 && (
                  <div
                    className="bg-teal-300"
                    style={{ width: `${returningPercent}%` }}
                  />
                )}
                {newPercent > 0 && (
                  <div
                    className="bg-teal-600"
                    style={{ width: `${newPercent}%` }}
                  />
                )}
              </div>

              {/* Stats Table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead></TableHead>
                    <TableHead className="text-right">Backers</TableHead>
                    <TableHead className="text-right">Percentage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm bg-teal-300" />
                        <span>Returning</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{returningBackers}</TableCell>
                    <TableCell className="text-right">{returningPercent.toFixed(0)}%</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm bg-teal-600" />
                        <span>New Backers</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{newBackers}</TableCell>
                    <TableCell className="text-right">{newPercent.toFixed(0)}%</TableCell>
                  </TableRow>
                  <TableRow className="font-medium border-t-2">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">{totalBackers}</TableCell>
                    <TableCell className="text-right">100%</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No backer data yet</p>
              <p className="text-sm">Backer breakdown will appear here once you have backers</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pre-Order Store Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Pre-Order Store
            {storeLiveNow && <Badge className="bg-green-100 text-green-700">Live</Badge>}
          </CardTitle>
          <CardDescription>
            Keep taking orders on your campaign page after the campaign ends
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {storeLoading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Loading…</p>
          ) : (
            <>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Accept pre-orders after the campaign ends</p>
                  <p className="text-sm text-muted-foreground">
                    Reward buttons stay live and read &quot;Pre-order&quot;; new orders appear here
                    and ship with fulfillment
                  </p>
                </div>
                <Switch
                  checked={preOrdersEnabled}
                  onCheckedChange={handleTogglePreOrders}
                  disabled={isToggling || !projectId}
                />
              </div>

              {preOrdersEnabled && hasCampaignEnded && !storeCanRun && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-3 text-sm text-amber-800 dark:text-amber-300 flex gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    Pre-orders only run on Keep-It-All campaigns or funded All-or-Nothing
                    campaigns — an unfunded AoN can&apos;t collect the charges, so the store
                    stays closed until this campaign funds.
                  </span>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                {hasCampaignEnded
                  ? preOrdersEnabled
                    ? "Your campaign has ended — the store applies right now."
                    : "Your campaign has ended — turn this on to reopen ordering."
                  : "Your campaign is still running; this takes effect the moment it ends."}
              </p>

              {projectSlug && (
                <Button variant="outline" size="sm" asChild>
                  <a href={`/projects/${projectSlug}`} target="_blank" rel="noopener noreferrer">
                    View campaign page
                  </a>
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
