"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Settings,
  Bell,
  ChevronLeft,
  Sparkles,
  Calendar as CalendarIcon,
  Send,
  Twitter,
  Facebook,
  Instagram,
  Linkedin,
  Youtube,
  Link2,
  Check,
  Plus,
  Trash2,
  Copy,
  Clock,
  BarChart3,
  Eye,
  Heart,
  Share2,
  RefreshCw,
  Wand2,
  FileText,
  Megaphone,
  TrendingUp,
  Zap,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Platform configurations
const SOCIAL_PLATFORMS = [
  { id: "twitter", name: "X (Twitter)", icon: Twitter, color: "bg-black" },
  { id: "facebook", name: "Facebook", icon: Facebook, color: "bg-blue-600" },
  { id: "instagram", name: "Instagram", icon: Instagram, color: "bg-gradient-to-br from-purple-600 to-pink-500" },
  { id: "linkedin", name: "LinkedIn", icon: Linkedin, color: "bg-blue-700" },
  { id: "youtube", name: "YouTube", icon: Youtube, color: "bg-red-600" },
];

// Platforms that support OAuth connection
const OAUTH_PLATFORMS = ["twitter", "facebook", "instagram", "youtube"];

// Connection status type
interface ConnectionStatus {
  connected: boolean;
  accountId?: string;
  providerAccountId?: string;
  expiresAt?: number | null;
  scope?: string | null;
}

// AI content generation templates
const CONTENT_TEMPLATES = [
  { id: "launch", name: "Launch Announcement", icon: Megaphone, description: "Announce your campaign launch" },
  { id: "milestone", name: "Milestone Celebration", icon: TrendingUp, description: "Celebrate funding milestones" },
  { id: "update", name: "Project Update", icon: FileText, description: "Share project progress" },
  { id: "reminder", name: "Campaign Reminder", icon: Clock, description: "Remind followers about your campaign" },
  { id: "thankyou", name: "Thank You Post", icon: Heart, description: "Thank your backers" },
  { id: "behindscenes", name: "Behind the Scenes", icon: Eye, description: "Share your creative process" },
];

// Types for scheduled posts
interface ScheduledPost {
  id: string;
  content: string;
  platforms: string[];
  scheduledFor: Date;
  status: string;
  imageUrl?: string;
}

export default function SocialHubPage() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState("create");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [postContent, setPostContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>(undefined);
  const [scheduleTime, setScheduleTime] = useState("12:00");
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [connections, setConnections] = useState<Record<string, ConnectionStatus>>({});
  const [isLoadingConnections, setIsLoadingConnections] = useState(true);
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);
  const [disconnectingPlatform, setDisconnectingPlatform] = useState<string | null>(null);

  // Fetch connection status
  const fetchConnections = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/social/connections");
      if (response.ok) {
        const data = await response.json();
        setConnections(data.connections);
        // Auto-select connected platforms
        const connectedIds = Object.entries(data.connections)
          .filter(([, status]) => (status as ConnectionStatus).connected)
          .map(([id]) => id);
        if (connectedIds.length > 0 && selectedPlatforms.length === 0) {
          setSelectedPlatforms(connectedIds);
        }
      }
    } catch (error) {
      console.error("Failed to fetch connections:", error);
    } finally {
      setIsLoadingConnections(false);
    }
  }, [selectedPlatforms.length]);

  // Handle OAuth callback messages
  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");

    if (success) {
      toast.success(success);
      // Clear the URL params
      window.history.replaceState({}, "", "/dashboard/social");
      // Refresh connections
      fetchConnections();
    }
    if (error) {
      toast.error(error);
      window.history.replaceState({}, "", "/dashboard/social");
    }
  }, [searchParams, fetchConnections]);

  // Initial fetch
  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const connectedPlatforms = SOCIAL_PLATFORMS.filter((p) => connections[p.id]?.connected);
  const disconnectedPlatforms = SOCIAL_PLATFORMS.filter((p) => !connections[p.id]?.connected);

  const togglePlatform = (platformId: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platformId)
        ? prev.filter((p) => p !== platformId)
        : [...prev, platformId]
    );
  };

  const generateContent = async (templateId?: string) => {
    setIsGenerating(true);
    // Simulate AI generation
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const generatedContents: Record<string, string> = {
      launch: "🚀 We're officially LIVE! After months of hard work, our campaign is finally here. Early bird rewards are limited - don't miss out! Link in bio. #crowdfunding #newproduct #launch",
      milestone: "🎉 INCREDIBLE! We just crossed 50% of our goal in just 3 days! Thank you to every single backer who believes in our vision. Let's keep this momentum going! 🙌",
      update: "📢 Quick update for our backers: Production is on track and we've finalized the color options. Check out the latest update on our campaign page!",
      reminder: "⏰ Only 7 days left! If you've been on the fence, now's the time to join 500+ backers who already secured their reward. Limited quantities available!",
      thankyou: "💚 From the bottom of our hearts - THANK YOU! Your support means everything. We can't wait to deliver something amazing to each and every one of you.",
      behindscenes: "👀 Sneak peek! Here's what goes into making each unit. Quality control is no joke - we test every single piece. #behindthescenes #quality",
    };

    setPostContent(
      templateId && generatedContents[templateId]
        ? generatedContents[templateId]
        : "🎯 Check out our crowdfunding campaign! We're building something amazing and we'd love your support. Link in bio! #crowdfunding #innovation"
    );
    setIsGenerating(false);
    toast.success("Content generated!");
  };

  const handlePost = () => {
    if (!postContent.trim()) {
      toast.error("Please enter some content");
      return;
    }
    if (selectedPlatforms.length === 0) {
      toast.error("Please select at least one platform");
      return;
    }
    toast.success("Posted to selected platforms!");
    setPostContent("");
  };

  const handleSchedule = () => {
    if (!postContent.trim()) {
      toast.error("Please enter some content");
      return;
    }
    if (!scheduleDate) {
      toast.error("Please select a date");
      return;
    }

    const newPost = {
      id: String(Date.now()),
      content: postContent,
      platforms: selectedPlatforms,
      scheduledFor: scheduleDate,
      status: "scheduled" as const,
    };

    setScheduledPosts([...scheduledPosts, newPost]);
    setIsScheduleDialogOpen(false);
    setPostContent("");
    setScheduleDate(undefined);
    toast.success("Post scheduled!");
  };

  const deleteScheduledPost = (id: string) => {
    setScheduledPosts(scheduledPosts.filter((p) => p.id !== id));
    toast.success("Post deleted");
  };

  const connectPlatform = (platformId: string) => {
    if (!OAUTH_PLATFORMS.includes(platformId)) {
      toast.error(`${platformId} connection is not yet supported`);
      return;
    }
    setConnectingPlatform(platformId);
    // Redirect to OAuth initiation endpoint
    window.location.href = `/api/auth/social/${platformId}`;
  };

  const disconnectPlatform = async (platformId: string) => {
    setDisconnectingPlatform(platformId);
    try {
      const response = await fetch("/api/auth/social/connections", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: platformId }),
      });

      if (response.ok) {
        toast.success(`Disconnected from ${platformId}`);
        // Remove from selected platforms
        setSelectedPlatforms((prev) => prev.filter((p) => p !== platformId));
        // Refresh connections
        await fetchConnections();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to disconnect");
      }
    } catch (error) {
      console.error("Disconnect error:", error);
      toast.error("Failed to disconnect");
    } finally {
      setDisconnectingPlatform(null);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
              <ChevronLeft className="h-4 w-4" />
              Dashboard
            </Link>
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-2">
              <Share2 className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-semibold">Social Hub</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon">
              <Bell className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon">
              <Settings className="h-5 w-5" />
            </Button>
            <Avatar>
              <AvatarFallback>GT</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      <div className="container py-6">
        {/* Connected Accounts Summary */}
        <div className="mb-6 flex items-center gap-4">
          <span className="text-sm text-muted-foreground">Connected:</span>
          {connectedPlatforms.map((platform) => (
            <div
              key={platform.id}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-white",
                platform.color
              )}
            >
              <platform.icon className="h-4 w-4" />
            </div>
          ))}
          {disconnectedPlatforms.length > 0 && (
            <Button variant="outline" size="sm" className="ml-2">
              <Plus className="mr-1 h-3 w-3" />
              Connect More
            </Button>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="create">
              <Sparkles className="mr-2 h-4 w-4" />
              Create & Post
            </TabsTrigger>
            <TabsTrigger value="scheduled">
              <CalendarIcon className="mr-2 h-4 w-4" />
              Scheduled
            </TabsTrigger>
            <TabsTrigger value="analytics">
              <BarChart3 className="mr-2 h-4 w-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="accounts">
              <Link2 className="mr-2 h-4 w-4" />
              Accounts
            </TabsTrigger>
          </TabsList>

          {/* Create & Post Tab */}
          <TabsContent value="create" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
              {/* AI Content Generator */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wand2 className="h-5 w-5 text-primary" />
                    AI Content Generator
                  </CardTitle>
                  <CardDescription>
                    Generate engaging social media content with AI
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Templates */}
                  <div className="space-y-2">
                    <Label>Quick Templates</Label>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {CONTENT_TEMPLATES.map((template) => (
                        <Button
                          key={template.id}
                          variant={selectedTemplate === template.id ? "secondary" : "outline"}
                          size="sm"
                          className="h-auto flex-col items-start gap-1 p-3 text-left"
                          onClick={() => {
                            setSelectedTemplate(template.id);
                            generateContent(template.id);
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <template.icon className="h-4 w-4" />
                            <span className="font-medium">{template.name}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {template.description}
                          </span>
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Content Input */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="content">Post Content</Label>
                      <span className="text-xs text-muted-foreground">
                        {postContent.length}/280
                      </span>
                    </div>
                    <Textarea
                      id="content"
                      placeholder="What would you like to share?"
                      rows={5}
                      value={postContent}
                      onChange={(e) => setPostContent(e.target.value)}
                    />
                  </div>

                  {/* AI Generate Button */}
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => generateContent()}
                    disabled={isGenerating}
                  >
                    {isGenerating ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Generate with AI
                      </>
                    )}
                  </Button>

                  {/* Platform Selection */}
                  <div className="space-y-2">
                    <Label>Post to</Label>
                    <div className="flex flex-wrap gap-2">
                      {connectedPlatforms.map((platform) => (
                        <Button
                          key={platform.id}
                          variant={selectedPlatforms.includes(platform.id) ? "default" : "outline"}
                          size="sm"
                          onClick={() => togglePlatform(platform.id)}
                          className="gap-2"
                        >
                          <platform.icon className="h-4 w-4" />
                          {platform.name}
                          {selectedPlatforms.includes(platform.id) && (
                            <Check className="h-3 w-3" />
                          )}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <Button className="flex-1" onClick={handlePost}>
                      <Send className="mr-2 h-4 w-4" />
                      Post Now
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setIsScheduleDialogOpen(true)}
                    >
                      <Clock className="mr-2 h-4 w-4" />
                      Schedule
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Preview & Tips */}
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Preview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {postContent ? (
                      <div className="rounded-lg border bg-card p-4">
                        <div className="mb-3 flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>GT</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">Your Project</p>
                            <p className="text-xs text-muted-foreground">Just now</p>
                          </div>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{postContent}</p>
                      </div>
                    ) : (
                      <div className="flex h-32 items-center justify-center text-muted-foreground">
                        <p className="text-sm">Start typing to see preview</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Zap className="h-4 w-4 text-yellow-500" />
                      Pro Tips
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>• Post during peak hours (9-11 AM, 7-9 PM)</li>
                      <li>• Use emojis to increase engagement</li>
                      <li>• Include a clear call-to-action</li>
                      <li>• Tag relevant accounts and use hashtags</li>
                      <li>• Share behind-the-scenes content</li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Scheduled Posts Tab */}
          <TabsContent value="scheduled" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Scheduled Posts</CardTitle>
                <Button onClick={() => setActiveTab("create")}>
                  <Plus className="mr-2 h-4 w-4" />
                  New Post
                </Button>
              </CardHeader>
              <CardContent>
                {scheduledPosts.length > 0 ? (
                  <div className="space-y-4">
                    {scheduledPosts.map((post) => (
                      <div
                        key={post.id}
                        className="flex items-start justify-between rounded-lg border p-4"
                      >
                        <div className="flex-1">
                          <div className="mb-2 flex items-center gap-2">
                            {post.platforms.map((platformId) => {
                              const platform = SOCIAL_PLATFORMS.find((p) => p.id === platformId);
                              if (!platform) return null;
                              return (
                                <div
                                  key={platformId}
                                  className={cn(
                                    "flex h-6 w-6 items-center justify-center rounded text-white",
                                    platform.color
                                  )}
                                >
                                  <platform.icon className="h-3 w-3" />
                                </div>
                              );
                            })}
                            <Badge variant={post.status === "scheduled" ? "default" : "secondary"}>
                              {post.status}
                            </Badge>
                          </div>
                          <p className="mb-2 text-sm line-clamp-2">{post.content}</p>
                          <p className="text-xs text-muted-foreground">
                            <Clock className="mr-1 inline h-3 w-3" />
                            {format(post.scheduledFor, "MMM d, yyyy 'at' h:mm a")}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon">
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteScheduledPost(post.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <CalendarIcon className="mb-4 h-12 w-12 text-muted-foreground" />
                    <h3 className="mb-2 font-semibold">No scheduled posts</h3>
                    <p className="mb-4 text-sm text-muted-foreground">
                      Schedule posts to keep your audience engaged
                    </p>
                    <Button onClick={() => setActiveTab("create")}>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Post
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            {/* Summary Stats - will be populated when social analytics API is available */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Impressions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">0</div>
                  <p className="text-xs text-muted-foreground">Connect accounts to track</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Engagements
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">0</div>
                  <p className="text-xs text-muted-foreground">Connect accounts to track</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Link Clicks
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">0</div>
                  <p className="text-xs text-muted-foreground">Connect accounts to track</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    New Followers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">0</div>
                  <p className="text-xs text-muted-foreground">Connect accounts to track</p>
                </CardContent>
              </Card>
            </div>

            {/* Post Performance */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Post Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <BarChart3 className="mb-4 h-12 w-12 text-muted-foreground" />
                  <h3 className="mb-2 font-semibold">No analytics data yet</h3>
                  <p className="mb-4 text-sm text-muted-foreground">
                    Post to your connected social accounts to start tracking performance
                  </p>
                  <Button onClick={() => setActiveTab("create")}>
                    Create Post
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Accounts Tab */}
          <TabsContent value="accounts" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Connected Accounts</CardTitle>
                <CardDescription>
                  Manage your social media connections
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoadingConnections ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  SOCIAL_PLATFORMS.map((platform) => {
                    const isConnected = connections[platform.id]?.connected;
                    const isOAuthSupported = OAUTH_PLATFORMS.includes(platform.id);
                    const isConnecting = connectingPlatform === platform.id;
                    const isDisconnecting = disconnectingPlatform === platform.id;

                    return (
                      <div
                        key={platform.id}
                        className="flex items-center justify-between rounded-lg border p-4"
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={cn(
                              "flex h-10 w-10 items-center justify-center rounded-lg text-white",
                              platform.color
                            )}
                          >
                            <platform.icon className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-medium">{platform.name}</p>
                            {isConnected ? (
                              <p className="text-sm text-muted-foreground">
                                Connected
                              </p>
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                {isOAuthSupported ? "Not connected" : "Coming soon"}
                              </p>
                            )}
                          </div>
                        </div>
                        {isConnected ? (
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-green-600 border-green-600">
                              <Check className="mr-1 h-3 w-3" />
                              Connected
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => disconnectPlatform(platform.id)}
                              disabled={isDisconnecting}
                            >
                              {isDisconnecting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                "Disconnect"
                              )}
                            </Button>
                          </div>
                        ) : (
                          <Button
                            onClick={() => connectPlatform(platform.id)}
                            disabled={!isOAuthSupported || isConnecting}
                          >
                            {isConnecting ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Connecting...
                              </>
                            ) : isOAuthSupported ? (
                              "Connect"
                            ) : (
                              "Coming Soon"
                            )}
                          </Button>
                        )}
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Posting Preferences</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Auto-post campaign updates</p>
                    <p className="text-sm text-muted-foreground">
                      Automatically share project updates to connected platforms
                    </p>
                  </div>
                  <Switch />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Milestone celebrations</p>
                    <p className="text-sm text-muted-foreground">
                      Auto-generate posts when you hit funding milestones
                    </p>
                  </div>
                  <Switch />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Daily engagement reminders</p>
                    <p className="text-sm text-muted-foreground">
                      Get notified about optimal posting times
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Schedule Dialog */}
      <Dialog open={isScheduleDialogOpen} onOpenChange={setIsScheduleDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Schedule Post</DialogTitle>
            <DialogDescription>
              Choose when to publish your post to connected social accounts.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {scheduleDate ? format(scheduleDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={scheduleDate}
                    onSelect={setScheduleDate}
                    initialFocus
                    disabled={(date) => date < new Date()}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label htmlFor="time">Time</Label>
              <Input
                id="time"
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Platforms</Label>
              <div className="flex flex-wrap gap-2">
                {selectedPlatforms.map((platformId) => {
                  const platform = SOCIAL_PLATFORMS.find((p) => p.id === platformId);
                  if (!platform) return null;
                  return (
                    <Badge key={platformId} variant="secondary" className="gap-1">
                      <platform.icon className="h-3 w-3" />
                      {platform.name}
                    </Badge>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsScheduleDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSchedule}>
              <Clock className="mr-2 h-4 w-4" />
              Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
