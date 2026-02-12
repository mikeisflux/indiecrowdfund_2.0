"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, UsersRound, Layers } from "lucide-react";

// Import existing tabs from v1
import { EmailsTab } from "../../../indiekit/components/tabs";
import { EmailListTab } from "../../../indiekit/components/tabs";
import { SegmentsTab } from "../../../indiekit/components/tabs";

import type { EmailCampaign } from "../../types";

interface EmailMarketingTabProps {
  emailCampaigns: EmailCampaign[];
  onOpenEmailDialog: (template?: { subject?: string; body?: string; name?: string } | null) => void;
  projectId: string;
  onRefresh: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  segments: any[];
  hasActiveCampaign: boolean;
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
  hasActiveCampaign,
}: EmailMarketingTabProps) {
  const [subTab, setSubTab] = useState("campaigns");

  return (
    <div className="space-y-4">
      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList className="bg-muted/50">
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

        <TabsContent value="campaigns">
          <EmailsTab
            emailCampaigns={emailCampaigns}
            onOpenEmailDialog={onOpenEmailDialog}
            projectId={projectId}
            onRefresh={onRefresh}
          />
        </TabsContent>

        <TabsContent value="subscribers">
          <EmailListTab projectId={projectId} hasActiveCampaign={hasActiveCampaign} />
        </TabsContent>

        <TabsContent value="segments">
          <SegmentsTab segments={segments} projectId={projectId} onRefresh={onRefresh} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
