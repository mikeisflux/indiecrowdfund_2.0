import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  onConfigureCampaignType?: (type: "subscriber" | "backer" | "creator") => void;
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
    </div>
  );
}
