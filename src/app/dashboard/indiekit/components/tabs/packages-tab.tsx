"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  ArrowLeft,
  ChevronRight,
  AlertCircle,
  RotateCcw,
  RefreshCcw,
  Search,
  FileSpreadsheet,
  ExternalLink,
  CheckCircle2,
  Info,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PackageGroup } from "../../types";

interface ConnectedService {
  id: string;
  name: string;
  accountId: string;
  connectedAt: string;
}

interface PackagesTabProps {
  packageGroups: PackageGroup[];
  packageGroupFilter: string;
  onPackageGroupFilterChange: (filter: string) => void;
  hasActiveCampaign?: boolean;
  connectedServices?: ConnectedService[];
}

export function PackagesTab({
  packageGroups,
  packageGroupFilter,
  onPackageGroupFilterChange,
  hasActiveCampaign = true,
  connectedServices = [],
}: PackagesTabProps) {
  const [segmentFilter, setSegmentFilter] = useState("ready_to_ship");
  const [searchGroupId, setSearchGroupId] = useState("");
  const [lastRefreshed] = useState(new Date().toLocaleString());

  // Show message if no active campaign
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

  // Calculate totals for Process All actions
  const totalNotPushed = packageGroups.reduce((sum, g) => sum + g.statusCounts.notPushed, 0);
  const totalErrored = packageGroups.reduce((sum, g) => sum + g.statusCounts.pushErrored, 0);

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button variant="ghost" size="sm" className="-mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back
      </Button>

      {/* Fulfillment Integration Header */}
      <div className="bg-teal-600 text-white rounded-lg p-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold mb-2">Fulfillment Integration</h2>
            <p className="text-teal-100">Push orders to your shipping service and track fulfillment status</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-0">
                Switch Fulfillment Method
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>ShipStation</DropdownMenuItem>
              <DropdownMenuItem>CSV Export</DropdownMenuItem>
              <DropdownMenuItem>Manual Fulfillment</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Process Tabs - Now includes Instructions and Connect */}
      <Tabs defaultValue="by-group">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="instructions">Instructions</TabsTrigger>
          <TabsTrigger value="connect">1. Connect</TabsTrigger>
          <TabsTrigger value="process-all">2a. Process All</TabsTrigger>
          <TabsTrigger value="by-group">2b. Process by Group</TabsTrigger>
        </TabsList>

        {/* Instructions Tab */}
        <TabsContent value="instructions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>How Fulfillment Integration Works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-600 font-semibold">
                      1
                    </div>
                    <div>
                      <h4 className="font-semibold">Connect Your Shipping Service</h4>
                      <p className="text-sm text-muted-foreground">
                        Link your ShipStation, EasyPost, or other fulfillment account to enable automatic order syncing.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-600 font-semibold">
                      2
                    </div>
                    <div>
                      <h4 className="font-semibold">Set Up Package Groups</h4>
                      <p className="text-sm text-muted-foreground">
                        Organize orders by shipping destination, product type, or custom criteria for efficient processing.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-600 font-semibold">
                      3
                    </div>
                    <div>
                      <h4 className="font-semibold">Push Orders</h4>
                      <p className="text-sm text-muted-foreground">
                        Send orders to your shipping service individually by group, or all at once with Process All.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-600 font-semibold">
                      4
                    </div>
                    <div>
                      <h4 className="font-semibold">Track Status</h4>
                      <p className="text-sm text-muted-foreground">
                        Monitor push status and shipping progress in real-time. Handle any errors that occur.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-600 font-semibold">
                      5
                    </div>
                    <div>
                      <h4 className="font-semibold">Update Order Status</h4>
                      <p className="text-sm text-muted-foreground">
                        Sync shipping status back from your fulfillment service to mark orders as shipped.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-teal-600 mt-0.5" />
                  <div>
                    <h4 className="font-semibold mb-1">Before You Begin</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Ensure all product weights are set correctly for accurate shipping rates</li>
                      <li>• Configure customs information for international shipments</li>
                      <li>• Verify backer addresses are complete before pushing orders</li>
                      <li>• Test with a small batch first before bulk processing</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex justify-center">
                <Button className="bg-teal-600 hover:bg-teal-700">
                  Get Started - Connect Service
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Connect Tab */}
        <TabsContent value="connect" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Connected Services</CardTitle>
            </CardHeader>
            <CardContent>
              {connectedServices.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Service</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Connected</TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {connectedServices.map((service) => (
                      <TableRow key={service.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <span className="font-medium">{service.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {service.accountId}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {service.connectedAt}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="text-teal-600">
                            Update
                            <ExternalLink className="h-3 w-3 ml-1" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground mb-4">No services connected yet</p>
                </div>
              )}

              <div className="flex justify-center mt-6">
                <Button className="bg-teal-600 hover:bg-teal-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Add New Connection
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Process All Tab */}
        <TabsContent value="process-all" className="space-y-6">
          {/* Filter by Segment */}
          <div className="w-full">
            <Select value={segmentFilter} onValueChange={setSegmentFilter}>
              <SelectTrigger className="w-full h-12">
                <SelectValue placeholder="Filter by Segment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Backers</SelectItem>
                <SelectItem value="ready_to_ship">All Backers with Ready To Ship Orders</SelectItem>
                <SelectItem value="survey_complete">Survey Complete</SelectItem>
                <SelectItem value="address_complete">Address Complete</SelectItem>
                <SelectItem value="payment_complete">Payment Complete</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Service Box, Add New Orders Box, Search Box Row */}
          <div className="grid gap-4 md:grid-cols-3">
            {/* Service Box */}
            <Card>
              <CardContent className="pt-6">
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Connected Service</h4>
                <p className="font-semibold">ShipStation</p>
                <p className="text-sm text-muted-foreground">(NDM Express)</p>
                <Button variant="link" className="text-teal-600 p-0 h-auto mt-2">
                  Update Order Status
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </CardContent>
            </Card>

            {/* Add New Orders Box */}
            <Card>
              <CardContent className="pt-6">
                <Button className="bg-teal-600 hover:bg-teal-700 w-full mb-2">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Package Groups
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Last Refreshed: {lastRefreshed}
                </p>
              </CardContent>
            </Card>

            {/* Search Box */}
            <Card>
              <CardContent className="pt-6">
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Search Package Group</h4>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter Package Group #"
                    value={searchGroupId}
                    onChange={(e) => setSearchGroupId(e.target.value)}
                  />
                  <Button size="icon" className="bg-teal-600 hover:bg-teal-700">
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

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
          {/* Filter by Segment */}
          <div className="w-full">
            <Select value={segmentFilter} onValueChange={setSegmentFilter}>
              <SelectTrigger className="w-full h-12">
                <SelectValue placeholder="Filter by Segment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Backers</SelectItem>
                <SelectItem value="ready_to_ship">All Backers with Ready To Ship Orders</SelectItem>
                <SelectItem value="survey_complete">Survey Complete</SelectItem>
                <SelectItem value="address_complete">Address Complete</SelectItem>
                <SelectItem value="payment_complete">Payment Complete</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Service Box, Add New Orders Box, Search Box Row */}
          <div className="grid gap-4 md:grid-cols-3">
            {/* Service Box */}
            <Card>
              <CardContent className="pt-6">
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Connected Service</h4>
                <p className="font-semibold">ShipStation</p>
                <p className="text-sm text-muted-foreground">(NDM Express)</p>
                <Button variant="link" className="text-teal-600 p-0 h-auto mt-2">
                  Update Order Status
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </CardContent>
            </Card>

            {/* Add New Orders Box */}
            <Card>
              <CardContent className="pt-6">
                <Button className="bg-teal-600 hover:bg-teal-700 w-full mb-2">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Package Groups
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Last Refreshed: {lastRefreshed}
                </p>
              </CardContent>
            </Card>

            {/* Search Box */}
            <Card>
              <CardContent className="pt-6">
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Search Package Group</h4>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter Package Group #"
                    value={searchGroupId}
                    onChange={(e) => setSearchGroupId(e.target.value)}
                  />
                  <Button size="icon" className="bg-teal-600 hover:bg-teal-700">
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Package Group Filter */}
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <h3 className="text-lg font-semibold whitespace-nowrap">Package Groups</h3>
              <div className="flex flex-wrap gap-2">
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
            <div className="flex flex-wrap gap-2">
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
                  {/* Group Header with ID */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div>
                        <h4 className="font-semibold">Package Group #{group.id}</h4>
                        <p className="text-sm text-muted-foreground">{group.name}</p>
                      </div>
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

                  {/* Export Reports Dropdown */}
                  <div className="mt-2 pt-2 border-t">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground">
                          <FileSpreadsheet className="h-4 w-4 mr-2" />
                          Export reports for this group
                          <ChevronRight className="h-4 w-4 ml-auto" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-48">
                        <DropdownMenuItem>Export as CSV</DropdownMenuItem>
                        <DropdownMenuItem>Export as Excel</DropdownMenuItem>
                        <DropdownMenuItem>Export Packing Slips</DropdownMenuItem>
                        <DropdownMenuItem>Export Shipping Labels</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
