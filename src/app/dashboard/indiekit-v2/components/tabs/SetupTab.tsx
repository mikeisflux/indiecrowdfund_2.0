"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BoxIcon, Link2, FormInput, ShoppingCart } from "lucide-react";

// Import existing tabs from v1
import { ProductsTab } from "../../../indiekit/components/tabs";
import { SkuMappingTab } from "../../../indiekit/components/tabs";
import { SurveyBuilderTab } from "../../../indiekit/components/tabs";
import { AddonsTab } from "../../../indiekit/components/tabs";
import { ImportAddonFromProjectDialog } from "../../../indiekit/components/dialogs/import-addon-from-project-dialog";

import type { FulfillmentStats, Backer, SurveyAddon } from "../../types";

interface SetupTabProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  products: any[];
  projectId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  surveyQuestions: any[];
  stats: FulfillmentStats | null;
  backers: Backer[];
  surveyAddons: SurveyAddon[];
  onOpenAddonDialog: () => void;
  onRefresh: () => void;
  onEditAddon: (addon: SurveyAddon) => void;
}

/**
 * Setup Tab - Merges Products + SKU Mapping + Survey Builder + Add-ons from v1
 */
export function SetupTab({
  products,
  projectId,
  surveyQuestions,
  stats,
  backers,
  surveyAddons,
  onOpenAddonDialog,
  onRefresh,
  onEditAddon,
}: SetupTabProps) {
  const [subTab, setSubTab] = useState("products");
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);

  return (
    <div className="space-y-4">
      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="products">
            <BoxIcon className="h-4 w-4 mr-2" />
            Products
          </TabsTrigger>
          <TabsTrigger value="sku-mapping">
            <Link2 className="h-4 w-4 mr-2" />
            SKU Mapping
          </TabsTrigger>
          <TabsTrigger value="survey-builder">
            <FormInput className="h-4 w-4 mr-2" />
            Survey Builder
          </TabsTrigger>
          <TabsTrigger value="addons">
            <ShoppingCart className="h-4 w-4 mr-2" />
            Add-ons
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          <ProductsTab products={products} projectId={projectId} />
        </TabsContent>

        <TabsContent value="sku-mapping">
          <SkuMappingTab projectId={projectId} />
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
      </Tabs>

      <ImportAddonFromProjectDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        projectId={projectId}
        existingAddonNames={surveyAddons.map((a) => a.name)}
        onImported={onRefresh}
      />
    </div>
  );
}
