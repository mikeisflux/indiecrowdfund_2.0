// Retailer interface
export interface Retailer {
  id: string;
  businessName: string;
  businessType: string;
  contactName: string;
  email: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  country: string;
  taxId: string | null;
  taxIdType: string | null;
  resaleCertificate: string | null;
  yearsInBusiness: number | null;
  numberOfLocations: number | null;
  annualRevenue: string | null;
  websiteUrl: string | null;
  status: string;
  createdAt: string;
  verifiedAt: string | null;
  verificationNotes: string | null;
  accessCode: string | null;
  _count?: {
    pledges: number;
  };
}

export interface RetailerStats {
  pending: number;
  underReview: number;
  approved: number;
  rejected: number;
  suspended: number;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface SatisfactionSurvey {
  id: string;
  retailerId: string;
  retailerPledgeId: string;
  rating: number | null;
  feedback: string | null;
  productQuality: number | null;
  shippingSpeed: number | null;
  packaging: number | null;
  communication: number | null;
  overallExperience: number | null;
  wouldRecommend: boolean | null;
  sentAt: string | null;
  completedAt: string | null;
  createdAt: string;
  retailer: {
    id: string;
    businessName: string;
    contactName: string;
    email: string;
  };
  order: {
    id: string;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
    status: string;
    invoiceNumber: string | null;
    project: {
      id: string;
      title: string;
      vanityUrl: string | null;
      slug: string;
      imageUrl: string | null;
    } | null;
    reward: {
      id: string;
      title: string;
      price: number;
    } | null;
  } | null;
}

export interface SurveyStats {
  total: number;
  completed: number;
  pending: number;
  avgRating: number;
}
