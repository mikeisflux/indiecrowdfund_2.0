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
  category: "",
  items: [],
};

// Seed suggestions for the reward Category field. Only a starting point for
// the datalist — the field is free text, and categories the creator has
// already used on the project are listed ahead of these.
export const DEFAULT_CATEGORIES = [
  "Covers",
  "Sets",
  "Box Sets",
  "Upgrades",
  "Prints",
  "Originals",
  "Digital",
  "Merch",
];

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

// Columns for the Rewards / Add-ons CSV export.
//
// Deliberately identical to what handleImportRewards reads, so a creator can
// export, edit in a spreadsheet, and import the same file back. Anything not
// in this list is not round-trippable and is left out rather than exported as
// a column that silently does nothing on the way back in — notably the reward
// image, which is uploaded by hand and has no CSV representation.
export const REWARD_CSV_HEADERS = [
  "title",
  "description",
  "category",
  "amount",
  "shippingType",
  "shippingCost",
  "quantityAvailable",
  "visibility",
  "estimatedDeliveryMonth",
  "estimatedDeliveryYear",
  "itemTitles",
] as const;
