import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Sparkles,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Target,
  Wand2,
  Filter,
  Users,
  Eye,
} from "lucide-react";

interface Recommendation {
  type: "success" | "warning" | "info";
  message: string;
}

interface UserSegment {
  name: string;
  count: number;
  avgSpend: string | number;
  criteria: string;
}

interface BehaviorEvent {
  event: string;
  count: number;
  trend: string;
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

interface OverviewTabProps {
  recommendations: Recommendation[];
  userSegments: UserSegment[];
  behaviorEvents: BehaviorEvent[];
  emailCampaigns: EmailCampaign[];
  isApplyingRecommendations: boolean;
  handleApplyRecommendations: () => void;
  setShowSegmentManager: (show: boolean) => void;
  setShowCampaignDialog: (show: boolean) => void;
  handleViewCampaign: (campaign: EmailCampaign) => void;
}

export function OverviewTab({
  recommendations,
  userSegments,
  behaviorEvents,
  emailCampaigns,
  isApplyingRecommendations,
  handleApplyRecommendations,
  setShowSegmentManager,
  setShowCampaignDialog,
  handleViewCampaign,
}: OverviewTabProps) {
  return (
    <div className="mt-6 space-y-6">
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
                {recommendations.length > 0 ? (
                  recommendations.map((rec, index) => (
                    <li key={index} className="flex items-center gap-2">
                      {rec.type === "success" ? (
                        <CheckCircle className="h-4 w-4 text-emerald-600" />
                      ) : rec.type === "warning" ? (
                        <AlertCircle className="h-4 w-4 text-amber-600" />
                      ) : (
                        <Target className="h-4 w-4 text-blue-600" />
                      )}
                      <span>{rec.message}</span>
                    </li>
                  ))
                ) : (
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    <span>Loading recommendations...</span>
                  </li>
                )}
              </ul>
            </div>
            <Button
              className="bg-violet-600 text-white hover:bg-violet-700"
              onClick={handleApplyRecommendations}
              disabled={isApplyingRecommendations || recommendations.length === 0}
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

      <div className="grid gap-6 md:grid-cols-2">
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
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                      <Users className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">{segment.name}</p>
                      <p className="text-xs text-muted-foreground">{segment.criteria}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{segment.count.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Avg ${segment.avgSpend}</p>
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
                  <p className="mt-1 text-sm text-muted-foreground">
                    {campaign.recipients.toLocaleString()} recipients
                    {campaign.sentAt && ` • Sent ${campaign.sentAt}`}
                    {campaign.scheduledFor && ` • Scheduled for ${campaign.scheduledFor}`}
                  </p>
                </div>
                {campaign.status === "sent" && (
                  <div className="flex gap-6 text-center">
                    <div>
                      <p className="text-lg font-semibold">{((campaign.opens / campaign.recipients) * 100).toFixed(1)}%</p>
                      <p className="text-xs text-muted-foreground">Opens</p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold">{((campaign.clicks / campaign.recipients) * 100).toFixed(1)}%</p>
                      <p className="text-xs text-muted-foreground">Clicks</p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-emerald-600">{campaign.conversions}</p>
                      <p className="text-xs text-muted-foreground">Conversions</p>
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
    </div>
  );
}
