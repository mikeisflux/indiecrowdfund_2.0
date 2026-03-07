"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, FileDown, BarChart3 } from "lucide-react";

// Import existing tabs from v1
import { TimelineTab } from "../../../indiekit/components/tabs";
import { ExportTab } from "../../../indiekit/components/tabs";
import { CountsTab } from "../../../indiekit/components/tabs";

import type { FulfillmentStats, TimelineEntry } from "../../types";

interface ReportsTabProps {
  timeline: TimelineEntry[];
  projectId: string;
  stats: FulfillmentStats | null;
}

/**
 * Reports Tab - Merges Timeline + Export + Analytics from v1
 */
export function ReportsTab({ timeline, projectId, stats }: ReportsTabProps) {
  const [subTab, setSubTab] = useState("analytics");

  return (
    <div className="space-y-4">
      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="analytics">
            <BarChart3 className="h-4 w-4 mr-2" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="timeline">
            <Clock className="h-4 w-4 mr-2" />
            Timeline
          </TabsTrigger>
          <TabsTrigger value="export">
            <FileDown className="h-4 w-4 mr-2" />
            Export
          </TabsTrigger>
        </TabsList>

        <TabsContent value="analytics">
          <CountsTab
            totalBackers={stats?.totalBackers}
            surveysDone={stats?.surveysCompleted}
            preOrders={stats?.preOrderBackers}
            backersWithAddons={stats?.backersWithAddons}
            totalAddonItems={stats?.totalAddonItems}
            pledgeLevelBreakdown={stats?.pledgeLevelBreakdown}
            surveyStatusBreakdown={stats?.surveyStatusBreakdown}
            shippingRegionBreakdown={stats?.shippingRegionBreakdown}
            paymentStatusBreakdown={stats?.paymentStatusBreakdown}
          />
        </TabsContent>

        <TabsContent value="timeline">
          <TimelineTab entries={timeline} projectId={projectId} />
        </TabsContent>

        <TabsContent value="export">
          <ExportTab projectId={projectId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
