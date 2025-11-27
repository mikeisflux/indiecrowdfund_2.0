// Project types
export type ProjectStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "APPROVED"
  | "LIVE"
  | "FUNDED"
  | "FAILED"
  | "CANCELLED";

export type ProjectType = "INDIVIDUAL" | "BUSINESS" | "NONPROFIT";

export type DurationType = "FIXED_DAYS" | "END_DATE";

export type PaymentProcessor = "STRIPE" | "CCBILL";

// Reward types
export type RewardType = "TIER" | "ADDON";

export type ShippingType = "WORLDWIDE" | "SELECTED_COUNTRIES" | "NO_SHIPPING";

export type Visibility = "PUBLIC" | "SECRET";

// Pledge types
export type PledgeStatus =
  | "PENDING"
  | "COMPLETED"
  | "FAILED"
  | "REFUNDED"
  | "CANCELLED"
  | "CHARGEBACK";

export type FulfillmentStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "SHIPPED"
  | "DELIVERED";

// Project categories
// Shipping countries list
export const SHIPPING_COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "GB", name: "United Kingdom" },
  { code: "AU", name: "Australia" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "JP", name: "Japan" },
  { code: "IT", name: "Italy" },
  { code: "ES", name: "Spain" },
  { code: "NL", name: "Netherlands" },
  { code: "BE", name: "Belgium" },
  { code: "CH", name: "Switzerland" },
  { code: "AT", name: "Austria" },
  { code: "SE", name: "Sweden" },
  { code: "NO", name: "Norway" },
  { code: "DK", name: "Denmark" },
  { code: "FI", name: "Finland" },
  { code: "IE", name: "Ireland" },
  { code: "NZ", name: "New Zealand" },
  { code: "SG", name: "Singapore" },
  { code: "HK", name: "Hong Kong" },
  { code: "KR", name: "South Korea" },
  { code: "MX", name: "Mexico" },
  { code: "BR", name: "Brazil" },
  { code: "AR", name: "Argentina" },
  { code: "CL", name: "Chile" },
  { code: "CO", name: "Colombia" },
  { code: "PL", name: "Poland" },
  { code: "CZ", name: "Czech Republic" },
  { code: "PT", name: "Portugal" },
  { code: "GR", name: "Greece" },
  { code: "RO", name: "Romania" },
  { code: "HU", name: "Hungary" },
  { code: "TH", name: "Thailand" },
  { code: "MY", name: "Malaysia" },
  { code: "PH", name: "Philippines" },
  { code: "ID", name: "Indonesia" },
  { code: "IN", name: "India" },
  { code: "ZA", name: "South Africa" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "IL", name: "Israel" },
  { code: "TW", name: "Taiwan" },
  { code: "CN", name: "China" },
  { code: "RU", name: "Russia" },
] as const;

export const PROJECT_CATEGORIES = [
  { value: "art", label: "Art" },
  { value: "comics", label: "Comics & Illustration" },
  { value: "crafts", label: "Crafts" },
  { value: "dance", label: "Dance & Theater" },
  { value: "design", label: "Design & Tech" },
  { value: "fashion", label: "Fashion" },
  { value: "film", label: "Film" },
  { value: "food", label: "Food & Beverages" },
  { value: "games", label: "Games" },
  { value: "journalism", label: "Journalism" },
  { value: "music", label: "Music" },
  { value: "photography", label: "Photography" },
  { value: "publishing", label: "Publishing" },
  { value: "technology", label: "Technology" },
] as const;

export type ProjectCategory = typeof PROJECT_CATEGORIES[number]["value"];

// Form data types for project builder
export interface ProjectBasicsData {
  title: string;
  subtitle?: string;
  category: string;
  location?: string;
  imageUrl?: string;
  videoUrl?: string;
  goalAmount: number;
  durationType: DurationType;
  durationDays?: number;
  endDate?: Date;
  launchDate?: Date;
}

export interface RewardData {
  id?: string;
  type: RewardType;
  title: string;
  description: string;
  amount: number;
  imageUrl?: string;
  estimatedDelivery?: Date;
  shippingType: ShippingType;
  shippingCountries: string[];
  shippingCost: number;
  quantityAvailable?: number;
  visibility: Visibility;
  availableFrom?: Date;
  availableUntil?: Date;
  items: RewardItemData[];
}

export interface RewardItemData {
  id?: string;
  title: string;
  description?: string;
  imageUrl?: string;
}

export interface ProjectStoryData {
  description: string;
  risks: string;
  usesAI: boolean;
  faqs: { question: string; answer: string }[];
}

export interface ProjectPeopleData {
  creatorName: string;
  creatorBio?: string;
  creatorLocation?: string;
  creatorTimezone?: string;
  creatorImageUrl?: string;
  creatorWebsites: string[];
  showNameOnly: boolean;
  collaborators: CollaboratorData[];
}

export interface CollaboratorData {
  email: string;
  title?: string;
  canEditProject: boolean;
  canManageCommunity: boolean;
  canCoordinateFulfillment: boolean;
  canConfigurePledgeManager: boolean;
}

export interface ProjectPaymentData {
  contactEmail: string;
  projectType: ProjectType;
  paymentProcessor: PaymentProcessor;
  hasAdultContent: boolean;
  hasRiskyContent: boolean;
  stripeAccountId?: string;
  ccbillAccountNumber?: string;
  ccbillSubaccount?: string;
  // Retailer settings
  allowRetailerPledges: boolean;
  retailerDiscount: number;
  retailerMinQuantity: number;
  retailerMaxQuantity?: number;
}

export interface ProjectPromotionData {
  prelaunchActive: boolean;
  prelaunchDescription?: string;
  customReferralTags: string[];
  googleAnalyticsId?: string;
  googleAnalyticsSecret?: string;
  metaPixelId?: string;
  metaConversionsToken?: string;
}

export interface FullProjectData {
  basics: ProjectBasicsData;
  rewards: RewardData[];
  story: ProjectStoryData;
  people: ProjectPeopleData;
  payment: ProjectPaymentData;
  promotion: ProjectPromotionData;
}

// API response types
export interface ApiResponse<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

// Dashboard types
export interface DashboardStats {
  totalPledged: number;
  fundingPercentage: number;
  backerCount: number;
  daysRemaining: number;
}

export interface FundingChartData {
  date: string;
  amount: number;
  cumulative: number;
}

export interface ReferrerData {
  referrer: string;
  type: "internal" | "external";
  pledges: number;
  percentage: number;
  amount: number;
}

export interface RewardPopularityData {
  rewardId: string;
  title: string;
  amount: number;
  backers: number;
  totalPledged: number;
}
