"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, UsersRound, Layers, Lock } from "lucide-react";

// Import existing tabs from v1
import { EmailsTab } from "./index";
import { SegmentsTab } from "./index";
// Creator-wide subscriber list (replaces the per-project EmailListTab
// that lived under "Subscribers" before — it pointed at project
// followers, which meant creators couldn't actually search or remove
// people they had imported into their global email list).
import { CreatorSubscribersTab } from "./CreatorSubscribersTab";

import type { EmailCampaign, Segment } from "../../types";

interface EmailMarketingTabProps {
  emailCampaigns: EmailCampaign[];
  onOpenEmailDialog: (template?: { subject?: string; body?: string; name?: string } | null) => void;
  projectId: string;
  onRefresh: () => void;
  segments: Segment[];
  // Was passed to the per-project EmailListTab to gate prelaunch
  // imports while a live campaign was in flight; the new
  // CreatorSubscribersTab is creator-wide and doesn't need it. Keep
  // the prop optional so callers don't have to change.
  hasActiveCampaign?: boolean;
  emailAccessLocked?: boolean;
}

/**
 * Email Marketing Tab - Merges Email Campaigns + Email List + Segments from v1
 */
export function EmailMarketingTab({
  emailCampaigns,
  onOpenEmailDialog,
  projectId,
  onRefresh,
  segments,
  emailAccessLocked,
}: EmailMarketingTabProps) {
  const [subTab, setSubTab] = useState("campaigns");

  if (emailAccessLocked) {
    return (
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Lock className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="mb-2 font-semibold text-lg">Email Marketing Locked</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            You need at least one approved prelaunch page or campaign before you can access email marketing features. Submit your project for review to get started.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs value={subTab} onValueChange={setSubTab}>
        <div className="overflow-x-auto pb-1">
        <TabsList className="inline-flex w-max bg-muted/50">
          <TabsTrigger value="campaigns">
            <Mail className="h-4 w-4 mr-2" />
            Campaigns
          </TabsTrigger>
          <TabsTrigger value="subscribers">
            <UsersRound className="h-4 w-4 mr-2" />
            Subscribers
          </TabsTrigger>
          <TabsTrigger value="segments">
            <Layers className="h-4 w-4 mr-2" />
            Segments
          </TabsTrigger>
        </TabsList>
        </div>

        <TabsContent value="campaigns">
          <EmailsTab
            emailCampaigns={emailCampaigns}
            onOpenEmailDialog={onOpenEmailDialog}
            projectId={projectId}
            onRefresh={onRefresh}
          />
        </TabsContent>

        <TabsContent value="subscribers">
          <CreatorSubscribersTab />
        </TabsContent>

        <TabsContent value="segments">
          <SegmentsTab segments={segments} projectId={projectId} onRefresh={onRefresh} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
