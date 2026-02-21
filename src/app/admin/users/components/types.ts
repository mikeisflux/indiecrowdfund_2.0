// User interface
export interface User {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: string;
  retailerAccess: boolean;
  createdAt: string;
  emailVerified: string | null;
  projectCount: number;
  pledgeCount: number;
  lockedAt: string | null;
  lockedReason: string | null;
  divinityCoinBalance: number;
}

export interface UserStats {
  total: number;
  users: number;
  admins: number;
  superAdmins: number;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// User pledge interface for backer history
export interface UserPledge {
  id: string;
  amount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  chargedImmediately: boolean;
  confirmationEmailSent: boolean;
  stripePaymentMethodId: string | null;
  project: {
    id: string;
    title: string;
    slug: string;
    imageUrl: string | null;
    status: string;
    creatorVanityUrl?: string | null;
  };
  reward: {
    id: string;
    title: string;
    amount: number;
  } | null;
}

// Email log interface for email history
export interface EmailLogEntry {
  id: string;
  type: string;
  subject: string | null;
  recipientEmail: string;
  sentAt: string;
  htmlContent: string | null;
  project: {
    id: string;
    title: string;
    slug: string;
  } | null;
  pledge: {
    id: string;
    amount: number;
    status: string;
  } | null;
}

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
  yearsInBusiness: number | null;
  numberOfLocations: number | null;
  annualRevenue: string | null;
  websiteUrl: string | null;
  status: string;
  createdAt: string;
  ordersCount?: number;
  verifiedAt?: string | null;
  verificationNotes?: string | null;
}

export interface RetailerStats {
  pending: number;
  underReview: number;
  approved: number;
  rejected: number;
  total: number;
}
