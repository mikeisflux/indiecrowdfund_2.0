export interface AIService {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  action: string;
  enabled: boolean;
  lastRun?: string;
  status: "idle" | "running" | "success" | "error";
  result?: string;
}

export interface CronJob {
  id: string;
  service: string;
  schedule: string;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
}

export interface PredictiveAnalyticsResult {
  success: boolean;
  summary?: {
    totalAnalyzed?: number;
    highValueProspects?: number;
    atRiskUsers?: number;
    predictedRevenue?: number;
    peakHour?: number;
  };
  topProspects?: Array<{
    userId: string;
    conversionProbability: number;
    churnRisk: number;
    predictedLifetimeValue: number;
  }>;
  atRiskUsers?: Array<{
    userId: string;
    conversionProbability: number;
    churnRisk: number;
  }>;
}

export interface SegmentationResult {
  success: boolean;
  totalUsers?: number;
  segments?: Array<{
    name: string;
    description: string;
    userCount: number;
    avgEngagement: number;
    criteria: string[];
  }>;
}

export interface SendTimeResult {
  success: boolean;
  summary?: {
    totalAnalyzed?: number;
    peakHour?: number;
  };
  hourlyDistribution?: Array<{
    hour: number;
    count: number;
  }>;
}

export interface AutoTaggingResult {
  success: boolean;
  results?: Array<{
    projectId: string;
    success: boolean;
    tags?: string[];
    reason?: string;
  }>;
}

export interface RunResults {
  "predictive-analytics"?: PredictiveAnalyticsResult;
  "smart-segmentation"?: SegmentationResult;
  "send-time-optimization"?: SendTimeResult;
  "auto-tagging"?: AutoTaggingResult;
  [key: string]: unknown;
}
