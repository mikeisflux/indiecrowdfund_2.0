"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Brain,
  Target,
  Zap,
  Mail,
  Users,
  Tag,
  Sparkles,
  TrendingUp,
  Clock,
  Settings,
  Play,
  Pause,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Send,
  Eye,
  BarChart3,
  PieChart,
  Activity,
  Filter,
  Layers,
  Wand2,
  History,
  ArrowRight,
  UserCheck,
  ShoppingCart,
  MousePointer,
  Timer,
  Gauge,
} from "lucide-react";

// Mock data
const projectTags = [
  { id: "1", name: "Solar-Powered Backpack", tags: ["technology", "sustainable", "outdoor", "gadgets", "eco-friendly", "travel", "solar", "portable", "green-tech", "innovation", "camping", "hiking"] },
  { id: "2", name: "Indie Game: Lost Horizons", tags: ["gaming", "indie", "adventure", "rpg", "pixel-art", "story-driven", "exploration", "fantasy", "single-player", "retro", "atmospheric"] },
  { id: "3", name: "Documentary: Ocean Guardians", tags: ["film", "documentary", "environment", "ocean", "conservation", "nature", "wildlife", "climate", "awareness", "education", "marine-life"] },
];

const emailCampaigns = [
  { id: "1", name: "Tech Enthusiasts - Week 47", status: "sent", recipients: 12456, opens: 4523, clicks: 1234, conversions: 89, sentAt: "2024-03-18" },
  { id: "2", name: "Gaming Community Update", status: "scheduled", recipients: 8934, opens: 0, clicks: 0, conversions: 0, scheduledFor: "2024-03-20 10:00" },
  { id: "3", name: "Eco-Conscious Backers", status: "draft", recipients: 15678, opens: 0, clicks: 0, conversions: 0, sentAt: null },
];

const behaviorEvents = [
  { event: "page_view", count: 45678, trend: "+12.3%" },
  { event: "project_view", count: 23456, trend: "+8.7%" },
  { event: "reward_view", count: 12345, trend: "+15.2%" },
  { event: "add_to_cart", count: 5678, trend: "+22.1%" },
  { event: "pledge_started", count: 3456, trend: "+18.4%" },
  { event: "pledge_completed", count: 2345, trend: "+14.6%" },
];

const userSegments = [
  { name: "High-Value Backers", count: 4567, avgSpend: 234.50, criteria: "Pledged >$100 in last 90 days" },
  { name: "Repeat Backers", count: 8934, avgSpend: 89.20, criteria: "2+ pledges in last 6 months" },
  { name: "Tech Enthusiasts", count: 12456, avgSpend: 156.80, criteria: "Backed tech/gaming projects" },
  { name: "Early Adopters", count: 3456, avgSpend: 178.90, criteria: "Backed within first 24 hours" },
  { name: "At-Risk Churners", count: 2345, avgSpend: 45.60, criteria: "No activity in 60 days" },
];

export default function AIMarketingPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCampaignDialog, setShowCampaignDialog] = useState(false);

  // AI Settings
  const [aiSettings, setAiSettings] = useState({
    autoTagging: true,
    autoTagConfidence: 75,
    maxTags: 12,
    emailPersonalization: true,
    behaviorTracking: true,
    predictiveAnalytics: true,
    smartSegmentation: true,
    autoOptimization: true,
    sendTimeOptimization: true,
    contentOptimization: true,
    abTesting: true,
    emailFrequencyCap: 3,
    dailyEmailLimit: 10000,
    quietHoursStart: "22:00",
    quietHoursEnd: "08:00",
  });

  // Behavior tracking settings
  const [trackingSettings, setTrackingSettings] = useState({
    trackPageViews: true,
    trackScrollDepth: true,
    trackTimeOnPage: true,
    trackClicks: true,
    trackHovers: false,
    trackFormInteractions: true,
    trackVideoEngagement: true,
    trackRewardComparisons: true,
    trackAbandonedCarts: true,
    sessionRecording: false,
    heatmaps: true,
    funnelAnalysis: true,
    retentionPeriod: 90,
  });

  const runAutoTagging = async () => {
    setIsProcessing(true);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsProcessing(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">AI Marketing & Analytics</h1>
          <p className="text-zinc-500">Intelligent automation for personalized user experiences</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-1">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            AI Active
          </Badge>
          <Button variant="outline">
            <History className="mr-2 h-4 w-4" />
            Activity Log
          </Button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-violet-100 p-3 dark:bg-violet-900/30">
                <Brain className="h-6 w-6 text-violet-600" />
              </div>
              <div>
                <p className="text-sm text-zinc-500">AI Predictions</p>
                <p className="text-2xl font-bold">94.2%</p>
                <p className="text-xs text-emerald-600">Accuracy rate</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-blue-100 p-3 dark:bg-blue-900/30">
                <Tag className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-zinc-500">Projects Tagged</p>
                <p className="text-2xl font-bold">1,234</p>
                <p className="text-xs text-zinc-500">14,808 total tags</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-emerald-100 p-3 dark:bg-emerald-900/30">
                <Send className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-zinc-500">Emails Sent</p>
                <p className="text-2xl font-bold">156.8K</p>
                <p className="text-xs text-emerald-600">+23% open rate</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-amber-100 p-3 dark:bg-amber-900/30">
                <TrendingUp className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-zinc-500">Conversion Lift</p>
                <p className="text-2xl font-bold">+34%</p>
                <p className="text-xs text-emerald-600">vs non-personalized</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview">
            <BarChart3 className="mr-2 h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="auto-tagging">
            <Tag className="mr-2 h-4 w-4" />
            Auto-Tagging
          </TabsTrigger>
          <TabsTrigger value="email-campaigns">
            <Mail className="mr-2 h-4 w-4" />
            Email Campaigns
          </TabsTrigger>
          <TabsTrigger value="behavior">
            <Activity className="mr-2 h-4 w-4" />
            Behavior Tracking
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="mr-2 h-4 w-4" />
            AI Settings
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-6 space-y-6">
          {/* AI Insights Banner */}
          <Card className="border-violet-200 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="rounded-full bg-violet-100 p-3">
                  <Sparkles className="h-6 w-6 text-violet-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-violet-900 dark:text-violet-100">AI Recommendations</h3>
                  <ul className="mt-2 space-y-2 text-sm text-violet-700 dark:text-violet-300">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      <span>23 projects have high engagement but low pledge conversion - consider targeted email campaigns</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      <span>Tech category showing 45% increase in interest - recommend featuring more tech projects</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      <span>4,567 users match high-value backer profile - activate personalized outreach</span>
                    </li>
                  </ul>
                </div>
                <Button variant="outline" className="bg-white">
                  <Wand2 className="mr-2 h-4 w-4" />
                  Apply Recommendations
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* User Segments */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Smart User Segments</CardTitle>
                  <Button variant="outline" size="sm">
                    <Filter className="mr-2 h-4 w-4" />
                    Manage
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {userSegments.map((segment) => (
                    <div key={segment.name} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100">
                          <Users className="h-5 w-5 text-zinc-600" />
                        </div>
                        <div>
                          <p className="font-medium">{segment.name}</p>
                          <p className="text-xs text-zinc-500">{segment.criteria}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{segment.count.toLocaleString()}</p>
                        <p className="text-xs text-zinc-500">Avg ${segment.avgSpend}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Behavior Events */}
            <Card>
              <CardHeader>
                <CardTitle>Behavior Tracking Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {behaviorEvents.map((event) => (
                    <div key={event.event} className="flex items-center gap-4">
                      <div className="w-36">
                        <p className="text-sm font-medium capitalize">{event.event.replace(/_/g, " ")}</p>
                      </div>
                      <div className="flex-1">
                        <Progress value={(event.count / 50000) * 100} className="h-2" />
                      </div>
                      <div className="w-20 text-right">
                        <p className="text-sm font-medium">{event.count.toLocaleString()}</p>
                      </div>
                      <Badge variant="outline" className="text-emerald-600">
                        {event.trend}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Email Campaigns */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recent AI-Powered Campaigns</CardTitle>
                <Button onClick={() => setShowCampaignDialog(true)}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Create AI Campaign
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {emailCampaigns.map((campaign) => (
                  <div key={campaign.id} className="flex items-center gap-4 rounded-lg border p-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{campaign.name}</p>
                        <Badge
                          variant={
                            campaign.status === "sent" ? "default" :
                            campaign.status === "scheduled" ? "secondary" : "outline"
                          }
                        >
                          {campaign.status}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-zinc-500">
                        {campaign.recipients.toLocaleString()} recipients
                        {campaign.sentAt && ` • Sent ${campaign.sentAt}`}
                        {campaign.scheduledFor && ` • Scheduled for ${campaign.scheduledFor}`}
                      </p>
                    </div>
                    {campaign.status === "sent" && (
                      <div className="flex gap-6 text-center">
                        <div>
                          <p className="text-lg font-semibold">{((campaign.opens / campaign.recipients) * 100).toFixed(1)}%</p>
                          <p className="text-xs text-zinc-500">Opens</p>
                        </div>
                        <div>
                          <p className="text-lg font-semibold">{((campaign.clicks / campaign.recipients) * 100).toFixed(1)}%</p>
                          <p className="text-xs text-zinc-500">Clicks</p>
                        </div>
                        <div>
                          <p className="text-lg font-semibold text-emerald-600">{campaign.conversions}</p>
                          <p className="text-xs text-zinc-500">Conversions</p>
                        </div>
                      </div>
                    )}
                    <Button variant="outline" size="sm">
                      <Eye className="mr-2 h-4 w-4" />
                      View
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Auto-Tagging Tab */}
        <TabsContent value="auto-tagging" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>AI Auto-Tagging Engine</CardTitle>
                  <CardDescription>
                    Automatically analyze project content and generate 10-15 relevant tags
                  </CardDescription>
                </div>
                <Button onClick={runAutoTagging} disabled={isProcessing}>
                  {isProcessing ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Wand2 className="mr-2 h-4 w-4" />
                      Run Auto-Tagging
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border bg-zinc-50 p-4 dark:bg-zinc-900">
                <div className="flex items-center gap-3">
                  <Brain className="h-5 w-5 text-violet-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">AI analyzes project titles, descriptions, stories, and images</p>
                    <p className="text-xs text-zinc-500">Uses NLP and image recognition to extract meaningful tags</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Auto-Tagging Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Confidence Threshold ({aiSettings.autoTagConfidence}%)</Label>
                    <Slider
                      value={[aiSettings.autoTagConfidence]}
                      onValueChange={([v]) => setAiSettings({ ...aiSettings, autoTagConfidence: v })}
                      min={50}
                      max={100}
                      step={5}
                    />
                    <p className="text-xs text-zinc-500">Only apply tags with confidence above this threshold</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Maximum Tags per Project ({aiSettings.maxTags})</Label>
                    <Slider
                      value={[aiSettings.maxTags]}
                      onValueChange={([v]) => setAiSettings({ ...aiSettings, maxTags: v })}
                      min={5}
                      max={20}
                      step={1}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <Label>Auto-Tag New Projects</Label>
                      <p className="text-sm text-zinc-500">Automatically tag projects on creation</p>
                    </div>
                    <Switch
                      checked={aiSettings.autoTagging}
                      onCheckedChange={(checked) => setAiSettings({ ...aiSettings, autoTagging: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <Label>Require Review</Label>
                      <p className="text-sm text-zinc-500">Require admin approval for auto-generated tags</p>
                    </div>
                    <Switch checked={false} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recently Tagged Projects</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {projectTags.map((project) => (
                  <div key={project.id} className="rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold">{project.name}</h4>
                      <Badge variant="outline">{project.tags.length} tags</Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {project.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Campaigns Tab */}
        <TabsContent value="email-campaigns" className="mt-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-zinc-500">Total Sent</p>
                <p className="mt-1 text-2xl font-bold">156,892</p>
                <p className="text-xs text-emerald-600">This month</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-zinc-500">Avg Open Rate</p>
                <p className="mt-1 text-2xl font-bold">36.2%</p>
                <p className="text-xs text-emerald-600">+4.5% vs industry</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-zinc-500">Avg Click Rate</p>
                <p className="mt-1 text-2xl font-bold">8.7%</p>
                <p className="text-xs text-emerald-600">+2.1% vs industry</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-zinc-500">Revenue Generated</p>
                <p className="mt-1 text-2xl font-bold">$234K</p>
                <p className="text-xs text-emerald-600">From email campaigns</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>AI-Powered Email Matching</CardTitle>
                  <CardDescription>
                    Match projects with users based on their interests and behavior
                  </CardDescription>
                </div>
                <Button onClick={() => setShowCampaignDialog(true)}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Create Campaign
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-blue-100 p-2">
                      <Users className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium">Subscriber Campaigns</p>
                      <p className="text-sm text-zinc-500">Target newsletter subscribers</p>
                    </div>
                  </div>
                  <Button variant="outline" className="mt-4 w-full">
                    <ArrowRight className="mr-2 h-4 w-4" />
                    Configure
                  </Button>
                </div>

                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-emerald-100 p-2">
                      <UserCheck className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-medium">Backer Campaigns</p>
                      <p className="text-sm text-zinc-500">Engage previous backers</p>
                    </div>
                  </div>
                  <Button variant="outline" className="mt-4 w-full">
                    <ArrowRight className="mr-2 h-4 w-4" />
                    Configure
                  </Button>
                </div>

                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-violet-100 p-2">
                      <Layers className="h-5 w-5 text-violet-600" />
                    </div>
                    <div>
                      <p className="font-medium">Creator Campaigns</p>
                      <p className="text-sm text-zinc-500">Notify project creators</p>
                    </div>
                  </div>
                  <Button variant="outline" className="mt-4 w-full">
                    <ArrowRight className="mr-2 h-4 w-4" />
                    Configure
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>How AI Email Matching Works</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex flex-1 flex-col items-center gap-2 p-4">
                  <div className="rounded-full bg-violet-100 p-4">
                    <Tag className="h-8 w-8 text-violet-600" />
                  </div>
                  <p className="text-center font-medium">Auto-Tag Projects</p>
                  <p className="text-center text-sm text-zinc-500">AI analyzes content and generates tags</p>
                </div>
                <ArrowRight className="h-6 w-6 text-zinc-300" />
                <div className="flex flex-1 flex-col items-center gap-2 p-4">
                  <div className="rounded-full bg-blue-100 p-4">
                    <Users className="h-8 w-8 text-blue-600" />
                  </div>
                  <p className="text-center font-medium">Match User Interests</p>
                  <p className="text-center text-sm text-zinc-500">Compare tags to user behavior</p>
                </div>
                <ArrowRight className="h-6 w-6 text-zinc-300" />
                <div className="flex flex-1 flex-col items-center gap-2 p-4">
                  <div className="rounded-full bg-emerald-100 p-4">
                    <Send className="h-8 w-8 text-emerald-600" />
                  </div>
                  <p className="text-center font-medium">Send Personalized Email</p>
                  <p className="text-center text-sm text-zinc-500">Deliver relevant projects</p>
                </div>
                <ArrowRight className="h-6 w-6 text-zinc-300" />
                <div className="flex flex-1 flex-col items-center gap-2 p-4">
                  <div className="rounded-full bg-amber-100 p-4">
                    <ShoppingCart className="h-8 w-8 text-amber-600" />
                  </div>
                  <p className="text-center font-medium">Track Conversions</p>
                  <p className="text-center text-sm text-zinc-500">Measure and optimize</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Behavior Tracking Tab */}
        <TabsContent value="behavior" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Behavior Tracking Configuration</CardTitle>
                  <CardDescription>Configure what user behaviors to track and analyze</CardDescription>
                </div>
                <Badge variant={trackingSettings.trackPageViews ? "default" : "secondary"}>
                  {trackingSettings.trackPageViews ? "Tracking Active" : "Tracking Paused"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-4">
                  <h4 className="font-semibold">Page Interactions</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3">
                        <Eye className="h-4 w-4 text-zinc-500" />
                        <Label>Page Views</Label>
                      </div>
                      <Switch
                        checked={trackingSettings.trackPageViews}
                        onCheckedChange={(checked) => setTrackingSettings({ ...trackingSettings, trackPageViews: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3">
                        <Activity className="h-4 w-4 text-zinc-500" />
                        <Label>Scroll Depth</Label>
                      </div>
                      <Switch
                        checked={trackingSettings.trackScrollDepth}
                        onCheckedChange={(checked) => setTrackingSettings({ ...trackingSettings, trackScrollDepth: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3">
                        <Timer className="h-4 w-4 text-zinc-500" />
                        <Label>Time on Page</Label>
                      </div>
                      <Switch
                        checked={trackingSettings.trackTimeOnPage}
                        onCheckedChange={(checked) => setTrackingSettings({ ...trackingSettings, trackTimeOnPage: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3">
                        <MousePointer className="h-4 w-4 text-zinc-500" />
                        <Label>Click Tracking</Label>
                      </div>
                      <Switch
                        checked={trackingSettings.trackClicks}
                        onCheckedChange={(checked) => setTrackingSettings({ ...trackingSettings, trackClicks: checked })}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold">Conversion Tracking</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3">
                        <ShoppingCart className="h-4 w-4 text-zinc-500" />
                        <Label>Abandoned Carts</Label>
                      </div>
                      <Switch
                        checked={trackingSettings.trackAbandonedCarts}
                        onCheckedChange={(checked) => setTrackingSettings({ ...trackingSettings, trackAbandonedCarts: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3">
                        <Layers className="h-4 w-4 text-zinc-500" />
                        <Label>Reward Comparisons</Label>
                      </div>
                      <Switch
                        checked={trackingSettings.trackRewardComparisons}
                        onCheckedChange={(checked) => setTrackingSettings({ ...trackingSettings, trackRewardComparisons: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3">
                        <Play className="h-4 w-4 text-zinc-500" />
                        <Label>Video Engagement</Label>
                      </div>
                      <Switch
                        checked={trackingSettings.trackVideoEngagement}
                        onCheckedChange={(checked) => setTrackingSettings({ ...trackingSettings, trackVideoEngagement: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3">
                        <BarChart3 className="h-4 w-4 text-zinc-500" />
                        <Label>Funnel Analysis</Label>
                      </div>
                      <Switch
                        checked={trackingSettings.funnelAnalysis}
                        onCheckedChange={(checked) => setTrackingSettings({ ...trackingSettings, funnelAnalysis: checked })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <h4 className="font-semibold">Advanced Features</h4>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <Label>Session Recording</Label>
                      <p className="text-xs text-zinc-500">Record user sessions for replay</p>
                    </div>
                    <Switch
                      checked={trackingSettings.sessionRecording}
                      onCheckedChange={(checked) => setTrackingSettings({ ...trackingSettings, sessionRecording: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <Label>Heatmaps</Label>
                      <p className="text-xs text-zinc-500">Generate click heatmaps</p>
                    </div>
                    <Switch
                      checked={trackingSettings.heatmaps}
                      onCheckedChange={(checked) => setTrackingSettings({ ...trackingSettings, heatmaps: checked })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Data Retention (days)</Label>
                    <Select
                      value={String(trackingSettings.retentionPeriod)}
                      onValueChange={(v) => setTrackingSettings({ ...trackingSettings, retentionPeriod: parseInt(v) })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30">30 days</SelectItem>
                        <SelectItem value="60">60 days</SelectItem>
                        <SelectItem value="90">90 days</SelectItem>
                        <SelectItem value="180">180 days</SelectItem>
                        <SelectItem value="365">1 year</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Real-Time Behavior Stream</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { time: "2s ago", event: "project_view", user: "user_abc123", details: "Viewed 'Solar-Powered Backpack'" },
                  { time: "5s ago", event: "reward_view", user: "user_def456", details: "Viewed $50 reward tier" },
                  { time: "8s ago", event: "pledge_started", user: "user_ghi789", details: "Started pledge on 'Indie Game'" },
                  { time: "12s ago", event: "scroll_depth", user: "user_jkl012", details: "Scrolled 75% on project page" },
                  { time: "15s ago", event: "video_play", user: "user_mno345", details: "Started watching project video" },
                ].map((event, i) => (
                  <div key={i} className="flex items-center gap-4 rounded-lg border p-3 text-sm">
                    <span className="w-16 text-zinc-500">{event.time}</span>
                    <Badge variant="outline" className="w-28 justify-center">
                      {event.event.replace(/_/g, " ")}
                    </Badge>
                    <code className="text-xs text-zinc-500">{event.user}</code>
                    <span className="flex-1 text-zinc-600">{event.details}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Settings Tab */}
        <TabsContent value="settings" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>AI Engine Configuration</CardTitle>
              <CardDescription>Fine-tune the AI marketing and personalization engine</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <h4 className="font-semibold">Core Features</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <Label>Email Personalization</Label>
                        <p className="text-xs text-zinc-500">Personalize email content per user</p>
                      </div>
                      <Switch
                        checked={aiSettings.emailPersonalization}
                        onCheckedChange={(checked) => setAiSettings({ ...aiSettings, emailPersonalization: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <Label>Predictive Analytics</Label>
                        <p className="text-xs text-zinc-500">Predict user behavior and conversion likelihood</p>
                      </div>
                      <Switch
                        checked={aiSettings.predictiveAnalytics}
                        onCheckedChange={(checked) => setAiSettings({ ...aiSettings, predictiveAnalytics: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <Label>Smart Segmentation</Label>
                        <p className="text-xs text-zinc-500">Auto-create user segments based on behavior</p>
                      </div>
                      <Switch
                        checked={aiSettings.smartSegmentation}
                        onCheckedChange={(checked) => setAiSettings({ ...aiSettings, smartSegmentation: checked })}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold">Optimization</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <Label>Send Time Optimization</Label>
                        <p className="text-xs text-zinc-500">AI picks optimal send time per user</p>
                      </div>
                      <Switch
                        checked={aiSettings.sendTimeOptimization}
                        onCheckedChange={(checked) => setAiSettings({ ...aiSettings, sendTimeOptimization: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <Label>Content Optimization</Label>
                        <p className="text-xs text-zinc-500">A/B test subject lines and content</p>
                      </div>
                      <Switch
                        checked={aiSettings.contentOptimization}
                        onCheckedChange={(checked) => setAiSettings({ ...aiSettings, contentOptimization: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <Label>Automatic A/B Testing</Label>
                        <p className="text-xs text-zinc-500">Automatically run A/B tests on campaigns</p>
                      </div>
                      <Switch
                        checked={aiSettings.abTesting}
                        onCheckedChange={(checked) => setAiSettings({ ...aiSettings, abTesting: checked })}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Email Limits & Frequency</CardTitle>
              <CardDescription>Control email sending behavior to prevent spam</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Max Emails Per User Per Week</Label>
                  <Slider
                    value={[aiSettings.emailFrequencyCap]}
                    onValueChange={([v]) => setAiSettings({ ...aiSettings, emailFrequencyCap: v })}
                    min={1}
                    max={7}
                    step={1}
                  />
                  <p className="text-sm text-zinc-500">{aiSettings.emailFrequencyCap} emails per week</p>
                </div>

                <div className="space-y-2">
                  <Label>Daily Email Limit</Label>
                  <Input
                    type="number"
                    value={aiSettings.dailyEmailLimit}
                    onChange={(e) => setAiSettings({ ...aiSettings, dailyEmailLimit: parseInt(e.target.value) })}
                  />
                  <p className="text-xs text-zinc-500">Maximum emails to send per day across all campaigns</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Quiet Hours Start</Label>
                  <Input
                    type="time"
                    value={aiSettings.quietHoursStart}
                    onChange={(e) => setAiSettings({ ...aiSettings, quietHoursStart: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Quiet Hours End</Label>
                  <Input
                    type="time"
                    value={aiSettings.quietHoursEnd}
                    onChange={(e) => setAiSettings({ ...aiSettings, quietHoursEnd: e.target.value })}
                  />
                </div>
              </div>
              <p className="text-sm text-zinc-500">No emails will be sent during quiet hours (in user's local timezone)</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Campaign Dialog */}
      <Dialog open={showCampaignDialog} onOpenChange={setShowCampaignDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create AI-Powered Campaign</DialogTitle>
            <DialogDescription>
              Let AI match projects to users based on their interests and behavior
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Campaign Name</Label>
              <Input placeholder="e.g., Tech Enthusiasts - November 2024" />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Target Audience</Label>
                <Select defaultValue="all">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Subscribers</SelectItem>
                    <SelectItem value="backers">Previous Backers</SelectItem>
                    <SelectItem value="high-value">High-Value Backers</SelectItem>
                    <SelectItem value="at-risk">At-Risk Churners</SelectItem>
                    <SelectItem value="creators">Project Creators</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Project Categories</Label>
                <Select defaultValue="all">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="technology">Technology</SelectItem>
                    <SelectItem value="games">Games</SelectItem>
                    <SelectItem value="film">Film & Video</SelectItem>
                    <SelectItem value="design">Design</SelectItem>
                    <SelectItem value="music">Music</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Email Subject (AI will personalize)</Label>
              <Input placeholder="e.g., Projects you'll love this week" />
            </div>

            <div className="space-y-2">
              <Label>Intro Message</Label>
              <Textarea
                placeholder="Brief intro for the email. AI will add personalized project recommendations below."
                rows={3}
              />
            </div>

            <div className="rounded-lg border bg-violet-50 p-4 dark:bg-violet-950/20">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-violet-600" />
                <p className="font-medium text-violet-900 dark:text-violet-100">AI Personalization</p>
              </div>
              <p className="mt-1 text-sm text-violet-700 dark:text-violet-300">
                Each recipient will receive 3-5 project recommendations based on their browsing history,
                previous pledges, and matching tags.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCampaignDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowCampaignDialog(false)}>
              <Sparkles className="mr-2 h-4 w-4" />
              Create Campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
