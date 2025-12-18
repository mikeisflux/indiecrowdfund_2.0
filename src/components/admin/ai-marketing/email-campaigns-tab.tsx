import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sparkles,
  Users,
  UserCheck,
  Layers,
  Tag,
  Send,
  ShoppingCart,
  ArrowRight,
  Upload,
  Store,
  Eye,
  MousePointer,
  Clock,
  CheckCircle,
  AlertCircle,
  Play,
  Brain,
} from "lucide-react";

interface EmailStats {
  totalSent: number;
  avgOpenRate: string;
  avgClickRate: string;
  totalOpens: number;
  totalClicks: number;
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

interface EmailCampaignsTabProps {
  emailStats: EmailStats | null;
  emailCampaigns: EmailCampaign[];
  setShowCampaignDialog: (show: boolean) => void;
  onConfigureCampaignType?: (type: "subscriber" | "backer" | "creator" | "retailer") => void;
  onImportCSV?: () => void;
}

export function EmailCampaignsTab({
  emailStats,
  emailCampaigns,
  setShowCampaignDialog,
  onConfigureCampaignType,
  onImportCSV,
}: EmailCampaignsTabProps) {
  return (
    <div className="mt-6 space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-zinc-500">Total Sent</p>
            <p className="mt-1 text-2xl font-bold">{(emailStats?.totalSent || 0).toLocaleString()}</p>
            <p className="text-xs text-zinc-500">All campaigns</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-zinc-500">Avg Open Rate</p>
            <p className="mt-1 text-2xl font-bold">{emailStats?.avgOpenRate || "0"}%</p>
            <p className="text-xs text-zinc-500">{(emailStats?.totalOpens || 0).toLocaleString()} total opens</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-zinc-500">Avg Click Rate</p>
            <p className="mt-1 text-2xl font-bold">{emailStats?.avgClickRate || "0"}%</p>
            <p className="text-xs text-zinc-500">{(emailStats?.totalClicks || 0).toLocaleString()} total clicks</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-zinc-500">Active Campaigns</p>
            <p className="mt-1 text-2xl font-bold">{emailCampaigns.length}</p>
            <p className="text-xs text-zinc-500">Total campaigns</p>
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
          <div className="grid gap-4 md:grid-cols-4">
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
              <div className="mt-4 flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => onConfigureCampaignType?.("subscriber")}
                >
                  <ArrowRight className="mr-2 h-4 w-4" />
                  Configure
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={onImportCSV}
                  title="Import subscribers from CSV"
                >
                  <Upload className="h-4 w-4" />
                </Button>
              </div>
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
              <Button
                variant="outline"
                className="mt-4 w-full"
                onClick={() => onConfigureCampaignType?.("backer")}
              >
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
              <Button
                variant="outline"
                className="mt-4 w-full"
                onClick={() => onConfigureCampaignType?.("creator")}
              >
                <ArrowRight className="mr-2 h-4 w-4" />
                Configure
              </Button>
            </div>

            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-amber-100 p-2">
                  <Store className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-medium">Retailer Campaigns</p>
                  <p className="text-sm text-zinc-500">Reach retail partners</p>
                </div>
              </div>
              <Button
                variant="outline"
                className="mt-4 w-full"
                onClick={() => onConfigureCampaignType?.("retailer")}
              >
                <ArrowRight className="mr-2 h-4 w-4" />
                Configure
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Campaign Manager */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-violet-600" />
                Campaign Manager
              </CardTitle>
              <CardDescription>
                View and manage all email campaigns with AI insights
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {emailCampaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-zinc-100 p-4 mb-4">
                <Send className="h-8 w-8 text-zinc-400" />
              </div>
              <p className="text-lg font-medium text-zinc-600">No campaigns yet</p>
              <p className="text-sm text-zinc-500 mt-1 max-w-md">
                Create your first campaign using the campaign type cards above.
                The AI will help you target the right audience with personalized content.
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Audience</TableHead>
                    <TableHead className="text-center">Recipients</TableHead>
                    <TableHead className="text-center">Opens</TableHead>
                    <TableHead className="text-center">Clicks</TableHead>
                    <TableHead className="text-center">Conversions</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {emailCampaigns.map((campaign) => (
                    <TableRow key={campaign.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="font-medium">{campaign.name}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <CampaignStatusBadge status={campaign.status} />
                      </TableCell>
                      <TableCell>
                        <AudienceBadge name={campaign.name} />
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Users className="h-3.5 w-3.5 text-zinc-400" />
                          {campaign.recipients.toLocaleString()}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Eye className="h-3.5 w-3.5 text-blue-500" />
                          {campaign.opens.toLocaleString()}
                          {campaign.recipients > 0 && (
                            <span className="text-xs text-zinc-400">
                              ({Math.round((campaign.opens / campaign.recipients) * 100)}%)
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <MousePointer className="h-3.5 w-3.5 text-emerald-500" />
                          {campaign.clicks.toLocaleString()}
                          {campaign.opens > 0 && (
                            <span className="text-xs text-zinc-400">
                              ({Math.round((campaign.clicks / campaign.opens) * 100)}%)
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <ShoppingCart className="h-3.5 w-3.5 text-amber-500" />
                          {campaign.conversions.toLocaleString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-zinc-500">
                          {campaign.sentAt
                            ? new Date(campaign.sentAt).toLocaleDateString()
                            : campaign.scheduledFor
                              ? `Scheduled: ${new Date(campaign.scheduledFor).toLocaleDateString()}`
                              : "Draft"
                          }
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* How AI Works */}
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
    </div>
  );
}

// Helper component for campaign status badges
function CampaignStatusBadge({ status }: { status: string }) {
  switch (status.toUpperCase()) {
    case "SENT":
      return (
        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
          <CheckCircle className="mr-1 h-3 w-3" />
          Sent
        </Badge>
      );
    case "SCHEDULED":
      return (
        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
          <Clock className="mr-1 h-3 w-3" />
          Scheduled
        </Badge>
      );
    case "SENDING":
      return (
        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
          <Play className="mr-1 h-3 w-3" />
          Sending
        </Badge>
      );
    case "DRAFT":
      return (
        <Badge variant="outline">
          <AlertCircle className="mr-1 h-3 w-3" />
          Draft
        </Badge>
      );
    case "FAILED":
      return (
        <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
          <AlertCircle className="mr-1 h-3 w-3" />
          Failed
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

// Helper component to show audience type based on campaign name
function AudienceBadge({ name }: { name: string }) {
  const nameLower = name.toLowerCase();

  if (nameLower.includes("subscriber") || nameLower.includes("newsletter")) {
    return (
      <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
        <Users className="mr-1 h-3 w-3" />
        Subscribers
      </Badge>
    );
  }
  if (nameLower.includes("backer")) {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
        <UserCheck className="mr-1 h-3 w-3" />
        Backers
      </Badge>
    );
  }
  if (nameLower.includes("creator")) {
    return (
      <Badge className="bg-violet-100 text-violet-700 hover:bg-violet-100">
        <Layers className="mr-1 h-3 w-3" />
        Creators
      </Badge>
    );
  }
  if (nameLower.includes("retailer")) {
    return (
      <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
        <Store className="mr-1 h-3 w-3" />
        Retailers
      </Badge>
    );
  }
  return (
    <Badge variant="outline">
      <Users className="mr-1 h-3 w-3" />
      General
    </Badge>
  );
}
