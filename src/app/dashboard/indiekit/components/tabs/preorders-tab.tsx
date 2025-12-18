"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
}

export function PreOrdersTab({ stats, hasActiveCampaign = false }: PreOrdersTabProps) {
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
      <div className="grid gap-4 md:grid-cols-4">
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
          <CardTitle>Pre-Order Store</CardTitle>
          <CardDescription>Configure your post-campaign pre-order store</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Pre-order store not yet configured</p>
            <p className="text-sm mb-4">Set up your pre-order store after your campaign ends</p>
            <Button variant="outline" disabled>
              Configure Pre-Order Store
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
