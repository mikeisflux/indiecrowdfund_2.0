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
  MoreHorizontal,
  Send,
  ArrowRight,
  ChevronRight,
  AlertCircle,
  FileSpreadsheet,
  Loader2,
} from "lucide-react";
import type { PackageGroup } from "../../../types";

interface PackageGroupCardProps {
  group: PackageGroup;
  fulfillmentMethod: string;
  isPushing: boolean;
  onPushOrders: (groupId: string) => void;
  onViewGroup: (group: PackageGroup) => void;
  onExport: (groupId: string, format: "csv" | "excel" | "packing_slips" | "shipping_labels") => void;
  onEditCustoms: (groupId: string, itemName: string) => void;
}

export function PackageGroupCard({
  group,
  fulfillmentMethod,
  isPushing,
  onPushOrders,
  onViewGroup,
  onExport,
  onEditCustoms,
}: PackageGroupCardProps) {
  return (
    <Card>
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
              <DropdownMenuItem onClick={() => onViewGroup(group)}>View This Group</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport(group.id, "csv")}>Export Orders</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport(group.id, "excel")}>Export Reports</DropdownMenuItem>
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
            disabled={group.statusCounts.notPushed === 0 || isPushing}
            onClick={() => onPushOrders(group.id)}
          >
            {isPushing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            {isPushing ? "Sending..." : `Send ${group.statusCounts.notPushed} to ${fulfillmentMethod === "shopify" ? "Shopify" : fulfillmentMethod === "shipstation" ? "ShipStation" : "Fulfillment"}`}
          </Button>
        </div>

        {/* Items Table */}
        <div className="rounded-lg border overflow-x-auto">
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
                          <button className="text-teal-600 underline ml-1" onClick={() => onEditCustoms(group.id, item.name)}>edit</button>
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
          <Button variant="link" className="text-teal-600" onClick={() => onViewGroup(group)}>
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
              <DropdownMenuItem onClick={() => onExport(group.id, "csv")}>Export as CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport(group.id, "excel")}>Export as Excel</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport(group.id, "packing_slips")}>Export Packing Slips</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport(group.id, "shipping_labels")}>Export Shipping Labels</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}
