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

export type PaymentProcessor = "STRIPE" | "DIVINITYCOIN";

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
  {
    value: "art",
    label: "Art",
    subcategories: [
      { value: "ceramics", label: "Ceramics" },
      { value: "conceptual-art", label: "Conceptual Art" },
      { value: "digital-art", label: "Digital Art" },
      { value: "illustration", label: "Illustration" },
      { value: "installations", label: "Installations" },
      { value: "mixed-media", label: "Mixed Media" },
      { value: "painting", label: "Painting" },
      { value: "performance-art", label: "Performance Art" },
      { value: "public-art", label: "Public Art" },
      { value: "sculpture", label: "Sculpture" },
      { value: "social-practice", label: "Social Practice" },
      { value: "textiles", label: "Textiles" },
      { value: "video-art", label: "Video Art" },
    ],
  },
  {
    value: "comics",
    label: "Comics",
    subcategories: [
      { value: "anthologies", label: "Anthologies" },
      { value: "comic-books", label: "Comic Books" },
      { value: "events", label: "Events" },
      { value: "graphic-novels", label: "Graphic Novels" },
      { value: "web-comics", label: "Web Comics" },
    ],
  },
  // TODO: Reactivate these categories in the future
  // {
  //   value: "crafts",
  //   label: "Crafts",
  //   subcategories: [
  //     { value: "candles", label: "Candles" },
  //     { value: "crochet", label: "Crochet" },
  //     { value: "diy", label: "DIY" },
  //     { value: "embroidery", label: "Embroidery" },
  //     { value: "glass", label: "Glass" },
  //     { value: "knitting", label: "Knitting" },
  //     { value: "pottery", label: "Pottery" },
  //     { value: "printing", label: "Printing" },
  //     { value: "quilts", label: "Quilts" },
  //     { value: "stationery", label: "Stationery" },
  //     { value: "taxidermy", label: "Taxidermy" },
  //     { value: "weaving", label: "Weaving" },
  //     { value: "woodworking", label: "Woodworking" },
  //   ],
  // },
  // {
  //   value: "dance",
  //   label: "Dance",
  //   subcategories: [
  //     { value: "performances", label: "Performances" },
  //     { value: "residencies", label: "Residencies" },
  //     { value: "spaces", label: "Spaces" },
  //     { value: "workshops", label: "Workshops" },
  //   ],
  // },
  // {
  //   value: "design",
  //   label: "Design",
  //   subcategories: [
  //     { value: "architecture", label: "Architecture" },
  //     { value: "civil-design", label: "Civil Design" },
  //     { value: "graphic-design", label: "Graphic Design" },
  //     { value: "interactive-design", label: "Interactive Design" },
  //     { value: "product-design", label: "Product Design" },
  //     { value: "toys", label: "Toys" },
  //     { value: "typography", label: "Typography" },
  //   ],
  // },
  // {
  //   value: "fashion",
  //   label: "Fashion",
  //   subcategories: [
  //     { value: "accessories", label: "Accessories" },
  //     { value: "apparel", label: "Apparel" },
  //     { value: "childrens-wear", label: "Children's Wear" },
  //     { value: "couture", label: "Couture" },
  //     { value: "footwear", label: "Footwear" },
  //     { value: "jewelry", label: "Jewelry" },
  //     { value: "pet-fashion", label: "Pet Fashion" },
  //     { value: "ready-to-wear", label: "Ready-to-Wear" },
  //   ],
  // },
  {
    value: "film",
    label: "Film & Video",
    subcategories: [
      { value: "action", label: "Action" },
      { value: "animation", label: "Animation" },
      { value: "comedy", label: "Comedy" },
      { value: "documentary", label: "Documentary" },
      { value: "drama", label: "Drama" },
      { value: "experimental", label: "Experimental" },
      { value: "family", label: "Family" },
      { value: "fantasy", label: "Fantasy" },
      { value: "festivals", label: "Festivals" },
      { value: "horror", label: "Horror" },
      { value: "movie-theaters", label: "Movie Theaters" },
      { value: "music-videos", label: "Music Videos" },
      { value: "narrative-film", label: "Narrative Film" },
      { value: "nsfw", label: "NSFW" },
      { value: "romance", label: "Romance" },
      { value: "science-fiction", label: "Science Fiction" },
      { value: "shorts", label: "Shorts" },
      { value: "television", label: "Television" },
      { value: "thrillers", label: "Thrillers" },
      { value: "web-series", label: "Web Series" },
    ],
  },
  // TODO: Reactivate Food category in the future
  // {
  //   value: "food",
  //   label: "Food",
  //   subcategories: [
  //     { value: "bacon", label: "Bacon" },
  //     { value: "community-gardens", label: "Community Gardens" },
  //     { value: "cookbooks", label: "Cookbooks" },
  //     { value: "drinks", label: "Drinks" },
  //     { value: "events", label: "Events" },
  //     { value: "farmers-markets", label: "Farmers Markets" },
  //     { value: "farms", label: "Farms" },
  //     { value: "food-trucks", label: "Food Trucks" },
  //     { value: "restaurants", label: "Restaurants" },
  //     { value: "small-batch", label: "Small Batch" },
  //     { value: "spaces", label: "Spaces" },
  //     { value: "vegan", label: "Vegan" },
  //   ],
  // },
  {
    value: "games",
    label: "Games",
    subcategories: [
      { value: "gaming-hardware", label: "Gaming Hardware" },
      { value: "live-games", label: "Live Games" },
      { value: "mobile-games", label: "Mobile Games" },
      { value: "playing-cards", label: "Playing Cards" },
      { value: "puzzles", label: "Puzzles" },
      { value: "tabletop-games", label: "Tabletop Games" },
      { value: "video-games", label: "Video Games" },
    ],
  },
  // TODO: Reactivate Journalism category in the future
  // {
  //   value: "journalism",
  //   label: "Journalism",
  //   subcategories: [
  //     { value: "audio", label: "Audio" },
  //     { value: "photo", label: "Photo" },
  //     { value: "print", label: "Print" },
  //     { value: "video", label: "Video" },
  //     { value: "web", label: "Web" },
  //   ],
  // },
  {
    value: "music",
    label: "Music",
    subcategories: [
      { value: "blues", label: "Blues" },
      { value: "chiptune", label: "Chiptune" },
      { value: "classical-music", label: "Classical Music" },
      { value: "comedy", label: "Comedy" },
      { value: "country-folk", label: "Country & Folk" },
      { value: "electronic-music", label: "Electronic Music" },
      { value: "faith", label: "Faith" },
      { value: "hip-hop", label: "Hip-Hop" },
      { value: "indie-rock", label: "Indie Rock" },
      { value: "jazz", label: "Jazz" },
      { value: "kids", label: "Kids" },
      { value: "latin", label: "Latin" },
      { value: "metal", label: "Metal" },
      { value: "pop", label: "Pop" },
      { value: "punk", label: "Punk" },
      { value: "r-and-b", label: "R&B" },
      { value: "rock", label: "Rock" },
    ],
  },
  // TODO: Reactivate Photography category in the future
  // {
  //   value: "photography",
  //   label: "Photography",
  //   subcategories: [
  //     { value: "animals", label: "Animals" },
  //     { value: "fine-art", label: "Fine Art" },
  //     { value: "nature", label: "Nature" },
  //     { value: "people", label: "People" },
  //     { value: "photobooks", label: "Photobooks" },
  //     { value: "places", label: "Places" },
  //   ],
  // },
  {
    value: "publishing",
    label: "Publishing",
    subcategories: [
      { value: "academic", label: "Academic" },
      { value: "anthologies", label: "Anthologies" },
      { value: "art-books", label: "Art Books" },
      { value: "calendars", label: "Calendars" },
      { value: "childrens-books", label: "Children's Books" },
      { value: "comedy", label: "Comedy" },
      { value: "fiction", label: "Fiction" },
      { value: "letterpress", label: "Letterpress" },
      { value: "literary-journals", label: "Literary Journals" },
      { value: "literary-spaces", label: "Literary Spaces" },
      { value: "nonfiction", label: "Nonfiction" },
      { value: "periodicals", label: "Periodicals" },
      { value: "poetry", label: "Poetry" },
      { value: "radio-podcasts", label: "Radio & Podcasts" },
      { value: "translations", label: "Translations" },
      { value: "young-adult", label: "Young Adult" },
      { value: "zines", label: "Zines" },
    ],
  },
  // TODO: Reactivate Technology category in the future
  // {
  //   value: "technology",
  //   label: "Technology",
  //   subcategories: [
  //     { value: "3d-printing", label: "3D Printing" },
  //     { value: "apps", label: "Apps" },
  //     { value: "camera-equipment", label: "Camera Equipment" },
  //     { value: "diy-electronics", label: "DIY Electronics" },
  //     { value: "fabrication-tools", label: "Fabrication Tools" },
  //     { value: "flight", label: "Flight" },
  //     { value: "gadgets", label: "Gadgets" },
  //     { value: "hardware", label: "Hardware" },
  //     { value: "makerspaces", label: "Makerspaces" },
  //     { value: "robots", label: "Robots" },
  //     { value: "software", label: "Software" },
  //     { value: "sound", label: "Sound" },
  //     { value: "space-exploration", label: "Space Exploration" },
  //     { value: "wearables", label: "Wearables" },
  //     { value: "web", label: "Web" },
  //   ],
  // },
  // TODO: Reactivate Theater category in the future
  // {
  //   value: "theater",
  //   label: "Theater",
  //   subcategories: [
  //     { value: "comedy", label: "Comedy" },
  //     { value: "experimental", label: "Experimental" },
  //     { value: "festivals", label: "Festivals" },
  //     { value: "immersive", label: "Immersive" },
  //     { value: "musical", label: "Musical" },
  //     { value: "plays", label: "Plays" },
  //     { value: "spaces", label: "Spaces" },
  //   ],
  // },
] as const;

export type ProjectCategory = typeof PROJECT_CATEGORIES[number]["value"];
export type ProjectSubcategory = typeof PROJECT_CATEGORIES[number]["subcategories"][number]["value"];

// Form data types for project builder
export interface ProjectBasicsData {
  title: string;
  subtitle?: string;
  slug?: string;
  category: string;
  subcategory?: string;
  secondaryCategory?: string;
  secondarySubcategory?: string;
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
  shippingCost: Record<string, number>;  // Per-country rates: { "US": 5, "CA": 8 }
  quantityAvailable?: number;
  quantityClaimed?: number;
  visibility: Visibility;
  secretToken?: string;  // For secret rewards - only accessible via this token
  availableFrom?: Date;
  availableUntil?: Date;
  items: RewardItemData[];
  // Live campaign fields
  isEnded?: boolean;
  endedAt?: Date;
  backerCount?: number;
}

export interface RewardItemData {
  id?: string;
  projectItemId?: string; // Reference to ProjectItem for matching with global items list
  title: string;
  description?: string;
  imageUrl?: string;
  isEnded?: boolean; // True if item has been ended (no longer available for new pledges)
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
  id?: string;
  email: string;
  title?: string;
  canEditProject: boolean;
  canManageCommunity: boolean;
  canCoordinateFulfillment: boolean;
  canConfigurePledgeManager: boolean;
}

export interface ProjectPaymentData {
  contactEmail?: string;
  contactEmailConfirmed?: boolean;
  projectType: ProjectType;
  paymentProcessor: PaymentProcessor;
  hasAdultContent: boolean;
  hasRiskyContent: boolean;
  promoContentSfw: boolean; // Agrees that promotional video/image/title are SFW
  stripeAccountId?: string;
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
