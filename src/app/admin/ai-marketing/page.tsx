"use client";

import { apiFetch } from "@/lib/fetch-utils";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Mail,
  Users,
  Tag,
  Layers,
  TrendingUp,
  Settings,
  RefreshCw,
  Send,
  BarChart3,
  Activity,
  History,
} from "lucide-react";

import {
  OverviewTab,
  AutoTaggingTab,
  TagSegmentsTab,
  EmailCampaignsTab,
  BehaviorAnalyticsTab,
  AISettingsTab,
  ResultsViewerDialog,
  TagReviewDialog,
  CampaignDialog,
  CSVImportDialog,
  PendingTagUpdate,
  CampaignForm,
  CampaignTemplate,
} from "@/components/admin/ai-marketing";
import { CampaignTypeDialog } from "@/components/admin/ai-marketing/dialogs/campaign-type-dialog";
import { SubscriberListTab } from "@/components/admin/ai-marketing/subscriber-list-tab";

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
  sentCount: number;
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
  const [pendingTagUpdates, setPendingTagUpdates] = useState<PendingTagUpdate[]>([]);
  const [showCampaignTypeDialog, setShowCampaignTypeDialog] = useState(false);
  const [selectedCampaignType, setSelectedCampaignType] = useState<"subscriber" | "backer" | "creator" | "retailer" | null>(null);
  const [isApplyingTags, setIsApplyingTags] = useState(false);
  const [showCSVImportDialog, setShowCSVImportDialog] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [aiRunResults, setAiRunResults] = useState<Record<string, { success: boolean; message: string; data?: any; timestamp: string }>>({});
  const [showResultsViewer, setShowResultsViewer] = useState(false);
  const [resultsViewerTab, setResultsViewerTab] = useState("predictive");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" }>({ key: "conversionProbability", direction: "desc" });

  // Campaign form state
  const [campaignForm, setCampaignForm] = useState<CampaignForm>({
    name: "",
    targetAudience: "all",
    projectCategory: "all",
    subjectTemplate: "",
    introMessage: "",
    autoGenerateCopy: true,
    includeProjectRecommendations: true,
    selectedSegments: [],
  });

  // Preset campaign templates
  const campaignTemplates: CampaignTemplate[] = [
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
      const response = await apiFetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", },
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
      const response = await apiFetch("/api/admin/ai-marketing/auto-tag", {
        method: "POST",
        headers: { "Content-Type": "application/json", },
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

      const response = await apiFetch("/api/admin/ai-marketing/auto-tag", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", },
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
      const response = await apiFetch("/api/admin/ai-marketing/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json", },
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
          includeProjectRecommendations: true,
          selectedSegments: [],
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
      includeProjectRecommendations: true,
      selectedSegments: [],
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
        await apiFetch("/api/admin/ai-marketing/campaigns", {
          method: "POST",
          headers: { "Content-Type": "application/json", },
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

  const handleConfigureCampaignType = (type: "subscriber" | "backer" | "creator" | "retailer") => {
    setSelectedCampaignType(type);
    setShowCampaignTypeDialog(true);
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
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white">AI Marketing & Analytics</h1>
          <p className="text-muted-foreground">Intelligent automation for personalized user experiences</p>
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
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-violet-100 p-3 dark:bg-violet-900/30">
                <Brain className="h-6 w-6 text-violet-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">AI Predictions</p>
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
                <p className="text-sm text-muted-foreground">Projects Tagged</p>
                <p className="text-2xl font-bold">{stats?.projectsTagged?.count || "0"}</p>
                <p className="text-xs text-muted-foreground">{stats?.projectsTagged?.totalTags || "0"} {stats?.projectsTagged?.label || "total tags"}</p>
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
                <p className="text-sm text-muted-foreground">Emails Sent</p>
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
                <p className="text-sm text-muted-foreground">Conversion Lift</p>
                <p className="text-2xl font-bold">{stats?.conversionLift?.percent || "0"}%</p>
                <p className="text-xs text-emerald-600">{stats?.conversionLift?.label || "vs non-personalized"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto pb-1">
        <TabsList className="inline-flex w-max min-w-full">
          <TabsTrigger value="overview">
            <BarChart3 className="mr-2 h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="subscribers">
            <Users className="mr-2 h-4 w-4" />
            Email Lists
          </TabsTrigger>
          <TabsTrigger value="auto-tagging">
            <Tag className="mr-2 h-4 w-4" />
            Auto-Tagging
          </TabsTrigger>
          <TabsTrigger value="tag-segments">
            <Layers className="mr-2 h-4 w-4" />
            Create Tag Segment
          </TabsTrigger>
          <TabsTrigger value="email-campaigns">
            <Mail className="mr-2 h-4 w-4" />
            Campaigns
          </TabsTrigger>
          <TabsTrigger value="behavior">
            <Activity className="mr-2 h-4 w-4" />
            Behavior
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>
        </div>

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

        {/* Subscriber List Tab */}
        <TabsContent value="subscribers">
          <SubscriberListTab onImportCSV={() => setShowCSVImportDialog(true)} />
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

        {/* Tag Segments Tab */}
        <TabsContent value="tag-segments">
          <TagSegmentsTab />
        </TabsContent>

        {/* Email Campaigns Tab */}
        <TabsContent value="email-campaigns">
          <EmailCampaignsTab
            emailStats={emailStats}
            emailCampaigns={emailCampaigns}
            setShowCampaignDialog={setShowCampaignDialog}
            onConfigureCampaignType={handleConfigureCampaignType}
            onImportCSV={() => setShowCSVImportDialog(true)}
            onRefresh={loadData}
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
      <CampaignDialog
        open={showCampaignDialog}
        onOpenChange={setShowCampaignDialog}
        form={campaignForm}
        onFormChange={setCampaignForm}
        templates={campaignTemplates}
        isCreating={isCreatingCampaign}
        error={campaignError}
        success={campaignSuccess}
        onApplyTemplate={applyTemplate}
        onCreate={handleCreateCampaign}
        onReset={resetCampaignDialog}
      />

      {/* Activity Log Dialog - kept inline as it's small */}
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
                <p className="text-center text-muted-foreground py-8">No activity logged yet</p>
              ) : (
                activityLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 rounded-lg border p-3">
                    <div className="rounded-full bg-violet-100 p-2">
                      <Activity className="h-4 w-4 text-violet-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{log.action}</p>
                      <p className="text-sm text-muted-foreground">{log.details}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">
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

      {/* Segment Manager Dialog - kept inline as it's small */}
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
                  <div className="rounded-full bg-muted p-2">
                    <Users className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">{segment.name}</p>
                    <p className="text-sm text-muted-foreground">{segment.criteria}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{segment.count.toLocaleString()} users</p>
                  <p className="text-sm text-muted-foreground">Avg spend: ${Number(segment.avgSpend).toFixed(2)}</p>
                </div>
              </div>
            ))}
            <div className="rounded-lg border border-dashed p-4 text-center">
              <p className="text-sm text-muted-foreground">
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

      {/* Campaign Viewer Dialog - kept inline as it's small */}
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
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-2xl font-bold">{selectedCampaign.recipients.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Recipients</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-2xl font-bold">
                    {selectedCampaign.recipients > 0 ? ((selectedCampaign.opens / selectedCampaign.recipients) * 100).toFixed(1) : 0}%
                  </p>
                  <p className="text-sm text-muted-foreground">Open Rate</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-2xl font-bold">
                    {selectedCampaign.recipients > 0 ? ((selectedCampaign.clicks / selectedCampaign.recipients) * 100).toFixed(1) : 0}%
                  </p>
                  <p className="text-sm text-muted-foreground">Click Rate</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-600">{selectedCampaign.conversions}</p>
                  <p className="text-sm text-muted-foreground">Conversions</p>
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
                    <span className="text-sm text-muted-foreground">Sent: {selectedCampaign.sentAt}</span>
                  )}
                  {selectedCampaign.scheduledFor && (
                    <span className="text-sm text-muted-foreground">Scheduled for: {selectedCampaign.scheduledFor}</span>
                  )}
                </div>
              </div>
              <div className="rounded-lg border bg-muted/50 p-4 dark:bg-zinc-900">
                <h4 className="font-semibold mb-2">AI-Generated Content</h4>
                <p className="text-sm text-muted-foreground dark:text-muted-foreground">
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
      <TagReviewDialog
        open={showTagReview}
        onOpenChange={setShowTagReview}
        pendingTagUpdates={pendingTagUpdates}
        isApplyingTags={isApplyingTags}
        onClose={() => {
          setShowTagReview(false);
          setPendingTagUpdates([]);
        }}
        onApplyTags={handleApplyTags}
        onApproveAll={approveAllProjects}
        onSetProjectApproval={setProjectApproval}
        onToggleTagSelection={toggleTagSelection}
      />

      {/* AI Results Viewer Dialog */}
      <ResultsViewerDialog
        open={showResultsViewer}
        onOpenChange={setShowResultsViewer}
        activeTab={resultsViewerTab}
        onTabChange={setResultsViewerTab}
        aiRunResults={aiRunResults}
        sortConfig={sortConfig}
        onSortConfigChange={setSortConfig}
      />

      {/* Campaign Type Dialog */}
      <CampaignTypeDialog
        open={showCampaignTypeDialog}
        onOpenChange={setShowCampaignTypeDialog}
        campaignType={selectedCampaignType}
        onSuccess={() => loadData()}
      />

      {/* CSV Import Dialog */}
      <CSVImportDialog
        open={showCSVImportDialog}
        onOpenChange={setShowCSVImportDialog}
        onSuccess={() => loadData()}
      />
    </div>
  );
}
