"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  MoreHorizontal,
  Users,
  Filter,
  Layers,
  Mail,
  Edit,
  Copy,
  Trash2,
} from "lucide-react";

interface Segment {
  id: string;
  name: string;
  type: "pledge_level" | "addon" | "survey_status" | "shipping_region" | "payment_status" | "custom";
  criteria: string;
  backerCount: number;
  createdAt: string;
}

interface SegmentsTabProps {
  segments?: Segment[];
}

// Demo data
const demoSegments: Segment[] = [
  {
    id: "1",
    name: "Premium Backers",
    type: "pledge_level",
    criteria: "Pledge Level: Collector's Edition ($150+)",
    backerCount: 89,
    createdAt: "11/15/24",
  },
  {
    id: "2",
    name: "Art Print Add-on",
    type: "addon",
    criteria: "Has Add-on: Limited Art Print",
    backerCount: 156,
    createdAt: "11/10/24",
  },
  {
    id: "3",
    name: "Survey Incomplete",
    type: "survey_status",
    criteria: "Survey Status: Not Completed",
    backerCount: 34,
    createdAt: "11/01/24",
  },
  {
    id: "4",
    name: "International Backers",
    type: "shipping_region",
    criteria: "Region: Outside US",
    backerCount: 142,
    createdAt: "10/28/24",
  },
  {
    id: "5",
    name: "Payment Failed",
    type: "payment_status",
    criteria: "Payment Status: Errored",
    backerCount: 12,
    createdAt: "11/20/24",
  },
];

const typeLabels: Record<Segment["type"], string> = {
  pledge_level: "Pledge Level",
  addon: "Add-on",
  survey_status: "Survey Status",
  shipping_region: "Shipping Region",
  payment_status: "Payment Status",
  custom: "Custom",
};

const typeColors: Record<Segment["type"], string> = {
  pledge_level: "bg-purple-100 text-purple-700",
  addon: "bg-blue-100 text-blue-700",
  survey_status: "bg-yellow-100 text-yellow-700",
  shipping_region: "bg-green-100 text-green-700",
  payment_status: "bg-red-100 text-red-700",
  custom: "bg-gray-100 text-gray-700",
};

export function SegmentsTab({ segments = demoSegments }: SegmentsTabProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Layers className="h-6 w-6 text-teal-600" />
          <div>
            <h3 className="text-lg font-semibold">Segments</h3>
            <p className="text-sm text-muted-foreground">
              Group backers for targeted communications and fulfillment
            </p>
          </div>
        </div>
        <Button className="bg-teal-600 hover:bg-teal-700">
          <Plus className="h-4 w-4 mr-2" />
          Create Segment
        </Button>
      </div>

      {/* Segment Types Info */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Filter className="h-4 w-4 text-teal-600" />
              <span className="font-medium">Filter Based</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Create segments based on pledge level, add-ons, or survey status
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-teal-600" />
              <span className="font-medium">Dynamic Updates</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Segments automatically update as backer data changes
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Mail className="h-4 w-4 text-teal-600" />
              <span className="font-medium">Email Targeting</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Send targeted emails to specific backer groups
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Segments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Your Segments</CardTitle>
          <CardDescription>Manage and use your backer segments</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Segment Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Criteria</TableHead>
                <TableHead className="text-right">Backers</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {segments.map((segment) => (
                <TableRow key={segment.id}>
                  <TableCell className="font-medium">{segment.name}</TableCell>
                  <TableCell>
                    <Badge className={typeColors[segment.type]}>
                      {typeLabels[segment.type]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-[200px] truncate">
                    {segment.criteria}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="flex items-center justify-end gap-1">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      {segment.backerCount}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{segment.createdAt}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Users className="h-4 w-4 mr-2" />
                          View Backers
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Mail className="h-4 w-4 mr-2" />
                          Send Email
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit Segment
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {segments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No segments created yet. Create your first segment to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Create</CardTitle>
          <CardDescription>Common segment types to get you started</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <Button variant="outline" className="justify-start h-auto py-3">
              <div className="text-left">
                <p className="font-medium">Survey Incomplete</p>
                <p className="text-xs text-muted-foreground">Backers who haven&apos;t completed their survey</p>
              </div>
            </Button>
            <Button variant="outline" className="justify-start h-auto py-3">
              <div className="text-left">
                <p className="font-medium">Payment Failed</p>
                <p className="text-xs text-muted-foreground">Backers with failed payment attempts</p>
              </div>
            </Button>
            <Button variant="outline" className="justify-start h-auto py-3">
              <div className="text-left">
                <p className="font-medium">International Shipping</p>
                <p className="text-xs text-muted-foreground">Backers outside the US</p>
              </div>
            </Button>
            <Button variant="outline" className="justify-start h-auto py-3">
              <div className="text-left">
                <p className="font-medium">High Value Backers</p>
                <p className="text-xs text-muted-foreground">Backers with pledges over $100</p>
              </div>
            </Button>
            <Button variant="outline" className="justify-start h-auto py-3">
              <div className="text-left">
                <p className="font-medium">With Add-ons</p>
                <p className="text-xs text-muted-foreground">Backers who purchased add-ons</p>
              </div>
            </Button>
            <Button variant="outline" className="justify-start h-auto py-3">
              <div className="text-left">
                <p className="font-medium">Ready to Ship</p>
                <p className="text-xs text-muted-foreground">Backers ready for fulfillment</p>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
