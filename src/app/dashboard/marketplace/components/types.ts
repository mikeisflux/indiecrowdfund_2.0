export interface MarketplaceBook {
  id: string;
  title: string;
  slug: string;
  coverImage: string | null;
  price: number;
  currency: string;
  status: "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "LIVE" | "REJECTED" | "ARCHIVED";
  isFeatured: boolean;
  isStaffPick: boolean;
  stats: {
    purchases: number;
    views: number;
    revenue: number;
  };
  createdAt: string;
  publishedAt: string | null;
  rejectionReason: string | null;
}

export interface CompanyProfile {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  logo: string | null;
  banner: string | null;
  isVerified: boolean;
  stats: {
    books: number;
    totalSales: number;
    totalRevenue: number;
  };
}

export interface MarketplaceStats {
  totalBooks: number;
  liveBooks: number;
  pendingBooks: number;
  totalRevenue: number;
  totalSales: number;
  monthlyRevenue: number;
  monthlySales: number;
}

export interface DiscountCodeRedemption {
  id: string;
  redeemedAt: string;
  discountAmount: number;
  customer: {
    id: string;
    name: string | null;
    email: string;
  };
  book: {
    id: string;
    title: string;
    slug: string;
  };
}

export interface DiscountCode {
  id: string;
  code: string;
  type: "FREE_BOOK" | "PERCENTAGE" | "FIXED_AMOUNT";
  validFrom: string;
  validUntil: string;
  maxRedemptions: number;
  usageCount: number;
  isActive: boolean;
  createdAt: string;
  bookId: string | null;
  book: {
    id: string;
    title: string;
    slug: string;
    coverImageUrl: string | null;
  } | null;
  redemptions: DiscountCodeRedemption[];
}

export interface LiveBook {
  id: string;
  title: string;
  slug: string;
  coverImageUrl: string | null;
  price: number;
}
