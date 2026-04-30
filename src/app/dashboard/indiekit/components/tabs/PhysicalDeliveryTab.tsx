"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Box, Truck } from "lucide-react";

// Import existing tabs from v1
import { PackagesTab } from "./index";
import { ShippingTab } from "./index";

import type { PackageGroup, ShippingService } from "../../types";

interface PhysicalDeliveryTabProps {
  packageGroups: PackageGroup[];
  packageGroupFilter: string;
  onPackageGroupFilterChange: (filter: string) => void;
  shippingServices: ShippingService[];
  hasActiveCampaign: boolean;
  projectId: string;
  onRefresh: () => void;
}

/**
 * Physical Delivery Tab - Merges Packages + Shipping from v1
 */
export function PhysicalDeliveryTab({
  packageGroups,
  packageGroupFilter,
  onPackageGroupFilterChange,
  shippingServices,
  hasActiveCampaign,
  projectId,
  onRefresh,
}: PhysicalDeliveryTabProps) {
  const [subTab, setSubTab] = useState("packages");

  return (
    <div className="space-y-4">
      <Tabs value={subTab} onValueChange={setSubTab}>
        <div className="overflow-x-auto pb-1">
        <TabsList className="inline-flex w-max bg-muted/50">
          <TabsTrigger value="packages">
            <Box className="h-4 w-4 mr-2" />
            Packages
          </TabsTrigger>
          <TabsTrigger value="shipping">
            <Truck className="h-4 w-4 mr-2" />
            Shipping Config
          </TabsTrigger>
        </TabsList>
        </div>

        <TabsContent value="packages">
          <PackagesTab
            packageGroups={packageGroups}
            packageGroupFilter={packageGroupFilter}
            onPackageGroupFilterChange={onPackageGroupFilterChange}
            hasActiveCampaign={hasActiveCampaign}
            projectId={projectId}
            onRefresh={onRefresh}
          />
        </TabsContent>

        <TabsContent value="shipping">
          <ShippingTab shippingServices={shippingServices} projectId={projectId} onRefresh={onRefresh} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
