"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DollarSign,
  Users,
  TrendingUp,
  Clock,
  Eye,
  Share2,
  ArrowUpRight,
  ArrowDownRight,
  MoreHorizontal,
  Plus,
  Settings,
  Bell,
  BarChart3,
  MessageSquare,
  Package,
  Truck,
} from "lucide-react";

// Mock data
const mockProject = {
  id: "1",
  title: "Revolutionary Solar-Powered Backpack",
  status: "LIVE",
  imageUrl: "/placeholder-1.jpg",
  goalAmount: 50000,
  currentAmount: 42500,
  backerCount: 847,
  daysRemaining: 12,
  launchedAt: new Date("2024-01-15"),
  endDate: new Date("2024-02-28"),
};

const mockStats = {
  todayPledges: 2450,
  todayBackers: 23,
  todayViews: 1247,
  weeklyGrowth: 12.5,
  conversionRate: 3.2,
  avgPledge: 50.12,
};

const mockFundingData = [
  { date: "Jan 15", amount: 5000, cumulative: 5000 },
  { date: "Jan 16", amount: 3200, cumulative: 8200 },
  { date: "Jan 17", amount: 4500, cumulative: 12700 },
  { date: "Jan 18", amount: 2800, cumulative: 15500 },
  { date: "Jan 19", amount: 6200, cumulative: 21700 },
  { date: "Jan 20", amount: 4100, cumulative: 25800 },
  { date: "Jan 21", amount: 5500, cumulative: 31300 },
  { date: "Jan 22", amount: 3800, cumulative: 35100 },
  { date: "Jan 23", amount: 4200, cumulative: 39300 },
  { date: "Jan 24", amount: 3200, cumulative: 42500 },
];

const mockReferrers = [
  { source: "Direct", visits: 5420, pledges: 234, amount: 12450, percentage: 35 },
  { source: "Twitter", visits: 3210, pledges: 156, amount: 8230, percentage: 22 },
  { source: "Facebook", visits: 2840, pledges: 98, amount: 5120, percentage: 15 },
  { source: "Email", visits: 1890, pledges: 145, amount: 7890, percentage: 12 },
  { source: "Reddit", visits: 1450, pledges: 87, amount: 4560, percentage: 10 },
  { source: "Other", visits: 890, pledges: 45, amount: 2340, percentage: 6 },
];

const mockRewardStats = [
  { title: "Early Bird Special", amount: 89, backers: 87, total: 7743, remaining: 13 },
  { title: "Standard Package", amount: 129, backers: 456, total: 58824, remaining: null },
  { title: "Deluxe Bundle", amount: 199, backers: 145, total: 28855, remaining: 55 },
  { title: "Custom Pledge", amount: null, backers: 159, total: 3078, remaining: null },
];

const mockRecentBackers = [
  { name: "John D.", amount: 199, reward: "Deluxe Bundle", time: "2 mins ago" },
  { name: "Sarah M.", amount: 89, reward: "Early Bird", time: "15 mins ago" },
  { name: "Alex K.", amount: 129, reward: "Standard", time: "32 mins ago" },
  { name: "Maria L.", amount: 50, reward: "Custom", time: "1 hour ago" },
  { name: "Chris P.", amount: 199, reward: "Deluxe Bundle", time: "2 hours ago" },
];

export default function CreatorDashboard() {
  const [selectedProject, setSelectedProject] = useState(mockProject.id);
  const [timeRange, setTimeRange] = useState("7d");

  const project = mockProject;
  const fundingPercent = (project.currentAmount / project.goalAmount) * 100;

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-xl font-bold text-primary">
              IndieCrowdfund
            </Link>
            <Badge variant="secondary">Creator Dashboard</Badge>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon">
              <Bell className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon">
              <Settings className="h-5 w-5" />
            </Button>
            <Avatar>
              <AvatarImage src="/avatar.jpg" />
              <AvatarFallback>GT</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      {/* Sub Navigation */}
      <div className="border-b bg-background">
        <div className="container flex h-12 items-center gap-4">
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={mockProject.id}>{mockProject.title}</SelectItem>
            </SelectContent>
          </Select>
          <Badge
            variant={project.status === "LIVE" ? "default" : "secondary"}
          >
            {project.status}
          </Badge>
          <div className="ml-auto flex items-center gap-2">
            <Link href={`/projects/${project.id}`}>
              <Button variant="outline" size="sm">
                <Eye className="mr-2 h-4 w-4" />
                View Project
              </Button>
            </Link>
            <Link href={`/projects/${project.id}/edit`}>
              <Button variant="outline" size="sm">
                <Settings className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </Link>
            <Button size="sm">
              <Share2 className="mr-2 h-4 w-4" />
              Share
            </Button>
          </div>
        </div>
      </div>

      <div className="container py-6">
        {/* Stats Overview */}
        <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Pledged
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${project.currentAmount.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                {fundingPercent.toFixed(0)}% of ${project.goalAmount.toLocaleString()} goal
              </p>
              <Progress value={Math.min(fundingPercent, 100)} className="mt-2 h-1" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Backers
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{project.backerCount}</div>
              <p className="flex items-center text-xs text-green-600">
                <ArrowUpRight className="mr-1 h-3 w-3" />
                +{mockStats.todayBackers} today
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Page Views
              </CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mockStats.todayViews.toLocaleString()}</div>
              <p className="flex items-center text-xs text-green-600">
                <ArrowUpRight className="mr-1 h-3 w-3" />
                +{mockStats.weeklyGrowth}% this week
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Days Remaining
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{project.daysRemaining}</div>
              <p className="text-xs text-muted-foreground">
                Campaign ends {project.endDate.toLocaleDateString()}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">
              <BarChart3 className="mr-2 h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="backers">
              <Users className="mr-2 h-4 w-4" />
              Backers
            </TabsTrigger>
            <TabsTrigger value="rewards">
              <Package className="mr-2 h-4 w-4" />
              Rewards
            </TabsTrigger>
            <TabsTrigger value="messages">
              <MessageSquare className="mr-2 h-4 w-4" />
              Messages
            </TabsTrigger>
            <TabsTrigger value="fulfillment">
              <Truck className="mr-2 h-4 w-4" />
              Fulfillment
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Funding Chart */}
              <Card className="lg:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Funding Progress</CardTitle>
                  <Select value={timeRange} onValueChange={setTimeRange}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7d">Last 7 days</SelectItem>
                      <SelectItem value="14d">Last 14 days</SelectItem>
                      <SelectItem value="30d">Last 30 days</SelectItem>
                      <SelectItem value="all">All time</SelectItem>
                    </SelectContent>
                  </Select>
                </CardHeader>
                <CardContent>
                  {/* Simple bar chart representation */}
                  <div className="h-[300px]">
                    <div className="flex h-full items-end gap-2">
                      {mockFundingData.map((day, i) => (
                        <div
                          key={i}
                          className="relative flex-1 rounded-t bg-primary/20 transition-all hover:bg-primary/30"
                          style={{
                            height: `${(day.amount / 7000) * 100}%`,
                          }}
                        >
                          <div
                            className="absolute bottom-0 w-full rounded-t bg-primary"
                            style={{
                              height: `${(day.amount / 7000) * 100}%`,
                            }}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                      {mockFundingData
                        .filter((_, i) => i % 2 === 0)
                        .map((day, i) => (
                          <span key={i}>{day.date}</span>
                        ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Backers */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Backers</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {mockRecentBackers.map((backer, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {backer.name[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">{backer.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {backer.reward}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">${backer.amount}</p>
                          <p className="text-xs text-muted-foreground">
                            {backer.time}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Traffic Sources */}
            <Card>
              <CardHeader>
                <CardTitle>Traffic Sources</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockReferrers.map((referrer, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <div className="w-24 text-sm font-medium">
                        {referrer.source}
                      </div>
                      <div className="flex-1">
                        <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="bg-primary"
                            style={{ width: `${referrer.percentage}%` }}
                          />
                        </div>
                      </div>
                      <div className="w-16 text-right text-sm text-muted-foreground">
                        {referrer.visits.toLocaleString()}
                      </div>
                      <div className="w-16 text-right text-sm font-medium">
                        {referrer.pledges}
                      </div>
                      <div className="w-24 text-right text-sm font-medium text-primary">
                        ${referrer.amount.toLocaleString()}
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center gap-4 border-t pt-4 text-xs text-muted-foreground">
                    <div className="w-24" />
                    <div className="flex-1" />
                    <div className="w-16 text-right">Visits</div>
                    <div className="w-16 text-right">Pledges</div>
                    <div className="w-24 text-right">Amount</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Conversion Rate
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{mockStats.conversionRate}%</div>
                  <p className="text-xs text-muted-foreground">
                    Visitors who pledge
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Average Pledge
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${mockStats.avgPledge}</div>
                  <p className="text-xs text-muted-foreground">
                    Per backer
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Today's Pledges
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${mockStats.todayPledges.toLocaleString()}</div>
                  <p className="flex items-center text-xs text-green-600">
                    <ArrowUpRight className="mr-1 h-3 w-3" />
                    +18% vs yesterday
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="rewards" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Reward Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockRewardStats.map((reward, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-lg border p-4"
                    >
                      <div>
                        <p className="font-medium">{reward.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {reward.amount ? `$${reward.amount}` : "Any amount"}
                        </p>
                      </div>
                      <div className="flex items-center gap-8">
                        <div className="text-center">
                          <p className="text-lg font-bold">{reward.backers}</p>
                          <p className="text-xs text-muted-foreground">Backers</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-primary">
                            ${reward.total.toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">Total</p>
                        </div>
                        {reward.remaining !== null && (
                          <div className="text-center">
                            <p className="text-lg font-bold">{reward.remaining}</p>
                            <p className="text-xs text-muted-foreground">
                              Remaining
                            </p>
                          </div>
                        )}
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="backers" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>All Backers</CardTitle>
                <Button variant="outline" size="sm">
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border">
                  <div className="grid grid-cols-5 gap-4 border-b bg-muted/50 p-3 text-sm font-medium">
                    <div>Backer</div>
                    <div>Reward</div>
                    <div>Amount</div>
                    <div>Status</div>
                    <div>Date</div>
                  </div>
                  {mockRecentBackers.map((backer, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-5 gap-4 border-b p-3 text-sm last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs">
                            {backer.name[0]}
                          </AvatarFallback>
                        </Avatar>
                        {backer.name}
                      </div>
                      <div>{backer.reward}</div>
                      <div className="font-medium">${backer.amount}</div>
                      <div>
                        <Badge variant="secondary">Completed</Badge>
                      </div>
                      <div className="text-muted-foreground">{backer.time}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="messages">
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <MessageSquare className="mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="mb-2 font-semibold">No messages yet</h3>
                <p className="mb-4 text-sm text-muted-foreground">
                  Messages from backers will appear here
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="fulfillment">
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Truck className="mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="mb-2 font-semibold">Fulfillment available after funding</h3>
                <p className="mb-4 text-center text-sm text-muted-foreground">
                  Once your campaign ends successfully, you'll be able to manage<br />
                  backer surveys and reward fulfillment here
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
