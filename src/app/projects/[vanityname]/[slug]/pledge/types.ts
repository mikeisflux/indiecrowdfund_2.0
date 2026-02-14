// Types for project and reward data
export interface ProjectData {
  id: string;
  title: string;
  slug: string;
  imageUrl: string;
  paymentProcessor: "STRIPE" | "DIVINITYCOIN";
  hasAdultContent: boolean;
  hasControversialContent?: boolean;
  estimatedDelivery: string;
  currentAmount: number;
  goalAmount: number;
  endDate: string | null;
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
}

export type Step = "rewards" | "addons" | "payment" | "success";
