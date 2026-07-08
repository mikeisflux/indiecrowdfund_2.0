import { RewardItemData, RewardData } from "@/types";

export const defaultItem: RewardItemData = {
  title: "",
  description: "",
  imageUrl: "",
};

export const defaultReward: RewardData = {
  type: "TIER",
  title: "",
  description: "",
  amount: 1,
  shippingType: "NO_SHIPPING",
  shippingCountries: ["US"],
  shippingCost: {},
  visibility: "PUBLIC",
  items: [],
};

// Previous projects type for import feature
export interface PreviousProjectForImport {
  id: string;
  title: string;
  rewards: { title: string; amount: number; description: string }[];
}

// Generate month options
export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Generate year options (current year + 5 years)
const currentYear = new Date().getFullYear();
export const YEARS = Array.from({ length: 6 }, (_, i) => currentYear + i);
