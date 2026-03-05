// Type definitions for the dashboard

export interface Project {
  id: string;
  title: string;
  slug: string;
  status: string;
  imageUrl: string | null;
  projectUrl: string;
}

export interface SelectedProject {
  id: string;
  title: string;
  slug: string;
  status: string;
  imageUrl: string | null;
  goalAmount: number;
  currentAmount: number;
  backerCount: number;
  daysRemaining: number;
  endDate: string | null;
  launchedAt: string | null;
  projectUrl: string;
}

export interface Stats {
  todayPledges: number;
  todayBackers: number;
  todayViews: number;
  weeklyGrowth: number;
  conversionRate: number;
  avgPledge: number;
  dailyChange: number;
}

export interface FundingDataPoint {
  date: string;
  amount: number;
  cumulative: number;
}

export interface Backer {
  id: string;
  status: string;
  fulfillmentStatus: string;
  userId: string;
  name: string;
  email: string | null;
  image: string | null;
  amount: number;
  shippingAmount: number;
  shippingAddress: string;
  shippingCity: string;
  shippingState: string;
  shippingCountry: string;
  rewardId: string | null;
  reward: string;
  addons: string;
  addonsMap: Record<string, number>;
  time: string;
}

export interface RewardAddonItem {
  id: string;
  title: string;
}

export interface RewardStat {
  id: string;
  title: string;
  amount: number;
  backers: number;
  total: number;
  remaining: number | null;
}

export interface Referrer {
  source: string;
  visits: number;
  pledges: number;
  amount: number;
  percentage: number;
}

export interface FulfillmentItem {
  name: string;
  count: number;
  projectItemId: string | null;
  sku: string | null;
}

export interface FulfillmentStats {
  totalBackers: number;
  shippedBackers: number;
  fulfillmentPercentage: number;
  items: FulfillmentItem[];
  statusBreakdown: {
    notStarted: number;
    inProgress: number;
    shipped: number;
    delivered: number;
  };
}

export interface DashboardData {
  projects: Project[];
  selectedProject: SelectedProject | null;
  stats: Stats | null;
  fundingData: FundingDataPoint[];
  recentBackers: Backer[];
  rewardStats: RewardStat[];
  allRewards: RewardAddonItem[];
  allAddons: RewardAddonItem[];
  referrers: Referrer[];
  fulfillmentStats: FulfillmentStats | null;
  userRole?: string;
}
