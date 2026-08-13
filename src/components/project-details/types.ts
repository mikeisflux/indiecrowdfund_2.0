// TypeScript interfaces for project data

export interface ProjectCreatorRatings {
  avg: {
    overall: number | null;
    delivery: number | null;
    quality: number | null;
    communication: number | null;
  };
  count: number;
}

export interface ProjectCreator {
  id: string;
  name: string;
  image: string;
  bio: string;
  location: string;
  vanityUrl?: string;
  projectsCreated: number;
  projectsBacked: number;
  ratings?: ProjectCreatorRatings;
}

export interface ProjectUpdate {
  id: string;
  title: string;
  content: string;
  createdAt: string | Date;
}

// Mirrors the resolveCampaignDisplay return shape from
// src/lib/currency.ts. Kept here as a duplicate (rather than imported)
// so client components don't transitively pull in the Prisma client
// types via the currency module's db dependency.
export interface CampaignAmountDisplay {
  currency: string;
  symbol: string;
  primaryFormatted: string;
  usdFormatted: string;
  showUsdSecondary: boolean;
}

export interface ProjectData {
  id: string;
  title: string;
  subtitle: string;
  slug: string;
  category: string;
  subcategory: string;
  location: string;
  imageUrl: string;
  videoUrl: string;
  isProjectWeLove: boolean;
  description: string;
  risks: string;
  goalAmount: number;
  currentAmount: number;
  // Localized currency display, computed server-side from Project.location
  // by /api/projects/vanity/[vanityname]/[slug]. Falls back to USD-only
  // (showUsdSecondary: false) for US / unknown locations; for non-US
  // (e.g. UK creators) currency/symbol/primaryFormatted reflect the local
  // currency with USD as the secondary line below.
  currentAmountDisplay?: CampaignAmountDisplay;
  goalAmountDisplay?: CampaignAmountDisplay;
  backerCount: number;
  daysRemaining: number;
  endDate: string | Date;
  launchedAt: string | Date | null;
  // 1 = original three-column layout, 2 = full-width story + reward grid.
  // Absent on older cached payloads, so callers treat undefined as 1.
  layoutVersion?: number;
  // Interior preview pages, in reading order (layout v2 only).
  previewImages?: string[];
  creator: ProjectCreator;
  creatorId: string;
  usesAI: boolean;
  faqs: { question: string; answer: string }[];
  updates: ProjectUpdate[];
  comments: number;
  paymentProcessor?: "STRIPE" | "DIVINITYCOIN" | "PAYPAL";
  campaignType?: "ALL_OR_NOTHING" | "KEEP_IT_ALL";
}

export interface RewardItem {
  id: string;
  title: string;
  quantity: number;
}

export interface RewardBacker {
  id: string;
  name: string;
  image: string | null;
}

export interface RewardData {
  id: string;
  type: string;
  title: string;
  description: string;
  amount: number;
  estimatedDelivery: string | Date | null;
  shippingType: string;
  shippingLocation: string;
  shippingCost: Record<string, number>; // Per-country rates: { "US": 5, "CA": 8 }
  shippingCountries: string[];
  quantityAvailable: number | null;
  quantityClaimed: number;
  backerCount: number;
  backers: RewardBacker[];
  imageUrl: string;
  items: RewardItem[];
  isEnded: boolean;
  endedAt: string | Date | null;
}

export interface AddonData {
  id: string;
  title: string;
  description: string;
  amount: number;
  imageUrl: string;
  shippingCost: Record<string, number>; // Per-country rates
  shippingCountries: string[];
}

export interface SimilarProject {
  id: string;
  title: string;
  slug: string;
  vanityUrl: string | null;
  creator: string;
  imageUrl: string | null;
  daysLeft: number;
  endDate: string | null;
  fundedPercent: number;
  isProjectWeLove: boolean;
}

export interface CommentReply {
  id: string;
  userId: string;
  author: string;
  avatarUrl: string | null;
  isCreator: boolean;
  isCollaborator: boolean;
  isSuperbacker: boolean;
  createdAt: Date | string;
  content: string;
}

export interface CommentData {
  id: string;
  userId: string;
  author: string;
  avatarUrl: string | null;
  isCreator: boolean;
  isCollaborator: boolean;
  isSuperbacker: boolean;
  isPinned: boolean;
  createdAt: Date | string;
  content: string;
  replies?: CommentReply[];
}

export interface StoryNavItem {
  id: string;
  text: string;
  level: number;
}

export interface ExistingPledge {
  id: string;
  amount: number;
  status: string;
  canCancel: boolean;
  canIncrease: boolean;
  reward: { title: string } | null;
}

export type TabValue = "campaign" | "rewards" | "creator" | "faq" | "updates" | "comments" | "community";

// Initial empty state for project
export const initialProject: ProjectData = {
  id: "",
  title: "Loading...",
  subtitle: "",
  slug: "",
  category: "",
  subcategory: "",
  location: "",
  imageUrl: "",
  videoUrl: "",
  isProjectWeLove: false,
  description: "",
  risks: "",
  goalAmount: 0,
  currentAmount: 0,
  backerCount: 0,
  daysRemaining: 0,
  endDate: new Date(),
  launchedAt: new Date(),
  layoutVersion: 1,
  creator: {
    id: "",
    name: "",
    image: "",
    bio: "",
    location: "",
    projectsCreated: 0,
    projectsBacked: 0,
  },
  creatorId: "",
  usesAI: false,
  faqs: [],
  updates: [],
  comments: 0,
};
