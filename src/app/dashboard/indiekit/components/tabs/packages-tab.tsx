"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  RefreshCw,
  MoreHorizontal,
  Send,
  ArrowRight,
  ChevronRight,
  AlertCircle,
  RotateCcw,
  RefreshCcw,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PackageGroup } from "../../types";

interface PackagesTabProps {
  packageGroups: PackageGroup[];
  packageGroupFilter: string;
  onPackageGroupFilterChange: (filter: string) => void;
}

export function PackagesTab({
  packageGroups,
  packageGroupFilter,
  onPackageGroupFilterChange,
}: PackagesTabProps) {
  // Calculate totals for Process All actions
  const totalNotPushed = packageGroups.reduce((sum, g) => sum + g.statusCounts.notPushed, 0);
  const totalErrored = packageGroups.reduce((sum, g) => sum + g.statusCounts.pushErrored, 0);

  return (
    <div className="space-y-6">
      {/* Fulfillment Integration Header */}
      <div className="bg-teal-600 text-white rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-2">Fulfillment Integration</h2>
        <p className="text-teal-100">Push orders to your shipping service and track fulfillment status</p>
      </div>

      {/* Process Tabs */}
      <Tabs defaultValue="by-group">
        <TabsList>
          <TabsTrigger value="process-all">Process All</TabsTrigger>
          <TabsTrigger value="by-group">Process by Group</TabsTrigger>
        </TabsList>

        {/* Process All Tab */}
        <TabsContent value="process-all" className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-4">Bulk Actions</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Push all orders to your shipping service at once, or retry failed pushes.
              </p>

              <div className="flex flex-wrap gap-4">
                <Button
                  className="bg-teal-600 hover:bg-teal-700"
                  disabled={totalNotPushed === 0}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Push all {totalNotPushed} orders
                </Button>
                <Button
                  className="bg-amber-600 hover:bg-amber-700"
                  disabled={totalErrored === 0}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Re-push all {totalErrored} errored orders
                </Button>
                <Button variant="outline">
                  <RefreshCcw className="h-4 w-4 mr-2" />
                  Update Order Status
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Status Summary */}
          <Card>
            <CardContent className="pt-6">
              <h4 className="font-medium mb-4">Overall Status</h4>
              <div className="flex items-center justify-between py-4 px-6 bg-muted/30 rounded-lg">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <div className="w-3 h-3 rounded-full bg-gray-400" />
                    <span className="text-sm text-muted-foreground">Not Pushed</span>
                  </div>
                  <p className="text-3xl font-bold">{totalNotPushed}</p>
                </div>
                <ArrowRight className="h-6 w-6 text-gray-300" />
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <div className="w-3 h-3 rounded-full bg-amber-500" />
                    <span className="text-sm text-muted-foreground">Push Errored</span>
                  </div>
                  <p className="text-3xl font-bold">{totalErrored}</p>
                </div>
                <ArrowRight className="h-6 w-6 text-gray-300" />
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <div className="w-3 h-3 rounded-full bg-amber-500" />
                    <span className="text-sm text-muted-foreground">Pushed</span>
                  </div>
                  <p className="text-3xl font-bold">
                    {packageGroups.reduce((sum, g) => sum + g.statusCounts.pushed, 0)}
                  </p>
                </div>
                <ArrowRight className="h-6 w-6 text-gray-300" />
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="text-sm text-muted-foreground">Shipped</span>
                  </div>
                  <p className="text-3xl font-bold">
                    {packageGroups.reduce((sum, g) => sum + g.statusCounts.shipped, 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Process by Group Tab */}
        <TabsContent value="by-group" className="space-y-4">
          {/* Package Group Filter */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <h3 className="text-lg font-semibold">Package Groups</h3>
              <div className="flex gap-2">
                <Button
                  variant={packageGroupFilter === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => onPackageGroupFilterChange("all")}
                  className={packageGroupFilter === "all" ? "bg-teal-600 hover:bg-teal-700" : ""}
                >
                  All ({packageGroups.length})
                </Button>
                <Button
                  variant={packageGroupFilter === "incomplete" ? "default" : "outline"}
                  size="sm"
                  onClick={() => onPackageGroupFilterChange("incomplete")}
                  className={packageGroupFilter === "incomplete" ? "bg-teal-600 hover:bg-teal-700" : ""}
                >
                  Incomplete ({packageGroups.filter(g => g.type === "incomplete").length})
                </Button>
                <Button
                  variant={packageGroupFilter === "international" ? "default" : "outline"}
                  size="sm"
                  onClick={() => onPackageGroupFilterChange("international")}
                  className={packageGroupFilter === "international" ? "bg-teal-600 hover:bg-teal-700" : ""}
                >
                  International ({packageGroups.filter(g => g.type === "international").length})
                </Button>
                <Button
                  variant={packageGroupFilter === "domestic" ? "default" : "outline"}
                  size="sm"
                  onClick={() => onPackageGroupFilterChange("domestic")}
                  className={packageGroupFilter === "domestic" ? "bg-teal-600 hover:bg-teal-700" : ""}
                >
                  Domestic ({packageGroups.filter(g => g.type === "domestic").length})
                </Button>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Groups
              </Button>
              <Button className="bg-teal-600 hover:bg-teal-700">
                <Plus className="h-4 w-4 mr-2" />
                Create Group
              </Button>
            </div>
          </div>

          {/* Package Groups Grid */}
          <div className="grid gap-6 md:grid-cols-2">
        {packageGroups
          .filter(g => packageGroupFilter === "all" || g.type === packageGroupFilter)
          .map((group) => (
          <Card key={group.id}>
            <CardContent className="pt-6">
              {/* Group Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h4 className="font-semibold">{group.name}</h4>
                  <Badge className="bg-teal-100 text-teal-700">
                    {group.type.charAt(0).toUpperCase() + group.type.slice(1)}
                  </Badge>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>View This Group</DropdownMenuItem>
                    <DropdownMenuItem>Export Orders</DropdownMenuItem>
                    <DropdownMenuItem>Export Reports</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Status Flow */}
              <div className="flex items-center justify-between py-3 mb-4 border-y">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-gray-400" />
                  <span className="text-sm">{group.statusCounts.notPushed}</span>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-300" />
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-sm">{group.statusCounts.pushErrored}</span>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-300" />
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-sm">{group.statusCounts.pushed}</span>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-300" />
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-sm">{group.statusCounts.shipped}</span>
                </div>
              </div>

              {/* Send Button */}
              <div className="mb-4">
                <p className="text-xs text-muted-foreground mb-2">
                  Group Last Sent: {group.lastSentAt || "Never"}
                </p>
                <Button
                  size="sm"
                  className="bg-teal-600 hover:bg-teal-700 w-full"
                  disabled={group.statusCounts.notPushed === 0}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send {group.statusCounts.notPushed} to ShipStation
                </Button>
              </div>

              {/* Items Table */}
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-12">Qty.</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-right w-24">Weight</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.items.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{item.quantity}</TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm">{item.name}</p>
                            {!item.customsValid && (
                              <p className="text-xs text-red-600 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                Not Valid for Customs
                                <button className="text-teal-600 underline ml-1">edit</button>
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {item.weight.lbs} lb {item.weight.oz.toFixed(1)} oz
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={2} className="text-right font-medium">
                        {group.items.length} items
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {group.totalWeight.lbs} lb {group.totalWeight.oz.toFixed(1)} oz
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {/* View Group Link */}
              <div className="mt-4 text-center">
                <Button variant="link" className="text-teal-600">
                  View This Group
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
