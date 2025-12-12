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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  ChevronUp,
  ChevronDown,
  Clock,
  AlertTriangle,
  Maximize2,
  Download,
} from "lucide-react";

import {
  OverviewTab,
  AutoTaggingTab,
  EmailCampaignsTab,
  BehaviorAnalyticsTab,
  AISettingsTab,
} from "@/components/admin/ai-marketing";

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
  const [showTagReview, setShowTagReview] = useState(false);
  const [pendingTagUpdates, setPendingTagUpdates] = useState<Array<{
    projectId: string;
    projectTitle: string;
    currentTags: string[];
    suggestedTags: string[];
    primaryCategory: string | null;
    suggestedCategories: string[];
    confidence: number;
    status: "pending" | "approved" | "rejected" | "error";
    error?: string;
    selectedTags: string[];
    applyCategory: boolean;
  }>>([]);
  const [isApplyingTags, setIsApplyingTags] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [aiRunResults, setAiRunResults] = useState<Record<string, { success: boolean; message: string; data?: any; timestamp: string }>>({});
  const [showResultsViewer, setShowResultsViewer] = useState(false);
  const [resultsViewerTab, setResultsViewerTab] = useState("predictive");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" }>({ key: "conversionProbability", direction: "desc" });

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
  const [recommendations, setRecommendations] = useState<Array<{ type: "success" | "warning" | "info"; message: string }>>([]);
  const [emailStats, setEmailStats] = useState<{ totalSent: number; avgOpenRate: string; avgClickRate: string; totalOpens: number; totalClicks: number } | null>(null);
  const [liveEvents, setLiveEvents] = useState<Array<{
    id: string;
    sessionId: string;
    eventType: string;
    path: string;
    projectId?: string;
    projectTitle?: string;
    searchQuery?: string;
    timeSpent?: number;
    scrollDepth?: number;
    timestamp: string;
    userId?: string;
    userName?: string;
  }>>([]);
  const [behaviorStats, setBehaviorStats] = useState<{
    todayCount: number;
    yesterdayCount: number;
    weekCount: number;
    trend: string;
  } | null>(null);
  const [topProjects, setTopProjects] = useState<Array<{ projectId: string; projectTitle: string; count: number }>>([]);
  const [topSearches, setTopSearches] = useState<Array<{ query: string; count: number }>>([]);

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
      // Load settings, stats, and behavior data in parallel
      const [settingsRes, statsRes, behaviorRes] = await Promise.all([
        fetch("/api/admin/settings"),
        fetch("/api/admin/ai-marketing/stats"),
        fetch("/api/admin/ai-marketing/behavior?limit=20")
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
        setRecommendations(statsData.recommendations || []);
        setEmailStats(statsData.emailStats || null);
      }

      // Load behavior data
      if (behaviorRes.ok) {
        const behaviorData = await behaviorRes.json();
        setLiveEvents(behaviorData.events || []);
        setBehaviorStats(behaviorData.stats || null);
        setTopProjects(behaviorData.topProjects || []);
        setTopSearches(behaviorData.topSearches || []);
      }
    } catch (error) {
      console.error("Failed to load AI data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Refresh behavior data more frequently
  const refreshBehaviorData = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/ai-marketing/behavior?limit=20");
      if (response.ok) {
        const data = await response.json();
        setLiveEvents(data.events || []);
        setBehaviorStats(data.stats || null);
        setTopProjects(data.topProjects || []);
        setTopSearches(data.topSearches || []);
      }
    } catch (error) {
      console.debug("Failed to refresh behavior data:", error);
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
      const response = await fetch("/api/admin/ai-marketing/auto-tag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confidenceThreshold: aiSettings.autoTagConfidence,
          maxTags: aiSettings.maxTags,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to run auto-tagging");
      }

      if (data.taggedProjects && data.taggedProjects.length > 0) {
        // Initialize selected tags and show review dialog
        setPendingTagUpdates(
          data.taggedProjects.map((p: {
            projectId: string;
            projectTitle: string;
            currentTags: string[];
            suggestedTags: string[];
            primaryCategory: string | null;
            suggestedCategories: string[];
            confidence: number;
            status: "pending" | "error";
            error?: string;
          }) => ({
            ...p,
            selectedTags: p.suggestedTags,
            applyCategory: true,
          }))
        );
        setShowTagReview(true);
      } else {
        setSaveMessage(data.message || "No projects to tag");
        setTimeout(() => setSaveMessage(null), 3000);
      }
    } catch (error) {
      console.error("Error running auto-tagging:", error);
      setSaveMessage("Failed to run auto-tagging");
      setTimeout(() => setSaveMessage(null), 3000);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyTags = async () => {
    setIsApplyingTags(true);
    try {
      const approvedUpdates = pendingTagUpdates
        .filter(p => p.status === "approved" && p.selectedTags.length > 0)
        .map(p => ({
          projectId: p.projectId,
          tags: p.selectedTags,
          category: p.applyCategory && p.primaryCategory ? p.primaryCategory : undefined,
        }));

      if (approvedUpdates.length === 0) {
        setSaveMessage("No tags approved for application");
        setShowTagReview(false);
        setTimeout(() => setSaveMessage(null), 3000);
        return;
      }

      const response = await fetch("/api/admin/ai-marketing/auto-tag", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectUpdates: approvedUpdates }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to apply tags");
      }

      setSaveMessage(data.message || `Applied tags to ${approvedUpdates.length} projects`);
      setShowTagReview(false);
      setPendingTagUpdates([]);
      await loadData();
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error("Error applying tags:", error);
      setSaveMessage("Failed to apply tags");
      setTimeout(() => setSaveMessage(null), 3000);
    } finally {
      setIsApplyingTags(false);
    }
  };

  const toggleTagSelection = (projectId: string, tag: string) => {
    setPendingTagUpdates(prev =>
      prev.map(p => {
        if (p.projectId !== projectId) return p;
        const selectedTags = p.selectedTags.includes(tag)
          ? p.selectedTags.filter(t => t !== tag)
          : [...p.selectedTags, tag];
        return { ...p, selectedTags };
      })
    );
  };

  const setProjectApproval = (projectId: string, status: "approved" | "rejected") => {
    setPendingTagUpdates(prev =>
      prev.map(p => p.projectId === projectId ? { ...p, status } : p)
    );
  };

  const approveAllProjects = () => {
    setPendingTagUpdates(prev =>
      prev.map(p => p.status !== "error" ? { ...p, status: "approved" as const } : p)
    );
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
          autoGenerateCopy: true,
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white">AI Marketing & Analytics</h1>
          <p className="text-zinc-500">Intelligent automation for personalized user experiences</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {saveMessage && (
            <span className={`text-sm ${saveMessage.includes("Failed") ? "text-red-600" : "text-emerald-600"}`}>
              {saveMessage}
            </span>
          )}
          <Badge variant="outline" className="gap-1">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            AI Active
          </Badge>
          <Button variant="outline" onClick={loadActivityLogs} className="flex-1 sm:flex-none">
            <History className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Activity Log</span>
          </Button>
          <Button onClick={saveSettings} disabled={isSaving} className="flex-1 sm:flex-none">
            {isSaving ? (
              <>
                <RefreshCw className="h-4 w-4 sm:mr-2 animate-spin" />
                <span className="hidden sm:inline">Saving...</span>
              </>
            ) : (
              <>
                <Settings className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Save Settings</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
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
        <TabsContent value="overview">
          <OverviewTab
            recommendations={recommendations}
            userSegments={userSegments}
            behaviorEvents={behaviorEvents}
            emailCampaigns={emailCampaigns}
            isApplyingRecommendations={isApplyingRecommendations}
            handleApplyRecommendations={handleApplyRecommendations}
            setShowSegmentManager={setShowSegmentManager}
            setShowCampaignDialog={setShowCampaignDialog}
            handleViewCampaign={handleViewCampaign}
          />
        </TabsContent>

        {/* Auto-Tagging Tab */}
        <TabsContent value="auto-tagging">
          <AutoTaggingTab
            projectTags={projectTags}
            aiSettings={aiSettings}
            isProcessing={isProcessing}
            runAutoTagging={runAutoTagging}
            setAiSettings={setAiSettings}
          />
        </TabsContent>

        {/* Email Campaigns Tab */}
        <TabsContent value="email-campaigns">
          <EmailCampaignsTab
            emailStats={emailStats}
            emailCampaigns={emailCampaigns}
            setShowCampaignDialog={setShowCampaignDialog}
          />
        </TabsContent>

        {/* Behavior Tracking Tab */}
        <TabsContent value="behavior">
          <BehaviorAnalyticsTab
            trackingSettings={trackingSettings}
            setTrackingSettings={setTrackingSettings}
            behaviorStats={behaviorStats}
            topProjects={topProjects}
            topSearches={topSearches}
            liveEvents={liveEvents}
            refreshBehaviorData={refreshBehaviorData}
          />
        </TabsContent>
        {/* AI Settings Tab */}
        <TabsContent value="settings">
          <AISettingsTab
            aiSettings={aiSettings}
            setAiSettings={setAiSettings}
            isProcessing={isProcessing}
            setIsProcessing={setIsProcessing}
            aiRunResults={aiRunResults}
            setAiRunResults={setAiRunResults}
            setSaveMessage={setSaveMessage}
            setShowResultsViewer={setShowResultsViewer}
            setResultsViewerTab={setResultsViewerTab}
            setUserSegments={setUserSegments}
          />
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

      {/* Tag Review Dialog */}
      <Dialog open={showTagReview} onOpenChange={setShowTagReview}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-violet-600" />
              Review AI-Generated Tags
            </DialogTitle>
            <DialogDescription>
              Review and approve the AI-suggested tags before applying them to projects.
              You can toggle individual tags on/off and approve or reject each project.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            {pendingTagUpdates.length === 0 ? (
              <p className="text-center text-zinc-500 py-8">No tags to review</p>
            ) : (
              <>
                {/* Summary stats */}
                <div className="flex items-center justify-between rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
                  <div className="text-sm">
                    <span className="font-medium">{pendingTagUpdates.length}</span> projects analyzed
                    {" • "}
                    <span className="text-emerald-600 font-medium">
                      {pendingTagUpdates.filter(p => p.status === "approved").length}
                    </span> approved
                    {" • "}
                    <span className="text-red-600 font-medium">
                      {pendingTagUpdates.filter(p => p.status === "rejected").length}
                    </span> rejected
                  </div>
                  <Button variant="outline" size="sm" onClick={approveAllProjects}>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Approve All
                  </Button>
                </div>

                {/* Project list */}
                {pendingTagUpdates.map((project) => (
                  <div
                    key={project.projectId}
                    className={`rounded-lg border p-4 ${
                      project.status === "approved"
                        ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20"
                        : project.status === "rejected"
                        ? "border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20"
                        : project.status === "error"
                        ? "border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20"
                        : ""
                    }`}
                  >
                    {/* Project header */}
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">{project.projectTitle}</h4>
                          <Badge
                            variant={project.confidence >= 80 ? "default" : project.confidence >= 60 ? "secondary" : "outline"}
                            className="text-xs"
                          >
                            {project.confidence}% confidence
                          </Badge>
                          {project.status === "error" && (
                            <Badge variant="destructive" className="text-xs">Error</Badge>
                          )}
                        </div>
                        {project.primaryCategory && (
                          <p className="text-sm text-zinc-500 mt-1">
                            Suggested category: <span className="font-medium">{project.primaryCategory}</span>
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant={project.status === "approved" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setProjectApproval(project.projectId, "approved")}
                          disabled={project.status === "error"}
                          className={project.status === "approved" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                        <Button
                          variant={project.status === "rejected" ? "destructive" : "outline"}
                          size="sm"
                          onClick={() => setProjectApproval(project.projectId, "rejected")}
                          disabled={project.status === "error"}
                        >
                          <AlertCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Error message */}
                    {project.error && (
                      <div className="mb-3 text-sm text-amber-700 dark:text-amber-400">
                        {project.error}
                      </div>
                    )}

                    {/* Current tags */}
                    {project.currentTags.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs text-zinc-500 mb-1">Current tags:</p>
                        <div className="flex flex-wrap gap-1">
                          {project.currentTags.map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs text-zinc-500">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Suggested tags (toggleable) */}
                    {project.suggestedTags.length > 0 && (
                      <div>
                        <p className="text-xs text-zinc-500 mb-1">AI-suggested tags (click to toggle):</p>
                        <div className="flex flex-wrap gap-2">
                          {project.suggestedTags.map((tag) => (
                            <Badge
                              key={tag}
                              variant={project.selectedTags.includes(tag) ? "default" : "outline"}
                              className={`cursor-pointer transition-colors ${
                                project.selectedTags.includes(tag)
                                  ? "bg-violet-600 hover:bg-violet-700"
                                  : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
                              }`}
                              onClick={() => toggleTagSelection(project.projectId, tag)}
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-xs text-zinc-400 mt-2">
                          {project.selectedTags.length} tags selected
                        </p>
                      </div>
                    )}

                    {project.suggestedTags.length === 0 && !project.error && (
                      <p className="text-sm text-zinc-500">
                        No tags met the confidence threshold
                      </p>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
          <DialogFooter className="border-t pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowTagReview(false);
                setPendingTagUpdates([]);
              }}
              disabled={isApplyingTags}
            >
              Cancel
            </Button>
            <Button
              onClick={handleApplyTags}
              disabled={isApplyingTags || pendingTagUpdates.filter(p => p.status === "approved").length === 0}
            >
              {isApplyingTags ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Applying Tags...
                </>
              ) : (
                <>
                  <Wand2 className="mr-2 h-4 w-4" />
                  Apply {pendingTagUpdates.filter(p => p.status === "approved").length} Approved
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Results Viewer Dialog */}
      <Dialog open={showResultsViewer} onOpenChange={setShowResultsViewer}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-violet-600" />
              AI Analysis Results Viewer
            </DialogTitle>
            <DialogDescription>
              Explore, sort, and analyze the detailed results from AI services
            </DialogDescription>
          </DialogHeader>

          <Tabs value={resultsViewerTab} onValueChange={setResultsViewerTab} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="predictive" className="gap-2">
                <TrendingUp className="h-4 w-4" />
                Predictive
              </TabsTrigger>
              <TabsTrigger value="segments" className="gap-2">
                <Users className="h-4 w-4" />
                Segments
              </TabsTrigger>
              <TabsTrigger value="sendtime" className="gap-2">
                <Clock className="h-4 w-4" />
                Send Times
              </TabsTrigger>
              <TabsTrigger value="tagging" className="gap-2">
                <Tag className="h-4 w-4" />
                Tagging
              </TabsTrigger>
            </TabsList>

            {/* Predictive Analytics Tab */}
            <TabsContent value="predictive" className="flex-1 overflow-hidden mt-4">
              {aiRunResults.runPredictiveAnalytics?.data ? (
                <div className="space-y-4 h-full">
                  {/* Stats Row */}
                  <div className="grid gap-3 grid-cols-4">
                    <div className="rounded-lg border bg-zinc-50 p-3 dark:bg-zinc-900">
                      <p className="text-xs text-zinc-500">Total Analyzed</p>
                      <p className="text-xl font-bold">{(aiRunResults.runPredictiveAnalytics.data as { summary?: { totalAnalyzed?: number } }).summary?.totalAnalyzed || 0}</p>
                    </div>
                    <div className="rounded-lg border bg-emerald-50 p-3 dark:bg-emerald-900/30">
                      <p className="text-xs text-zinc-500">High Value Prospects</p>
                      <p className="text-xl font-bold text-emerald-600">{(aiRunResults.runPredictiveAnalytics.data as { summary?: { highValueProspects?: number } }).summary?.highValueProspects || 0}</p>
                    </div>
                    <div className="rounded-lg border bg-amber-50 p-3 dark:bg-amber-900/30">
                      <p className="text-xs text-zinc-500">At Risk Users</p>
                      <p className="text-xl font-bold text-amber-600">{(aiRunResults.runPredictiveAnalytics.data as { summary?: { atRiskUsers?: number } }).summary?.atRiskUsers || 0}</p>
                    </div>
                    <div className="rounded-lg border bg-blue-50 p-3 dark:bg-blue-900/30">
                      <p className="text-xs text-zinc-500">Predicted Revenue</p>
                      <p className="text-xl font-bold text-blue-600">${((aiRunResults.runPredictiveAnalytics.data as { summary?: { predictedRevenue?: number } }).summary?.predictedRevenue || 0).toLocaleString()}</p>
                    </div>
                  </div>

                  {/* Data Tables */}
                  <div className="grid gap-4 grid-cols-2 flex-1">
                    {/* High Value Prospects */}
                    <div className="rounded-lg border overflow-hidden">
                      <div className="px-4 py-2 bg-emerald-50 border-b flex items-center justify-between dark:bg-emerald-900/30">
                        <span className="font-medium text-sm flex items-center gap-2">
                          <UserCheck className="h-4 w-4 text-emerald-600" />
                          High-Value Prospects
                        </span>
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => {
                          const newDirection = sortConfig.key === "conversionProbability" && sortConfig.direction === "desc" ? "asc" : "desc";
                          setSortConfig({ key: "conversionProbability", direction: newDirection });
                        }}>
                          Sort
                          {sortConfig.key === "conversionProbability" ? (
                            sortConfig.direction === "desc" ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />
                          ) : null}
                        </Button>
                      </div>
                      <ScrollArea className="h-48">
                        <Table>
                          <TableHeader>
                            <TableRow className="text-xs">
                              <TableHead className="h-8">User ID</TableHead>
                              <TableHead className="h-8 text-right cursor-pointer hover:bg-zinc-100" onClick={() => setSortConfig({ key: "conversionProbability", direction: sortConfig.direction === "desc" ? "asc" : "desc" })}>
                                Conversion %
                                {sortConfig.key === "conversionProbability" && (sortConfig.direction === "desc" ? <ChevronDown className="h-3 w-3 inline ml-1" /> : <ChevronUp className="h-3 w-3 inline ml-1" />)}
                              </TableHead>
                              <TableHead className="h-8 text-right">LTV</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {((aiRunResults.runPredictiveAnalytics.data as { topProspects?: { userId: string; conversionProbability: number; churnRisk: number; predictedLifetimeValue: number }[] }).topProspects || [])
                              .sort((a, b) => sortConfig.direction === "desc" ? b.conversionProbability - a.conversionProbability : a.conversionProbability - b.conversionProbability)
                              .map((prospect) => (
                              <TableRow key={prospect.userId} className="text-xs">
                                <TableCell className="py-2 font-mono text-xs">{prospect.userId.slice(0, 12)}...</TableCell>
                                <TableCell className="py-2 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <Progress value={prospect.conversionProbability * 100} className="w-16 h-1.5" />
                                    <span className="w-10 text-right">{(prospect.conversionProbability * 100).toFixed(0)}%</span>
                                  </div>
                                </TableCell>
                                <TableCell className="py-2 text-right font-medium">${prospect.predictedLifetimeValue.toFixed(0)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    </div>

                    {/* At Risk Users */}
                    <div className="rounded-lg border overflow-hidden">
                      <div className="px-4 py-2 bg-amber-50 border-b flex items-center justify-between dark:bg-amber-900/30">
                        <span className="font-medium text-sm flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                          At-Risk Users (Churn)
                        </span>
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => {
                          const newDirection = sortConfig.key === "churnRisk" && sortConfig.direction === "desc" ? "asc" : "desc";
                          setSortConfig({ key: "churnRisk", direction: newDirection });
                        }}>
                          Sort
                          {sortConfig.key === "churnRisk" ? (
                            sortConfig.direction === "desc" ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />
                          ) : null}
                        </Button>
                      </div>
                      <ScrollArea className="h-48">
                        <Table>
                          <TableHeader>
                            <TableRow className="text-xs">
                              <TableHead className="h-8">User ID</TableHead>
                              <TableHead className="h-8 text-right cursor-pointer hover:bg-zinc-100" onClick={() => setSortConfig({ key: "churnRisk", direction: sortConfig.direction === "desc" ? "asc" : "desc" })}>
                                Churn Risk
                                {sortConfig.key === "churnRisk" && (sortConfig.direction === "desc" ? <ChevronDown className="h-3 w-3 inline ml-1" /> : <ChevronUp className="h-3 w-3 inline ml-1" />)}
                              </TableHead>
                              <TableHead className="h-8 text-right">Conv %</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {((aiRunResults.runPredictiveAnalytics.data as { atRiskUsers?: { userId: string; conversionProbability: number; churnRisk: number; predictedLifetimeValue: number }[] }).atRiskUsers || [])
                              .sort((a, b) => sortConfig.direction === "desc" ? b.churnRisk - a.churnRisk : a.churnRisk - b.churnRisk)
                              .map((user) => (
                              <TableRow key={user.userId} className="text-xs">
                                <TableCell className="py-2 font-mono text-xs">{user.userId.slice(0, 12)}...</TableCell>
                                <TableCell className="py-2 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <Progress value={user.churnRisk * 100} className="w-16 h-1.5 [&>div]:bg-amber-500" />
                                    <span className="w-10 text-right text-amber-600">{(user.churnRisk * 100).toFixed(0)}%</span>
                                  </div>
                                </TableCell>
                                <TableCell className="py-2 text-right">{(user.conversionProbability * 100).toFixed(0)}%</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
                  <TrendingUp className="h-12 w-12 mb-4 text-zinc-300" />
                  <p className="font-medium">No Predictive Analytics Data</p>
                  <p className="text-sm">Run the Predictive Analytics service to see results here</p>
                </div>
              )}
            </TabsContent>

            {/* Segments Tab */}
            <TabsContent value="segments" className="flex-1 overflow-hidden mt-4">
              {aiRunResults.runSegmentation?.data ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{((aiRunResults.runSegmentation.data as { segments?: unknown[] }).segments || []).length} Segments Generated</p>
                      <p className="text-sm text-zinc-500">{(aiRunResults.runSegmentation.data as { totalUsers?: number }).totalUsers || 0} total users segmented</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => {
                      // Export segments as JSON
                      const data = JSON.stringify((aiRunResults.runSegmentation.data as { segments?: unknown[] }).segments || [], null, 2);
                      const blob = new Blob([data], { type: "application/json" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = "segments.json";
                      a.click();
                    }}>
                      <Download className="mr-2 h-4 w-4" />
                      Export
                    </Button>
                  </div>
                  <ScrollArea className="h-80">
                    <div className="grid gap-3 md:grid-cols-2">
                      {((aiRunResults.runSegmentation.data as { segments?: { name: string; description: string; userCount: number; avgEngagement: number; criteria: string[] }[] }).segments || []).map((segment, i) => (
                        <div key={i} className="rounded-lg border p-4 hover:border-violet-300 transition-colors">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h4 className="font-semibold text-sm">{segment.name}</h4>
                              <p className="text-xs text-zinc-500">{segment.description}</p>
                            </div>
                            <Badge variant="secondary">{segment.userCount} users</Badge>
                          </div>
                          <div className="flex items-center gap-4 mb-2">
                            <div className="text-xs">
                              <span className="text-zinc-500">Engagement:</span>
                              <span className="ml-1 font-medium">{(segment.avgEngagement * 100).toFixed(0)}%</span>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {segment.criteria.slice(0, 3).map((c, j) => (
                              <Badge key={j} variant="outline" className="text-xs">{c}</Badge>
                            ))}
                            {segment.criteria.length > 3 && (
                              <Badge variant="outline" className="text-xs">+{segment.criteria.length - 3} more</Badge>
                            )}
                          </div>
                          <div className="mt-3 pt-3 border-t flex gap-2">
                            <Button variant="outline" size="sm" className="h-7 text-xs flex-1">
                              <Mail className="mr-1 h-3 w-3" />
                              Email Segment
                            </Button>
                            <Button variant="outline" size="sm" className="h-7 text-xs flex-1">
                              <Eye className="mr-1 h-3 w-3" />
                              View Users
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
                  <Users className="h-12 w-12 mb-4 text-zinc-300" />
                  <p className="font-medium">No Segmentation Data</p>
                  <p className="text-sm">Run the Smart Segmentation service to see results here</p>
                </div>
              )}
            </TabsContent>

            {/* Send Time Tab */}
            <TabsContent value="sendtime" className="flex-1 overflow-hidden mt-4">
              {aiRunResults.runSendTimeOptimization?.data ? (
                <div className="space-y-4">
                  <div className="grid gap-3 grid-cols-3">
                    <div className="rounded-lg border bg-zinc-50 p-3 dark:bg-zinc-900">
                      <p className="text-xs text-zinc-500">Users Analyzed</p>
                      <p className="text-xl font-bold">{(aiRunResults.runSendTimeOptimization.data as { summary?: { totalAnalyzed?: number } }).summary?.totalAnalyzed || 0}</p>
                    </div>
                    <div className="rounded-lg border bg-amber-50 p-3 dark:bg-amber-900/30">
                      <p className="text-xs text-zinc-500">Peak Hour</p>
                      <p className="text-xl font-bold text-amber-600">
                        {(aiRunResults.runSendTimeOptimization.data as { summary?: { peakHour?: number } }).summary?.peakHour !== undefined
                          ? `${(aiRunResults.runSendTimeOptimization.data as { summary: { peakHour: number } }).summary.peakHour}:00`
                          : "N/A"}
                      </p>
                    </div>
                    <div className="rounded-lg border bg-blue-50 p-3 dark:bg-blue-900/30">
                      <p className="text-xs text-zinc-500">Timestamp</p>
                      <p className="text-sm font-medium text-blue-600">{aiRunResults.runSendTimeOptimization.timestamp}</p>
                    </div>
                  </div>

                  {/* Hourly Distribution Chart */}
                  <div className="rounded-lg border p-4">
                    <h4 className="font-medium mb-4">Hourly Distribution</h4>
                    <div className="flex items-end gap-1 h-40">
                      {((aiRunResults.runSendTimeOptimization.data as { hourlyDistribution?: { hour: number; count: number }[] }).hourlyDistribution || []).map((slot) => {
                        const maxCount = Math.max(...((aiRunResults.runSendTimeOptimization.data as { hourlyDistribution?: { count: number }[] }).hourlyDistribution || [{ count: 1 }]).map(h => h.count));
                        const heightPercent = maxCount > 0 ? (slot.count / maxCount) * 100 : 0;
                        const isPeak = (aiRunResults.runSendTimeOptimization.data as { summary?: { peakHour?: number } }).summary?.peakHour === slot.hour;
                        return (
                          <div key={slot.hour} className="flex-1 flex flex-col items-center gap-1">
                            <div
                              className={`w-full rounded-t transition-all ${isPeak ? "bg-amber-500" : "bg-blue-400"}`}
                              style={{ height: `${heightPercent}%`, minHeight: slot.count > 0 ? "4px" : "0" }}
                              title={`${slot.hour}:00 - ${slot.count} users`}
                            />
                            <span className="text-[10px] text-zinc-500">{slot.hour}</span>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-zinc-500 mt-2 text-center">Hour of day (0-23)</p>
                  </div>

                  {/* Distribution Table */}
                  <div className="rounded-lg border overflow-hidden">
                    <div className="px-4 py-2 bg-zinc-50 border-b dark:bg-zinc-800">
                      <span className="font-medium text-sm">Detailed Distribution</span>
                    </div>
                    <ScrollArea className="h-32">
                      <Table>
                        <TableHeader>
                          <TableRow className="text-xs">
                            <TableHead className="h-8">Hour</TableHead>
                            <TableHead className="h-8 text-right">Users</TableHead>
                            <TableHead className="h-8">Distribution</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {((aiRunResults.runSendTimeOptimization.data as { hourlyDistribution?: { hour: number; count: number }[] }).hourlyDistribution || [])
                            .sort((a, b) => b.count - a.count)
                            .map((slot) => {
                              const total = ((aiRunResults.runSendTimeOptimization.data as { summary?: { totalAnalyzed?: number } }).summary?.totalAnalyzed || 1);
                              const percent = (slot.count / total) * 100;
                              return (
                                <TableRow key={slot.hour} className="text-xs">
                                  <TableCell className="py-2">{slot.hour}:00</TableCell>
                                  <TableCell className="py-2 text-right font-medium">{slot.count}</TableCell>
                                  <TableCell className="py-2">
                                    <div className="flex items-center gap-2">
                                      <Progress value={percent} className="flex-1 h-1.5" />
                                      <span className="w-10 text-right text-zinc-500">{percent.toFixed(1)}%</span>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
                  <Clock className="h-12 w-12 mb-4 text-zinc-300" />
                  <p className="font-medium">No Send Time Data</p>
                  <p className="text-sm">Run the Send Time Optimization service to see results here</p>
                </div>
              )}
            </TabsContent>

            {/* Tagging Tab */}
            <TabsContent value="tagging" className="flex-1 overflow-hidden mt-4">
              {aiRunResults.runAutoTagging?.data ? (
                <div className="space-y-4">
                  <div className="grid gap-3 grid-cols-3">
                    <div className="rounded-lg border bg-zinc-50 p-3 dark:bg-zinc-900">
                      <p className="text-xs text-zinc-500">Projects Processed</p>
                      <p className="text-xl font-bold">{((aiRunResults.runAutoTagging.data as { results?: unknown[] }).results || []).length}</p>
                    </div>
                    <div className="rounded-lg border bg-emerald-50 p-3 dark:bg-emerald-900/30">
                      <p className="text-xs text-zinc-500">Successfully Tagged</p>
                      <p className="text-xl font-bold text-emerald-600">
                        {((aiRunResults.runAutoTagging.data as { results?: { success: boolean }[] }).results || []).filter(r => r.success).length}
                      </p>
                    </div>
                    <div className="rounded-lg border bg-red-50 p-3 dark:bg-red-900/30">
                      <p className="text-xs text-zinc-500">Failed / Skipped</p>
                      <p className="text-xl font-bold text-red-600">
                        {((aiRunResults.runAutoTagging.data as { results?: { success: boolean }[] }).results || []).filter(r => !r.success).length}
                      </p>
                    </div>
                  </div>

                  <ScrollArea className="h-64">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Project ID</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Tags Applied</TableHead>
                          <TableHead>Reason</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {((aiRunResults.runAutoTagging.data as { results?: { projectId: string; success: boolean; tags?: string[]; reason?: string }[] }).results || []).map((result) => (
                          <TableRow key={result.projectId} className="text-sm">
                            <TableCell className="py-2 font-mono text-xs">{result.projectId.slice(0, 16)}...</TableCell>
                            <TableCell className="py-2">
                              {result.success ? (
                                <Badge variant="default" className="bg-emerald-600 text-xs">Tagged</Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs">Skipped</Badge>
                              )}
                            </TableCell>
                            <TableCell className="py-2">
                              <div className="flex flex-wrap gap-1 max-w-xs">
                                {(result.tags || []).slice(0, 3).map((tag, i) => (
                                  <Badge key={i} variant="outline" className="text-xs">{tag}</Badge>
                                ))}
                                {(result.tags || []).length > 3 && (
                                  <Badge variant="outline" className="text-xs">+{(result.tags || []).length - 3}</Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="py-2 text-xs text-zinc-500 max-w-xs truncate">
                              {result.reason || "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
                  <Tag className="h-12 w-12 mb-4 text-zinc-300" />
                  <p className="font-medium">No Auto-Tagging Data</p>
                  <p className="text-sm">Run the Auto-Tagging service to see results here</p>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setShowResultsViewer(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
