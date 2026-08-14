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

export type PaymentProcessor = "STRIPE" | "DIVINITYCOIN" | "PAYPAL" | "PAYPAL_CONNECT" | "WHOP";

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
  { code: "WW", name: "Worldwide" },
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

// Comprehensive list of all countries (ISO 3166-1 alpha-2) for address forms
export const ALL_COUNTRIES = [
  { code: "AF", name: "Afghanistan" },
  { code: "AL", name: "Albania" },
  { code: "DZ", name: "Algeria" },
  { code: "AD", name: "Andorra" },
  { code: "AO", name: "Angola" },
  { code: "AG", name: "Antigua and Barbuda" },
  { code: "AR", name: "Argentina" },
  { code: "AM", name: "Armenia" },
  { code: "AU", name: "Australia" },
  { code: "AT", name: "Austria" },
  { code: "AZ", name: "Azerbaijan" },
  { code: "BS", name: "Bahamas" },
  { code: "BH", name: "Bahrain" },
  { code: "BD", name: "Bangladesh" },
  { code: "BB", name: "Barbados" },
  { code: "BY", name: "Belarus" },
  { code: "BE", name: "Belgium" },
  { code: "BZ", name: "Belize" },
  { code: "BJ", name: "Benin" },
  { code: "BT", name: "Bhutan" },
  { code: "BO", name: "Bolivia" },
  { code: "BA", name: "Bosnia and Herzegovina" },
  { code: "BW", name: "Botswana" },
  { code: "BR", name: "Brazil" },
  { code: "BN", name: "Brunei" },
  { code: "BG", name: "Bulgaria" },
  { code: "BF", name: "Burkina Faso" },
  { code: "BI", name: "Burundi" },
  { code: "CV", name: "Cabo Verde" },
  { code: "KH", name: "Cambodia" },
  { code: "CM", name: "Cameroon" },
  { code: "CA", name: "Canada" },
  { code: "CF", name: "Central African Republic" },
  { code: "TD", name: "Chad" },
  { code: "CL", name: "Chile" },
  { code: "CN", name: "China" },
  { code: "CO", name: "Colombia" },
  { code: "KM", name: "Comoros" },
  { code: "CG", name: "Congo" },
  { code: "CD", name: "Congo (DRC)" },
  { code: "CR", name: "Costa Rica" },
  { code: "CI", name: "Côte d'Ivoire" },
  { code: "HR", name: "Croatia" },
  { code: "CU", name: "Cuba" },
  { code: "CY", name: "Cyprus" },
  { code: "CZ", name: "Czech Republic" },
  { code: "DK", name: "Denmark" },
  { code: "DJ", name: "Djibouti" },
  { code: "DM", name: "Dominica" },
  { code: "DO", name: "Dominican Republic" },
  { code: "EC", name: "Ecuador" },
  { code: "EG", name: "Egypt" },
  { code: "SV", name: "El Salvador" },
  { code: "GQ", name: "Equatorial Guinea" },
  { code: "ER", name: "Eritrea" },
  { code: "EE", name: "Estonia" },
  { code: "SZ", name: "Eswatini" },
  { code: "ET", name: "Ethiopia" },
  { code: "FJ", name: "Fiji" },
  { code: "FI", name: "Finland" },
  { code: "FR", name: "France" },
  { code: "GA", name: "Gabon" },
  { code: "GM", name: "Gambia" },
  { code: "GE", name: "Georgia" },
  { code: "DE", name: "Germany" },
  { code: "GH", name: "Ghana" },
  { code: "GR", name: "Greece" },
  { code: "GD", name: "Grenada" },
  { code: "GT", name: "Guatemala" },
  { code: "GN", name: "Guinea" },
  { code: "GW", name: "Guinea-Bissau" },
  { code: "GY", name: "Guyana" },
  { code: "HT", name: "Haiti" },
  { code: "HN", name: "Honduras" },
  { code: "HK", name: "Hong Kong" },
  { code: "HU", name: "Hungary" },
  { code: "IS", name: "Iceland" },
  { code: "IN", name: "India" },
  { code: "ID", name: "Indonesia" },
  { code: "IR", name: "Iran" },
  { code: "IQ", name: "Iraq" },
  { code: "IE", name: "Ireland" },
  { code: "IL", name: "Israel" },
  { code: "IT", name: "Italy" },
  { code: "JM", name: "Jamaica" },
  { code: "JP", name: "Japan" },
  { code: "JO", name: "Jordan" },
  { code: "KZ", name: "Kazakhstan" },
  { code: "KE", name: "Kenya" },
  { code: "KI", name: "Kiribati" },
  { code: "KP", name: "North Korea" },
  { code: "KR", name: "South Korea" },
  { code: "KW", name: "Kuwait" },
  { code: "KG", name: "Kyrgyzstan" },
  { code: "LA", name: "Laos" },
  { code: "LV", name: "Latvia" },
  { code: "LB", name: "Lebanon" },
  { code: "LS", name: "Lesotho" },
  { code: "LR", name: "Liberia" },
  { code: "LY", name: "Libya" },
  { code: "LI", name: "Liechtenstein" },
  { code: "LT", name: "Lithuania" },
  { code: "LU", name: "Luxembourg" },
  { code: "MO", name: "Macao" },
  { code: "MG", name: "Madagascar" },
  { code: "MW", name: "Malawi" },
  { code: "MY", name: "Malaysia" },
  { code: "MV", name: "Maldives" },
  { code: "ML", name: "Mali" },
  { code: "MT", name: "Malta" },
  { code: "MH", name: "Marshall Islands" },
  { code: "MR", name: "Mauritania" },
  { code: "MU", name: "Mauritius" },
  { code: "MX", name: "Mexico" },
  { code: "FM", name: "Micronesia" },
  { code: "MD", name: "Moldova" },
  { code: "MC", name: "Monaco" },
  { code: "MN", name: "Mongolia" },
  { code: "ME", name: "Montenegro" },
  { code: "MA", name: "Morocco" },
  { code: "MZ", name: "Mozambique" },
  { code: "MM", name: "Myanmar" },
  { code: "NA", name: "Namibia" },
  { code: "NR", name: "Nauru" },
  { code: "NP", name: "Nepal" },
  { code: "NL", name: "Netherlands" },
  { code: "NZ", name: "New Zealand" },
  { code: "NI", name: "Nicaragua" },
  { code: "NE", name: "Niger" },
  { code: "NG", name: "Nigeria" },
  { code: "MK", name: "North Macedonia" },
  { code: "NO", name: "Norway" },
  { code: "OM", name: "Oman" },
  { code: "PK", name: "Pakistan" },
  { code: "PW", name: "Palau" },
  { code: "PS", name: "Palestine" },
  { code: "PA", name: "Panama" },
  { code: "PG", name: "Papua New Guinea" },
  { code: "PY", name: "Paraguay" },
  { code: "PE", name: "Peru" },
  { code: "PH", name: "Philippines" },
  { code: "PL", name: "Poland" },
  { code: "PT", name: "Portugal" },
  { code: "PR", name: "Puerto Rico" },
  { code: "QA", name: "Qatar" },
  { code: "RO", name: "Romania" },
  { code: "RU", name: "Russia" },
  { code: "RW", name: "Rwanda" },
  { code: "KN", name: "Saint Kitts and Nevis" },
  { code: "LC", name: "Saint Lucia" },
  { code: "VC", name: "Saint Vincent and the Grenadines" },
  { code: "WS", name: "Samoa" },
  { code: "SM", name: "San Marino" },
  { code: "ST", name: "São Tomé and Príncipe" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "SN", name: "Senegal" },
  { code: "RS", name: "Serbia" },
  { code: "SC", name: "Seychelles" },
  { code: "SL", name: "Sierra Leone" },
  { code: "SG", name: "Singapore" },
  { code: "SK", name: "Slovakia" },
  { code: "SI", name: "Slovenia" },
  { code: "SB", name: "Solomon Islands" },
  { code: "SO", name: "Somalia" },
  { code: "ZA", name: "South Africa" },
  { code: "SS", name: "South Sudan" },
  { code: "ES", name: "Spain" },
  { code: "LK", name: "Sri Lanka" },
  { code: "SD", name: "Sudan" },
  { code: "SR", name: "Suriname" },
  { code: "SE", name: "Sweden" },
  { code: "CH", name: "Switzerland" },
  { code: "SY", name: "Syria" },
  { code: "TW", name: "Taiwan" },
  { code: "TJ", name: "Tajikistan" },
  { code: "TZ", name: "Tanzania" },
  { code: "TH", name: "Thailand" },
  { code: "TL", name: "Timor-Leste" },
  { code: "TG", name: "Togo" },
  { code: "TO", name: "Tonga" },
  { code: "TT", name: "Trinidad and Tobago" },
  { code: "TN", name: "Tunisia" },
  { code: "TR", name: "Turkey" },
  { code: "TM", name: "Turkmenistan" },
  { code: "TV", name: "Tuvalu" },
  { code: "UG", name: "Uganda" },
  { code: "UA", name: "Ukraine" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "GB", name: "United Kingdom" },
  { code: "US", name: "United States" },
  { code: "UY", name: "Uruguay" },
  { code: "UZ", name: "Uzbekistan" },
  { code: "VU", name: "Vanuatu" },
  { code: "VA", name: "Vatican City" },
  { code: "VE", name: "Venezuela" },
  { code: "VN", name: "Vietnam" },
  { code: "YE", name: "Yemen" },
  { code: "ZM", name: "Zambia" },
  { code: "ZW", name: "Zimbabwe" },
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
  // Creator-chosen grouping label ("Covers", "Box Sets"). Drives the filter
  // pills on layout-v2 campaign pages. Empty/undefined = uncategorised.
  category?: string;
  estimatedDelivery?: Date;
  shippingType: ShippingType;
  shippingCountries: string[];
  shippingCost: Record<string, number>;  // Per-country rates: { "US": 5, "CA": 8 }
  quantityAvailable?: number;
  quantityClaimed?: number;
  // Shared stock: when set, this reward draws from the linked reward's
  // quantity pool rather than counting on its own.
  sharedStockWithId?: string;
  // Cross-project import only. A pool is per-campaign, so the source's
  // sharedStockWithId means nothing in the target — but neither copy has a
  // real id until it's saved, so the pair can't be linked client-side either.
  // These carry the intent through the batch save, where the server resolves
  // clientKey -> new id and writes the real link. Both ends must be in the
  // same import for it to resolve; otherwise it's dropped.
  clientKey?: string;
  sharedStockWithClientKey?: string;
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
  // Interior preview PDF — rasterised client-side and rendered in the
  // page-turn reader on layout-v2 campaign pages.
  previewPdfUrl?: string;
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
  campaignType: "ALL_OR_NOTHING" | "KEEP_IT_ALL";
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
