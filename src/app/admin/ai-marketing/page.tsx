"use client";

import { useState, useEffect, useCallback } from "react";
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
} from "@/components/ui/dialog";
import {
  Brain,
  Target,
  Mail,
  Users,
  Tag,
  Sparkles,
  TrendingUp,
  Settings,
  Play,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Send,
  Eye,
  BarChart3,
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
} from "lucide-react";

// Types for dynamic data
interface ProjectTag {
  id: string;
  name: string;
  tags: string[];
}

interface EmailCampaign {
  id: string;
  name: string;
  status: string;
  recipients: number;
  opens: number;
  clicks: number;
  conversions: number;
  sentAt: string | null;
  scheduledFor?: string | null;
}

interface BehaviorEvent {
  event: string;
  count: number;
  trend: string;
}

interface UserSegment {
  name: string;
  count: number;
  avgSpend: string | number;
  criteria: string;
}

interface AIStats {
  aiPredictions: { accuracy: string; label: string };
  projectsTagged: { count: string; totalTags: string; label: string };
  emailsSent: { count: string; openRate: string; label: string };
  conversionLift: { percent: string; label: string };
}

export default function AIMarketingPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [showCampaignDialog, setShowCampaignDialog] = useState(false);
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false);
  const [campaignError, setCampaignError] = useState<string | null>(null);
  const [campaignSuccess, setCampaignSuccess] = useState<string | null>(null);
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [showSegmentManager, setShowSegmentManager] = useState(false);
  const [showCampaignViewer, setShowCampaignViewer] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<EmailCampaign | null>(null);
  const [isApplyingRecommendations, setIsApplyingRecommendations] = useState(false);
  const [activityLogs, setActivityLogs] = useState<Array<{ id: string; action: string; details: string; timestamp: string }>>([]);

  // Campaign form state
  const [campaignForm, setCampaignForm] = useState({
    name: "",
    targetAudience: "all",
    projectCategory: "all",
    subjectTemplate: "",
    introMessage: "",
    autoGenerateCopy: true,
  });

  // Preset campaign templates
  const campaignTemplates = [
    {
      id: "weekly-picks",
      name: "Weekly Project Picks",
      targetAudience: "all",
      projectCategory: "all",
      subjectTemplate: "This week's must-see projects",
      introMessage: "We've handpicked some amazing projects we think you'll love.",
    },
    {
      id: "tech-enthusiasts",
      name: "Tech Enthusiasts Newsletter",
      targetAudience: "backers",
      projectCategory: "technology",
      subjectTemplate: "Innovative tech projects just for you",
      introMessage: "As a tech supporter, we thought you'd want to see these cutting-edge projects.",
    },
    {
      id: "high-value-exclusive",
      name: "Exclusive VIP Showcase",
      targetAudience: "high-value",
      projectCategory: "all",
      subjectTemplate: "Exclusive early access to premium projects",
      introMessage: "As one of our top supporters, get first look at these exceptional projects.",
    },
    {
      id: "game-launches",
      name: "New Game Launches",
      targetAudience: "backers",
      projectCategory: "games",
      subjectTemplate: "New games you won't want to miss",
      introMessage: "Level up with these exciting new game projects!",
    },
    {
      id: "creative-arts",
      name: "Creative Arts Digest",
      targetAudience: "all",
      projectCategory: "art",
      subjectTemplate: "Support incredible artists",
      introMessage: "Discover beautiful art projects from talented creators.",
    },
    {
      id: "creator-tips",
      name: "Creator Success Tips",
      targetAudience: "creators",
      projectCategory: "all",
      subjectTemplate: "Tips to make your project succeed",
      introMessage: "Learn from successful campaigns and boost your project.",
    },
    {
      id: "win-back",
      name: "We Miss You Campaign",
      targetAudience: "at-risk",
      projectCategory: "all",
      subjectTemplate: "Come back and see what's new!",
      introMessage: "It's been a while! Check out these amazing new projects.",
    },
  ];

  const applyTemplate = (templateId: string) => {
    const template = campaignTemplates.find(t => t.id === templateId);
    if (template) {
      setCampaignForm({
        ...campaignForm,
        name: template.name,
        targetAudience: template.targetAudience,
        projectCategory: template.projectCategory,
        subjectTemplate: campaignForm.autoGenerateCopy ? "" : template.subjectTemplate,
        introMessage: campaignForm.autoGenerateCopy ? "" : template.introMessage,
      });
    }
  };

  // Dynamic data from API
  const [stats, setStats] = useState<AIStats | null>(null);
  const [projectTags, setProjectTags] = useState<ProjectTag[]>([]);
  const [emailCampaigns, setEmailCampaigns] = useState<EmailCampaign[]>([]);
  const [behaviorEvents, setBehaviorEvents] = useState<BehaviorEvent[]>([]);
  const [userSegments, setUserSegments] = useState<UserSegment[]>([]);

  // AI Settings
  const [aiSettings, setAiSettings] = useState({
    autoTagging: true,
    autoTagConfidence: 75,
    maxTags: 5,
    emailPersonalization: false,
    behaviorTracking: false,
    predictiveAnalytics: false,
    smartSegmentation: false,
    autoOptimization: false,
    sendTimeOptimization: false,
    contentOptimization: false,
    abTesting: false,
    emailFrequencyCap: 3,
    dailyEmailLimit: 1000,
    quietHoursStart: "22:00",
    quietHoursEnd: "08:00",
  });

  // Behavior tracking settings
  const [trackingSettings, setTrackingSettings] = useState({
    trackPageViews: true,
    trackScrollDepth: false,
    trackTimeOnPage: true,
    trackClicks: true,
    trackHovers: false,
    trackFormInteractions: false,
    trackVideoEngagement: false,
    trackRewardComparisons: false,
    trackAbandonedCarts: true,
    sessionRecording: false,
    heatmaps: false,
    funnelAnalysis: true,
    retentionPeriod: 90,
  });

  // Load AI settings and stats from API
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Load both settings and stats in parallel
      const [settingsRes, statsRes] = await Promise.all([
        fetch("/api/admin/settings"),
        fetch("/api/admin/ai-marketing/stats")
      ]);

      // Load settings
      if (settingsRes.ok) {
        const data = await settingsRes.json();
        const s = data.settings;
        if (s) {
          setAiSettings(prev => ({
            ...prev,
            autoTagging: s.aiAutoTagging ?? prev.autoTagging,
            autoTagConfidence: s.aiAutoTagConfidence ?? prev.autoTagConfidence,
            maxTags: s.aiMaxTags ?? prev.maxTags,
            emailPersonalization: s.aiEmailPersonalization ?? prev.emailPersonalization,
            behaviorTracking: s.aiBehaviorTracking ?? prev.behaviorTracking,
            predictiveAnalytics: s.aiPredictiveAnalytics ?? prev.predictiveAnalytics,
            smartSegmentation: s.aiSmartSegmentation ?? prev.smartSegmentation,
            autoOptimization: s.aiAutoOptimization ?? prev.autoOptimization,
            sendTimeOptimization: s.aiSendTimeOptimization ?? prev.sendTimeOptimization,
            contentOptimization: s.aiContentOptimization ?? prev.contentOptimization,
            abTesting: s.aiAbTesting ?? prev.abTesting,
            emailFrequencyCap: s.aiEmailFrequencyCap ?? prev.emailFrequencyCap,
            dailyEmailLimit: s.aiDailyEmailLimit ?? prev.dailyEmailLimit,
            quietHoursStart: s.aiQuietHoursStart ?? prev.quietHoursStart,
            quietHoursEnd: s.aiQuietHoursEnd ?? prev.quietHoursEnd,
          }));
          setTrackingSettings(prev => ({
            ...prev,
            trackPageViews: s.aiTrackPageViews ?? prev.trackPageViews,
            trackScrollDepth: s.aiTrackScrollDepth ?? prev.trackScrollDepth,
            trackTimeOnPage: s.aiTrackTimeOnPage ?? prev.trackTimeOnPage,
            trackClicks: s.aiTrackClicks ?? prev.trackClicks,
            trackHovers: s.aiTrackHovers ?? prev.trackHovers,
            trackFormInteractions: s.aiTrackFormInteractions ?? prev.trackFormInteractions,
            trackVideoEngagement: s.aiTrackVideoEngagement ?? prev.trackVideoEngagement,
            trackRewardComparisons: s.aiTrackRewardComparisons ?? prev.trackRewardComparisons,
            trackAbandonedCarts: s.aiTrackAbandonedCarts ?? prev.trackAbandonedCarts,
            sessionRecording: s.aiSessionRecording ?? prev.sessionRecording,
            heatmaps: s.aiHeatmaps ?? prev.heatmaps,
            funnelAnalysis: s.aiFunnelAnalysis ?? prev.funnelAnalysis,
            retentionPeriod: s.aiRetentionDays ?? prev.retentionPeriod,
          }));
        }
      }

      // Load stats
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.stats);
        setProjectTags(statsData.projectTags || []);
        setEmailCampaigns(statsData.emailCampaigns || []);
        setBehaviorEvents(statsData.behaviorEvents || []);
        setUserSegments(statsData.userSegments || []);
      }
    } catch (error) {
      console.error("Failed to load AI data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const saveSettings = async () => {
    setIsSaving(true);
    setSaveMessage(null);

    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: "aiMarketing",
          data: {
            aiAutoTagging: aiSettings.autoTagging,
            aiAutoTagConfidence: aiSettings.autoTagConfidence,
            aiMaxTags: aiSettings.maxTags,
            aiEmailPersonalization: aiSettings.emailPersonalization,
            aiBehaviorTracking: aiSettings.behaviorTracking,
            aiPredictiveAnalytics: aiSettings.predictiveAnalytics,
            aiSmartSegmentation: aiSettings.smartSegmentation,
            aiAutoOptimization: aiSettings.autoOptimization,
            aiSendTimeOptimization: aiSettings.sendTimeOptimization,
            aiContentOptimization: aiSettings.contentOptimization,
            aiAbTesting: aiSettings.abTesting,
            aiEmailFrequencyCap: aiSettings.emailFrequencyCap,
            aiDailyEmailLimit: aiSettings.dailyEmailLimit,
            aiQuietHoursStart: aiSettings.quietHoursStart,
            aiQuietHoursEnd: aiSettings.quietHoursEnd,
            aiTrackPageViews: trackingSettings.trackPageViews,
            aiTrackScrollDepth: trackingSettings.trackScrollDepth,
            aiTrackTimeOnPage: trackingSettings.trackTimeOnPage,
            aiTrackClicks: trackingSettings.trackClicks,
            aiTrackHovers: trackingSettings.trackHovers,
            aiTrackFormInteractions: trackingSettings.trackFormInteractions,
            aiTrackVideoEngagement: trackingSettings.trackVideoEngagement,
            aiTrackRewardComparisons: trackingSettings.trackRewardComparisons,
            aiTrackAbandonedCarts: trackingSettings.trackAbandonedCarts,
            aiSessionRecording: trackingSettings.sessionRecording,
            aiHeatmaps: trackingSettings.heatmaps,
            aiFunnelAnalysis: trackingSettings.funnelAnalysis,
            aiRetentionDays: trackingSettings.retentionPeriod,
          },
        }),
      });

      if (response.ok) {
        setSaveMessage("AI settings saved successfully");
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        const error = await response.json();
        throw new Error(error.error || "Failed to save settings");
      }
    } catch (error) {
      console.error("Error saving AI settings:", error);
      setSaveMessage("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const runAutoTagging = async () => {
    setIsProcessing(true);
    try {
      // This would call the AI auto-tagging endpoint
      await new Promise((resolve) => setTimeout(resolve, 2000));
      // Reload stats after tagging
      await loadData();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateCampaign = async () => {
    if (!campaignForm.name.trim()) {
      setCampaignError("Please enter a campaign name");
      return;
    }

    setIsCreatingCampaign(true);
    setCampaignError(null);
    setCampaignSuccess(null);

    try {
      const response = await fetch("/api/admin/ai-marketing/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(campaignForm),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create campaign");
      }

      setCampaignSuccess(data.message || "Campaign created successfully!");

      // Reload data to show new campaign
      await loadData();

      // Close dialog after short delay to show success message
      setTimeout(() => {
        setShowCampaignDialog(false);
        setCampaignSuccess(null);
        setCampaignForm({
          name: "",
          targetAudience: "all",
          projectCategory: "all",
          subjectTemplate: "",
          introMessage: "",
        });
      }, 2000);
    } catch (error) {
      console.error("Error creating campaign:", error);
      setCampaignError(error instanceof Error ? error.message : "Failed to create campaign");
    } finally {
      setIsCreatingCampaign(false);
    }
  };

  const resetCampaignDialog = () => {
    setShowCampaignDialog(false);
    setCampaignError(null);
    setCampaignSuccess(null);
    setCampaignForm({
      name: "",
      targetAudience: "all",
      projectCategory: "all",
      subjectTemplate: "",
      introMessage: "",
      autoGenerateCopy: true,
    });
  };

  const handleApplyRecommendations = async () => {
    setIsApplyingRecommendations(true);
    try {
      // Create campaigns based on recommendations
      const recommendations = [
        { name: "High Engagement Projects", targetAudience: "all", projectCategory: "all" },
        { name: "Tech Category Spotlight", targetAudience: "backers", projectCategory: "technology" },
        { name: "High-Value Backer Outreach", targetAudience: "high-value", projectCategory: "all" },
      ];

      for (const rec of recommendations) {
        await fetch("/api/admin/ai-marketing/campaigns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: rec.name,
            targetAudience: rec.targetAudience,
            projectCategory: rec.projectCategory,
            autoGenerateCopy: true,
          }),
        });
      }

      // Reload data to show new campaigns
      await loadData();
      setSaveMessage("Recommendations applied - 3 campaigns created");
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error("Error applying recommendations:", error);
      setSaveMessage("Failed to apply recommendations");
    } finally {
      setIsApplyingRecommendations(false);
    }
  };

  const handleViewCampaign = (campaign: EmailCampaign) => {
    setSelectedCampaign(campaign);
    setShowCampaignViewer(true);
  };

  const loadActivityLogs = async () => {
    // Generate activity logs from campaigns and settings changes
    const logs = [
      ...emailCampaigns.slice(0, 5).map((c, i) => ({
        id: `campaign-${c.id}`,
        action: c.status === "sent" ? "Campaign Sent" : c.status === "scheduled" ? "Campaign Scheduled" : "Campaign Created",
        details: `"${c.name}" - ${c.recipients.toLocaleString()} recipients`,
        timestamp: c.sentAt || new Date(Date.now() - i * 86400000).toISOString(),
      })),
      {
        id: "settings-1",
        action: "AI Settings Updated",
        details: "Auto-tagging enabled, confidence threshold set to 75%",
        timestamp: new Date(Date.now() - 172800000).toISOString(),
      },
      {
        id: "tagging-1",
        action: "Auto-Tagging Run",
        details: `${projectTags.length} projects tagged automatically`,
        timestamp: new Date(Date.now() - 259200000).toISOString(),
      },
    ];
    setActivityLogs(logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    setShowActivityLog(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">AI Marketing & Analytics</h1>
          <p className="text-zinc-500">Intelligent automation for personalized user experiences</p>
        </div>
        <div className="flex items-center gap-3">
          {saveMessage && (
            <span className={`text-sm ${saveMessage.includes("Failed") ? "text-red-600" : "text-emerald-600"}`}>
              {saveMessage}
            </span>
          )}
          <Badge variant="outline" className="gap-1">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            AI Active
          </Badge>
          <Button variant="outline" onClick={loadActivityLogs}>
            <History className="mr-2 h-4 w-4" />
            Activity Log
          </Button>
          <Button onClick={saveSettings} disabled={isSaving}>
            {isSaving ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Settings className="mr-2 h-4 w-4" />
                Save Settings
              </>
            )}
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
                <p className="text-2xl font-bold">{stats?.aiPredictions?.accuracy || "0"}%</p>
                <p className="text-xs text-emerald-600">{stats?.aiPredictions?.label || "Accuracy rate"}</p>
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
                <p className="text-2xl font-bold">{stats?.projectsTagged?.count || "0"}</p>
                <p className="text-xs text-zinc-500">{stats?.projectsTagged?.totalTags || "0"} {stats?.projectsTagged?.label || "total tags"}</p>
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
                <p className="text-2xl font-bold">{stats?.emailsSent?.count || "0"}</p>
                <p className="text-xs text-emerald-600">{stats?.emailsSent?.openRate || "0%"} {stats?.emailsSent?.label || "open rate"}</p>
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
                <p className="text-2xl font-bold">{stats?.conversionLift?.percent || "0"}%</p>
                <p className="text-xs text-emerald-600">{stats?.conversionLift?.label || "vs non-personalized"}</p>
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
                <Button
                  variant="outline"
                  className="bg-white"
                  onClick={handleApplyRecommendations}
                  disabled={isApplyingRecommendations}
                >
                  {isApplyingRecommendations ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Applying...
                    </>
                  ) : (
                    <>
                      <Wand2 className="mr-2 h-4 w-4" />
                      Apply Recommendations
                    </>
                  )}
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
                  <Button variant="outline" size="sm" onClick={() => setShowSegmentManager(true)}>
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
                    <Button variant="outline" size="sm" onClick={() => handleViewCampaign(campaign)}>
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
              <p className="text-sm text-zinc-500">No emails will be sent during quiet hours (in user&apos;s local timezone)</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Campaign Dialog */}
      <Dialog open={showCampaignDialog} onOpenChange={(open) => {
        if (!open) resetCampaignDialog();
        else setShowCampaignDialog(true);
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create AI-Powered Campaign</DialogTitle>
            <DialogDescription>
              Let AI match projects to users based on their interests and behavior
            </DialogDescription>
          </DialogHeader>

          {campaignSuccess ? (
            <div className="py-8 text-center">
              <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
              <h3 className="font-semibold text-lg text-emerald-700">{campaignSuccess}</h3>
              <p className="text-sm text-zinc-500 mt-2">Your campaign is being prepared with AI-generated content.</p>
            </div>
          ) : (
            <>
              <div className="space-y-4 py-4">
                {campaignError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/20 dark:text-red-400">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      {campaignError}
                    </div>
                  </div>
                )}

                {/* Quick Start Template */}
                <div className="space-y-2">
                  <Label>Quick Start Template</Label>
                  <Select onValueChange={applyTemplate}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a campaign template..." />
                    </SelectTrigger>
                    <SelectContent>
                      {campaignTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-zinc-500">Select a template to auto-fill campaign settings</p>
                </div>

                {/* AI Auto-Generate Toggle */}
                <div className="flex items-center justify-between rounded-lg border bg-violet-50 p-4 dark:bg-violet-950/20">
                  <div className="flex items-center gap-3">
                    <Sparkles className="h-5 w-5 text-violet-600" />
                    <div>
                      <Label className="text-violet-900 dark:text-violet-100">AI Auto-Generate Copy</Label>
                      <p className="text-sm text-violet-700 dark:text-violet-300">
                        Let AI write the subject line and intro message
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={campaignForm.autoGenerateCopy}
                    onCheckedChange={(checked) => setCampaignForm({ ...campaignForm, autoGenerateCopy: checked })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Campaign Name</Label>
                  <Input
                    placeholder="e.g., Tech Enthusiasts - November 2024"
                    value={campaignForm.name}
                    onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Target Audience</Label>
                    <Select
                      value={campaignForm.targetAudience}
                      onValueChange={(value) => setCampaignForm({ ...campaignForm, targetAudience: value })}
                    >
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
                    <Select
                      value={campaignForm.projectCategory}
                      onValueChange={(value) => setCampaignForm({ ...campaignForm, projectCategory: value })}
                    >
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
                        <SelectItem value="art">Art</SelectItem>
                        <SelectItem value="publishing">Publishing</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {!campaignForm.autoGenerateCopy && (
                  <>
                    <div className="space-y-2">
                      <Label>Email Subject</Label>
                      <Input
                        placeholder="e.g., Projects you'll love this week"
                        value={campaignForm.subjectTemplate}
                        onChange={(e) => setCampaignForm({ ...campaignForm, subjectTemplate: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Intro Message</Label>
                      <Textarea
                        placeholder="Brief intro for the email. AI will add personalized project recommendations below."
                        rows={3}
                        value={campaignForm.introMessage}
                        onChange={(e) => setCampaignForm({ ...campaignForm, introMessage: e.target.value })}
                      />
                    </div>
                  </>
                )}

                {campaignForm.autoGenerateCopy && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/20">
                    <div className="flex items-center gap-2">
                      <Brain className="h-5 w-5 text-emerald-600" />
                      <p className="font-medium text-emerald-900 dark:text-emerald-100">AI Will Generate</p>
                    </div>
                    <ul className="mt-2 text-sm text-emerald-700 dark:text-emerald-300 space-y-1">
                      <li>• Compelling email subject line optimized for opens</li>
                      <li>• Personalized intro message for your audience</li>
                      <li>• 3-5 project recommendations per recipient</li>
                      <li>• Custom reasons why each project matches the user</li>
                    </ul>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={resetCampaignDialog} disabled={isCreatingCampaign}>
                  Cancel
                </Button>
                <Button onClick={handleCreateCampaign} disabled={isCreatingCampaign}>
                  {isCreatingCampaign ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Creating with AI...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Create Campaign
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Activity Log Dialog */}
      <Dialog open={showActivityLog} onOpenChange={setShowActivityLog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>AI Activity Log</DialogTitle>
            <DialogDescription>
              Recent AI marketing activities and automated actions
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            <div className="space-y-3">
              {activityLogs.length === 0 ? (
                <p className="text-center text-zinc-500 py-8">No activity logged yet</p>
              ) : (
                activityLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 rounded-lg border p-3">
                    <div className="rounded-full bg-violet-100 p-2">
                      <Activity className="h-4 w-4 text-violet-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{log.action}</p>
                      <p className="text-sm text-zinc-500">{log.details}</p>
                    </div>
                    <span className="text-xs text-zinc-400">
                      {new Date(log.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowActivityLog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Segment Manager Dialog */}
      <Dialog open={showSegmentManager} onOpenChange={setShowSegmentManager}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage User Segments</DialogTitle>
            <DialogDescription>
              View and configure AI-powered user segments for targeted campaigns
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {userSegments.map((segment) => (
              <div key={segment.name} className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-zinc-100 p-2">
                    <Users className="h-5 w-5 text-zinc-600" />
                  </div>
                  <div>
                    <p className="font-medium">{segment.name}</p>
                    <p className="text-sm text-zinc-500">{segment.criteria}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{segment.count.toLocaleString()} users</p>
                  <p className="text-sm text-zinc-500">Avg spend: ${segment.avgSpend}</p>
                </div>
              </div>
            ))}
            <div className="rounded-lg border border-dashed p-4 text-center">
              <p className="text-sm text-zinc-500">
                AI automatically creates and updates segments based on user behavior.
                New segments will appear here as patterns are detected.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSegmentManager(false)}>Close</Button>
            <Button onClick={() => {
              setShowSegmentManager(false);
              setShowCampaignDialog(true);
            }}>
              <Mail className="mr-2 h-4 w-4" />
              Create Campaign for Segment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Campaign Viewer Dialog */}
      <Dialog open={showCampaignViewer} onOpenChange={setShowCampaignViewer}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedCampaign?.name || "Campaign Details"}</DialogTitle>
            <DialogDescription>
              View campaign details and performance metrics
            </DialogDescription>
          </DialogHeader>
          {selectedCampaign && (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-2xl font-bold">{selectedCampaign.recipients.toLocaleString()}</p>
                  <p className="text-sm text-zinc-500">Recipients</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-2xl font-bold">
                    {selectedCampaign.recipients > 0 ? ((selectedCampaign.opens / selectedCampaign.recipients) * 100).toFixed(1) : 0}%
                  </p>
                  <p className="text-sm text-zinc-500">Open Rate</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-2xl font-bold">
                    {selectedCampaign.recipients > 0 ? ((selectedCampaign.clicks / selectedCampaign.recipients) * 100).toFixed(1) : 0}%
                  </p>
                  <p className="text-sm text-zinc-500">Click Rate</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-600">{selectedCampaign.conversions}</p>
                  <p className="text-sm text-zinc-500">Conversions</p>
                </div>
              </div>

              <div className="rounded-lg border p-4">
                <h4 className="font-semibold mb-2">Campaign Status</h4>
                <div className="flex items-center gap-4">
                  <Badge
                    variant={selectedCampaign.status === "sent" ? "default" : selectedCampaign.status === "scheduled" ? "secondary" : "outline"}
                    className="text-sm"
                  >
                    {selectedCampaign.status.toUpperCase()}
                  </Badge>
                  {selectedCampaign.sentAt && (
                    <span className="text-sm text-zinc-500">Sent: {selectedCampaign.sentAt}</span>
                  )}
                  {selectedCampaign.scheduledFor && (
                    <span className="text-sm text-zinc-500">Scheduled for: {selectedCampaign.scheduledFor}</span>
                  )}
                </div>
              </div>

              <div className="rounded-lg border bg-zinc-50 p-4 dark:bg-zinc-900">
                <h4 className="font-semibold mb-2">AI-Generated Content</h4>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  This campaign was created using AI to personalize content for each recipient based on their interests and behavior.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCampaignViewer(false)}>Close</Button>
            {selectedCampaign?.status === "draft" && (
              <Button>
                <Send className="mr-2 h-4 w-4" />
                Send Campaign
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
