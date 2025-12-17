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
  DollarSign,
  Users,
  UserCheck,
  UserPlus,
  ExternalLink,
  Copy,
} from "lucide-react";
import type { FulfillmentStats } from "../../types";

interface PreOrdersTabProps {
  stats: FulfillmentStats | null;
}

export function PreOrdersTab({ stats }: PreOrdersTabProps) {
  return (
    <div className="space-y-6">
      {/* Pre-Orders Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Pre-Orders & Upselling</h3>
          <p className="text-sm text-muted-foreground">
            Track pre-order backers and manage your post-campaign store
          </p>
        </div>
        <Button className="bg-teal-600 hover:bg-teal-700">
          <ExternalLink className="h-4 w-4 mr-2" />
          Open Pre-Order Store
        </Button>
      </div>

      {/* Pre-Order Stats */}
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
            <p className="text-2xl font-bold mt-1">{stats?.returningBackers || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">New Backers</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats?.newBackers || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* New vs Returning Backers */}
      <Card>
        <CardHeader>
          <CardTitle>Backer Breakdown</CardTitle>
          <CardDescription>Campaign backers vs pre-order customers</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Visual bar */}
            <div className="flex h-8 rounded-lg overflow-hidden">
              <div
                className="bg-teal-600 flex items-center justify-center text-white text-sm font-medium"
                style={{ width: `${((stats?.returningBackers || 0) / (stats?.totalBackers || 1)) * 100}%` }}
              >
                {stats?.returningBackers || 0} Returning
              </div>
              <div
                className="bg-teal-400 flex items-center justify-center text-white text-sm font-medium"
                style={{ width: `${((stats?.newBackers || 0) / (stats?.totalBackers || 1)) * 100}%` }}
              >
                {stats?.newBackers || 0} New
              </div>
            </div>

            {/* Stats table */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead></TableHead>
                  <TableHead className="text-right">Backers</TableHead>
                  <TableHead className="text-right">Pledged</TableHead>
                  <TableHead className="text-right">Avg/Backer</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-sm bg-teal-600" />
                      <span>Returning Backers</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {stats?.returningBackers || 0}
                    <span className="text-muted-foreground ml-1">
                      ({(((stats?.returningBackers || 0) / (stats?.totalBackers || 1)) * 100).toFixed(0)}%)
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    ${((stats?.returningBackers || 0) * 183).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">$183.00</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-sm bg-teal-400" />
                      <span>New Backers</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {stats?.newBackers || 0}
                    <span className="text-muted-foreground ml-1">
                      ({(((stats?.newBackers || 0) / (stats?.totalBackers || 1)) * 100).toFixed(0)}%)
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    ${((stats?.newBackers || 0) * 175).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">$175.00</TableCell>
                </TableRow>
                <TableRow className="font-medium">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">{stats?.totalBackers || 0}</TableCell>
                  <TableCell className="text-right">${(stats?.totalRaised || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    ${((stats?.totalRaised || 0) / (stats?.totalBackers || 1)).toFixed(2)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pre-Order Store Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Pre-Order Store</CardTitle>
          <CardDescription>Configure your post-campaign pre-order store</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">Store Status</p>
              <p className="text-sm text-muted-foreground">Accept new pre-orders from customers</p>
            </div>
            <Badge className="bg-green-100 text-green-700">Open</Badge>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">Store URL</p>
              <p className="text-sm text-teal-600">https://indiekit.co/store/my-awesome-project</p>
            </div>
            <Button variant="outline" size="sm">
              <Copy className="h-4 w-4 mr-2" />
              Copy
            </Button>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">Available Products</p>
              <p className="text-sm text-muted-foreground">Products available for pre-order</p>
            </div>
            <span className="font-medium">4 products</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
