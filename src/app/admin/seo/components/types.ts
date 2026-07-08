// ─── Type Definitions ────────────────────────────────────────────────

export interface SeoAudit {
  id: string;
  runType: string;
  status: string;
  totalPages: number;
  pagesAudited: number | null;
  overallScore: number | null;
  issuesFound: number | null;
  criticalIssues: number | null;
  warnings: number | null;
  passed: number | null;
  results: PageAuditResult[] | null;
  summary: string | null;
  duration: number | null;
  triggeredBy: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface PageAuditResult {
  path: string;
  score: number;
  hasPageMeta: boolean;
  hasTitle: boolean;
  hasDescription: boolean;
  descriptionLength: number | null;
  descriptionLengthOk: boolean;
  hasOgTitle: boolean;
  hasOgDescription: boolean;
  hasOgImage: boolean;
  hasKeywords: boolean;
  noIndex: boolean;
  issues: string[];
}

export interface SeoPageMeta {
  id: string;
  path: string;
  title: string | null;
  description: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  twitterTitle: string | null;
  twitterDesc: string | null;
  canonicalUrl: string | null;
  noIndex: boolean;
  noFollow: boolean;
  keywords: string[];
  lastAuditScore: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface SeoKeyword {
  id: string;
  keyword: string;
  category: string | null;
  targetPages: string[];
  currentRank: number | null;
  previousRank: number | null;
  searchVolume: number | null;
  difficulty: number | null;
  isTracked: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SeoRedirect {
  id: string;
  fromPath: string;
  toPath: string;
  statusCode: number;
  isActive: boolean;
  hitCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SeoCronLog {
  id: string;
  status: string;
  auditId: string | null;
  pagesProcessed: number;
  issuesFound: number;
  autoFixed: number;
  errors: string[];
  duration: number;
  output: string | null;
  createdAt: string;
}

export interface DashboardData {
  latestAudit: SeoAudit | null;
  totalPages: number;
  totalKeywords: number;
  trackedKeywords: number;
  recentCronLogs: SeoCronLog[];
  lowScorePages: SeoPageMeta[];
  issueStats: {
    critical: number;
    warnings: number;
    passed: number;
    total: number;
  };
  overallScore: number | null;
}

export interface AiSuggestion {
  priority: "critical" | "important" | "nice-to-have";
  page: string;
  issue: string;
  fix: string;
}

export interface MetaForm {
  path: string;
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  twitterTitle: string;
  twitterDesc: string;
  canonicalUrl: string;
  noIndex: boolean;
  noFollow: boolean;
  keywords: string;
}

export interface KeywordForm {
  keyword: string;
  category: string;
  targetPages: string;
  searchVolume: string;
  difficulty: string;
  currentRank: string;
  notes: string;
}

export interface RedirectForm {
  fromPath: string;
  toPath: string;
  statusCode: string;
  isActive: boolean;
}
