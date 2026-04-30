"use client";

// Re-export the existing Digital tab from v1 with new name
import { DigitalTab } from "../components/tabs";

import type { FulfillmentStats, DigitalFile, DistributionRule } from "../../types";

interface DigitalDeliveryTabProps {
  stats: FulfillmentStats | null;
  digitalFiles: DigitalFile[];
  distributionRules: DistributionRule[];
  onOpenUploadDialog: () => void;
  onOpenDistributionDialog: () => void;
  projectId: string;
  onRefresh: () => void;
}

/**
 * Digital Delivery Tab - Renamed from Digital in v1
 */
export function DigitalDeliveryTab(props: DigitalDeliveryTabProps) {
  return <DigitalTab {...props} />;
}
