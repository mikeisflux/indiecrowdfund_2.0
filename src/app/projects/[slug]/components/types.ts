// TypeScript interfaces for project data

export interface ProjectCreator {
  id: string;
  name: string;
  image: string;
  bio: string;
  location: string;
  projectsCreated: number;
  projectsBacked: number;
}

export interface ProjectUpdate {
  id: string;
  title: string;
  content: string;
  createdAt: string | Date;
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
  backerCount: number;
  daysRemaining: number;
  endDate: string | Date;
  launchedAt: string | Date | null;
  creator: ProjectCreator;
  creatorId: string;
  usesAI: boolean;
  faqs: { question: string; answer: string }[];
  updates: ProjectUpdate[];
  comments: number;
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
  creator: string;
  imageUrl: string;
  daysLeft: number;
  fundedPercent: number;
  isProjectWeLove: boolean;
}

export interface CommentData {
  id: string;
  author: string;
  avatarUrl: string;
  isCreator: boolean;
  isSuperbacker: boolean;
  isPinned: boolean;
  createdAt: Date;
  content: string;
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
