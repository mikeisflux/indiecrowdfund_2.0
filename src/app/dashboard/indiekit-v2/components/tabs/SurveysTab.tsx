"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, ClipboardList } from "lucide-react";

// Import existing tabs from v1
import { EmailsTab } from "../../../indiekit/components/tabs";
import { ManageSurveyTab } from "../../../indiekit/components/tabs";

import type { EmailCampaign } from "../../types";

interface SurveysTabProps {
  emailCampaigns: EmailCampaign[];
  onOpenEmailDialog: (template?: { subject?: string; body?: string; name?: string } | null) => void;
  projectId: string;
  onRefresh: () => void;
}

/**
 * Surveys Tab - Merges survey email sending + survey management from v1
 */
export function SurveysTab({
  emailCampaigns,
  onOpenEmailDialog,
  projectId,
  onRefresh,
}: SurveysTabProps) {
  const [subTab, setSubTab] = useState("send");

  return (
    <div className="space-y-4">
      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="send">
            <Mail className="h-4 w-4 mr-2" />
            Send Surveys
          </TabsTrigger>
          <TabsTrigger value="responses">
            <ClipboardList className="h-4 w-4 mr-2" />
            Survey Responses
          </TabsTrigger>
        </TabsList>

        <TabsContent value="send">
          <EmailsTab
            emailCampaigns={emailCampaigns}
            onOpenEmailDialog={onOpenEmailDialog}
            projectId={projectId}
            onRefresh={onRefresh}
          />
        </TabsContent>

        <TabsContent value="responses">
          <ManageSurveyTab projectId={projectId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
