export interface SkuMapping {
  id: string;
  sourceType: string;
  sourceId: string;
  sourceName: string;
  shopifySku: string;
  shopifyProductName?: string;
  quantity: number;
}

export interface UnmappedItem {
  sourceType: string;
  sourceId: string;
  sourceName: string;
  amount?: number;
  quantityClaimed?: number;
}

export interface SkuValidationState {
  status: "idle" | "validating" | "valid" | "invalid";
  productName?: string;
  error?: string;
}

export interface SkippedItem {
  id: string;
  sourceType: string;
  sourceId: string;
  sourceName: string;
}

export interface ModifierAddon {
  id: string;
  title: string;
}

export interface TierReward {
  id: string;
  title: string;
}

export interface ModifierSkuMapping {
  id: string;
  baseRewardId: string;
  modifierAddonId: string;
  shopifySku: string;
  shopifyProductName?: string;
}

export interface SkuMappingTabProps {
  projectId?: string;
}
