import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
  Eye,
  Activity,
  Timer,
  MousePointer,
  ShoppingCart,
  Layers,
  Play,
  BarChart3,
  RefreshCw,
} from "lucide-react";

interface TrackingSettings {
  trackPageViews: boolean;
  trackScrollDepth: boolean;
  trackTimeOnPage: boolean;
  trackClicks: boolean;
  trackHovers: boolean;
  trackFormInteractions: boolean;
  trackVideoEngagement: boolean;
  trackRewardComparisons: boolean;
  trackAbandonedCarts: boolean;
  sessionRecording: boolean;
  heatmaps: boolean;
  funnelAnalysis: boolean;
  retentionPeriod: number;
}

interface BehaviorStats {
  todayCount: number;
  yesterdayCount: number;
  weekCount: number;
  trend: string;
}

interface LiveEvent {
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
}

interface BehaviorAnalyticsTabProps {
  trackingSettings: TrackingSettings;
  setTrackingSettings: (settings: TrackingSettings) => void;
  behaviorStats: BehaviorStats | null;
  topProjects: Array<{ projectId: string; projectTitle: string; count: number }>;
  topSearches: Array<{ query: string; count: number }>;
  liveEvents: LiveEvent[];
  refreshBehaviorData: () => void;
}

export function BehaviorAnalyticsTab({
  trackingSettings,
  setTrackingSettings,
  behaviorStats,
  topProjects,
  topSearches,
  liveEvents,
  refreshBehaviorData,
}: BehaviorAnalyticsTabProps) {
  return (
    <div className="mt-6 space-y-6">
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
                    <Eye className="h-4 w-4 text-muted-foreground" />
                    <Label>Page Views</Label>
                  </div>
                  <Switch
                    checked={trackingSettings.trackPageViews}
                    onCheckedChange={(checked) => setTrackingSettings({ ...trackingSettings, trackPageViews: checked })}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    <Label>Scroll Depth</Label>
                  </div>
                  <Switch
                    checked={trackingSettings.trackScrollDepth}
                    onCheckedChange={(checked) => setTrackingSettings({ ...trackingSettings, trackScrollDepth: checked })}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <Timer className="h-4 w-4 text-muted-foreground" />
                    <Label>Time on Page</Label>
                  </div>
                  <Switch
                    checked={trackingSettings.trackTimeOnPage}
                    onCheckedChange={(checked) => setTrackingSettings({ ...trackingSettings, trackTimeOnPage: checked })}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <MousePointer className="h-4 w-4 text-muted-foreground" />
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
                    <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                    <Label>Abandoned Carts</Label>
                  </div>
                  <Switch
                    checked={trackingSettings.trackAbandonedCarts}
                    onCheckedChange={(checked) => setTrackingSettings({ ...trackingSettings, trackAbandonedCarts: checked })}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <Layers className="h-4 w-4 text-muted-foreground" />
                    <Label>Reward Comparisons</Label>
                  </div>
                  <Switch
                    checked={trackingSettings.trackRewardComparisons}
                    onCheckedChange={(checked) => setTrackingSettings({ ...trackingSettings, trackRewardComparisons: checked })}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <Play className="h-4 w-4 text-muted-foreground" />
                    <Label>Video Engagement</Label>
                  </div>
                  <Switch
                    checked={trackingSettings.trackVideoEngagement}
                    onCheckedChange={(checked) => setTrackingSettings({ ...trackingSettings, trackVideoEngagement: checked })}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
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
                  <p className="text-xs text-muted-foreground">Record user sessions for replay</p>
                </div>
                <Switch
                  checked={trackingSettings.sessionRecording}
                  onCheckedChange={(checked) => setTrackingSettings({ ...trackingSettings, sessionRecording: checked })}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label>Heatmaps</Label>
                  <p className="text-xs text-muted-foreground">Generate click heatmaps</p>
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

      {/* Stats Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Today&apos;s Events</p>
            <p className="text-2xl font-bold">{behaviorStats?.todayCount?.toLocaleString() || 0}</p>
            <p className="text-xs text-emerald-600">{behaviorStats?.trend || "+0%"} vs yesterday</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">This Week</p>
            <p className="text-2xl font-bold">{behaviorStats?.weekCount?.toLocaleString() || 0}</p>
            <p className="text-xs text-muted-foreground">Total events</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Top Searches</p>
            <p className="text-2xl font-bold">{topSearches.length}</p>
            <p className="text-xs text-muted-foreground">Unique queries</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Top Projects</p>
            <p className="text-2xl font-bold">{topProjects.length}</p>
            <p className="text-xs text-muted-foreground">By engagement</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Projects */}
        <Card>
          <CardHeader>
            <CardTitle>Most Viewed Projects</CardTitle>
          </CardHeader>
          <CardContent>
            {topProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No project data yet</p>
            ) : (
              <div className="space-y-3">
                {topProjects.slice(0, 5).map((project, i) => (
                  <div key={project.projectId} className="flex items-center gap-3">
                    <span className="text-sm font-medium text-muted-foreground w-6">{i + 1}.</span>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{project.projectTitle}</p>
                    </div>
                    <Badge variant="secondary">{project.count} views</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Searches */}
        <Card>
          <CardHeader>
            <CardTitle>Popular Searches</CardTitle>
          </CardHeader>
          <CardContent>
            {topSearches.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No search data yet</p>
            ) : (
              <div className="space-y-3">
                {topSearches.slice(0, 5).map((search, i) => (
                  <div key={search.query} className="flex items-center gap-3">
                    <span className="text-sm font-medium text-muted-foreground w-6">{i + 1}.</span>
                    <div className="flex-1">
                      <p className="font-medium text-sm">&quot;{search.query}&quot;</p>
                    </div>
                    <Badge variant="outline">{search.count} searches</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Real-Time Behavior Stream</CardTitle>
            <Button variant="outline" size="sm" onClick={refreshBehaviorData}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {liveEvents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="h-12 w-12 mx-auto mb-3 text-zinc-300" />
                <p className="font-medium">No events recorded yet</p>
                <p className="text-sm">User behavior will appear here in real-time as visitors interact with your site.</p>
              </div>
            ) : (
              liveEvents.map((event) => {
                const timeDiff = Math.floor((Date.now() - new Date(event.timestamp).getTime()) / 1000);
                const timeAgo = timeDiff < 60 ? `${timeDiff}s ago` : timeDiff < 3600 ? `${Math.floor(timeDiff / 60)}m ago` : `${Math.floor(timeDiff / 3600)}h ago`;

                let details = event.path;
                if (event.projectTitle) {
                  details = `Viewed "${event.projectTitle}"`;
                } else if (event.searchQuery) {
                  details = `Searched for "${event.searchQuery}"`;
                } else if (event.scrollDepth) {
                  details = `Scrolled ${event.scrollDepth}% on ${event.path}`;
                } else if (event.timeSpent) {
                  details = `Spent ${event.timeSpent}s on ${event.path}`;
                }

                return (
                  <div key={event.id} className="flex items-center gap-4 rounded-lg border p-3 text-sm">
                    <span className="w-16 text-muted-foreground">{timeAgo}</span>
                    <Badge variant="outline" className="w-28 justify-center text-xs">
                      {event.eventType.toLowerCase().replace(/_/g, " ")}
                    </Badge>
                    <code className="text-xs text-muted-foreground">{event.userName || event.sessionId}</code>
                    <span className="flex-1 text-muted-foreground truncate">{details}</span>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
