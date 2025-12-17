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
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Home,
} from "lucide-react";
import type { FulfillmentStats } from "../../types";

interface PreOrdersTabProps {
  stats: FulfillmentStats | null;
}

// Demo chart data for New vs Returning Backers
const chartData = [
  { date: "Dec 10", returning: 2, new: 5 },
  { date: "Dec 11", returning: 3, new: 8 },
  { date: "Dec 12", returning: 1, new: 4 },
  { date: "Dec 13", returning: 4, new: 6 },
  { date: "Dec 14", returning: 2, new: 3 },
  { date: "Dec 15", returning: 3, new: 7 },
  { date: "Dec 16", returning: 2, new: 5 },
];

export function PreOrdersTab({ stats }: PreOrdersTabProps) {
  const maxValue = Math.max(...chartData.map(d => d.returning + d.new));

  return (
    <div className="space-y-6">
      {/* Launch Navigation */}
      <div className="flex items-center gap-1 border-b pb-4">
        <Home className="h-4 w-4 text-teal-600 mr-1" />
        <span className="font-medium text-teal-600">Launch</span>
        <div className="flex gap-1 ml-4">
          <Button variant="ghost" size="sm" className="text-teal-600 font-medium">Dashboard</Button>
          <Button variant="ghost" size="sm">Email Campaigns</Button>
          <Button variant="ghost" size="sm">Teaser Pages</Button>
          <Button variant="ghost" size="sm">Projects</Button>
          <Button variant="ghost" size="sm">Members</Button>
        </div>
      </div>

      {/* Project Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Flying Sparks Volumes 1-3</h2>
          <p className="text-sm text-muted-foreground">Last Updated: 12/15/24 09:00 PST</p>
        </div>
        <Button variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Update
        </Button>
      </div>

      {/* Main Content Grid: Project Card + Chart */}
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        {/* PROJECT CARD */}
        <Card className="shadow-sm">
          <CardContent className="pt-6">
            {/* Project Image Placeholder */}
            <div className="h-[200px] w-full bg-gradient-to-br from-teal-100 to-teal-200 rounded-lg mb-4 flex items-center justify-center">
              <span className="text-teal-600 font-medium">Project Image</span>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-center gap-2 text-sm mb-4">
              <Button variant="ghost" size="sm" className="h-8 px-2">
                <ChevronLeft className="h-4 w-4" />
                10th
              </Button>
              <span className="text-muted-foreground">Your <strong>11th</strong> project</span>
              <Button variant="ghost" size="sm" className="h-8 px-2">
                12th
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Project Title */}
            <h3 className="font-semibold text-center mb-2">Flying Sparks Volumes 1-3</h3>

            {/* View Project Link */}
            <div className="text-center mb-4">
              <Button variant="link" className="text-teal-600 h-auto p-0">
                <Badge variant="outline" className="mr-1">IC</Badge>
                View project
              </Button>
            </div>

            {/* Stats */}
            <div className="space-y-2 text-center">
              <div>
                <p className="text-2xl font-bold">${(stats?.totalRaised || 5720).toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">pledged</p>
              </div>
              <div>
                <p className="text-xl font-bold">{stats?.totalBackers || 35} backers</p>
              </div>
              <div>
                <p className="text-lg font-medium">${((stats?.totalRaised || 5720) / (stats?.totalBackers || 35)).toFixed(2)}</p>
                <p className="text-sm text-muted-foreground">average pledge</p>
              </div>
              <div>
                <p className="text-lg font-medium">0 Days to go</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* NEW VS RETURNING BACKERS CHART */}
        <Card>
          <CardHeader>
            <CardTitle>New vs Returning Backers</CardTitle>
            <CardDescription>Daily breakdown of backer acquisition</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Bar Chart */}
            <div className="h-[280px] flex items-end gap-4 mb-6">
              {chartData.map((day, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center">
                  <div className="w-full flex flex-col-reverse" style={{ height: '240px' }}>
                    {/* Returning bar */}
                    <div
                      className="w-full bg-teal-300 rounded-t"
                      style={{ height: `${(day.returning / maxValue) * 100}%` }}
                    />
                    {/* New bar stacked on top */}
                    <div
                      className="w-full bg-teal-600 rounded-t"
                      style={{ height: `${(day.new / maxValue) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground mt-2">{day.date}</span>
                </div>
              ))}
            </div>

            {/* Legend / Proportion Bar */}
            <div className="flex h-8 rounded-lg overflow-hidden mb-4">
              <div
                className="bg-teal-300 flex items-center justify-center text-white text-sm font-medium"
                style={{ width: `${((stats?.returningBackers || 9) / (stats?.totalBackers || 35)) * 100}%` }}
              >
                Returning Backers
              </div>
              <div
                className="bg-teal-600 flex items-center justify-center text-white text-sm font-medium"
                style={{ width: `${((stats?.newBackers || 26) / (stats?.totalBackers || 35)) * 100}%` }}
              >
                New Backers
              </div>
            </div>

            {/* Stats Table */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead></TableHead>
                  <TableHead className="text-right">Backers</TableHead>
                  <TableHead className="text-right">Pledged</TableHead>
                  <TableHead className="text-right">$/backer</TableHead>
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
                  <TableCell className="text-right">
                    {stats?.returningBackers || 9}
                    <span className="text-muted-foreground ml-1">
                      ({(((stats?.returningBackers || 9) / (stats?.totalBackers || 35)) * 100).toFixed(0)}%)
                    </span>
                  </TableCell>
                  <TableCell className="text-right">$247</TableCell>
                  <TableCell className="text-right">$27.44</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-sm bg-teal-600" />
                      <span>New Backers</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {stats?.newBackers || 26}
                    <span className="text-muted-foreground ml-1">
                      ({(((stats?.newBackers || 26) / (stats?.totalBackers || 35)) * 100).toFixed(0)}%)
                    </span>
                  </TableCell>
                  <TableCell className="text-right">$1,059</TableCell>
                  <TableCell className="text-right">$40.73</TableCell>
                </TableRow>
                <TableRow className="font-medium border-t-2">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">{stats?.totalBackers || 35}</TableCell>
                  <TableCell className="text-right">${(stats?.totalRaised || 1306).toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    ${((stats?.totalRaised || 1306) / (stats?.totalBackers || 35)).toFixed(2)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

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
              <p className="text-sm text-teal-600">https://indiecrowdfund.co/store/flying-sparks</p>
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
          <div className="flex justify-end">
            <Button className="bg-teal-600 hover:bg-teal-700">
              <ExternalLink className="h-4 w-4 mr-2" />
              Open Pre-Order Store
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
