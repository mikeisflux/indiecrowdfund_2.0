"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Download,
  Calendar,
  Target,
  ShoppingCart,
  RefreshCw,
  BarChart3,
  Loader2,
} from "lucide-react";
import { OverviewTab } from "./components/OverviewTab";
import { RevenueTab } from "./components/RevenueTab";
import { TrafficTab } from "./components/TrafficTab";
import { ProjectsAnalyticsTab } from "./components/ProjectsAnalyticsTab";
import { GeographyTab } from "./components/GeographyTab";

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
  userLocations: { location: string; userCount: number }[];
  backerLocations: { location: string; backerCount: number }[];
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
    const filename = `analytics-${activeTab}-${timeRange}-${new Date().toISOString().split("T")[0]}.csv`;

    switch (activeTab) {
      case "overview":
        if (overviewData) {
          csvContent = "Metric,Current,Previous,Growth\n";
          csvContent += `Revenue,$${Number(overviewData.revenue.current).toFixed(2)},$${Number(overviewData.revenue.previous).toFixed(2)},${overviewData.revenue.growth}%\n`;
          csvContent += `Users,${overviewData.users.current},${overviewData.users.previous},${overviewData.users.growth}%\n`;
          csvContent += `Page Views,${overviewData.visits.current},${overviewData.visits.previous},${overviewData.visits.growth}%\n`;
          csvContent += `Conversion Rate,${overviewData.conversionRate}%,,\n`;
          csvContent += `Total Pledges,${overviewData.revenue.count},,\n`;

          if (categoryData.length > 0) {
            csvContent += "\nCategory,Project Count,Total Funding\n";
            categoryData.forEach((cat) => {
              csvContent += `${cat.category},${cat.count},$${Number(cat.totalFunding).toFixed(2)}\n`;
            });
          }
        }
        break;

      case "revenue":
        if (revenueData) {
          csvContent = "Date,Total Revenue,Pledge Count\n";
          revenueData.byDay.forEach((day) => {
            csvContent += `${day.date},$${Number(day.total).toFixed(2)},${day.count}\n`;
          });

          csvContent += "\nTop Projects\nRank,Title,Current Amount,Goal Amount,Backers\n";
          revenueData.topProjects.forEach((project, i) => {
            csvContent += `${i + 1},"${project.title.replace(/"/g, '""')}",$${Number(project.currentAmount).toFixed(2)},$${Number(project.goalAmount).toFixed(2)},${project.backerCount}\n`;
          });

          csvContent += "\nPledges by Status\nStatus,Count,Total\n";
          revenueData.byStatus.forEach((status) => {
            csvContent += `${status.status},${status.count},$${Number(status.total).toFixed(2)}\n`;
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
          trafficData.topReferrers.forEach((ref) => {
            csvContent += `"${ref.referrer.replace(/"/g, '""')}",${ref.visits}\n`;
          });

          csvContent += "\nTop Pages\nPath,Views\n";
          trafficData.topPages.forEach((page) => {
            csvContent += `"${page.path.replace(/"/g, '""')}",${page.views}\n`;
          });
        }
        break;

      case "projects":
        if (projectsData) {
          csvContent = "Status,Count\n";
          projectsData.byStatus.forEach((status) => {
            csvContent += `${status.status},${status.count}\n`;
          });

          csvContent += "\nFunding Distribution\nRange,Count\n";
          Object.entries(projectsData.fundingDistribution).forEach(([range, count]) => {
            csvContent += `${range},${count}\n`;
          });

          csvContent += "\nRecent Projects\nTitle,Status,Category,Current Amount,Goal Amount,Backers,Created\n";
          projectsData.recent.forEach((project) => {
            csvContent += `"${project.title.replace(/"/g, '""')}",${project.status},${project.category},$${Number(project.currentAmount).toFixed(2)},$${Number(project.goalAmount).toFixed(2)},${project.backerCount},${project.createdAt}\n`;
          });
        }
        break;

      case "geography":
        if (geographyData) {
          csvContent = "Country,Visitors\n";
          geographyData.countries.forEach((country) => {
            csvContent += `"${country.country.replace(/"/g, '""')}",${country.visits}\n`;
          });

          if (geographyData.userLocations?.length > 0) {
            csvContent += "\nUser Locations\nLocation,User Count\n";
            geographyData.userLocations.forEach((loc) => {
              csvContent += `"${loc.location.replace(/"/g, '""')}",${loc.userCount}\n`;
            });
          }

          if (geographyData.backerLocations?.length > 0) {
            csvContent += "\nBacker Locations\nLocation,Backer Count\n";
            geographyData.backerLocations.forEach((loc) => {
              csvContent += `"${loc.location.replace(/"/g, '""')}",${loc.backerCount}\n`;
            });
          }

          if (geographyData.cities.length > 0) {
            csvContent += "\nProject Locations\nLocation,Project Count\n";
            geographyData.cities.forEach((city) => {
              csvContent += `"${(city.location || "Unknown").replace(/"/g, '""')}",${city.projectCount}\n`;
            });
          }
        }
        break;
    }

    if (!csvContent) {
      toast.error("No data available to export");
      return;
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success("Data exported successfully");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Analytics</h1>
          <p className="text-muted-foreground">Comprehensive platform metrics and insights</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-full sm:w-[160px]">
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
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
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
                <p className="text-sm font-medium text-muted-foreground">New Users</p>
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
                <p className="text-sm font-medium text-muted-foreground">Total Pledges</p>
                <p className="mt-1 text-3xl font-bold text-zinc-900 dark:text-white">
                  {overviewData ? formatNumber(overviewData.revenue.count) : "-"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">in selected period</p>
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
                <p className="text-sm font-medium text-muted-foreground">Conversion Rate</p>
                <p className="mt-1 text-3xl font-bold text-zinc-900 dark:text-white">
                  {overviewData ? `${overviewData.conversionRate}%` : "-"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">views to pledges</p>
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
        <div className="overflow-x-auto pb-1">
          <TabsList className="inline-flex w-max min-w-full">
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
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          </div>
        ) : (
          <>
            <TabsContent value="overview">
              <OverviewTab
                categoryData={categoryData}
                formatCurrency={formatCurrency}
              />
            </TabsContent>

            <TabsContent value="revenue">
              <RevenueTab
                revenueData={revenueData}
                formatCurrency={formatCurrency}
              />
            </TabsContent>

            <TabsContent value="traffic">
              <TrafficTab
                trafficData={trafficData}
                formatNumber={formatNumber}
              />
            </TabsContent>

            <TabsContent value="projects">
              <ProjectsAnalyticsTab
                projectsData={projectsData}
                formatCurrency={formatCurrency}
              />
            </TabsContent>

            <TabsContent value="geography">
              <GeographyTab
                geographyData={geographyData}
                formatNumber={formatNumber}
              />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}
