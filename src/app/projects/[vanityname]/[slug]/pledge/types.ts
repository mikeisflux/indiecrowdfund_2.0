// Types for project and reward data
export interface ProjectData {
  id: string;
  title: string;
  slug: string;
  imageUrl: string;
  paymentProcessor: "STRIPE" | "DIVINITYCOIN" | "PAYPAL" | "PAYPAL_CONNECT" | "WHOP";
  campaignType: "ALL_OR_NOTHING" | "KEEP_IT_ALL";
  hasAdultContent: boolean;
  hasControversialContent?: boolean;
  estimatedDelivery: string;
  currentAmount: number;
  goalAmount: number;
  endDate: string | null;
  // 1 = original layout, 2 = the reward-grid layout. Decides whether the
  // add-on step renders as a grid or the original stacked list.
  layoutVersion?: number;
  creator: { id: string; name: string; location: string; image: string };
}

export interface RewardData {
  id: string;
  title: string;
  description: string;
  amount: number;
  shippingCost: Record<string, number> | number;
  shippingType: "NO_SHIPPING" | "WORLDWIDE" | "SELECTED_COUNTRIES";
  shippingCountries: string[];
  estimatedDelivery: string;
  quantityClaimed: number;
  imageUrl: string;
  items: { title: string; quantity: number }[];
}

export interface AddonData {
  id: string;
  title: string;
  description: string;
  amount: number;
  shippingCost: Record<string, number> | number;
  shippingType: "NO_SHIPPING" | "WORLDWIDE" | "SELECTED_COUNTRIES";
  shippingCountries: string[];
  imageUrl: string | null;
  estimatedDelivery: string;
  limitedQuantity: number | null;
  quantityClaimed: number;
  includes: string[];
  // Creator-chosen grouping, used for the filter pills on the add-on step.
  // Add-on categories are their own vocabulary — Reward.type keeps them from
  // mixing with tier categories.
  category?: string | null;
}

export type Step = "rewards" | "addons" | "payment" | "success";
