"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, ClipboardList, FormInput, ShoppingCart } from "lucide-react";

// Import existing tabs from v1
import { EmailsTab } from "./index";
import { ManageSurveyTab } from "./index";
import { SurveyBuilderTab } from "./index";
import { AddonsTab } from "./index";
import { ImportAddonFromProjectDialog } from "../dialogs/import-addon-from-project-dialog";

import type { EmailCampaign, FulfillmentStats, Backer, SurveyAddon, SurveyQuestion } from "../../types";

interface SurveysTabProps {
  emailCampaigns: EmailCampaign[];
  onOpenEmailDialog: (template?: { subject?: string; body?: string; name?: string } | null) => void;
  projectId: string;
  onRefresh: () => void;
  surveyQuestions: SurveyQuestion[];
  stats: FulfillmentStats | null;
  backers: Backer[];
  surveyAddons: SurveyAddon[];
  onOpenAddonDialog: () => void;
  onEditAddon: (addon: SurveyAddon) => void;
}

/**
 * Surveys Tab - Merges survey sending, builder, add-ons, and responses
 */
export function SurveysTab({
  emailCampaigns,
  onOpenEmailDialog,
  projectId,
  onRefresh,
  surveyQuestions,
  stats,
  backers,
  surveyAddons,
  onOpenAddonDialog,
  onEditAddon,
}: SurveysTabProps) {
  const [subTab, setSubTab] = useState("sent");
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);

  return (
    <div className="space-y-4">
      <Tabs value={subTab} onValueChange={setSubTab}>
        <div className="overflow-x-auto pb-1">
        <TabsList className="inline-flex w-max bg-muted/50">
          <TabsTrigger value="sent">
            <Mail className="h-4 w-4 mr-2" />
            Sent Surveys
          </TabsTrigger>
          <TabsTrigger value="survey-builder">
            <FormInput className="h-4 w-4 mr-2" />
            Survey Builder
          </TabsTrigger>
          <TabsTrigger value="addons">
            <ShoppingCart className="h-4 w-4 mr-2" />
            Add-ons
          </TabsTrigger>
          <TabsTrigger value="responses">
            <ClipboardList className="h-4 w-4 mr-2" />
            Survey Responses
          </TabsTrigger>
        </TabsList>
        </div>

        <TabsContent value="sent">
          <EmailsTab
            emailCampaigns={emailCampaigns}
            onOpenEmailDialog={onOpenEmailDialog}
            projectId={projectId}
            onRefresh={onRefresh}
          />
        </TabsContent>

        <TabsContent value="survey-builder">
          <SurveyBuilderTab projectId={projectId} questions={surveyQuestions} />
        </TabsContent>

        <TabsContent value="addons">
          <AddonsTab
            stats={stats}
            backers={backers}
            surveyAddons={surveyAddons}
            onOpenAddonDialog={onOpenAddonDialog}
            onOpenImportDialog={() => setIsImportDialogOpen(true)}
            projectId={projectId}
            onRefresh={onRefresh}
            onEditAddon={onEditAddon}
          />
        </TabsContent>

        <TabsContent value="responses">
          <ManageSurveyTab projectId={projectId} />
        </TabsContent>
      </Tabs>

      <ImportAddonFromProjectDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        projectId={projectId}
        existingAddonIds={surveyAddons.map((a) => a.id)}
        onImported={onRefresh}
      />
    </div>
  );
}
