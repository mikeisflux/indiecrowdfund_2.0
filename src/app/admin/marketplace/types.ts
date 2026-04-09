export interface MarketplaceBook {
  id: string;
  title: string;
  slug: string;
  description: string;
  mediaCategory: string;
  category: string | null;
  coverImage: string | null;
  promoVideoUrl: string | null;
  pdfFileUrl: string;
  audioFileUrl: string | null;
  videoFileUrl: string | null;
  price: number;
  currency: string;
  paymentProcessor: string;
  isNsfw: boolean;
  status: string;
  isFeatured: boolean;
  isStaffPick: boolean;
  featuredOrder: number | null;
  staffPickOrder: number | null;
  submittedAt: string | null;
  createdAt: string;
  creator: {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
  };
  company: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

export interface ReviewHistory {
  id: string;
  bookId: string;
  bookTitle: string;
  action: string;
  notes: string | null;
  reviewedBy: string;
  createdAt: string;
}

export interface Stats {
  pending: number;
  live: number;
  approvedToday: number;
  rejectedToday: number;
  totalRevenue: number;
  totalSales: number;
}

export interface Transaction {
  id: string;
  book: {
    id: string;
    title: string;
    slug: string;
    coverImage: string | null;
    creator: {
      id: string;
      name: string;
      email: string;
    };
  };
  buyer: {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
  };
  amount: number;
  platformFee: number;
  creatorPayout: number;
  currency: string;
  paymentProcessor: string;
  transactionId: string | null;
  status: string;
  createdAt: string;
  completedAt: string | null;
  refundedAt: string | null;
  refundReason: string | null;
}

export interface TransactionStats {
  totalRevenue: number;
  totalPlatformFees: number;
  totalCreatorPayouts: number;
  totalTransactions: number;
  todayRevenue: number;
  todayPlatformFees: number;
  todayTransactions: number;
}

export interface PdfBook {
  id: string;
  title: string;
  slug: string;
  status: string;
  pdf: {
    url: string | null;
    fileName: string | null;
    fileSize: number | null;
    fileSizeFormatted: string | null;
    coverUrl: string | null;
    totalPages: number | null;
    hasUrl: boolean;
    hasSize: boolean;
    r2Exists?: boolean | null;
  };
  coverImageUrl: string | null;
  price: number;
  purchaseCount: number;
  createdAt: string;
  publishedAt: string | null;
  creator: {
    id: string;
    name: string;
    email: string;
  };
  issues: string[];
}

export interface PdfStats {
  total: number;
  withPdf: number;
  missingPdf: number;
  missingSize: number;
  liveWithIssues: number;
}
