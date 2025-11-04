"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency } from "@/lib/utils"
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import {
  TrendingUp,
  Users,
  Eye,
  DollarSign,
  Download,
  Calendar,
} from "lucide-react"

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"]

interface AnalyticsData {
  summary: {
    totalFunding: number
    fundingGoal: number
    backerCount: number
    totalViews: number
    uniqueViewers: number
    conversionRate: string
    averagePledge: string
  }
  fundingProgress: Array<{
    date: string
    amount: number
    backers: number
    dailyAmount: number
    dailyBackers: number
  }>
  trafficSources: Array<{ source: string; visits: number }>
  deviceBreakdown: Array<{ device: string; visits: number }>
  topReferrers: Array<{ referrer: string; visits: number }>
  rewardPerformance: Array<{
    id: string
    title: string
    pledgeAmount: number
    backerCount: number
    revenue: number
    available: number | null
    claimed: number
  }>
  geographic: Array<{ country: string; backers: number; revenue: number }>
}

export default function ProjectAnalyticsPage() {
  const params = useParams()
  const { toast } = useToast()
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [timeRange, setTimeRange] = useState("30")
  const [project, setProject] = useState<any>(null)

  useEffect(() => {
    fetchAnalytics()
    fetchProject()
  }, [timeRange])

  const fetchProject = async () => {
    try {
      const response = await fetch(`/api/projects/${params.id}`)
      const data = await response.json()
      setProject(data)
    } catch (error) {
      console.error("Failed to fetch project:", error)
    }
  }

  const fetchAnalytics = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(
        `/api/projects/${params.id}/analytics?timeRange=${timeRange}`
      )
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch analytics")
      }

      setAnalytics(data)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load analytics",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const exportData = (format: "csv" | "json") => {
    if (!analytics) return

    if (format === "json") {
      const dataStr = JSON.stringify(analytics, null, 2)
      const dataBlob = new Blob([dataStr], { type: "application/json" })
      const url = URL.createObjectURL(dataBlob)
      const link = document.createElement("a")
      link.href = url
      link.download = `analytics-${params.id}-${new Date().toISOString()}.json`
      link.click()
    } else {
      // CSV export for funding progress
      const headers = ["Date", "Amount", "Backers", "Daily Amount", "Daily Backers"]
      const rows = analytics.fundingProgress.map((item) => [
        item.date,
        item.amount,
        item.backers,
        item.dailyAmount,
        item.dailyBackers,
      ])

      const csv = [headers, ...rows].map((row) => row.join(",")).join("\n")
      const dataBlob = new Blob([csv], { type: "text/csv" })
      const url = URL.createObjectURL(dataBlob)
      const link = document.createElement("a")
      link.href = url
      link.download = `funding-progress-${params.id}-${new Date().toISOString()}.csv`
      link.click()
    }

    toast({
      title: "Export successful",
      description: `Analytics data exported as ${format.toUpperCase()}`,
    })
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading analytics...</div>
      </div>
    )
  }

  if (!analytics) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Unable to load analytics data
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Analytics</h1>
          <p className="text-muted-foreground">
            {project?.title || "Project Analytics"}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="60">Last 60 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => exportData("csv")} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button onClick={() => exportData("json")} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export JSON
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Funding</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(analytics.summary.totalFunding, project?.currency || "USD")}
            </div>
            <p className="text-xs text-muted-foreground">
              of {formatCurrency(analytics.summary.fundingGoal, project?.currency || "USD")} goal
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Backers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.summary.backerCount}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(parseFloat(analytics.summary.averagePledge), project?.currency || "USD")}{" "}
              average pledge
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Page Views</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.summary.totalViews.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {analytics.summary.uniqueViewers} unique viewers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Conversion Rate
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.summary.conversionRate}%
            </div>
            <p className="text-xs text-muted-foreground">
              Viewers to backers
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Funding Progress Chart */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Funding Progress</CardTitle>
          <CardDescription>
            Cumulative funding and backers over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={analytics.fundingProgress}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={(value) => new Date(value).toLocaleDateString()}
              />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip
                labelFormatter={(value) => new Date(value).toLocaleDateString()}
                formatter={(value: any, name: string) => {
                  if (name === "amount") {
                    return [formatCurrency(value, project?.currency || "USD"), "Funding"]
                  }
                  return [value, "Backers"]
                }}
              />
              <Legend />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="amount"
                stroke="#8884d8"
                fill="#8884d8"
                name="Cumulative Funding"
              />
              <Area
                yAxisId="right"
                type="monotone"
                dataKey="backers"
                stroke="#82ca9d"
                fill="#82ca9d"
                name="Total Backers"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Daily Activity Chart */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Daily Activity</CardTitle>
          <CardDescription>Pledges and backers per day</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics.fundingProgress}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={(value) => new Date(value).toLocaleDateString()}
              />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip
                labelFormatter={(value) => new Date(value).toLocaleDateString()}
                formatter={(value: any, name: string) => {
                  if (name === "dailyAmount") {
                    return [formatCurrency(value, project?.currency || "USD"), "Daily Funding"]
                  }
                  return [value, "Daily Backers"]
                }}
              />
              <Legend />
              <Bar
                yAxisId="left"
                dataKey="dailyAmount"
                fill="#8884d8"
                name="Daily Funding"
              />
              <Bar
                yAxisId="right"
                dataKey="dailyBackers"
                fill="#82ca9d"
                name="Daily Backers"
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Traffic Sources */}
        <Card>
          <CardHeader>
            <CardTitle>Traffic Sources</CardTitle>
            <CardDescription>Where your visitors come from</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analytics.trafficSources}
                  dataKey="visits"
                  nameKey="source"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={(entry) => `${entry.source}: ${entry.visits}`}
                >
                  {analytics.trafficSources.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Device Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Device Breakdown</CardTitle>
            <CardDescription>Desktop vs Mobile vs Tablet</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analytics.deviceBreakdown}
                  dataKey="visits"
                  nameKey="device"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={(entry) => `${entry.device}: ${entry.visits}`}
                >
                  {analytics.deviceBreakdown.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Reward Performance */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Reward Performance</CardTitle>
          <CardDescription>Revenue and backers by reward tier</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics.rewardPerformance}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="title" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip
                formatter={(value: any, name: string) => {
                  if (name === "revenue") {
                    return [formatCurrency(value, project?.currency || "USD"), "Revenue"]
                  }
                  return [value, "Backers"]
                }}
              />
              <Legend />
              <Bar
                yAxisId="left"
                dataKey="revenue"
                fill="#8884d8"
                name="Revenue"
              />
              <Bar
                yAxisId="right"
                dataKey="backerCount"
                fill="#82ca9d"
                name="Backers"
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top Referrers */}
      {analytics.topReferrers.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Top Referrers</CardTitle>
            <CardDescription>Websites sending traffic to your project</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics.topReferrers.map((referrer, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium truncate">{referrer.referrer}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{referrer.visits}</p>
                    <p className="text-xs text-muted-foreground">visits</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Geographic Distribution */}
      {analytics.geographic.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Geographic Distribution</CardTitle>
            <CardDescription>Backers and revenue by country</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics.geographic
                .sort((a, b) => b.revenue - a.revenue)
                .slice(0, 10)
                .map((country, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium">{country.country}</p>
                      <p className="text-xs text-muted-foreground">
                        {country.backers} backers
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">
                        {formatCurrency(country.revenue, project?.currency || "USD")}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
