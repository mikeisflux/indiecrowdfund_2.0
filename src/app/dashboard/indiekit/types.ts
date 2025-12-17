import { ElementType } from "react";

export interface Project {
  id: string;
  title: string;
  slug: string;
  status: string;
}

export interface FulfillmentStats {
  totalBackers: number;
  fulfilledBackers: number;
  surveysCompleted: number;
  surveysPending: number;
  totalRaised: number;
  addOnPurchases: number;
  backersWithAddons: number;
  digitalDownloads: number;
  packagesShipped: number;
  chargeStats: {
    notCharged: number;
    errored: number;
    charged: number;
    paypalCollected: number;
  };
  preOrderBackers: number;
  preOrderRevenue: number;
  returningBackers: number;
  newBackers: number;
}

export interface WorkflowStep {
  id: string;
  label: string;
  description: string;
  status: "completed" | "in_progress" | "pending" | "locked";
  icon: ElementType;
  targetTab?: string;
  actionCount?: number;
}

export interface Backer {
  id: string;
  projectId?: string;
  backerNumber?: number;
  name: string;
  email: string;
  avatar?: string;
  pledgeAmount: number;
  reward: string;
  rewardAmount: number;
  status: "not_pushed" | "push_errored" | "pushed" | "shipped";
  chargeStatus: "not_charged" | "errored" | "charged" | "paypal_collected";
  surveyCompleted: boolean;
  addressComplete: boolean;
  shippingAddress?: {
    name?: string;
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    country: string;
    postalCode: string;
    phone?: string;
  };
  balance: {
    pledgeAmount: number;
    pledgeLevelAmount: number;
    addonsAmount: number;
    shippingAmount: number;
    totalCharged: number;
    balanceDue: number;
  };
  items: { name: string; quantity: number; sku?: string }[];
  addons: { id: string; name: string; quantity: number; amount: number }[];
  digitalDownloads: { name: string; downloaded: boolean; distributedAt?: string }[];
  activity: { date: string; action: string; details?: string }[];
}

export interface SurveyAddon {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl?: string;
  available: boolean;
  quantityLimit?: number;
  purchasedCount: number;
}

export interface DistributionRule {
  id: string;
  name: string;
  condition: string;
  triggerProduct: string;
  distributeFile: string;
  requiresPayment: boolean;
  status: "not_started" | "started" | "completed";
  distributedCount: number;
  totalEligible: number;
  startedAt?: string;
}

export interface PackageGroup {
  id: string;
  name: string;
  type: "domestic" | "international" | "incomplete";
  itemCount: number;
  backerCount: number;
  status: "pending" | "processing" | "shipped";
  statusCounts: {
    notPushed: number;
    pushErrored: number;
    pushed: number;
    shipped: number;
  };
  lastSentAt?: string;
  items: {
    name: string;
    quantity: number;
    weight: { lbs: number; oz: number };
    customsValid: boolean;
    sku?: string;
  }[];
  totalWeight: { lbs: number; oz: number };
}

export interface ShippingService {
  id: string;
  name: string;
  connected: boolean;
  connectedAt?: string;
  icon: string;
}

export interface DigitalFile {
  id: string;
  name: string;
  size: string;
  type: string;
  uploadedAt: string;
  distributedTo: number;
  totalEligible: number;
}

export interface EmailCampaign {
  id: string;
  title: string;
  status: "draft" | "scheduled" | "sent";
  scheduledFor?: string;
  sentAt?: string;
  recipients: number;
  openRate?: number;
}

export const STATUS_COLORS: Record<Backer["status"], string> = {
  not_pushed: "bg-gray-100 text-gray-700",
  push_errored: "bg-red-100 text-red-700",
  pushed: "bg-yellow-100 text-yellow-700",
  shipped: "bg-green-100 text-green-700",
};

export const STATUS_LABELS: Record<Backer["status"], string> = {
  not_pushed: "Not Pushed",
  push_errored: "Push Errored",
  pushed: "Pushed",
  shipped: "Shipped",
};
