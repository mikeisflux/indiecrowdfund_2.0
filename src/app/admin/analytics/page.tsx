"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
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
  FolderKanban,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  Activity,
  Globe,
  Smartphone,
  Monitor,
  Tablet,
  Download,
  Calendar,
  Target,
  ShoppingCart,
  RefreshCw,
  BarChart3,
} from "lucide-react";

// Mock data for charts
const revenueData = [
  { date: "Jan", revenue: 245000, pledges: 4521 },
  { date: "Feb", revenue: 312000, pledges: 5234 },
  { date: "Mar", revenue: 287000, pledges: 4892 },
  { date: "Apr", revenue: 398000, pledges: 6127 },
  { date: "May", revenue: 456000, pledges: 7234 },
  { date: "Jun", revenue: 523000, pledges: 8456 },
  { date: "Jul", revenue: 489000, pledges: 7892 },
  { date: "Aug", revenue: 567000, pledges: 9123 },
  { date: "Sep", revenue: 612000, pledges: 9856 },
  { date: "Oct", revenue: 534000, pledges: 8234 },
  { date: "Nov", revenue: 678000, pledges: 10234 },
];

const categoryData = [
  { name: "Technology", projects: 45, revenue: 1234500, percentage: 28 },
  { name: "Games", projects: 38, revenue: 987600, percentage: 22 },
  { name: "Film", projects: 32, revenue: 765400, percentage: 17 },
  { name: "Design", projects: 28, revenue: 654300, percentage: 15 },
  { name: "Music", projects: 18, revenue: 432100, percentage: 10 },
  { name: "Publishing", projects: 12, revenue: 321000, percentage: 7 },
];

const trafficSources = [
  { source: "Direct", visits: 245000, conversions: 8234, rate: 3.36 },
  { source: "Google", visits: 187000, conversions: 5621, rate: 3.01 },
  { source: "Social Media", visits: 156000, conversions: 4892, rate: 3.14 },
  { source: "Email", visits: 89000, conversions: 3456, rate: 3.88 },
  { source: "Referral", visits: 67000, conversions: 2134, rate: 3.18 },
];

const topProjects = [
  { name: "Solar-Powered Backpack", creator: "Green Tech Labs", raised: 42500, goal: 50000, backers: 847 },
  { name: "Indie Game: Lost Horizons", creator: "Pixel Dreams", raised: 67800, goal: 100000, backers: 1243 },
  { name: "The Art of Mindful Living", creator: "Sarah Chen", raised: 18720, goal: 15000, backers: 456 },
  { name: "Documentary: Ocean Guardians", creator: "Blue Planet Films", raised: 45000, goal: 75000, backers: 612 },
  { name: "Smart Home Music System", creator: "AudioTech Labs", raised: 156000, goal: 200000, backers: 892 },
];

const hourlyActivity = [
  { hour: "00:00", views: 1200, pledges: 45 },
  { hour: "02:00", views: 800, pledges: 23 },
  { hour: "04:00", views: 600, pledges: 12 },
  { hour: "06:00", views: 900, pledges: 28 },
  { hour: "08:00", views: 2400, pledges: 89 },
  { hour: "10:00", views: 4500, pledges: 167 },
  { hour: "12:00", views: 5200, pledges: 198 },
  { hour: "14:00", views: 4800, pledges: 178 },
  { hour: "16:00", views: 5100, pledges: 189 },
  { hour: "18:00", views: 6200, pledges: 234 },
  { hour: "20:00", views: 7500, pledges: 287 },
  { hour: "22:00", views: 4200, pledges: 156 },
];

const geoData = [
  { country: "United States", visitors: 456000, pledges: 15234, revenue: 1234500 },
  { country: "United Kingdom", visitors: 123000, pledges: 4521, revenue: 345600 },
  { country: "Canada", visitors: 98000, pledges: 3456, revenue: 287400 },
  { country: "Germany", visitors: 87000, pledges: 2987, revenue: 245600 },
  { country: "Australia", visitors: 76000, pledges: 2456, revenue: 198700 },
  { country: "France", visitors: 65000, pledges: 2134, revenue: 176500 },
];

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState("30d");
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Analytics</h1>
          <p className="text-zinc-500">Comprehensive platform metrics and insights</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[160px]">
              <Calendar className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24 hours</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button variant="outline" size="icon">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-500">Total Revenue</p>
                <p className="mt-1 text-3xl font-bold text-zinc-900 dark:text-white">$5.1M</p>
                <div className="mt-2 flex items-center gap-1 text-sm text-emerald-600">
                  <ArrowUpRight className="h-4 w-4" />
                  <span>+18.2% from last period</span>
                </div>
              </div>
              <div className="rounded-full bg-emerald-100 p-3 dark:bg-emerald-900/30">
                <DollarSign className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-500">Total Users</p>
                <p className="mt-1 text-3xl font-bold text-zinc-900 dark:text-white">89,234</p>
                <div className="mt-2 flex items-center gap-1 text-sm text-emerald-600">
                  <ArrowUpRight className="h-4 w-4" />
                  <span>+2,456 new this month</span>
                </div>
              </div>
              <div className="rounded-full bg-blue-100 p-3 dark:bg-blue-900/30">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-500">Total Pledges</p>
                <p className="mt-1 text-3xl font-bold text-zinc-900 dark:text-white">156,892</p>
                <div className="mt-2 flex items-center gap-1 text-sm text-emerald-600">
                  <ArrowUpRight className="h-4 w-4" />
                  <span>+12.4% conversion rate</span>
                </div>
              </div>
              <div className="rounded-full bg-violet-100 p-3 dark:bg-violet-900/30">
                <ShoppingCart className="h-6 w-6 text-violet-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-500">Avg. Pledge</p>
                <p className="mt-1 text-3xl font-bold text-zinc-900 dark:text-white">$68.42</p>
                <div className="mt-2 flex items-center gap-1 text-sm text-red-600">
                  <ArrowDownRight className="h-4 w-4" />
                  <span>-2.1% from last period</span>
                </div>
              </div>
              <div className="rounded-full bg-amber-100 p-3 dark:bg-amber-900/30">
                <Target className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview">
            <BarChart3 className="mr-2 h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="revenue">
            <DollarSign className="mr-2 h-4 w-4" />
            Revenue
          </TabsTrigger>
          <TabsTrigger value="traffic">
            <Activity className="mr-2 h-4 w-4" />
            Traffic
          </TabsTrigger>
          <TabsTrigger value="projects">
            <FolderKanban className="mr-2 h-4 w-4" />
            Projects
          </TabsTrigger>
          <TabsTrigger value="geography">
            <Globe className="mr-2 h-4 w-4" />
            Geography
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          {/* Revenue chart placeholder */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Revenue & Pledges Over Time</CardTitle>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-emerald-500" />
                    <span className="text-sm text-zinc-500">Revenue</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-blue-500" />
                    <span className="text-sm text-zinc-500">Pledges</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] flex items-end gap-2">
                {revenueData.map((item, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex gap-0.5">
                      <div
                        className="flex-1 bg-emerald-500 rounded-t"
                        style={{ height: `${(item.revenue / 700000) * 250}px` }}
                      />
                      <div
                        className="flex-1 bg-blue-500 rounded-t"
                        style={{ height: `${(item.pledges / 12000) * 250}px` }}
                      />
                    </div>
                    <span className="text-xs text-zinc-500">{item.date}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Category breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Revenue by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {categoryData.map((cat) => (
                    <div key={cat.name}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="font-medium">{cat.name}</span>
                        <span className="text-zinc-500">${(cat.revenue / 1000).toFixed(0)}K ({cat.percentage}%)</span>
                      </div>
                      <Progress value={cat.percentage} className="h-2" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Hourly activity */}
            <Card>
              <CardHeader>
                <CardTitle>Hourly Activity (Today)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px] flex items-end gap-1">
                  {hourlyActivity.map((item, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center">
                      <div
                        className="w-full bg-gradient-to-t from-emerald-500 to-emerald-400 rounded-t"
                        style={{ height: `${(item.views / 8000) * 200}px` }}
                      />
                      <span className="mt-1 text-[10px] text-zinc-500">{item.hour.replace(":00", "")}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="revenue" className="mt-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium text-zinc-500">Gross Revenue</p>
                <p className="mt-1 text-2xl font-bold">$5,234,567</p>
                <p className="mt-1 text-sm text-zinc-500">Before fees and refunds</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium text-zinc-500">Platform Fees</p>
                <p className="mt-1 text-2xl font-bold">$261,728</p>
                <p className="mt-1 text-sm text-zinc-500">5% of gross revenue</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium text-zinc-500">Refunds</p>
                <p className="mt-1 text-2xl font-bold">$45,678</p>
                <p className="mt-1 text-sm text-zinc-500">0.87% refund rate</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Payment Processors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-violet-100">
                      <CreditCard className="h-6 w-6 text-violet-600" />
                    </div>
                    <div>
                      <p className="font-semibold">Stripe</p>
                      <p className="text-sm text-zinc-500">Primary processor</p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-2xl font-bold">$4.8M</p>
                      <p className="text-sm text-zinc-500">Processed</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">92%</p>
                      <p className="text-sm text-zinc-500">Share</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-100">
                      <CreditCard className="h-6 w-6 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-semibold">CCBill</p>
                      <p className="text-sm text-zinc-500">High-risk processor</p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-2xl font-bold">$418K</p>
                      <p className="text-sm text-zinc-500">Processed</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">8%</p>
                      <p className="text-sm text-zinc-500">Share</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="traffic" className="mt-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium text-zinc-500">Page Views</p>
                <p className="mt-1 text-2xl font-bold">2.4M</p>
                <p className="mt-1 text-sm text-emerald-600">+12.3%</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium text-zinc-500">Unique Visitors</p>
                <p className="mt-1 text-2xl font-bold">856K</p>
                <p className="mt-1 text-sm text-emerald-600">+8.7%</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium text-zinc-500">Avg. Session</p>
                <p className="mt-1 text-2xl font-bold">4m 32s</p>
                <p className="mt-1 text-sm text-red-600">-0.8%</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium text-zinc-500">Bounce Rate</p>
                <p className="mt-1 text-2xl font-bold">42.3%</p>
                <p className="mt-1 text-sm text-emerald-600">-2.1%</p>
              </CardContent>
            </Card>
          </div>

          {/* Traffic sources */}
          <Card>
            <CardHeader>
              <CardTitle>Traffic Sources</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {trafficSources.map((source) => (
                  <div key={source.source} className="flex items-center gap-4 rounded-lg border p-4">
                    <div className="w-32 font-medium">{source.source}</div>
                    <div className="flex-1">
                      <Progress value={(source.visits / 250000) * 100} className="h-2" />
                    </div>
                    <div className="w-24 text-right text-sm text-zinc-500">
                      {(source.visits / 1000).toFixed(0)}K visits
                    </div>
                    <div className="w-24 text-right text-sm text-zinc-500">
                      {source.conversions.toLocaleString()} conv.
                    </div>
                    <div className="w-20 text-right">
                      <Badge variant="outline">{source.rate}%</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Device breakdown */}
          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="rounded-full bg-blue-100 p-3">
                    <Monitor className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-zinc-500">Desktop</p>
                    <p className="text-2xl font-bold">58%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="rounded-full bg-emerald-100 p-3">
                    <Smartphone className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm text-zinc-500">Mobile</p>
                    <p className="text-2xl font-bold">34%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="rounded-full bg-violet-100 p-3">
                    <Tablet className="h-6 w-6 text-violet-600" />
                  </div>
                  <div>
                    <p className="text-sm text-zinc-500">Tablet</p>
                    <p className="text-2xl font-bold">8%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="projects" className="mt-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium text-zinc-500">Total Projects</p>
                <p className="mt-1 text-2xl font-bold">1,234</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium text-zinc-500">Success Rate</p>
                <p className="mt-1 text-2xl font-bold">67.8%</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium text-zinc-500">Avg. Funding</p>
                <p className="mt-1 text-2xl font-bold">$42,567</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium text-zinc-500">Avg. Backers</p>
                <p className="mt-1 text-2xl font-bold">623</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Top Performing Projects</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topProjects.map((project, i) => (
                  <div key={i} className="flex items-center gap-4 rounded-lg border p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 font-bold text-zinc-600">
                      #{i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{project.name}</p>
                      <p className="text-sm text-zinc-500">by {project.creator}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-emerald-600">${project.raised.toLocaleString()}</p>
                      <p className="text-sm text-zinc-500">of ${project.goal.toLocaleString()}</p>
                    </div>
                    <div className="w-24">
                      <Progress value={(project.raised / project.goal) * 100} className="h-2" />
                    </div>
                    <div className="text-right text-sm text-zinc-500">
                      {project.backers} backers
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="geography" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Top Countries</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {geoData.map((country, i) => (
                  <div key={i} className="flex items-center gap-4 rounded-lg border p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100">
                      <Globe className="h-5 w-5 text-zinc-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{country.country}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{(country.visitors / 1000).toFixed(0)}K</p>
                      <p className="text-xs text-zinc-500">visitors</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{country.pledges.toLocaleString()}</p>
                      <p className="text-xs text-zinc-500">pledges</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-emerald-600">${(country.revenue / 1000).toFixed(0)}K</p>
                      <p className="text-xs text-zinc-500">revenue</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
