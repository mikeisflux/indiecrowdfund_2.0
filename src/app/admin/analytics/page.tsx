"use client";

import { useState, useEffect, useCallback } from "react";
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
  Loader2,
} from "lucide-react";

interface OverviewData {
  visits: { current: number; previous: number; growth: string };
  revenue: { current: number; previous: number; growth: string; count: number };
  users: { current: number; previous: number; growth: string };
  conversionRate: string | number;
}

interface CategoryData {
  category: string;
  count: number;
  totalFunding: number;
}

interface RevenueData {
  byDay: { date: string; total: number; count: number }[];
  topProjects: {
    id: string;
    title: string;
    currentAmount: number;
    goalAmount: number;
    backerCount: number;
  }[];
  byStatus: { status: string; count: number; total: number }[];
}

interface TrafficData {
  topPages: { path: string; views: number }[];
  topReferrers: { referrer: string; visits: number }[];
  devices: { mobile: number; desktop: number; tablet: number };
}

interface ProjectsData {
  byStatus: { status: string; count: number }[];
  recent: {
    id: string;
    title: string;
    status: string;
    category: string;
    goalAmount: number;
    currentAmount: number;
    backerCount: number;
    createdAt: string;
  }[];
  fundingDistribution: Record<string, number>;
}

interface GeographyData {
  countries: { country: string; visits: number }[];
  cities: { location: string; projectCount: number }[];
}

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState("30d");
  const [activeTab, setActiveTab] = useState("overview");
  const [isLoading, setIsLoading] = useState(true);

  // Data states
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null);
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [revenueData, setRevenueData] = useState<RevenueData | null>(null);
  const [trafficData, setTrafficData] = useState<TrafficData | null>(null);
  const [projectsData, setProjectsData] = useState<ProjectsData | null>(null);
  const [geographyData, setGeographyData] = useState<GeographyData | null>(null);

  const fetchAnalytics = useCallback(async (tab: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/analytics?period=${timeRange}&tab=${tab}`);
      if (response.ok) {
        const data = await response.json();

        switch (tab) {
          case "overview":
            setOverviewData(data.overview || null);
            setCategoryData(data.projectsByCategory || []);
            break;
          case "revenue":
            setRevenueData(data.revenue || null);
            break;
          case "traffic":
            setTrafficData(data.traffic || null);
            break;
          case "projects":
            setProjectsData(data.projects || null);
            break;
          case "geography":
            setGeographyData(data.geography || null);
            break;
        }
      }
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setIsLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchAnalytics(activeTab);
  }, [activeTab, timeRange, fetchAnalytics]);

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    }
    if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(0)}K`;
    }
    return `$${amount.toLocaleString()}`;
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(0)}K`;
    }
    return num.toLocaleString();
  };

  const getGrowthBadge = (growth: string | number) => {
    const growthNum = typeof growth === "string" ? parseFloat(growth) : growth;
    const isPositive = growthNum >= 0;
    return (
      <div className={`flex items-center gap-1 text-sm ${isPositive ? "text-emerald-600" : "text-red-600"}`}>
        {isPositive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
        <span>{isPositive ? "+" : ""}{growthNum.toFixed(1)}%</span>
      </div>
    );
  };

  const exportToCSV = () => {
    let csvContent = "";
    let filename = `analytics-${activeTab}-${timeRange}-${new Date().toISOString().split('T')[0]}.csv`;

    switch (activeTab) {
      case "overview":
        if (overviewData) {
          csvContent = "Metric,Current,Previous,Growth\n";
          csvContent += `Revenue,$${overviewData.revenue.current},$${overviewData.revenue.previous},${overviewData.revenue.growth}%\n`;
          csvContent += `Users,${overviewData.users.current},${overviewData.users.previous},${overviewData.users.growth}%\n`;
          csvContent += `Page Views,${overviewData.visits.current},${overviewData.visits.previous},${overviewData.visits.growth}%\n`;
          csvContent += `Conversion Rate,${overviewData.conversionRate}%,,\n`;
          csvContent += `Total Pledges,${overviewData.revenue.count},,\n`;

          if (categoryData.length > 0) {
            csvContent += "\nCategory,Project Count,Total Funding\n";
            categoryData.forEach(cat => {
              csvContent += `${cat.category},${cat.count},$${cat.totalFunding}\n`;
            });
          }
        }
        break;

      case "revenue":
        if (revenueData) {
          csvContent = "Date,Total Revenue,Pledge Count\n";
          revenueData.byDay.forEach(day => {
            csvContent += `${day.date},$${day.total},${day.count}\n`;
          });

          csvContent += "\nTop Projects\nRank,Title,Current Amount,Goal Amount,Backers\n";
          revenueData.topProjects.forEach((project, i) => {
            csvContent += `${i + 1},"${project.title.replace(/"/g, '""')}",$${project.currentAmount},$${project.goalAmount},${project.backerCount}\n`;
          });

          csvContent += "\nPledges by Status\nStatus,Count,Total\n";
          revenueData.byStatus.forEach(status => {
            csvContent += `${status.status},${status.count},$${status.total}\n`;
          });
        }
        break;

      case "traffic":
        if (trafficData) {
          csvContent = "Device Type,Count\n";
          csvContent += `Desktop,${trafficData.devices.desktop}\n`;
          csvContent += `Mobile,${trafficData.devices.mobile}\n`;
          csvContent += `Tablet,${trafficData.devices.tablet}\n`;

          csvContent += "\nTop Referrers\nReferrer,Visits\n";
          trafficData.topReferrers.forEach(ref => {
            csvContent += `"${ref.referrer.replace(/"/g, '""')}",${ref.visits}\n`;
          });

          csvContent += "\nTop Pages\nPath,Views\n";
          trafficData.topPages.forEach(page => {
            csvContent += `"${page.path.replace(/"/g, '""')}",${page.views}\n`;
          });
        }
        break;

      case "projects":
        if (projectsData) {
          csvContent = "Status,Count\n";
          projectsData.byStatus.forEach(status => {
            csvContent += `${status.status},${status.count}\n`;
          });

          csvContent += "\nFunding Distribution\nRange,Count\n";
          Object.entries(projectsData.fundingDistribution).forEach(([range, count]) => {
            csvContent += `${range},${count}\n`;
          });

          csvContent += "\nRecent Projects\nTitle,Status,Category,Current Amount,Goal Amount,Backers,Created\n";
          projectsData.recent.forEach(project => {
            csvContent += `"${project.title.replace(/"/g, '""')}",${project.status},${project.category},$${project.currentAmount},$${project.goalAmount},${project.backerCount},${project.createdAt}\n`;
          });
        }
        break;

      case "geography":
        if (geographyData) {
          csvContent = "Country,Visitors\n";
          geographyData.countries.forEach(country => {
            csvContent += `"${country.country.replace(/"/g, '""')}",${country.visits}\n`;
          });

          if (geographyData.cities.length > 0) {
            csvContent += "\nProject Locations\nLocation,Project Count\n";
            geographyData.cities.forEach(city => {
              csvContent += `"${(city.location || "Unknown").replace(/"/g, '""')}",${city.projectCount}\n`;
            });
          }
        }
        break;
    }

    if (!csvContent) {
      alert("No data available to export");
      return;
    }

    // Create and download the file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  };

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
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button variant="outline" size="icon" onClick={() => fetchAnalytics(activeTab)}>
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
                <p className="mt-1 text-3xl font-bold text-zinc-900 dark:text-white">
                  {overviewData ? formatCurrency(overviewData.revenue.current) : "-"}
                </p>
                {overviewData && getGrowthBadge(overviewData.revenue.growth)}
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
                <p className="text-sm font-medium text-zinc-500">New Users</p>
                <p className="mt-1 text-3xl font-bold text-zinc-900 dark:text-white">
                  {overviewData ? formatNumber(overviewData.users.current) : "-"}
                </p>
                {overviewData && getGrowthBadge(overviewData.users.growth)}
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
                <p className="mt-1 text-3xl font-bold text-zinc-900 dark:text-white">
                  {overviewData ? formatNumber(overviewData.revenue.count) : "-"}
                </p>
                <p className="mt-1 text-sm text-zinc-500">in selected period</p>
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
                <p className="text-sm font-medium text-zinc-500">Conversion Rate</p>
                <p className="mt-1 text-3xl font-bold text-zinc-900 dark:text-white">
                  {overviewData ? `${overviewData.conversionRate}%` : "-"}
                </p>
                <p className="mt-1 text-sm text-zinc-500">views to pledges</p>
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

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          </div>
        ) : (
          <>
            <TabsContent value="overview" className="mt-6 space-y-6">
              {/* Category breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle>Projects by Category</CardTitle>
                </CardHeader>
                <CardContent>
                  {categoryData.length === 0 ? (
                    <p className="text-center text-zinc-500 py-8">No category data available</p>
                  ) : (
                    <div className="space-y-4">
                      {categoryData.map((cat) => {
                        const totalFunding = categoryData.reduce((sum, c) => sum + c.totalFunding, 0);
                        const percentage = totalFunding > 0 ? (cat.totalFunding / totalFunding) * 100 : 0;
                        return (
                          <div key={cat.category}>
                            <div className="mb-1 flex items-center justify-between text-sm">
                              <span className="font-medium">{cat.category}</span>
                              <span className="text-zinc-500">
                                {formatCurrency(cat.totalFunding)} ({cat.count} projects)
                              </span>
                            </div>
                            <Progress value={percentage} className="h-2" />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="revenue" className="mt-6 space-y-6">
              {revenueData ? (
                <>
                  <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                      <CardContent className="p-6">
                        <p className="text-sm font-medium text-zinc-500">Gross Revenue</p>
                        <p className="mt-1 text-2xl font-bold">
                          {formatCurrency(revenueData.byStatus.reduce((sum, s) => sum + s.total, 0))}
                        </p>
                        <p className="mt-1 text-sm text-zinc-500">Total from all pledges</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-6">
                        <p className="text-sm font-medium text-zinc-500">Completed Pledges</p>
                        <p className="mt-1 text-2xl font-bold">
                          {revenueData.byStatus.find(s => s.status === "COMPLETED")?.count || 0}
                        </p>
                        <p className="mt-1 text-sm text-zinc-500">Successfully processed</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-6">
                        <p className="text-sm font-medium text-zinc-500">Pending Pledges</p>
                        <p className="mt-1 text-2xl font-bold">
                          {revenueData.byStatus.find(s => s.status === "PENDING")?.count || 0}
                        </p>
                        <p className="mt-1 text-sm text-zinc-500">Awaiting completion</p>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle>Top Projects by Revenue</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {revenueData.topProjects.length === 0 ? (
                        <p className="text-center text-zinc-500 py-8">No projects yet</p>
                      ) : (
                        <div className="space-y-4">
                          {revenueData.topProjects.map((project, i) => (
                            <div key={project.id} className="flex items-center gap-4 rounded-lg border p-4">
                              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 font-bold text-zinc-600">
                                #{i + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{project.title}</p>
                                <p className="text-sm text-zinc-500">{project.backerCount} backers</p>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold text-emerald-600">
                                  {formatCurrency(project.currentAmount)}
                                </p>
                                <p className="text-sm text-zinc-500">
                                  of {formatCurrency(project.goalAmount)}
                                </p>
                              </div>
                              <div className="w-24">
                                <Progress
                                  value={Math.min((project.currentAmount / project.goalAmount) * 100, 100)}
                                  className="h-2"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center text-zinc-500">
                    No revenue data available
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="traffic" className="mt-6 space-y-6">
              {trafficData ? (
                <>
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
                            <p className="text-2xl font-bold">
                              {formatNumber(trafficData.devices.desktop)}
                            </p>
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
                            <p className="text-2xl font-bold">
                              {formatNumber(trafficData.devices.mobile)}
                            </p>
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
                            <p className="text-2xl font-bold">
                              {formatNumber(trafficData.devices.tablet)}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Traffic sources */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Top Referrers</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {trafficData.topReferrers.length === 0 ? (
                        <p className="text-center text-zinc-500 py-8">No referrer data available</p>
                      ) : (
                        <div className="space-y-4">
                          {trafficData.topReferrers.map((source) => {
                            const maxVisits = Math.max(...trafficData.topReferrers.map(r => r.visits));
                            return (
                              <div key={source.referrer} className="flex items-center gap-4 rounded-lg border p-4">
                                <div className="w-32 font-medium truncate">{source.referrer}</div>
                                <div className="flex-1">
                                  <Progress value={(source.visits / maxVisits) * 100} className="h-2" />
                                </div>
                                <div className="w-24 text-right text-sm text-zinc-500">
                                  {formatNumber(source.visits)} visits
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Top pages */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Top Pages</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {trafficData.topPages.length === 0 ? (
                        <p className="text-center text-zinc-500 py-8">No page view data available</p>
                      ) : (
                        <div className="space-y-2">
                          {trafficData.topPages.slice(0, 10).map((page) => (
                            <div key={page.path} className="flex items-center justify-between py-2 border-b last:border-0">
                              <code className="text-sm text-zinc-600 truncate max-w-[70%]">{page.path}</code>
                              <span className="text-sm text-zinc-500">{formatNumber(page.views)} views</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center text-zinc-500">
                    No traffic data available
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="projects" className="mt-6 space-y-6">
              {projectsData ? (
                <>
                  <div className="grid gap-4 md:grid-cols-4">
                    {projectsData.byStatus.map((status) => (
                      <Card key={status.status}>
                        <CardContent className="p-6">
                          <p className="text-sm font-medium text-zinc-500">{status.status}</p>
                          <p className="mt-1 text-2xl font-bold">{status.count}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Funding Distribution */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Funding Progress Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 md:grid-cols-5">
                        {Object.entries(projectsData.fundingDistribution).map(([range, count]) => (
                          <div key={range} className="text-center p-4 rounded-lg border">
                            <p className="text-2xl font-bold text-zinc-900 dark:text-white">{count}</p>
                            <p className="text-sm text-zinc-500">{range}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Recent Projects</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {projectsData.recent.length === 0 ? (
                        <p className="text-center text-zinc-500 py-8">No recent projects</p>
                      ) : (
                        <div className="space-y-4">
                          {projectsData.recent.slice(0, 10).map((project) => (
                            <div key={project.id} className="flex items-center gap-4 rounded-lg border p-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium truncate">{project.title}</p>
                                  <Badge variant="outline">{project.category}</Badge>
                                  <Badge variant={project.status === "LIVE" ? "default" : "secondary"}>
                                    {project.status}
                                  </Badge>
                                </div>
                                <p className="text-sm text-zinc-500">
                                  {project.backerCount} backers • Created {new Date(project.createdAt).toLocaleDateString()}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold text-emerald-600">
                                  {formatCurrency(project.currentAmount)}
                                </p>
                                <p className="text-sm text-zinc-500">
                                  of {formatCurrency(project.goalAmount)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center text-zinc-500">
                    No project data available
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="geography" className="mt-6 space-y-6">
              {geographyData ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Top Countries</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {geographyData.countries.length === 0 ? (
                      <p className="text-center text-zinc-500 py-8">No geographic data available</p>
                    ) : (
                      <div className="space-y-4">
                        {geographyData.countries.map((country, i) => (
                          <div key={i} className="flex items-center gap-4 rounded-lg border p-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100">
                              <Globe className="h-5 w-5 text-zinc-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium">{country.country}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium">{formatNumber(country.visits)}</p>
                              <p className="text-xs text-zinc-500">visitors</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center text-zinc-500">
                    No geographic data available
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}
