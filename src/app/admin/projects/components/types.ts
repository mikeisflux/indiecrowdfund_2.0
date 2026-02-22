export interface Creator {
  id: string;
  name: string | null;
  email: string;
  emailVerified: Date | null;
  createdAt: string;
  vanityUrl?: string | null;
  _count: {
    createdProjects: number;
  };
}

export interface Project {
  id: string;
  title: string;
  subtitle: string | null;
  slug: string;
  description: string | null;
  category: string;
  goalAmount: number;
  currentAmount: number;
  backerCount: number;
  currency: string;
  durationType: "FIXED_DAYS" | "END_DATE" | null;
  durationDays: number | null;
  endDate: string | null;
  launchDate: string | null;
  videoUrl: string | null;
  imageUrl: string | null;
  risks: string | null;
  status: string;
  prelaunchActive: boolean;
  paymentProcessor: "STRIPE" | "DIVINITYCOIN" | null;
  hasAdultContent: boolean;
  hasRiskyContent: boolean;
  promoContentSfw: boolean;
  createdAt: string;
  creator: Creator;
  rewards: { id: string }[];
  _count: {
    pledges: number;
    followers?: number;
  };
  fulfillment?: {
    total: number;
    notStarted: number;
    inProgress: number;
    shipped: number;
    delivered: number;
  };
}

export interface ReviewHistory {
  id: string;
  projectId: string;
  action: string;
  notes: string | null;
  internalNotes: string | null;
  rejectionReason: string | null;
  previousStatus: string | null;
  newStatus: string | null;
  createdAt: string;
  project: {
    id: string;
    title: string;
    slug: string;
    status: string;
    creator: {
      name: string | null;
      email: string;
      vanityUrl?: string | null;
    };
  };
  reviewer: {
    name: string | null;
    email: string;
  } | null;
}

export interface Stats {
  pending: number;
  approvedToday: number;
  rejectedToday: number;
  activeCampaigns?: number;
  prelaunchActive?: number;
  prelaunchReview?: number;
}

export const rejectionReasons = [
  { value: "INCOMPLETE_INFORMATION", label: "Incomplete Information" },
  { value: "POLICY_VIOLATION", label: "Policy Violation" },
  { value: "PROHIBITED_CONTENT", label: "Prohibited Content" },
  { value: "INTELLECTUAL_PROPERTY", label: "Intellectual Property Issues" },
  { value: "FRAUD_SUSPECTED", label: "Suspected Fraud" },
  { value: "UNREALISTIC_GOALS", label: "Unrealistic Goals" },
  { value: "MISSING_REWARDS", label: "Missing or Inadequate Rewards" },
  { value: "IDENTITY_VERIFICATION", label: "Identity Verification Required" },
  { value: "OTHER", label: "Other" },
];
