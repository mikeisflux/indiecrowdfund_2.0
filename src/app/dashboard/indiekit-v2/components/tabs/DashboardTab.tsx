"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutDashboard, BarChart3 } from "lucide-react";

// Import existing tabs from v1
import { OverviewTab } from "../../../indiekit/components/tabs";
import { CountsTab } from "../../../indiekit/components/tabs";

import type { FulfillmentStats, Backer, TimelineEntry } from "../../types";

interface DashboardTabProps {
  stats: FulfillmentStats | null;
  backers: Backer[];
  timeline: TimelineEntry[];
  projectId: string;
  onSwitchTab: (tab: string) => void;
}

/**
 * Dashboard Tab - Merges Overview + Counts from v1
 */
export function DashboardTab({ stats, backers, timeline, projectId, onSwitchTab }: DashboardTabProps) {
  const [subTab, setSubTab] = useState("overview");

  return (
    <div className="space-y-4">
      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="overview">
            <LayoutDashboard className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="charts">
            <BarChart3 className="h-4 w-4 mr-2" />
            Charts & Breakdown
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab
            stats={stats}
            backers={backers}
            timeline={timeline}
            projectId={projectId}
            onSwitchTab={onSwitchTab}
          />
        </TabsContent>

        <TabsContent value="charts">
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
      </Tabs>
    </div>
  );
}
