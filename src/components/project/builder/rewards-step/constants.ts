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
  // Empty, not ["US"]. Every new reward starts as NO_SHIPPING, so seeding a
  // country list here stamped {US} onto every digital reward ever created —
  // which the project page then rendered as "Ships to: US" and backers read
  // as US-only. Countries are chosen by the creator when they pick a physical
  // shipping type; a digital reward has none.
  shippingCountries: [],
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
