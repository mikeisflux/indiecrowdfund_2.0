"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/fetch-utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sparkles,
  Send,
  CalendarClock,
  Loader2,
  CheckCircle2,
  XCircle,
  Trash2,
  RotateCcw,
  ExternalLink,
  AtSign,
} from "lucide-react";
import { toast } from "sonner";

/**
 * Creator Social Hub — real X posting from the creator's own account.
 *
 * The previous version of this tab faked everything (Post was a toast,
 * "AI generate" returned canned copy with invented stats, analytics were
 * hardcoded zeros). This one is backed by /api/creator/social/*:
 * credentials are verified against X before saving, Post Now publishes
 * synchronously, Schedule queues a CreatorSocialPost that the hourly
 * social cron sends, AI copy comes from the campaign's live data, and
 * the counts below are real rows.
 */

interface SocialProject {
  id: string;
  title: string;
}

interface SocialPostRow {
  id: string;
  content: string;
  imageUrl: string | null;
  projectId: string | null;
  scheduledFor: string | null;
  status: string;
  error: string | null;
  externalId: string | null;
  postedAt: string | null;
  createdAt: string;
}

interface SocialStats {
  postedTotal: number;
  postedThisMonth: number;
  scheduled: number;
  failed: number;
}

interface SocialHubTabProps {
  projects?: SocialProject[];
  selectedProjectId?: string;
}

const POST_TYPE_OPTIONS = [
  { value: "auto", label: "Best angle (auto)" },
  { value: "launch", label: "Just launched" },
  { value: "milestone_50", label: "50% funded" },
  { value: "milestone_100", label: "Fully funded" },
  { value: "ending_soon", label: "Ending soon" },
];

export function SocialHubTab({ projects = [], selectedProjectId }: SocialHubTabProps) {
  // Account state
  const [accountLoading, setAccountLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [handle, setHandle] = useState<string | null>(null);
  const [autoPostEnabled, setAutoPostEnabled] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [accessSecret, setAccessSecret] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isTogglingAuto, setIsTogglingAuto] = useState(false);

  // Composer state
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [postProjectId, setPostProjectId] = useState(selectedProjectId || projects[0]?.id || "");
  const [postType, setPostType] = useState("auto");
  const [scheduleAt, setScheduleAt] = useState("");
  const [showSchedule, setShowSchedule] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Posts + stats
  const [posts, setPosts] = useState<SocialPostRow[]>([]);
  const [stats, setStats] = useState<SocialStats>({ postedTotal: 0, postedThisMonth: 0, scheduled: 0, failed: 0 });
  const [actioningId, setActioningId] = useState<string | null>(null);

  const loadAccount = useCallback(async () => {
    try {
      const res = await fetch("/api/creator/social/account");
      if (res.ok) {
        const data = await res.json();
        setConnected(!!data.connected);
        setHandle(data.handle || null);
        setAutoPostEnabled(!!data.autoPostEnabled);
      }
    } catch {
      // Card shows the connect form.
    } finally {
      setAccountLoading(false);
    }
  }, []);

  const loadPosts = useCallback(async () => {
    try {
      const res = await fetch("/api/creator/social/posts");
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts || []);
        if (data.stats) setStats(data.stats);
      }
    } catch {
      // Keep whatever we had.
    }
  }, []);

  useEffect(() => {
    loadAccount();
    loadPosts();
  }, [loadAccount, loadPosts]);

  useEffect(() => {
    if (selectedProjectId) setPostProjectId(selectedProjectId);
  }, [selectedProjectId]);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const res = await apiFetch("/api/creator/social/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, apiSecret, accessToken, accessSecret }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to connect");
      toast.success(`Connected as @${data.handle}`);
      setApiKey("");
      setApiSecret("");
      setAccessToken("");
      setAccessSecret("");
      loadAccount();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to connect");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm("Disconnect your X account? Scheduled posts will be cancelled.")) return;
    try {
      const res = await apiFetch("/api/creator/social/account", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to disconnect");
      toast.success("X account disconnected");
      setConnected(false);
      setHandle(null);
      loadPosts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to disconnect");
    }
  };

  const handleToggleAutoPost = async (checked: boolean) => {
    setIsTogglingAuto(true);
    try {
      const res = await apiFetch("/api/creator/social/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoPostEnabled: checked }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to update");
      setAutoPostEnabled(checked);
      toast.success(
        checked
          ? "Auto-post on: launch / 50% / funded / ending-soon posts will go out from your account"
          : "Auto-post off"
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update");
    } finally {
      setIsTogglingAuto(false);
    }
  };

  const handleGenerate = async () => {
    if (!postProjectId) {
      toast.error("Pick a campaign — the AI writes from its live data");
      return;
    }
    setIsGenerating(true);
    try {
      const res = await apiFetch("/api/creator/social/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          projectId: postProjectId,
          postType: postType === "auto" ? undefined : postType,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setContent(data.content || "");
      toast.success("Draft written from your campaign's live numbers — edit before posting");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Generation failed");
    } finally {
      setIsGenerating(false);
    }
  };

  const submitPost = async (mode: "post_now" | "schedule") => {
    if (!content.trim()) {
      toast.error("Write something first");
      return;
    }
    if (mode === "schedule" && !scheduleAt) {
      toast.error("Pick a date and time");
      return;
    }
    const setBusy = mode === "post_now" ? setIsPosting : setIsScheduling;
    setBusy(true);
    try {
      const res = await apiFetch("/api/creator/social/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: mode,
          content: content.trim(),
          projectId: postProjectId || undefined,
          imageUrl: imageUrl.trim() || undefined,
          scheduledFor: mode === "schedule" ? new Date(scheduleAt).toISOString() : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed");
      toast.success(mode === "post_now" ? "Posted to X" : "Scheduled — it posts automatically at that time");
      setContent("");
      setImageUrl("");
      setScheduleAt("");
      setShowSchedule(false);
      loadPosts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const postAction = async (postId: string, action: "cancel" | "retry" | "delete") => {
    setActioningId(postId);
    try {
      const res = await apiFetch("/api/creator/social/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, postId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed");
      toast.success(data.message || (action === "cancel" ? "Cancelled" : action === "retry" ? "Re-queued" : "Deleted"));
      loadPosts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setActioningId(null);
    }
  };

  const statusBadge = (post: SocialPostRow) => {
    switch (post.status) {
      case "POSTED":
        return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Posted</Badge>;
      case "SCHEDULED":
        return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
          {post.scheduledFor ? "Scheduled" : "Queued"}
        </Badge>;
      case "FAILED":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="secondary">{post.status}</Badge>;
    }
  };

  const charCount = content.length;

  return (
    <div className="space-y-6">
      {/* Account */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AtSign className="h-5 w-5 text-sky-500" />
            X (Twitter) Account
          </CardTitle>
          <CardDescription>
            Posts go out from your own X account using your X developer app credentials.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {accountLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : connected ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg border-green-500/50">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium">Connected{handle ? ` as @${handle}` : ""}</p>
                    <p className="text-sm text-muted-foreground">Credentials verified with X</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={handleDisconnect}>
                  Disconnect
                </Button>
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Auto-post campaign milestones</p>
                  <p className="text-sm text-muted-foreground">
                    Automatically posts when a campaign launches, hits 50%, fully funds, or enters its final 72 hours
                  </p>
                </div>
                <Switch
                  checked={autoPostEnabled}
                  onCheckedChange={handleToggleAutoPost}
                  disabled={isTogglingAuto}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="x-api-key">API Key</Label>
                  <Input id="x-api-key" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="x-api-secret">API Key Secret</Label>
                  <Input id="x-api-secret" type="password" value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="x-access-token">Access Token</Label>
                  <Input id="x-access-token" type="password" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="x-access-secret">Access Token Secret</Label>
                  <Input id="x-access-secret" type="password" value={accessSecret} onChange={(e) => setAccessSecret(e.target.value)} />
                </div>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground space-y-2">
                <p className="font-medium">Getting your keys (free, ~5 minutes):</p>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>Go to developer.x.com and create a (free) developer account with the X account you post from</li>
                  <li>Create an app, set its permissions to <strong>Read and write</strong></li>
                  <li>Under &quot;Keys and tokens&quot;, copy the API Key &amp; Secret and generate an Access Token &amp; Secret</li>
                  <li>Paste all four here — we verify them with X before saving (stored encrypted)</li>
                </ol>
              </div>
              <Button onClick={handleConnect} disabled={isConnecting}>
                {isConnecting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Verifying with X...</>
                ) : (
                  "Verify & Connect"
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats — real CreatorSocialPost counts */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Posted this month", value: stats.postedThisMonth },
          { label: "Posted all-time", value: stats.postedTotal },
          { label: "Scheduled", value: stats.scheduled },
          { label: "Failed", value: stats.failed },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-6">
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-sm text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Composer */}
      <Card>
        <CardHeader>
          <CardTitle>Compose Post</CardTitle>
          <CardDescription>
            Post now, schedule for later, or let AI draft from your campaign&apos;s live numbers.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {projects.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Campaign</Label>
                <Select value={postProjectId} onValueChange={setPostProjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select campaign" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>AI angle</Label>
                <div className="flex gap-2">
                  <Select value={postType} onValueChange={setPostType}>
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {POST_TYPE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={handleGenerate} disabled={isGenerating || !postProjectId}>
                    {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    <span className="ml-2 hidden sm:inline">{isGenerating ? "Writing..." : "AI Draft"}</span>
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Textarea
              placeholder="What's happening with your campaign?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
            />
            <p className={`text-xs text-right ${charCount > 280 ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
              {charCount}/280
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="x-image-url">Image URL (optional)</Label>
            <Input
              id="x-image-url"
              placeholder="https://... (e.g. your campaign cover image)"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
            />
          </div>

          {showSchedule && (
            <div className="space-y-2">
              <Label htmlFor="x-schedule-at">Post at</Label>
              <Input
                id="x-schedule-at"
                type="datetime-local"
                value={scheduleAt}
                onChange={(e) => setScheduleAt(e.target.value)}
                className="w-full sm:w-[260px]"
              />
              <p className="text-xs text-muted-foreground">
                Scheduled posts go out on the next hourly publish run at or after this time.
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => submitPost("post_now")}
              disabled={isPosting || !connected || charCount === 0 || charCount > 280}
            >
              {isPosting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              {isPosting ? "Posting..." : "Post Now"}
            </Button>
            {showSchedule ? (
              <Button
                variant="secondary"
                onClick={() => submitPost("schedule")}
                disabled={isScheduling || !connected || charCount === 0 || charCount > 280}
              >
                {isScheduling ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CalendarClock className="h-4 w-4 mr-2" />}
                {isScheduling ? "Scheduling..." : "Confirm Schedule"}
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setShowSchedule(true)} disabled={!connected}>
                <CalendarClock className="h-4 w-4 mr-2" />
                Schedule
              </Button>
            )}
            {!connected && !accountLoading && (
              <p className="text-sm text-muted-foreground self-center">Connect your X account above to post.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Post history */}
      <Card>
        <CardHeader>
          <CardTitle>Posts</CardTitle>
          <CardDescription>Scheduled, sent, and failed posts from your account</CardDescription>
        </CardHeader>
        <CardContent>
          {posts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Send className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>Nothing here yet — your posts and their status will show up here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {posts.map((post) => (
                <div key={post.id} className="p-3 border rounded-lg space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm whitespace-pre-wrap break-words flex-1">{post.content}</p>
                    {statusBadge(post)}
                  </div>
                  {post.status === "FAILED" && post.error && (
                    <p className="text-xs text-red-600 flex items-center gap-1">
                      <XCircle className="h-3 w-3 shrink-0" />
                      {post.error}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      {post.status === "POSTED" && post.postedAt
                        ? `Posted ${new Date(post.postedAt).toLocaleString()}`
                        : post.scheduledFor
                          ? `Scheduled for ${new Date(post.scheduledFor).toLocaleString()}`
                          : `Created ${new Date(post.createdAt).toLocaleString()}`}
                    </p>
                    <div className="flex gap-1">
                      {post.status === "POSTED" && post.externalId && (
                        <Button variant="ghost" size="sm" asChild>
                          <a
                            href={`https://x.com/i/web/status/${post.externalId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            View on X
                            <ExternalLink className="h-3 w-3 ml-1" />
                          </a>
                        </Button>
                      )}
                      {post.status === "SCHEDULED" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => postAction(post.id, "cancel")}
                          disabled={actioningId === post.id}
                        >
                          Cancel
                        </Button>
                      )}
                      {post.status === "FAILED" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => postAction(post.id, "retry")}
                          disabled={actioningId === post.id}
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Retry
                        </Button>
                      )}
                      {post.status !== "POSTED" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600"
                          onClick={() => postAction(post.id, "delete")}
                          disabled={actioningId === post.id}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
