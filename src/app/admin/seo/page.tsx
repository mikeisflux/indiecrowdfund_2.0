"use client";

import { getCSRFHeaders } from "@/lib/csrf";
import { fetchWithRetry } from "@/lib/fetch-utils";
import { toast } from "sonner";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Globe,
  BarChart3,
  Loader2,
  RefreshCw,
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
  Copy,
  Clock,
  Sparkles,
  Link2,
  Tag,
  FileText,
  Activity,
  Eye,
  EyeOff,
  ArrowRight,
  Zap,
  TrendingUp,
} from "lucide-react";

// ─── Type Definitions ────────────────────────────────────────────────

interface SeoAudit {
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

interface PageAuditResult {
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

interface SeoPageMeta {
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

interface SeoKeyword {
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

interface SeoRedirect {
  id: string;
  fromPath: string;
  toPath: string;
  statusCode: number;
  isActive: boolean;
  hitCount: number;
  createdAt: string;
  updatedAt: string;
}

interface SeoCronLog {
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

interface DashboardData {
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

interface AiSuggestion {
  priority: "critical" | "important" | "nice-to-have";
  page: string;
  issue: string;
  fix: string;
}

// ─── Helper Components ───────────────────────────────────────────────

function ScoreGauge({ score, size = 120 }: { score: number; size?: number }) {
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color =
    score >= 80
      ? "text-emerald-500"
      : score >= 60
        ? "text-yellow-500"
        : "text-red-500";
  const strokeColor =
    score >= 80
      ? "#10b981"
      : score >= 60
        ? "#eab308"
        : "#ef4444";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-muted/20"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`text-2xl font-bold ${color}`}>{score}</span>
        <span className="text-xs text-muted-foreground">/100</span>
      </div>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  if (score >= 80) {
    return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">{score}</Badge>;
  }
  if (score >= 60) {
    return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">{score}</Badge>;
  }
  return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">{score}</Badge>;
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "success":
    case "completed":
      return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">{status}</Badge>;
    case "partial":
    case "running":
      return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">{status}</Badge>;
    case "error":
    case "failed":
      return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">{status}</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function EmptyState({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-muted/50 p-4 mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium text-muted-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground/70 max-w-md">{description}</p>
    </div>
  );
}

function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="animate-pulse flex gap-4 items-center">
          <div className="h-4 bg-muted rounded w-1/4" />
          <div className="h-4 bg-muted rounded w-1/3" />
          <div className="h-4 bg-muted rounded w-1/6" />
        </div>
      ))}
    </div>
  );
}


// ─── Main Component ──────────────────────────────────────────────────

export default function SeoManagementPage() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isLoading, setIsLoading] = useState(true);

  // Dashboard state
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isRunningAudit, setIsRunningAudit] = useState(false);
  const [auditHistory, setAuditHistory] = useState<SeoAudit[]>([]);

  // Page Audit state
  const [auditResults, setAuditResults] = useState<PageAuditResult[]>([]);
  const [auditSearch, setAuditSearch] = useState("");
  const [expandedAuditRow, setExpandedAuditRow] = useState<string | null>(null);

  // Meta Tags state
  const [pages, setPages] = useState<SeoPageMeta[]>([]);
  const [pageSearch, setPageSearch] = useState("");
  const [showMetaDialog, setShowMetaDialog] = useState(false);
  const [editingPage, setEditingPage] = useState<SeoPageMeta | null>(null);
  const [metaForm, setMetaForm] = useState({
    path: "",
    title: "",
    description: "",
    ogTitle: "",
    ogDescription: "",
    ogImage: "",
    twitterTitle: "",
    twitterDesc: "",
    canonicalUrl: "",
    noIndex: false,
    noFollow: false,
    keywords: "",
  });
  const [isSavingMeta, setIsSavingMeta] = useState(false);

  // Keywords state
  const [keywords, setKeywords] = useState<SeoKeyword[]>([]);
  const [keywordSearch, setKeywordSearch] = useState("");
  const [keywordCategoryFilter, setKeywordCategoryFilter] = useState("all");
  const [showKeywordDialog, setShowKeywordDialog] = useState(false);
  const [editingKeyword, setEditingKeyword] = useState<SeoKeyword | null>(null);
  const [keywordForm, setKeywordForm] = useState({
    keyword: "",
    category: "primary",
    targetPages: "",
    searchVolume: "",
    difficulty: "",
    currentRank: "",
    notes: "",
  });
  const [isSavingKeyword, setIsSavingKeyword] = useState(false);

  // Redirects state
  const [redirects, setRedirects] = useState<SeoRedirect[]>([]);
  const [showRedirectDialog, setShowRedirectDialog] = useState(false);
  const [editingRedirect, setEditingRedirect] = useState<SeoRedirect | null>(null);
  const [redirectForm, setRedirectForm] = useState({
    fromPath: "",
    toPath: "",
    statusCode: "301",
    isActive: true,
  });
  const [isSavingRedirect, setIsSavingRedirect] = useState(false);
  const [showDeleteRedirectDialog, setShowDeleteRedirectDialog] = useState(false);
  const [redirectToDelete, setRedirectToDelete] = useState<SeoRedirect | null>(null);

  // Cron state
  const [cronLogs, setCronLogs] = useState<SeoCronLog[]>([]);
  const [isRunningCron, setIsRunningCron] = useState(false);
  const [expandedCronRow, setExpandedCronRow] = useState<string | null>(null);

  // AI Suggestions state
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestion[]>([]);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);

  // ─── Data Fetching ───────────────────────────────────────────────

  const fetchDashboard = useCallback(async () => {
    try {
      const response = await fetchWithRetry("/api/admin/seo");
      if (response.ok) {
        const json = await response.json();
        setDashboardData(json.data);
      } else {
        toast.error("Failed to load SEO dashboard");
      }
    } catch {
      toast.error("Network error loading SEO dashboard");
    }
  }, []);

  const fetchAuditHistory = useCallback(async () => {
    try {
      const response = await fetchWithRetry("/api/admin/seo/audit?limit=10");
      if (response.ok) {
        const json = await response.json();
        setAuditHistory(json.data || []);
        // Use the latest completed audit's results for the page audit tab
        const latestWithResults = (json.data || []).find(
          (a: SeoAudit) => a.status === "completed" && a.results
        );
        if (latestWithResults?.results) {
          setAuditResults(latestWithResults.results);
        }
      }
    } catch {
      console.error("Failed to fetch audit history");
    }
  }, []);

  const fetchPages = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (pageSearch) params.set("query", pageSearch);
      const response = await fetchWithRetry(`/api/admin/seo/pages?${params}`);
      if (response.ok) {
        const json = await response.json();
        setPages(json.data || []);
      }
    } catch {
      toast.error("Failed to load pages");
    }
  }, [pageSearch]);

  const fetchKeywords = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (keywordSearch) params.set("query", keywordSearch);
      if (keywordCategoryFilter !== "all") params.set("category", keywordCategoryFilter);
      const response = await fetchWithRetry(`/api/admin/seo/keywords?${params}`);
      if (response.ok) {
        const json = await response.json();
        setKeywords(json.data || []);
      }
    } catch {
      toast.error("Failed to load keywords");
    }
  }, [keywordSearch, keywordCategoryFilter]);

  const fetchRedirects = useCallback(async () => {
    try {
      const response = await fetchWithRetry("/api/admin/seo/redirects");
      if (response.ok) {
        const json = await response.json();
        setRedirects(json.data || []);
      }
    } catch {
      toast.error("Failed to load redirects");
    }
  }, []);

  const fetchCronLogs = useCallback(async () => {
    try {
      const response = await fetchWithRetry("/api/admin/seo");
      if (response.ok) {
        const json = await response.json();
        setCronLogs(json.data?.recentCronLogs || []);
      }
    } catch {
      console.error("Failed to fetch cron logs");
    }
  }, []);

  // ─── Initial Load ────────────────────────────────────────────────

  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true);
      await Promise.all([fetchDashboard(), fetchAuditHistory()]);
      setIsLoading(false);
    };
    loadInitialData();
  }, [fetchDashboard, fetchAuditHistory]);

  // ─── Tab Change Handler ──────────────────────────────────────────

  useEffect(() => {
    switch (activeTab) {
      case "meta":
        fetchPages();
        break;
      case "keywords":
        fetchKeywords();
        break;
      case "redirects":
        fetchRedirects();
        break;
      case "cron":
        fetchCronLogs();
        break;
    }
  }, [activeTab, fetchPages, fetchKeywords, fetchRedirects, fetchCronLogs]);


  // ─── Action Handlers ─────────────────────────────────────────────

  const handleRunAudit = async () => {
    setIsRunningAudit(true);
    try {
      const response = await fetchWithRetry("/api/admin/seo/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
      });
      if (response.ok) {
        const json = await response.json();
        toast.success(`Audit complete! Overall score: ${json.data.overallScore}/100`);
        setAuditResults(json.data.results || []);
        await fetchDashboard();
        await fetchAuditHistory();
      } else {
        const err = await response.json();
        toast.error(err.error || "Audit failed");
      }
    } catch {
      toast.error("Network error running audit");
    } finally {
      setIsRunningAudit(false);
    }
  };

  const handleSaveMeta = async () => {
    if (!metaForm.path.trim()) {
      toast.error("Page path is required");
      return;
    }
    setIsSavingMeta(true);
    try {
      const response = await fetchWithRetry("/api/admin/seo/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          ...metaForm,
          keywords: metaForm.keywords
            .split(",")
            .map((k) => k.trim())
            .filter(Boolean),
        }),
      });
      if (response.ok) {
        const json = await response.json();
        toast.success(`Page meta ${json.stats.action} for ${json.stats.path}`);
        setShowMetaDialog(false);
        resetMetaForm();
        await fetchPages();
      } else {
        const err = await response.json();
        toast.error(err.error || "Failed to save meta");
      }
    } catch {
      toast.error("Network error saving meta");
    } finally {
      setIsSavingMeta(false);
    }
  };

  const handleSaveKeyword = async () => {
    if (!keywordForm.keyword.trim()) {
      toast.error("Keyword is required");
      return;
    }
    setIsSavingKeyword(true);
    try {
      const isEditing = !!editingKeyword;
      const body = {
        ...(isEditing ? { id: editingKeyword.id } : {}),
        keyword: keywordForm.keyword,
        category: keywordForm.category || null,
        targetPages: keywordForm.targetPages
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean),
        searchVolume: keywordForm.searchVolume ? parseInt(keywordForm.searchVolume) : null,
        difficulty: keywordForm.difficulty ? parseInt(keywordForm.difficulty) : null,
        currentRank: keywordForm.currentRank ? parseInt(keywordForm.currentRank) : null,
        notes: keywordForm.notes || null,
      };

      const response = await fetchWithRetry("/api/admin/seo/keywords", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        toast.success(isEditing ? "Keyword updated" : "Keyword added");
        setShowKeywordDialog(false);
        resetKeywordForm();
        await fetchKeywords();
      } else {
        const err = await response.json();
        toast.error(err.error || "Failed to save keyword");
      }
    } catch {
      toast.error("Network error saving keyword");
    } finally {
      setIsSavingKeyword(false);
    }
  };

  const handleDeleteKeyword = async (id: string) => {
    try {
      const response = await fetchWithRetry(`/api/admin/seo/keywords?id=${id}`, {
        method: "DELETE",
        headers: getCSRFHeaders(),
      });
      if (response.ok) {
        toast.success("Keyword deleted");
        await fetchKeywords();
      } else {
        const err = await response.json();
        toast.error(err.error || "Failed to delete keyword");
      }
    } catch {
      toast.error("Network error deleting keyword");
    }
  };

  const handleSaveRedirect = async () => {
    if (!redirectForm.fromPath.trim() || !redirectForm.toPath.trim()) {
      toast.error("Both paths are required");
      return;
    }
    setIsSavingRedirect(true);
    try {
      const isEditing = !!editingRedirect;
      const body = {
        ...(isEditing ? { id: editingRedirect.id } : {}),
        fromPath: redirectForm.fromPath,
        toPath: redirectForm.toPath,
        statusCode: parseInt(redirectForm.statusCode),
        isActive: redirectForm.isActive,
      };

      const response = await fetchWithRetry("/api/admin/seo/redirects", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        toast.success(isEditing ? "Redirect updated" : "Redirect created");
        setShowRedirectDialog(false);
        resetRedirectForm();
        await fetchRedirects();
      } else {
        const err = await response.json();
        toast.error(err.error || "Failed to save redirect");
      }
    } catch {
      toast.error("Network error saving redirect");
    } finally {
      setIsSavingRedirect(false);
    }
  };

  const handleToggleRedirect = async (redirect: SeoRedirect) => {
    try {
      const response = await fetchWithRetry("/api/admin/seo/redirects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({ id: redirect.id, isActive: !redirect.isActive }),
      });
      if (response.ok) {
        toast.success(`Redirect ${redirect.isActive ? "disabled" : "enabled"}`);
        await fetchRedirects();
      } else {
        const err = await response.json();
        toast.error(err.error || "Failed to toggle redirect");
      }
    } catch {
      toast.error("Network error toggling redirect");
    }
  };

  const handleDeleteRedirect = async () => {
    if (!redirectToDelete) return;
    try {
      const response = await fetchWithRetry(`/api/admin/seo/redirects?id=${redirectToDelete.id}`, {
        method: "DELETE",
        headers: getCSRFHeaders(),
      });
      if (response.ok) {
        toast.success("Redirect deleted");
        setShowDeleteRedirectDialog(false);
        setRedirectToDelete(null);
        await fetchRedirects();
      } else {
        const err = await response.json();
        toast.error(err.error || "Failed to delete redirect");
      }
    } catch {
      toast.error("Network error deleting redirect");
    }
  };

  const handleRunCron = async () => {
    setIsRunningCron(true);
    try {
      const response = await fetchWithRetry("/api/admin/seo/cron", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
      });
      if (response.ok) {
        const json = await response.json();
        toast.success(`Cron complete! Score: ${json.data.auditScore}/100, ${json.data.pagesProcessed} pages processed`);
        await fetchCronLogs();
        await fetchDashboard();
      } else {
        const err = await response.json();
        toast.error(err.error || "Cron job failed");
      }
    } catch {
      toast.error("Network error running cron");
    } finally {
      setIsRunningCron(false);
    }
  };

  const handleGenerateAiSuggestions = async () => {
    setIsGeneratingSuggestions(true);
    try {
      // First run a fresh audit to get latest data
      const response = await fetchWithRetry("/api/admin/seo/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
      });
      if (response.ok) {
        const json = await response.json();
        const results: PageAuditResult[] = json.data.results || [];
        const suggestions: AiSuggestion[] = [];

        results.forEach((page) => {
          page.issues.forEach((issue) => {
            let priority: AiSuggestion["priority"] = "nice-to-have";
            let fix = "";

            if (issue.includes("No SeoPageMeta")) {
              priority = "critical";
              fix = `Create a SeoPageMeta entry for ${page.path} with a descriptive title and meta description that includes relevant keywords.`;
            } else if (issue.includes("Missing page title")) {
              priority = "critical";
              fix = `Add a compelling title tag (50-60 chars) for ${page.path} that includes your primary keyword for this page.`;
            } else if (issue.includes("Missing meta description")) {
              priority = "critical";
              fix = `Write a meta description (120-155 chars) for ${page.path} that summarizes the page content and includes a call-to-action.`;
            } else if (issue.includes("too short")) {
              priority = "important";
              fix = `Expand the meta description to at least 50 characters. Include relevant keywords and a compelling value proposition.`;
            } else if (issue.includes("too long")) {
              priority = "important";
              fix = `Shorten the meta description to under 160 characters to prevent truncation in search results.`;
            } else if (issue.includes("Open Graph title")) {
              priority = "important";
              fix = `Add an og:title tag to improve social media sharing appearance. Use the page title or a social-optimized variant.`;
            } else if (issue.includes("Open Graph description")) {
              priority = "important";
              fix = `Add an og:description tag for better social media previews. Keep it engaging and under 200 characters.`;
            } else if (issue.includes("Open Graph image")) {
              priority = "important";
              fix = `Add an og:image (1200x630px recommended) to make social shares more visually appealing and increase click-through rates.`;
            } else if (issue.includes("No keywords")) {
              priority = "nice-to-have";
              fix = `Define 3-5 relevant keywords for ${page.path} that match user search intent.`;
            } else if (issue.includes("noIndex")) {
              priority = "nice-to-have";
              fix = `This page is set to noIndex. Verify this is intentional -- if not, remove the noIndex flag to allow search engine indexing.`;
            }

            if (fix) {
              suggestions.push({ priority, page: page.path, issue, fix });
            }
          });
        });

        // Sort by priority
        const priorityOrder = { critical: 0, important: 1, "nice-to-have": 2 };
        suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

        setAiSuggestions(suggestions);
        setAuditResults(results);
        await fetchDashboard();
        toast.success(`Generated ${suggestions.length} AI suggestions`);
      } else {
        toast.error("Failed to run audit for AI suggestions");
      }
    } catch {
      toast.error("Network error generating suggestions");
    } finally {
      setIsGeneratingSuggestions(false);
    }
  };

  // ─── Form Helpers ────────────────────────────────────────────────

  const resetMetaForm = () => {
    setEditingPage(null);
    setMetaForm({
      path: "",
      title: "",
      description: "",
      ogTitle: "",
      ogDescription: "",
      ogImage: "",
      twitterTitle: "",
      twitterDesc: "",
      canonicalUrl: "",
      noIndex: false,
      noFollow: false,
      keywords: "",
    });
  };

  const openEditMeta = (page: SeoPageMeta) => {
    setEditingPage(page);
    setMetaForm({
      path: page.path,
      title: page.title || "",
      description: page.description || "",
      ogTitle: page.ogTitle || "",
      ogDescription: page.ogDescription || "",
      ogImage: page.ogImage || "",
      twitterTitle: page.twitterTitle || "",
      twitterDesc: page.twitterDesc || "",
      canonicalUrl: page.canonicalUrl || "",
      noIndex: page.noIndex,
      noFollow: page.noFollow,
      keywords: (page.keywords || []).join(", "),
    });
    setShowMetaDialog(true);
  };

  const resetKeywordForm = () => {
    setEditingKeyword(null);
    setKeywordForm({
      keyword: "",
      category: "primary",
      targetPages: "",
      searchVolume: "",
      difficulty: "",
      currentRank: "",
      notes: "",
    });
  };

  const openEditKeyword = (kw: SeoKeyword) => {
    setEditingKeyword(kw);
    setKeywordForm({
      keyword: kw.keyword,
      category: kw.category || "primary",
      targetPages: (kw.targetPages || []).join(", "),
      searchVolume: kw.searchVolume?.toString() || "",
      difficulty: kw.difficulty?.toString() || "",
      currentRank: kw.currentRank?.toString() || "",
      notes: kw.notes || "",
    });
    setShowKeywordDialog(true);
  };

  const resetRedirectForm = () => {
    setEditingRedirect(null);
    setRedirectForm({
      fromPath: "",
      toPath: "",
      statusCode: "301",
      isActive: true,
    });
  };

  const openEditRedirect = (r: SeoRedirect) => {
    setEditingRedirect(r);
    setRedirectForm({
      fromPath: r.fromPath,
      toPath: r.toPath,
      statusCode: r.statusCode.toString(),
      isActive: r.isActive,
    });
    setShowRedirectDialog(true);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  // ─── Filtered Data ──────────────────────────────────────────────

  const filteredAuditResults = auditResults.filter((r) =>
    r.path.toLowerCase().includes(auditSearch.toLowerCase())
  );

  const filteredPages = pages.filter(
    (p) =>
      p.path.toLowerCase().includes(pageSearch.toLowerCase()) ||
      (p.title && p.title.toLowerCase().includes(pageSearch.toLowerCase()))
  );


  // ─── Render ─────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-500 to-teal-600 bg-clip-text text-transparent">
            SEO Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor, audit, and optimize your site&apos;s search engine performance
          </p>
        </div>
        <Button
          onClick={handleRunAudit}
          disabled={isRunningAudit}
          className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
        >
          {isRunningAudit ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Run SEO Audit
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-7 h-auto">
          <TabsTrigger value="dashboard" className="text-xs sm:text-sm">
            <BarChart3 className="h-3 w-3 mr-1 hidden sm:inline" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="audit" className="text-xs sm:text-sm">
            <Search className="h-3 w-3 mr-1 hidden sm:inline" />
            Page Audit
          </TabsTrigger>
          <TabsTrigger value="meta" className="text-xs sm:text-sm">
            <FileText className="h-3 w-3 mr-1 hidden sm:inline" />
            Meta Tags
          </TabsTrigger>
          <TabsTrigger value="keywords" className="text-xs sm:text-sm">
            <Tag className="h-3 w-3 mr-1 hidden sm:inline" />
            Keywords
          </TabsTrigger>
          <TabsTrigger value="redirects" className="text-xs sm:text-sm">
            <Link2 className="h-3 w-3 mr-1 hidden sm:inline" />
            Redirects
          </TabsTrigger>
          <TabsTrigger value="cron" className="text-xs sm:text-sm">
            <Clock className="h-3 w-3 mr-1 hidden sm:inline" />
            Cron
          </TabsTrigger>
          <TabsTrigger value="ai" className="text-xs sm:text-sm">
            <Sparkles className="h-3 w-3 mr-1 hidden sm:inline" />
            AI Suggestions
          </TabsTrigger>
        </TabsList>

        {/* ═══════ Tab 1: Dashboard ═══════ */}
        <TabsContent value="dashboard" className="space-y-6">
          {/* Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-emerald-500/20 bg-gradient-to-br from-background to-emerald-500/5">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Overall SEO Score</p>
                    <p className="text-3xl font-bold text-emerald-500">
                      {dashboardData?.overallScore ?? "--"}
                    </p>
                  </div>
                  <ScoreGauge score={dashboardData?.overallScore ?? 0} size={80} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Pages Tracked</p>
                    <p className="text-3xl font-bold">{dashboardData?.totalPages ?? 0}</p>
                  </div>
                  <div className="rounded-full bg-blue-500/10 p-3">
                    <Globe className="h-6 w-6 text-blue-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Keywords Tracked</p>
                    <p className="text-3xl font-bold">{dashboardData?.trackedKeywords ?? 0}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      of {dashboardData?.totalKeywords ?? 0} total
                    </p>
                  </div>
                  <div className="rounded-full bg-purple-500/10 p-3">
                    <Tag className="h-6 w-6 text-purple-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Issues Found</p>
                    <p className="text-3xl font-bold">{dashboardData?.issueStats.total ?? 0}</p>
                    <p className="text-xs text-red-400 mt-1">
                      {dashboardData?.issueStats.critical ?? 0} critical
                    </p>
                  </div>
                  <div className="rounded-full bg-red-500/10 p-3">
                    <AlertTriangle className="h-6 w-6 text-red-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Latest Audit Summary + Score History */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Latest Audit Summary</CardTitle>
                <CardDescription>
                  {dashboardData?.latestAudit?.completedAt
                    ? `Last run: ${formatDate(dashboardData.latestAudit.completedAt)}`
                    : "No audits run yet"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {dashboardData?.latestAudit ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <StatusBadge status={dashboardData.latestAudit.status} />
                      <span className="text-sm text-muted-foreground">
                        {dashboardData.latestAudit.pagesAudited} pages audited
                      </span>
                      {dashboardData.latestAudit.duration && (
                        <span className="text-sm text-muted-foreground">
                          in {formatDuration(dashboardData.latestAudit.duration)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm">{dashboardData.latestAudit.summary}</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center p-3 rounded-lg bg-red-500/10">
                        <p className="text-2xl font-bold text-red-400">{dashboardData.issueStats.critical}</p>
                        <p className="text-xs text-muted-foreground">Critical</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-yellow-500/10">
                        <p className="text-2xl font-bold text-yellow-400">{dashboardData.issueStats.warnings}</p>
                        <p className="text-xs text-muted-foreground">Warnings</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-emerald-500/10">
                        <p className="text-2xl font-bold text-emerald-400">{dashboardData.issueStats.passed}</p>
                        <p className="text-xs text-muted-foreground">Passed</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    icon={BarChart3}
                    title="No Audits Yet"
                    description="Run your first SEO audit to see results here."
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Audit Score History</CardTitle>
                <CardDescription>Last {auditHistory.length} audits</CardDescription>
              </CardHeader>
              <CardContent>
                {auditHistory.length > 0 ? (
                  <div className="flex items-end gap-2 h-40">
                    {auditHistory
                      .filter((a) => a.status === "completed" && a.overallScore !== null)
                      .reverse()
                      .map((audit) => {
                        const score = audit.overallScore ?? 0;
                        const height = Math.max(score, 5);
                        const color =
                          score >= 80
                            ? "bg-emerald-500"
                            : score >= 60
                              ? "bg-yellow-500"
                              : "bg-red-500";
                        return (
                          <div key={audit.id} className="flex-1 flex flex-col items-center gap-1">
                            <span className="text-xs text-muted-foreground">{score}</span>
                            <div
                              className={`w-full rounded-t-sm ${color} transition-all duration-500`}
                              style={{ height: `${height}%` }}
                              title={`Score: ${score} - ${formatDate(audit.createdAt)}`}
                            />
                            <span className="text-[10px] text-muted-foreground truncate max-w-full">
                              {new Date(audit.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <EmptyState
                    icon={BarChart3}
                    title="No History"
                    description="Run audits to see score trends over time."
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent Cron Logs */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Cron Logs</CardTitle>
              <CardDescription>Last 10 automated runs</CardDescription>
            </CardHeader>
            <CardContent>
              {dashboardData?.recentCronLogs && dashboardData.recentCronLogs.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Timestamp</th>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Status</th>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Pages</th>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Issues</th>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardData.recentCronLogs.map((log) => (
                        <tr key={log.id} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-2 px-3">{formatDate(log.createdAt)}</td>
                          <td className="py-2 px-3"><StatusBadge status={log.status} /></td>
                          <td className="py-2 px-3">{log.pagesProcessed}</td>
                          <td className="py-2 px-3">{log.issuesFound}</td>
                          <td className="py-2 px-3">{formatDuration(log.duration)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  icon={Clock}
                  title="No Cron Logs"
                  description="Cron jobs haven't been run yet. Use the Cron tab to set up automated audits."
                />
              )}
            </CardContent>
          </Card>

          {/* Low Score Pages */}
          {dashboardData?.lowScorePages && dashboardData.lowScorePages.length > 0 && (
            <Card className="border-red-500/20">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  Pages Needing Attention
                </CardTitle>
                <CardDescription>Pages with audit scores below 60</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {dashboardData.lowScorePages.map((page) => (
                    <div
                      key={page.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 hover:bg-red-500/10 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <ScoreBadge score={page.lastAuditScore ?? 0} />
                        <span className="font-mono text-sm">{page.path}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          openEditMeta(page);
                        }}
                      >
                        <Pencil className="h-3 w-3 mr-1" />
                        Fix
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>


        {/* ═══════ Tab 2: Page Audit ═══════ */}
        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <CardTitle>Page Audit Results</CardTitle>
                  <CardDescription>
                    {auditResults.length} pages audited
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Filter by path..."
                      value={auditSearch}
                      onChange={(e) => setAuditSearch(e.target.value)}
                      className="pl-9 w-60"
                    />
                  </div>
                  <Button onClick={handleRunAudit} disabled={isRunningAudit} size="sm" variant="outline">
                    {isRunningAudit ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredAuditResults.length > 0 ? (
                <ScrollArea className="h-[600px]">
                  <div className="space-y-2">
                    {filteredAuditResults.map((result) => (
                      <div key={result.path} className="border rounded-lg overflow-hidden">
                        <button
                          className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors text-left"
                          onClick={() =>
                            setExpandedAuditRow(expandedAuditRow === result.path ? null : result.path)
                          }
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <ScoreBadge score={result.score} />
                            <span className="font-mono text-sm truncate">{result.path}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            {result.issues.length > 0 && (
                              <Badge variant="outline" className="text-xs">
                                {result.issues.length} issue{result.issues.length !== 1 ? "s" : ""}
                              </Badge>
                            )}
                            {expandedAuditRow === result.path ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </button>

                        {expandedAuditRow === result.path && (
                          <div className="border-t p-4 bg-muted/10 space-y-3">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              <div className="flex items-center gap-2">
                                {result.hasTitle ? (
                                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                                ) : (
                                  <AlertTriangle className="h-4 w-4 text-red-500" />
                                )}
                                <span className="text-sm">Title</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {result.hasDescription ? (
                                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                                ) : (
                                  <AlertTriangle className="h-4 w-4 text-red-500" />
                                )}
                                <span className="text-sm">Description</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {result.hasOgTitle && result.hasOgDescription ? (
                                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                                ) : (
                                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                                )}
                                <span className="text-sm">OG Tags</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {result.hasOgImage ? (
                                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                                ) : (
                                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                                )}
                                <span className="text-sm">OG Image</span>
                              </div>
                            </div>

                            {result.descriptionLength !== null && (
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">
                                  Description length: {result.descriptionLength} chars
                                </span>
                                {result.descriptionLengthOk ? (
                                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                                    OK
                                  </Badge>
                                ) : (
                                  <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">
                                    {result.descriptionLength < 50 ? "Too short" : "Too long"}
                                  </Badge>
                                )}
                              </div>
                            )}

                            {result.issues.length > 0 && (
                              <div className="space-y-1">
                                <p className="text-sm font-medium text-red-400">Issues:</p>
                                {result.issues.map((issue, i) => (
                                  <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                                    <AlertTriangle className="h-3 w-3 text-red-400 mt-0.5 shrink-0" />
                                    <span>{issue}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="flex items-center gap-2 pt-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const existing = pages.find((p) => p.path === result.path);
                                  if (existing) {
                                    openEditMeta(existing);
                                  } else {
                                    resetMetaForm();
                                    setMetaForm((prev) => ({ ...prev, path: result.path }));
                                    setShowMetaDialog(true);
                                  }
                                  setActiveTab("meta");
                                }}
                              >
                                <Pencil className="h-3 w-3 mr-1" />
                                Edit Meta
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : auditResults.length === 0 ? (
                <EmptyState
                  icon={Search}
                  title="No Audit Results"
                  description="Run an SEO audit to analyze all pages on your site."
                />
              ) : (
                <EmptyState
                  icon={Search}
                  title="No Matching Pages"
                  description="Try adjusting your search filter."
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>


        {/* ═══════ Tab 3: Meta Tags Manager ═══════ */}
        <TabsContent value="meta" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <CardTitle>Meta Tags Manager</CardTitle>
                  <CardDescription>Manage SEO meta tags for all pages</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search pages..."
                      value={pageSearch}
                      onChange={(e) => setPageSearch(e.target.value)}
                      className="pl-9 w-60"
                    />
                  </div>
                  <Button
                    onClick={() => {
                      resetMetaForm();
                      setShowMetaDialog(true);
                    }}
                    className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Page
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredPages.length > 0 ? (
                <ScrollArea className="h-[600px]">
                  <div className="space-y-2">
                    {filteredPages.map((page) => (
                      <div
                        key={page.id}
                        className="border rounded-lg p-4 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            {page.lastAuditScore !== null && (
                              <ScoreBadge score={page.lastAuditScore} />
                            )}
                            <span className="font-mono text-sm font-medium">{page.path}</span>
                            {page.noIndex && (
                              <Badge variant="outline" className="text-xs">
                                <EyeOff className="h-3 w-3 mr-1" />
                                noindex
                              </Badge>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditMeta(page)}
                          >
                            <Pencil className="h-3 w-3 mr-1" />
                            Edit
                          </Button>
                        </div>

                        {page.title && (
                          <p className="text-sm truncate mb-1">
                            <span className="text-muted-foreground">Title:</span>{" "}
                            {page.title}
                          </p>
                        )}
                        {page.description && (
                          <p className="text-sm truncate text-muted-foreground">
                            {page.description}
                          </p>
                        )}

                        {/* Google Preview */}
                        {(page.title || page.description) && (
                          <div className="mt-3 p-3 rounded-lg bg-white/5 border border-border/50">
                            <p className="text-xs text-muted-foreground mb-1">Google Preview:</p>
                            <div>
                              <p className="text-blue-400 text-sm hover:underline cursor-default truncate">
                                {page.title || page.path} - IndieCrowdfund
                              </p>
                              <p className="text-emerald-500 text-xs truncate">
                                www.indiecrowdfund.com{page.path}
                              </p>
                              <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                                {page.description || "No description set."}
                              </p>
                            </div>
                          </div>
                        )}

                        {page.keywords && page.keywords.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {page.keywords.map((kw, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {kw}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <EmptyState
                  icon={FileText}
                  title="No Pages Found"
                  description={pageSearch ? "Try adjusting your search." : "Add your first page meta tags to get started."}
                />
              )}
            </CardContent>
          </Card>

          {/* Meta Tags Dialog */}
          <Dialog open={showMetaDialog} onOpenChange={(open) => { if (!open) { setShowMetaDialog(false); resetMetaForm(); } }}>
            <DialogContent className="max-w-2xl max-h-[90vh]">
              <DialogHeader>
                <DialogTitle>{editingPage ? "Edit" : "Add"} Page Meta Tags</DialogTitle>
                <DialogDescription>
                  {editingPage
                    ? `Editing meta tags for ${editingPage.path}`
                    : "Create meta tags for a new page path"}
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[60vh] pr-4">
                <div className="space-y-4 py-2">
                  <div>
                    <Label htmlFor="meta-path">Page Path</Label>
                    <Input
                      id="meta-path"
                      placeholder="/about-us"
                      value={metaForm.path}
                      onChange={(e) => setMetaForm({ ...metaForm, path: e.target.value })}
                      disabled={!!editingPage}
                    />
                  </div>

                  <div>
                    <Label htmlFor="meta-title">Title</Label>
                    <Input
                      id="meta-title"
                      placeholder="Page Title - IndieCrowdfund"
                      value={metaForm.title}
                      onChange={(e) => setMetaForm({ ...metaForm, title: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {metaForm.title.length}/60 characters (recommended 50-60)
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="meta-description">Description</Label>
                    <Textarea
                      id="meta-description"
                      placeholder="A compelling description of this page..."
                      value={metaForm.description}
                      onChange={(e) => setMetaForm({ ...metaForm, description: e.target.value })}
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {metaForm.description.length}/160 characters (recommended 120-155)
                    </p>
                    <Progress
                      value={Math.min((metaForm.description.length / 160) * 100, 100)}
                      className="h-1 mt-1"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="meta-og-title">OG Title</Label>
                      <Input
                        id="meta-og-title"
                        placeholder="Social media title"
                        value={metaForm.ogTitle}
                        onChange={(e) => setMetaForm({ ...metaForm, ogTitle: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="meta-og-desc">OG Description</Label>
                      <Input
                        id="meta-og-desc"
                        placeholder="Social media description"
                        value={metaForm.ogDescription}
                        onChange={(e) => setMetaForm({ ...metaForm, ogDescription: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="meta-og-image">OG Image URL</Label>
                    <Input
                      id="meta-og-image"
                      placeholder="https://www.indiecrowdfund.com/og-image.jpg"
                      value={metaForm.ogImage}
                      onChange={(e) => setMetaForm({ ...metaForm, ogImage: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="meta-twitter-title">Twitter Title</Label>
                      <Input
                        id="meta-twitter-title"
                        placeholder="Twitter card title"
                        value={metaForm.twitterTitle}
                        onChange={(e) => setMetaForm({ ...metaForm, twitterTitle: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="meta-twitter-desc">Twitter Description</Label>
                      <Input
                        id="meta-twitter-desc"
                        placeholder="Twitter card description"
                        value={metaForm.twitterDesc}
                        onChange={(e) => setMetaForm({ ...metaForm, twitterDesc: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="meta-canonical">Canonical URL</Label>
                    <Input
                      id="meta-canonical"
                      placeholder="https://www.indiecrowdfund.com/page"
                      value={metaForm.canonicalUrl}
                      onChange={(e) => setMetaForm({ ...metaForm, canonicalUrl: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="meta-keywords">Keywords (comma-separated)</Label>
                    <Input
                      id="meta-keywords"
                      placeholder="crowdfunding, indie, creators"
                      value={metaForm.keywords}
                      onChange={(e) => setMetaForm({ ...metaForm, keywords: e.target.value })}
                    />
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={metaForm.noIndex}
                        onCheckedChange={(checked) => setMetaForm({ ...metaForm, noIndex: checked })}
                      />
                      <Label>noIndex</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={metaForm.noFollow}
                        onCheckedChange={(checked) => setMetaForm({ ...metaForm, noFollow: checked })}
                      />
                      <Label>noFollow</Label>
                    </div>
                  </div>

                  {/* Live Google Preview */}
                  {(metaForm.title || metaForm.description) && (
                    <div className="p-4 rounded-lg bg-white/5 border border-border/50">
                      <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                        <Eye className="h-3 w-3" /> Google Search Preview
                      </p>
                      <div>
                        <p className="text-blue-400 text-sm hover:underline cursor-default truncate">
                          {metaForm.title || metaForm.path || "Page Title"} - IndieCrowdfund
                        </p>
                        <p className="text-emerald-500 text-xs truncate">
                          www.indiecrowdfund.com{metaForm.path || "/"}
                        </p>
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                          {metaForm.description || "No description provided."}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setShowMetaDialog(false); resetMetaForm(); }}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveMeta}
                  disabled={isSavingMeta}
                  className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
                >
                  {isSavingMeta && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingPage ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>


        {/* ═══════ Tab 4: Keywords ═══════ */}
        <TabsContent value="keywords" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <CardTitle>Keyword Tracker</CardTitle>
                  <CardDescription>Monitor keyword rankings and performance</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search keywords..."
                      value={keywordSearch}
                      onChange={(e) => setKeywordSearch(e.target.value)}
                      className="pl-9 w-48"
                    />
                  </div>
                  <Select value={keywordCategoryFilter} onValueChange={setKeywordCategoryFilter}>
                    <SelectTrigger className="w-36">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="primary">Primary</SelectItem>
                      <SelectItem value="secondary">Secondary</SelectItem>
                      <SelectItem value="long-tail">Long-tail</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={() => {
                      resetKeywordForm();
                      setShowKeywordDialog(true);
                    }}
                    className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Keyword
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {keywords.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Keyword</th>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Category</th>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Volume</th>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Difficulty</th>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Rank</th>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Change</th>
                        <th className="text-right py-2 px-3 text-muted-foreground font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {keywords.map((kw) => {
                        const rankChange =
                          kw.previousRank !== null && kw.currentRank !== null
                            ? kw.previousRank - kw.currentRank
                            : null;
                        return (
                          <tr key={kw.id} className="border-b border-border/50 hover:bg-muted/30">
                            <td className="py-2 px-3 font-medium">{kw.keyword}</td>
                            <td className="py-2 px-3">
                              {kw.category ? (
                                <Badge
                                  variant="outline"
                                  className={
                                    kw.category === "primary"
                                      ? "border-emerald-500/50 text-emerald-400"
                                      : kw.category === "secondary"
                                        ? "border-blue-500/50 text-blue-400"
                                        : "border-purple-500/50 text-purple-400"
                                  }
                                >
                                  {kw.category}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">--</span>
                              )}
                            </td>
                            <td className="py-2 px-3">
                              {kw.searchVolume !== null ? kw.searchVolume.toLocaleString() : "--"}
                            </td>
                            <td className="py-2 px-3">
                              {kw.difficulty !== null ? (
                                <div className="flex items-center gap-2">
                                  <Progress value={kw.difficulty} className="w-16 h-2" />
                                  <span className="text-xs">{kw.difficulty}</span>
                                </div>
                              ) : (
                                "--"
                              )}
                            </td>
                            <td className="py-2 px-3 font-mono">
                              {kw.currentRank !== null ? `#${kw.currentRank}` : "--"}
                            </td>
                            <td className="py-2 px-3">
                              {rankChange !== null ? (
                                <div
                                  className={`flex items-center gap-1 text-sm ${
                                    rankChange > 0
                                      ? "text-emerald-500"
                                      : rankChange < 0
                                        ? "text-red-500"
                                        : "text-muted-foreground"
                                  }`}
                                >
                                  {rankChange > 0 ? (
                                    <ArrowUpRight className="h-3 w-3" />
                                  ) : rankChange < 0 ? (
                                    <ArrowDownRight className="h-3 w-3" />
                                  ) : null}
                                  <span>{rankChange > 0 ? `+${rankChange}` : rankChange === 0 ? "=" : rankChange}</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">--</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="sm" onClick={() => openEditKeyword(kw)}>
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteKeyword(kw.id)}
                                  className="text-red-400 hover:text-red-500"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  icon={Tag}
                  title="No Keywords Tracked"
                  description="Start tracking keywords to monitor your search engine rankings."
                />
              )}
            </CardContent>
          </Card>

          {/* Keyword Dialog */}
          <Dialog open={showKeywordDialog} onOpenChange={(open) => { if (!open) { setShowKeywordDialog(false); resetKeywordForm(); } }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingKeyword ? "Edit" : "Add"} Keyword</DialogTitle>
                <DialogDescription>
                  {editingKeyword ? "Update keyword tracking details" : "Add a new keyword to track"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label htmlFor="kw-keyword">Keyword</Label>
                  <Input
                    id="kw-keyword"
                    placeholder="crowdfunding platform"
                    value={keywordForm.keyword}
                    onChange={(e) => setKeywordForm({ ...keywordForm, keyword: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="kw-category">Category</Label>
                  <Select
                    value={keywordForm.category}
                    onValueChange={(val) => setKeywordForm({ ...keywordForm, category: val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="primary">Primary</SelectItem>
                      <SelectItem value="secondary">Secondary</SelectItem>
                      <SelectItem value="long-tail">Long-tail</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="kw-target">Target Pages (comma-separated)</Label>
                  <Input
                    id="kw-target"
                    placeholder="/discover, /about-us"
                    value={keywordForm.targetPages}
                    onChange={(e) => setKeywordForm({ ...keywordForm, targetPages: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="kw-volume">Search Volume</Label>
                    <Input
                      id="kw-volume"
                      type="number"
                      placeholder="1000"
                      value={keywordForm.searchVolume}
                      onChange={(e) => setKeywordForm({ ...keywordForm, searchVolume: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="kw-difficulty">Difficulty (0-100)</Label>
                    <Input
                      id="kw-difficulty"
                      type="number"
                      placeholder="45"
                      value={keywordForm.difficulty}
                      onChange={(e) => setKeywordForm({ ...keywordForm, difficulty: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="kw-rank">Current Rank</Label>
                    <Input
                      id="kw-rank"
                      type="number"
                      placeholder="12"
                      value={keywordForm.currentRank}
                      onChange={(e) => setKeywordForm({ ...keywordForm, currentRank: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="kw-notes">Notes</Label>
                  <Textarea
                    id="kw-notes"
                    placeholder="Optional notes about this keyword..."
                    value={keywordForm.notes}
                    onChange={(e) => setKeywordForm({ ...keywordForm, notes: e.target.value })}
                    rows={2}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setShowKeywordDialog(false); resetKeywordForm(); }}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveKeyword}
                  disabled={isSavingKeyword}
                  className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
                >
                  {isSavingKeyword && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingKeyword ? "Update" : "Add"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>


        {/* ═══════ Tab 5: Redirects ═══════ */}
        <TabsContent value="redirects" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <CardTitle>URL Redirects</CardTitle>
                  <CardDescription>
                    Manage 301/302 redirects for SEO and broken links
                  </CardDescription>
                </div>
                <Button
                  onClick={() => {
                    resetRedirectForm();
                    setShowRedirectDialog(true);
                  }}
                  className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Redirect
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {redirects.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">From</th>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">To</th>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Status</th>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Active</th>
                        <th className="text-left py-2 px-3 text-muted-foreground font-medium">Hits</th>
                        <th className="text-right py-2 px-3 text-muted-foreground font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {redirects.map((r) => (
                        <tr key={r.id} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-2 px-3 font-mono text-sm">{r.fromPath}</td>
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-1">
                              <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="font-mono text-sm truncate max-w-[200px]">{r.toPath}</span>
                            </div>
                          </td>
                          <td className="py-2 px-3">
                            <Badge variant="outline">{r.statusCode}</Badge>
                          </td>
                          <td className="py-2 px-3">
                            <Switch
                              checked={r.isActive}
                              onCheckedChange={() => handleToggleRedirect(r)}
                            />
                          </td>
                          <td className="py-2 px-3 text-muted-foreground">{r.hitCount}</td>
                          <td className="py-2 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => openEditRedirect(r)}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-400 hover:text-red-500"
                                onClick={() => {
                                  setRedirectToDelete(r);
                                  setShowDeleteRedirectDialog(true);
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  icon={Link2}
                  title="No Redirects"
                  description="Create redirects to handle moved or deleted pages and preserve SEO value."
                />
              )}
            </CardContent>
          </Card>

          {/* Redirect Dialog */}
          <Dialog open={showRedirectDialog} onOpenChange={(open) => { if (!open) { setShowRedirectDialog(false); resetRedirectForm(); } }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingRedirect ? "Edit" : "Add"} Redirect</DialogTitle>
                <DialogDescription>
                  {editingRedirect ? "Update redirect configuration" : "Create a new URL redirect"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label htmlFor="redir-from">From Path</Label>
                  <Input
                    id="redir-from"
                    placeholder="/old-page"
                    value={redirectForm.fromPath}
                    onChange={(e) => setRedirectForm({ ...redirectForm, fromPath: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="redir-to">To Path</Label>
                  <Input
                    id="redir-to"
                    placeholder="/new-page"
                    value={redirectForm.toPath}
                    onChange={(e) => setRedirectForm({ ...redirectForm, toPath: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="redir-status">Status Code</Label>
                  <Select
                    value={redirectForm.statusCode}
                    onValueChange={(val) => setRedirectForm({ ...redirectForm, statusCode: val })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="301">301 - Permanent Redirect</SelectItem>
                      <SelectItem value="302">302 - Temporary Redirect</SelectItem>
                      <SelectItem value="307">307 - Temporary Redirect (Preserve Method)</SelectItem>
                      <SelectItem value="308">308 - Permanent Redirect (Preserve Method)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={redirectForm.isActive}
                    onCheckedChange={(checked) => setRedirectForm({ ...redirectForm, isActive: checked })}
                  />
                  <Label>Active</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setShowRedirectDialog(false); resetRedirectForm(); }}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveRedirect}
                  disabled={isSavingRedirect}
                  className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
                >
                  {isSavingRedirect && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingRedirect ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete Redirect Confirmation */}
          <Dialog open={showDeleteRedirectDialog} onOpenChange={setShowDeleteRedirectDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Redirect</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete the redirect from{" "}
                  <span className="font-mono font-medium">{redirectToDelete?.fromPath}</span>?
                  This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowDeleteRedirectDialog(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleDeleteRedirect}>
                  Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>


        {/* ═══════ Tab 6: Cron & Automation ═══════ */}
        <TabsContent value="cron" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cron Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-emerald-500" />
                  Cron Job Status
                </CardTitle>
                <CardDescription>SEO automation runs daily at 3:00 AM</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
                  <div>
                    <p className="font-medium">Daily SEO Audit</p>
                    <p className="text-sm text-muted-foreground">
                      Audits all pages, checks project/book meta, logs results
                    </p>
                  </div>
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                    Scheduled
                  </Badge>
                </div>

                <Button
                  onClick={handleRunCron}
                  disabled={isRunningCron}
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
                >
                  {isRunningCron ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4 mr-2" />
                  )}
                  Run Cron Now
                </Button>
              </CardContent>
            </Card>

            {/* Setup Instructions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-500" />
                  Cron Setup
                </CardTitle>
                <CardDescription>Add this to your server crontab</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <pre className="p-3 rounded-lg bg-muted/50 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">
                    {`0 3 * * * curl -s "https://www.indiecrowdfund.com/api/admin/seo/cron?apiKey=YOUR_API_KEY" -X POST > /dev/null 2>&1`}
                  </pre>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-1 right-1"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        '0 3 * * * curl -s "https://www.indiecrowdfund.com/api/admin/seo/cron?apiKey=YOUR_API_KEY" -X POST > /dev/null 2>&1'
                      );
                      toast.info("Crontab command copied to clipboard");
                    }}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>

                <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                  <p className="text-sm font-medium text-yellow-400 flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4" />
                    Required .env variable
                  </p>
                  <div className="relative mt-2">
                    <pre className="p-2 rounded bg-muted/30 text-xs font-mono">
                      SEO_CRON_API_KEY=your_secure_api_key_here
                    </pre>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-0 right-0"
                      onClick={() => {
                        navigator.clipboard.writeText("SEO_CRON_API_KEY=your_secure_api_key_here");
                        toast.info("Env variable copied to clipboard");
                      }}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Cron Logs Table */}
          <Card>
            <CardHeader>
              <CardTitle>Cron Run History</CardTitle>
              <CardDescription>Recent automated and manual cron runs</CardDescription>
            </CardHeader>
            <CardContent>
              {cronLogs.length > 0 ? (
                <div className="space-y-2">
                  {cronLogs.map((log) => (
                    <div key={log.id} className="border rounded-lg overflow-hidden">
                      <button
                        className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors text-left"
                        onClick={() =>
                          setExpandedCronRow(expandedCronRow === log.id ? null : log.id)
                        }
                      >
                        <div className="flex items-center gap-3">
                          <StatusBadge status={log.status} />
                          <span className="text-sm">{formatDate(log.createdAt)}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{log.pagesProcessed} pages</span>
                          <span>{log.issuesFound} issues</span>
                          <span>{log.autoFixed} auto-fixed</span>
                          <span>{formatDuration(log.duration)}</span>
                          {expandedCronRow === log.id ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </div>
                      </button>

                      {expandedCronRow === log.id && (
                        <div className="border-t p-4 bg-muted/10 space-y-3">
                          {log.output && (
                            <div>
                              <p className="text-sm font-medium mb-1">Output:</p>
                              <pre className="text-xs text-muted-foreground p-2 rounded bg-muted/30 whitespace-pre-wrap">
                                {log.output}
                              </pre>
                            </div>
                          )}
                          {log.errors && log.errors.length > 0 && (
                            <div>
                              <p className="text-sm font-medium text-red-400 mb-1">
                                Errors ({log.errors.length}):
                              </p>
                              <div className="space-y-1">
                                {log.errors.map((err, i) => (
                                  <div key={i} className="flex items-start gap-2 text-sm text-red-300">
                                    <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                                    <span>{err}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Activity}
                  title="No Cron Logs"
                  description="Run the cron job manually or set up automated scheduling to see logs here."
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>


        {/* ═══════ Tab 7: AI Suggestions ═══════ */}
        <TabsContent value="ai" className="space-y-4">
          <Card className="border-purple-500/20 bg-gradient-to-br from-background to-purple-500/5">
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-purple-500" />
                    AI-Powered SEO Suggestions
                  </CardTitle>
                  <CardDescription>
                    Generate intelligent improvement recommendations based on your latest audit data
                  </CardDescription>
                </div>
                <Button
                  onClick={handleGenerateAiSuggestions}
                  disabled={isGeneratingSuggestions}
                  className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700"
                >
                  {isGeneratingSuggestions ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Generate Suggestions
                </Button>
              </div>
            </CardHeader>
          </Card>

          {aiSuggestions.length > 0 ? (
            <>
              {/* Critical */}
              {aiSuggestions.filter((s) => s.priority === "critical").length > 0 && (
                <Card className="border-red-500/20">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2 text-red-400">
                      <AlertTriangle className="h-5 w-5" />
                      Critical Issues ({aiSuggestions.filter((s) => s.priority === "critical").length})
                    </CardTitle>
                    <CardDescription>These issues significantly impact your SEO performance</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {aiSuggestions
                        .filter((s) => s.priority === "critical")
                        .map((suggestion, i) => (
                          <div
                            key={i}
                            className="p-4 rounded-lg border border-red-500/20 bg-red-500/5"
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Critical</Badge>
                              <span className="font-mono text-sm text-muted-foreground">{suggestion.page}</span>
                            </div>
                            <p className="text-sm font-medium mb-1">{suggestion.issue}</p>
                            <div className="flex items-start gap-2 mt-2 p-2 rounded bg-muted/20">
                              <TrendingUp className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                              <p className="text-sm text-muted-foreground">{suggestion.fix}</p>
                            </div>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Important */}
              {aiSuggestions.filter((s) => s.priority === "important").length > 0 && (
                <Card className="border-yellow-500/20">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2 text-yellow-400">
                      <ExternalLink className="h-5 w-5" />
                      Important Improvements ({aiSuggestions.filter((s) => s.priority === "important").length})
                    </CardTitle>
                    <CardDescription>Addressing these will noticeably improve your SEO</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="max-h-[400px]">
                      <div className="space-y-3">
                        {aiSuggestions
                          .filter((s) => s.priority === "important")
                          .map((suggestion, i) => (
                            <div
                              key={i}
                              className="p-4 rounded-lg border border-yellow-500/20 bg-yellow-500/5"
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Important</Badge>
                                <span className="font-mono text-sm text-muted-foreground">{suggestion.page}</span>
                              </div>
                              <p className="text-sm font-medium mb-1">{suggestion.issue}</p>
                              <div className="flex items-start gap-2 mt-2 p-2 rounded bg-muted/20">
                                <TrendingUp className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                                <p className="text-sm text-muted-foreground">{suggestion.fix}</p>
                              </div>
                            </div>
                          ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}

              {/* Nice-to-have */}
              {aiSuggestions.filter((s) => s.priority === "nice-to-have").length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2 text-blue-400">
                      <Sparkles className="h-5 w-5" />
                      Nice-to-Have ({aiSuggestions.filter((s) => s.priority === "nice-to-have").length})
                    </CardTitle>
                    <CardDescription>Optional enhancements for the best possible SEO</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="max-h-[300px]">
                      <div className="space-y-3">
                        {aiSuggestions
                          .filter((s) => s.priority === "nice-to-have")
                          .map((suggestion, i) => (
                            <div
                              key={i}
                              className="p-4 rounded-lg border border-border/50 bg-muted/5"
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline">Nice-to-have</Badge>
                                <span className="font-mono text-sm text-muted-foreground">{suggestion.page}</span>
                              </div>
                              <p className="text-sm font-medium mb-1">{suggestion.issue}</p>
                              <div className="flex items-start gap-2 mt-2 p-2 rounded bg-muted/20">
                                <TrendingUp className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                                <p className="text-sm text-muted-foreground">{suggestion.fix}</p>
                              </div>
                            </div>
                          ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}

              {/* Summary */}
              <Card className="border-emerald-500/20">
                <CardContent className="pt-6">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="p-4 rounded-lg bg-red-500/10">
                      <p className="text-2xl font-bold text-red-400">
                        {aiSuggestions.filter((s) => s.priority === "critical").length}
                      </p>
                      <p className="text-sm text-muted-foreground">Critical</p>
                    </div>
                    <div className="p-4 rounded-lg bg-yellow-500/10">
                      <p className="text-2xl font-bold text-yellow-400">
                        {aiSuggestions.filter((s) => s.priority === "important").length}
                      </p>
                      <p className="text-sm text-muted-foreground">Important</p>
                    </div>
                    <div className="p-4 rounded-lg bg-blue-500/10">
                      <p className="text-2xl font-bold text-blue-400">
                        {aiSuggestions.filter((s) => s.priority === "nice-to-have").length}
                      </p>
                      <p className="text-sm text-muted-foreground">Nice-to-have</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <EmptyState
                  icon={Sparkles}
                  title="No Suggestions Generated Yet"
                  description="Click 'Generate Suggestions' to run an audit and get AI-powered SEO improvement recommendations."
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
