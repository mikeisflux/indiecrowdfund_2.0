"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { fetchWithRetry } from "@/lib/fetch-utils";
import { getCSRFHeaders } from "@/lib/csrf";
import {
  Search,
  Loader2,
  Play,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  FileText,
  Globe,
  Hash,
  ArrowRight,
  Plus,
  Pencil,
  Trash2,
  Copy,
  Clock,
  Zap,
  Eye,
  BarChart3,
  Sparkles,
  Terminal,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// ============================================
// Types
// ============================================

interface DashboardData {
  latestAudit: AuditRecord | null;
  totalPages: number;
  totalKeywords: number;
  trackedKeywords: number;
  recentCronLogs: CronLog[];
  lowScorePages: PageMeta[];
  issueStats: { critical: number; warnings: number; passed: number; total: number };
  overallScore: number | null;
}

interface AuditRecord {
  id: string;
  runType: string;
  status: string;
  totalPages: number;
  pagesAudited: number;
  overallScore: number | null;
  issuesFound: number;
  criticalIssues: number;
  warnings: number;
  passed: number;
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

interface PageMeta {
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
  jsonLd: string | null;
  lastAuditScore: number | null;
  updatedAt: string;
  createdAt: string;
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
  updatedAt: string;
  createdAt: string;
}

interface SeoRedirect {
  id: string;
  fromPath: string;
  toPath: string;
  statusCode: number;
  isActive: boolean;
  hitCount: number;
  lastHitAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CronLog {
  id: string;
  status: string;
  auditId: string | null;
  pagesProcessed: number;
  issuesFound: number;
  autoFixed: number;
  errors: string[];
  duration: number | null;
  output: string | null;
  createdAt: string;
}

// ============================================
// Helper Components
// ============================================

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null || score === undefined) return <Badge variant="secondary">N/A</Badge>;
  if (score >= 80) return <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">{score}</Badge>;
  if (score >= 60) return <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30">{score}</Badge>;
  return <Badge className="bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30">{score}</Badge>;
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "success":
    case "completed":
      return <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400"><CheckCircle className="w-3 h-3 mr-1" />{status}</Badge>;
    case "error":
    case "failed":
      return <Badge className="bg-red-500/20 text-red-700 dark:text-red-400"><XCircle className="w-3 h-3 mr-1" />{status}</Badge>;
    case "partial":
    case "running":
      return <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400"><AlertTriangle className="w-3 h-3 mr-1" />{status}</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function ScoreGauge({ score }: { score: number | null }) {
  const val = score ?? 0;
  const color = val >= 80 ? "text-emerald-500" : val >= 60 ? "text-amber-500" : "text-red-500";
  const bgColor = val >= 80 ? "stroke-emerald-500" : val >= 60 ? "stroke-amber-500" : "stroke-red-500";
  const circumference = 2 * Math.PI * 45;
  const dashOffset = circumference - (val / 100) * circumference;

  return (
    <div className="relative w-32 h-32 mx-auto">
      <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
        <circle cx="50" cy="50" r="45" fill="none" strokeWidth="8" strokeLinecap="round"
          className={bgColor}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: "stroke-dashoffset 1s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-3xl font-bold ${color}`}>{val}</span>
        <span className="text-xs text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "N/A";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatDuration(ms: number | null) {
  if (!ms) return "N/A";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ============================================
// Main Page Component
// ============================================

export default function AdminSeoPage() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Dashboard state
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [auditHistory, setAuditHistory] = useState<AuditRecord[]>([]);

  // Page audit state
  const [auditResults, setAuditResults] = useState<PageAuditResult[]>([]);
  const [auditSearch, setAuditSearch] = useState("");
  const [expandedPath, setExpandedPath] = useState<string | null>(null);

  // Meta tags state
  const [pages, setPages] = useState<PageMeta[]>([]);
  const [metaSearch, setMetaSearch] = useState("");
  const [editingPage, setEditingPage] = useState<PageMeta | null>(null);
  const [metaDialogOpen, setMetaDialogOpen] = useState(false);
  const [metaForm, setMetaForm] = useState({
    path: "", title: "", description: "", ogTitle: "", ogDescription: "",
    ogImage: "", twitterTitle: "", twitterDesc: "", canonicalUrl: "",
    noIndex: false, noFollow: false, keywords: "",
  });

  // Keywords state
  const [keywords, setKeywords] = useState<SeoKeyword[]>([]);
  const [keywordFilter, setKeywordFilter] = useState("all");
  const [keywordDialogOpen, setKeywordDialogOpen] = useState(false);
  const [editingKeyword, setEditingKeyword] = useState<SeoKeyword | null>(null);
  const [keywordForm, setKeywordForm] = useState({
    keyword: "", category: "primary", targetPages: "", searchVolume: "",
    difficulty: "", currentRank: "", notes: "",
  });

  // Redirects state
  const [redirects, setRedirects] = useState<SeoRedirect[]>([]);
  const [redirectDialogOpen, setRedirectDialogOpen] = useState(false);
  const [editingRedirect, setEditingRedirect] = useState<SeoRedirect | null>(null);
  const [redirectForm, setRedirectForm] = useState({
    fromPath: "", toPath: "", statusCode: "301",
  });

  // Cron state
  const [cronLogs, setCronLogs] = useState<CronLog[]>([]);
  const [expandedCronId, setExpandedCronId] = useState<string | null>(null);

  // AI state
  const [aiSuggestions, setAiSuggestions] = useState<PageAuditResult[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

  // ============================================
  // Data Fetching
  // ============================================

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetchWithRetry("/api/admin/seo");
      if (res.ok) {
        const json = await res.json();
        setDashboard(json.data);
      }
    } catch (error) {
      console.error("Failed to fetch SEO dashboard:", error);
    }
  }, []);

  const fetchAuditHistory = useCallback(async () => {
    try {
      const res = await fetchWithRetry("/api/admin/seo/audit?limit=10");
      if (res.ok) {
        const json = await res.json();
        setAuditHistory(json.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch audit history:", error);
    }
  }, []);

  const fetchPages = useCallback(async () => {
    try {
      const url = metaSearch ? `/api/admin/seo/pages?query=${encodeURIComponent(metaSearch)}` : "/api/admin/seo/pages";
      const res = await fetchWithRetry(url);
      if (res.ok) {
        const json = await res.json();
        setPages(json.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch pages:", error);
    }
  }, [metaSearch]);

  const fetchKeywords = useCallback(async () => {
    try {
      const url = keywordFilter !== "all" ? `/api/admin/seo/keywords?category=${keywordFilter}` : "/api/admin/seo/keywords";
      const res = await fetchWithRetry(url);
      if (res.ok) {
        const json = await res.json();
        setKeywords(json.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch keywords:", error);
    }
  }, [keywordFilter]);

  const fetchRedirects = useCallback(async () => {
    try {
      const res = await fetchWithRetry("/api/admin/seo/redirects");
      if (res.ok) {
        const json = await res.json();
        setRedirects(json.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch redirects:", error);
    }
  }, []);

  const fetchCronLogs = useCallback(async () => {
    try {
      const res = await fetchWithRetry("/api/admin/seo");
      if (res.ok) {
        const json = await res.json();
        setCronLogs(json.data?.recentCronLogs || []);
      }
    } catch (error) {
      console.error("Failed to fetch cron logs:", error);
    }
  }, []);

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([fetchDashboard(), fetchAuditHistory()]);
      setLoading(false);
    };
    loadAll();
  }, [fetchDashboard, fetchAuditHistory]);

  useEffect(() => {
    if (activeTab === "meta") fetchPages();
  }, [activeTab, fetchPages]);

  useEffect(() => {
    if (activeTab === "keywords") fetchKeywords();
  }, [activeTab, fetchKeywords]);

  useEffect(() => {
    if (activeTab === "redirects") fetchRedirects();
  }, [activeTab, fetchRedirects]);

  useEffect(() => {
    if (activeTab === "cron") fetchCronLogs();
  }, [activeTab, fetchCronLogs]);

  // ============================================
  // Actions
  // ============================================

  const runAudit = async () => {
    setActionLoading(true);
    try {
      const res = await fetchWithRetry("/api/admin/seo/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
      });
      if (res.ok) {
        const json = await res.json();
        toast.success(`Audit complete! Score: ${json.data.overallScore}/100`);
        setAuditResults(json.data.results || []);
        await fetchDashboard();
        await fetchAuditHistory();
      } else {
        const err = await res.json();
        toast.error(err.error || "Audit failed");
      }
    } catch (error) {
      console.error("Audit error:", error);
      toast.error("Failed to run audit");
    } finally {
      setActionLoading(false);
    }
  };

  const runCron = async () => {
    setActionLoading(true);
    try {
      const res = await fetchWithRetry("/api/admin/seo/cron", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
      });
      if (res.ok) {
        const json = await res.json();
        toast.success(`Cron completed! Score: ${json.data.auditScore}/100, Issues: ${json.data.projectIssuesFound}`);
        await fetchDashboard();
        await fetchCronLogs();
      } else {
        const err = await res.json();
        toast.error(err.error || "Cron failed");
      }
    } catch (error) {
      console.error("Cron error:", error);
      toast.error("Failed to run cron");
    } finally {
      setActionLoading(false);
    }
  };

  const saveMeta = async () => {
    setActionLoading(true);
    try {
      const res = await fetchWithRetry("/api/admin/seo/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          ...metaForm,
          keywords: metaForm.keywords.split(",").map(k => k.trim()).filter(Boolean),
        }),
      });
      if (res.ok) {
        toast.success("Meta tags saved");
        setMetaDialogOpen(false);
        await fetchPages();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to save");
      }
    } catch (error) {
      console.error("Save meta error:", error);
      toast.error("Failed to save meta tags");
    } finally {
      setActionLoading(false);
    }
  };

  const saveKeyword = async () => {
    setActionLoading(true);
    try {
      const isEdit = !!editingKeyword;
      const body = {
        ...(isEdit && { id: editingKeyword.id }),
        keyword: keywordForm.keyword,
        category: keywordForm.category || null,
        targetPages: keywordForm.targetPages.split(",").map(p => p.trim()).filter(Boolean),
        searchVolume: keywordForm.searchVolume ? parseInt(keywordForm.searchVolume) : null,
        difficulty: keywordForm.difficulty ? parseInt(keywordForm.difficulty) : null,
        currentRank: keywordForm.currentRank ? parseInt(keywordForm.currentRank) : null,
        notes: keywordForm.notes || null,
      };
      const res = await fetchWithRetry("/api/admin/seo/keywords", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        toast.success(isEdit ? "Keyword updated" : "Keyword added");
        setKeywordDialogOpen(false);
        setEditingKeyword(null);
        await fetchKeywords();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to save keyword");
      }
    } catch (error) {
      console.error("Save keyword error:", error);
      toast.error("Failed to save keyword");
    } finally {
      setActionLoading(false);
    }
  };

  const deleteKeyword = async (id: string) => {
    try {
      const res = await fetchWithRetry(`/api/admin/seo/keywords?id=${id}`, {
        method: "DELETE",
        headers: { ...getCSRFHeaders() },
      });
      if (res.ok) {
        toast.success("Keyword deleted");
        await fetchKeywords();
      } else {
        toast.error("Failed to delete keyword");
      }
    } catch (error) {
      console.error("Delete keyword error:", error);
      toast.error("Failed to delete keyword");
    }
  };

  const saveRedirect = async () => {
    setActionLoading(true);
    try {
      const isEdit = !!editingRedirect;
      const body = {
        ...(isEdit && { id: editingRedirect.id }),
        fromPath: redirectForm.fromPath,
        toPath: redirectForm.toPath,
        statusCode: parseInt(redirectForm.statusCode),
      };
      const res = await fetchWithRetry("/api/admin/seo/redirects", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        toast.success(isEdit ? "Redirect updated" : "Redirect created");
        setRedirectDialogOpen(false);
        setEditingRedirect(null);
        await fetchRedirects();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to save redirect");
      }
    } catch (error) {
      console.error("Save redirect error:", error);
      toast.error("Failed to save redirect");
    } finally {
      setActionLoading(false);
    }
  };

  const deleteRedirect = async (id: string) => {
    try {
      const res = await fetchWithRetry(`/api/admin/seo/redirects?id=${id}`, {
        method: "DELETE",
        headers: { ...getCSRFHeaders() },
      });
      if (res.ok) {
        toast.success("Redirect deleted");
        await fetchRedirects();
      } else {
        toast.error("Failed to delete redirect");
      }
    } catch (error) {
      console.error("Delete redirect error:", error);
      toast.error("Failed to delete redirect");
    }
  };

  const toggleRedirectActive = async (redirect: SeoRedirect) => {
    try {
      const res = await fetchWithRetry("/api/admin/seo/redirects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({ id: redirect.id, isActive: !redirect.isActive }),
      });
      if (res.ok) {
        toast.success(redirect.isActive ? "Redirect disabled" : "Redirect enabled");
        await fetchRedirects();
      }
    } catch (error) {
      console.error("Toggle redirect error:", error);
    }
  };

  const generateAiSuggestions = async () => {
    setAiLoading(true);
    try {
      const res = await fetchWithRetry("/api/admin/seo/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
      });
      if (res.ok) {
        const json = await res.json();
        const results = (json.data.results || []) as PageAuditResult[];
        setAiSuggestions(results.filter((r: PageAuditResult) => r.issues.length > 0).sort((a: PageAuditResult, b: PageAuditResult) => a.score - b.score));
        toast.success("AI analysis complete");
        await fetchDashboard();
      } else {
        toast.error("Failed to generate suggestions");
      }
    } catch (error) {
      console.error("AI suggestions error:", error);
      toast.error("Failed to generate AI suggestions");
    } finally {
      setAiLoading(false);
    }
  };

  const openEditMeta = (page: PageMeta) => {
    setEditingPage(page);
    setMetaForm({
      path: page.path, title: page.title || "", description: page.description || "",
      ogTitle: page.ogTitle || "", ogDescription: page.ogDescription || "",
      ogImage: page.ogImage || "", twitterTitle: page.twitterTitle || "",
      twitterDesc: page.twitterDesc || "", canonicalUrl: page.canonicalUrl || "",
      noIndex: page.noIndex, noFollow: page.noFollow, keywords: page.keywords.join(", "),
    });
    setMetaDialogOpen(true);
  };

  const openNewMeta = () => {
    setEditingPage(null);
    setMetaForm({
      path: "", title: "", description: "", ogTitle: "", ogDescription: "",
      ogImage: "", twitterTitle: "", twitterDesc: "", canonicalUrl: "",
      noIndex: false, noFollow: false, keywords: "",
    });
    setMetaDialogOpen(true);
  };

  const openEditKeyword = (kw: SeoKeyword) => {
    setEditingKeyword(kw);
    setKeywordForm({
      keyword: kw.keyword, category: kw.category || "primary",
      targetPages: kw.targetPages.join(", "), searchVolume: kw.searchVolume?.toString() || "",
      difficulty: kw.difficulty?.toString() || "", currentRank: kw.currentRank?.toString() || "",
      notes: kw.notes || "",
    });
    setKeywordDialogOpen(true);
  };

  const openNewKeyword = () => {
    setEditingKeyword(null);
    setKeywordForm({ keyword: "", category: "primary", targetPages: "", searchVolume: "", difficulty: "", currentRank: "", notes: "" });
    setKeywordDialogOpen(true);
  };

  const openEditRedirect = (r: SeoRedirect) => {
    setEditingRedirect(r);
    setRedirectForm({ fromPath: r.fromPath, toPath: r.toPath, statusCode: r.statusCode.toString() });
    setRedirectDialogOpen(true);
  };

  const openNewRedirect = () => {
    setEditingRedirect(null);
    setRedirectForm({ fromPath: "", toPath: "", statusCode: "301" });
    setRedirectDialogOpen(true);
  };

  const filteredAuditResults = auditResults.filter(r => r.path.toLowerCase().includes(auditSearch.toLowerCase()));

  // ============================================
  // Loading State
  // ============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500 mx-auto mb-4" />
          <p className="text-muted-foreground">Loading SEO Suite...</p>
        </div>
      </div>
    );
  }

  // ============================================
  // Render
  // ============================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20">
              <Search className="h-6 w-6 text-emerald-500" />
            </div>
            SEO Suite
          </h1>
          <p className="text-muted-foreground mt-1">Comprehensive SEO management, auditing, and optimization</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { fetchDashboard(); fetchAuditHistory(); }} disabled={actionLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${actionLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={runAudit} disabled={actionLoading} className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700">
            {actionLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
            Run Full Audit
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-7 w-full">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="audit">Page Audit</TabsTrigger>
          <TabsTrigger value="meta">Meta Tags</TabsTrigger>
          <TabsTrigger value="keywords">Keywords</TabsTrigger>
          <TabsTrigger value="redirects">Redirects</TabsTrigger>
          <TabsTrigger value="cron">Cron</TabsTrigger>
          <TabsTrigger value="ai">AI</TabsTrigger>
        </TabsList>

        {/* ============================================ */}
        {/* TAB: Dashboard */}
        {/* ============================================ */}
        <TabsContent value="dashboard" className="space-y-6">
          {/* Score Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card className="md:col-span-1">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground text-center mb-2">SEO Score</p>
                <ScoreGauge score={dashboard?.overallScore ?? null} />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <FileText className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                <p className="text-3xl font-bold">{dashboard?.totalPages ?? 0}</p>
                <p className="text-sm text-muted-foreground">Pages Tracked</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <Hash className="h-8 w-8 text-purple-500 mx-auto mb-2" />
                <p className="text-3xl font-bold">{dashboard?.totalKeywords ?? 0}</p>
                <p className="text-sm text-muted-foreground">Keywords</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                <p className="text-3xl font-bold">{dashboard?.issueStats.total ?? 0}</p>
                <p className="text-sm text-muted-foreground">Total Issues</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <XCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
                <p className="text-3xl font-bold">{dashboard?.issueStats.critical ?? 0}</p>
                <p className="text-sm text-muted-foreground">Critical Issues</p>
              </CardContent>
            </Card>
          </div>

          {/* Audit History Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Audit Score History</CardTitle>
            </CardHeader>
            <CardContent>
              {auditHistory.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No audits yet. Run your first audit to see the score history.</p>
              ) : (
                <div className="flex items-end gap-2 h-40">
                  {auditHistory.slice().reverse().map((audit) => {
                    const score = audit.overallScore ?? 0;
                    const color = score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-amber-500" : "bg-red-500";
                    return (
                      <div key={audit.id} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-xs font-medium">{score}</span>
                        <div className={`w-full rounded-t ${color} transition-all`} style={{ height: `${Math.max(score, 5)}%` }} />
                        <span className="text-[10px] text-muted-foreground">{new Date(audit.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Low Score Pages & Latest Audit */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" /> Pages Needing Attention</CardTitle>
              </CardHeader>
              <CardContent>
                {(dashboard?.lowScorePages?.length ?? 0) === 0 ? (
                  <p className="text-muted-foreground text-center py-4">All pages are scoring well!</p>
                ) : (
                  <div className="space-y-2">
                    {dashboard?.lowScorePages.map((page) => (
                      <div key={page.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                        <span className="text-sm font-mono truncate flex-1">{page.path}</span>
                        <ScoreBadge score={page.lastAuditScore} />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> Latest Audit Summary</CardTitle>
              </CardHeader>
              <CardContent>
                {dashboard?.latestAudit ? (
                  <div className="space-y-3">
                    <div className="flex justify-between"><span className="text-muted-foreground">Status</span><StatusBadge status={dashboard.latestAudit.status} /></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Run Type</span><Badge variant="secondary">{dashboard.latestAudit.runType}</Badge></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Pages Audited</span><span className="font-medium">{dashboard.latestAudit.pagesAudited}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Duration</span><span className="font-medium">{formatDuration(dashboard.latestAudit.duration)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span className="text-sm">{formatDate(dashboard.latestAudit.completedAt)}</span></div>
                    {dashboard.latestAudit.summary && (
                      <p className="text-sm text-muted-foreground border-t pt-2 mt-2">{dashboard.latestAudit.summary}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">No audits yet</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ============================================ */}
        {/* TAB: Page Audit */}
        {/* ============================================ */}
        <TabsContent value="audit" className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Filter by path..." value={auditSearch} onChange={(e) => setAuditSearch(e.target.value)} className="pl-10" />
            </div>
            <Button onClick={runAudit} disabled={actionLoading}>
              {actionLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              Run Audit
            </Button>
          </div>

          {auditResults.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Search className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-lg font-medium">No Audit Results</p>
                <p className="text-muted-foreground mt-1">Click &quot;Run Audit&quot; to scan all pages</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {filteredAuditResults.map((result) => (
                <Card key={result.path} className="cursor-pointer" onClick={() => setExpandedPath(expandedPath === result.path ? null : result.path)}>
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {result.score >= 80 ? <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" /> :
                         result.score >= 60 ? <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" /> :
                         <XCircle className="h-5 w-5 text-red-500 shrink-0" />}
                        <span className="font-mono text-sm truncate">{result.path}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">{result.issues.length} issues</span>
                        <ScoreBadge score={result.score} />
                        {expandedPath === result.path ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </div>
                    {expandedPath === result.path && (
                      <div className="mt-4 pt-4 border-t space-y-3">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                          <div className="flex items-center gap-1">{result.hasTitle ? <CheckCircle className="h-3 w-3 text-emerald-500" /> : <XCircle className="h-3 w-3 text-red-500" />} Title</div>
                          <div className="flex items-center gap-1">{result.hasDescription ? <CheckCircle className="h-3 w-3 text-emerald-500" /> : <XCircle className="h-3 w-3 text-red-500" />} Description</div>
                          <div className="flex items-center gap-1">{result.hasOgTitle ? <CheckCircle className="h-3 w-3 text-emerald-500" /> : <XCircle className="h-3 w-3 text-red-500" />} OG Title</div>
                          <div className="flex items-center gap-1">{result.hasOgImage ? <CheckCircle className="h-3 w-3 text-emerald-500" /> : <XCircle className="h-3 w-3 text-red-500" />} OG Image</div>
                          <div className="flex items-center gap-1">{result.hasKeywords ? <CheckCircle className="h-3 w-3 text-emerald-500" /> : <XCircle className="h-3 w-3 text-red-500" />} Keywords</div>
                          <div className="flex items-center gap-1">{result.descriptionLengthOk ? <CheckCircle className="h-3 w-3 text-emerald-500" /> : <XCircle className="h-3 w-3 text-red-500" />} Desc Length{result.descriptionLength !== null && ` (${result.descriptionLength})`}</div>
                          <div className="flex items-center gap-1">{!result.noIndex ? <CheckCircle className="h-3 w-3 text-emerald-500" /> : <AlertTriangle className="h-3 w-3 text-amber-500" />} Indexable</div>
                          <div className="flex items-center gap-1">{result.hasPageMeta ? <CheckCircle className="h-3 w-3 text-emerald-500" /> : <XCircle className="h-3 w-3 text-red-500" />} Has Meta Record</div>
                        </div>
                        {result.issues.length > 0 && (
                          <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3">
                            <p className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">Issues:</p>
                            <ul className="space-y-1">
                              {result.issues.map((issue, i) => (
                                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                                  <XCircle className="h-3 w-3 text-red-500 mt-0.5 shrink-0" /> {issue}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ============================================ */}
        {/* TAB: Meta Tags Manager */}
        {/* ============================================ */}
        <TabsContent value="meta" className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search pages..." value={metaSearch} onChange={(e) => setMetaSearch(e.target.value)} className="pl-10" />
            </div>
            <Button onClick={openNewMeta}><Plus className="h-4 w-4 mr-2" /> Add Page Meta</Button>
          </div>

          <div className="space-y-2">
            {pages.map((page) => (
              <Card key={page.id}>
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0 mr-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">{page.path}</span>
                        <ScoreBadge score={page.lastAuditScore} />
                        {page.noIndex && <Badge variant="destructive" className="text-[10px]">noindex</Badge>}
                      </div>
                      {page.title && <p className="text-sm text-muted-foreground mt-1 truncate">{page.title}</p>}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => openEditMeta(page)}><Pencil className="h-4 w-4" /></Button>
                  </div>
                  {/* Google Preview */}
                  {page.title && (
                    <div className="mt-3 p-3 rounded-lg bg-muted/50 border">
                      <p className="text-xs text-muted-foreground mb-1">Google Preview:</p>
                      <p className="text-blue-600 dark:text-blue-400 text-sm font-medium hover:underline truncate">{page.title}</p>
                      <p className="text-emerald-600 dark:text-emerald-400 text-xs">indiecrowdfund.com{page.path}</p>
                      <p className="text-sm text-muted-foreground line-clamp-2">{page.description || "No description set"}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            {pages.length === 0 && (
              <Card><CardContent className="py-8 text-center text-muted-foreground">No pages found. Run an audit to populate page data.</CardContent></Card>
            )}
          </div>
        </TabsContent>

        {/* ============================================ */}
        {/* TAB: Keywords */}
        {/* ============================================ */}
        <TabsContent value="keywords" className="space-y-4">
          <div className="flex items-center gap-4">
            <Select value={keywordFilter} onValueChange={setKeywordFilter}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="primary">Primary</SelectItem>
                <SelectItem value="secondary">Secondary</SelectItem>
                <SelectItem value="long-tail">Long-tail</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={openNewKeyword}><Plus className="h-4 w-4 mr-2" /> Add Keyword</Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 font-medium">Keyword</th>
                      <th className="text-left p-3 font-medium">Category</th>
                      <th className="text-center p-3 font-medium">Volume</th>
                      <th className="text-center p-3 font-medium">Difficulty</th>
                      <th className="text-center p-3 font-medium">Rank</th>
                      <th className="text-center p-3 font-medium">Change</th>
                      <th className="text-right p-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {keywords.map((kw) => {
                      const rankChange = kw.previousRank && kw.currentRank ? kw.previousRank - kw.currentRank : null;
                      return (
                        <tr key={kw.id} className="border-b hover:bg-muted/50">
                          <td className="p-3 font-medium">{kw.keyword}</td>
                          <td className="p-3"><Badge variant="secondary">{kw.category || "uncategorized"}</Badge></td>
                          <td className="p-3 text-center">{kw.searchVolume?.toLocaleString() ?? "-"}</td>
                          <td className="p-3 text-center">
                            {kw.difficulty !== null ? (
                              <Badge className={kw.difficulty >= 70 ? "bg-red-500/20 text-red-600" : kw.difficulty >= 40 ? "bg-amber-500/20 text-amber-600" : "bg-emerald-500/20 text-emerald-600"}>
                                {kw.difficulty}
                              </Badge>
                            ) : "-"}
                          </td>
                          <td className="p-3 text-center font-mono">{kw.currentRank ?? "-"}</td>
                          <td className="p-3 text-center">
                            {rankChange !== null ? (
                              <span className={`flex items-center justify-center gap-1 ${rankChange > 0 ? "text-emerald-500" : rankChange < 0 ? "text-red-500" : "text-muted-foreground"}`}>
                                {rankChange > 0 ? <TrendingUp className="h-3 w-3" /> : rankChange < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                                {Math.abs(rankChange)}
                              </span>
                            ) : "-"}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => openEditKeyword(kw)}><Pencil className="h-3 w-3" /></Button>
                              <Button variant="ghost" size="sm" onClick={() => deleteKeyword(kw.id)}><Trash2 className="h-3 w-3 text-red-500" /></Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {keywords.length === 0 && <p className="text-center py-8 text-muted-foreground">No keywords tracked yet</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================ */}
        {/* TAB: Redirects */}
        {/* ============================================ */}
        <TabsContent value="redirects" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{redirects.length} redirect{redirects.length !== 1 ? "s" : ""} configured</p>
            <Button onClick={openNewRedirect}><Plus className="h-4 w-4 mr-2" /> Add Redirect</Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 font-medium">From</th>
                      <th className="text-left p-3 font-medium">To</th>
                      <th className="text-center p-3 font-medium">Status</th>
                      <th className="text-center p-3 font-medium">Hits</th>
                      <th className="text-center p-3 font-medium">Active</th>
                      <th className="text-right p-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {redirects.map((r) => (
                      <tr key={r.id} className="border-b hover:bg-muted/50">
                        <td className="p-3 font-mono text-xs">{r.fromPath}</td>
                        <td className="p-3 font-mono text-xs flex items-center gap-1"><ArrowRight className="h-3 w-3 text-muted-foreground" /> {r.toPath}</td>
                        <td className="p-3 text-center"><Badge variant="secondary">{r.statusCode}</Badge></td>
                        <td className="p-3 text-center">{r.hitCount}</td>
                        <td className="p-3 text-center"><Switch checked={r.isActive} onCheckedChange={() => toggleRedirectActive(r)} /></td>
                        <td className="p-3 text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openEditRedirect(r)}><Pencil className="h-3 w-3" /></Button>
                            <Button variant="ghost" size="sm" onClick={() => deleteRedirect(r.id)}><Trash2 className="h-3 w-3 text-red-500" /></Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {redirects.length === 0 && <p className="text-center py-8 text-muted-foreground">No redirects configured</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================ */}
        {/* TAB: Cron & Automation */}
        {/* ============================================ */}
        <TabsContent value="cron" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Terminal className="h-5 w-5" /> Cron Setup</CardTitle>
                <CardDescription>Configure automated daily SEO audits</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">1. Add to .env file:</Label>
                  <div className="mt-1 p-3 rounded-lg bg-muted font-mono text-xs relative">
                    <code>SEO_CRON_API_KEY=your-secret-key-here</code>
                    <Button variant="ghost" size="sm" className="absolute top-1 right-1" onClick={() => { navigator.clipboard.writeText("SEO_CRON_API_KEY=your-secret-key-here"); toast.info("Copied!"); }}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">2. Add to crontab (runs daily at 3 AM):</Label>
                  <div className="mt-1 p-3 rounded-lg bg-muted font-mono text-xs relative break-all">
                    <code>0 3 * * * curl -s &quot;https://www.indiecrowdfund.com/api/admin/seo/cron?apiKey=YOUR_API_KEY&quot; -X POST &gt; /dev/null 2&gt;&amp;1</code>
                    <Button variant="ghost" size="sm" className="absolute top-1 right-1" onClick={() => { navigator.clipboard.writeText('0 3 * * * curl -s "https://www.indiecrowdfund.com/api/admin/seo/cron?apiKey=YOUR_API_KEY" -X POST > /dev/null 2>&1'); toast.info("Copied!"); }}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">3. Or use the shell script:</Label>
                  <div className="mt-1 p-3 rounded-lg bg-muted font-mono text-xs relative">
                    <code>0 3 * * * /path/to/scripts/seo-cron.sh &gt;&gt; /var/log/seo-cron.log 2&gt;&amp;1</code>
                  </div>
                </div>
                <Button onClick={runCron} disabled={actionLoading} className="w-full">
                  {actionLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
                  Run Cron Now
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> Recent Cron Logs</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-80">
                  {cronLogs.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No cron logs yet</p>
                  ) : (
                    <div className="space-y-2">
                      {cronLogs.map((log) => (
                        <div key={log.id} className="border rounded-lg p-3 cursor-pointer hover:bg-muted/50" onClick={() => setExpandedCronId(expandedCronId === log.id ? null : log.id)}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <StatusBadge status={log.status} />
                              <span className="text-xs text-muted-foreground">{formatDate(log.createdAt)}</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>{log.pagesProcessed} pages</span>
                              <span>{log.issuesFound} issues</span>
                              <span>{formatDuration(log.duration)}</span>
                            </div>
                          </div>
                          {expandedCronId === log.id && log.output && (
                            <div className="mt-2 p-2 rounded bg-muted text-xs font-mono whitespace-pre-wrap">{log.output}</div>
                          )}
                          {expandedCronId === log.id && log.errors.length > 0 && (
                            <div className="mt-2 p-2 rounded bg-red-500/5 border border-red-500/20 text-xs">
                              {log.errors.map((err, i) => <p key={i} className="text-red-600 dark:text-red-400">{err}</p>)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ============================================ */}
        {/* TAB: AI Suggestions */}
        {/* ============================================ */}
        <TabsContent value="ai" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-amber-500" /> AI-Powered SEO Suggestions</CardTitle>
              <CardDescription>Run an audit and get prioritized recommendations for improving your site&apos;s SEO</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={generateAiSuggestions} disabled={aiLoading} className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700">
                {aiLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Generate AI Suggestions
              </Button>
            </CardContent>
          </Card>

          {aiSuggestions.length > 0 && (
            <>
              {/* Critical */}
              {aiSuggestions.filter(s => s.score < 30).length > 0 && (
                <Card className="border-red-500/30">
                  <CardHeader>
                    <CardTitle className="text-red-600 dark:text-red-400 flex items-center gap-2"><XCircle className="h-5 w-5" /> Critical - Immediate Action Required</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {aiSuggestions.filter(s => s.score < 30).map((s) => (
                      <div key={s.path} className="p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono text-sm font-medium">{s.path}</span>
                          <ScoreBadge score={s.score} />
                        </div>
                        <ul className="space-y-1">
                          {s.issues.map((issue, i) => (
                            <li key={i} className="text-sm flex items-start gap-2"><ArrowRight className="h-3 w-3 mt-1 text-red-500 shrink-0" /> {issue}</li>
                          ))}
                        </ul>
                        <Button variant="outline" size="sm" className="mt-2" onClick={() => { setActiveTab("meta"); setMetaSearch(s.path); }}>
                          <Pencil className="h-3 w-3 mr-1" /> Fix Meta Tags
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Important */}
              {aiSuggestions.filter(s => s.score >= 30 && s.score < 70).length > 0 && (
                <Card className="border-amber-500/30">
                  <CardHeader>
                    <CardTitle className="text-amber-600 dark:text-amber-400 flex items-center gap-2"><AlertTriangle className="h-5 w-5" /> Important - Should Fix Soon</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {aiSuggestions.filter(s => s.score >= 30 && s.score < 70).map((s) => (
                      <div key={s.path} className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono text-sm font-medium">{s.path}</span>
                          <ScoreBadge score={s.score} />
                        </div>
                        <ul className="space-y-1">
                          {s.issues.map((issue, i) => (
                            <li key={i} className="text-sm flex items-start gap-2"><ArrowRight className="h-3 w-3 mt-1 text-amber-500 shrink-0" /> {issue}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Nice-to-have */}
              {aiSuggestions.filter(s => s.score >= 70).length > 0 && (
                <Card className="border-emerald-500/30">
                  <CardHeader>
                    <CardTitle className="text-emerald-600 dark:text-emerald-400 flex items-center gap-2"><Eye className="h-5 w-5" /> Nice-to-Have - Minor Improvements</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {aiSuggestions.filter(s => s.score >= 70).map((s) => (
                      <div key={s.path} className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono text-sm font-medium">{s.path}</span>
                          <ScoreBadge score={s.score} />
                        </div>
                        <ul className="space-y-1">
                          {s.issues.map((issue, i) => (
                            <li key={i} className="text-sm flex items-start gap-2"><ArrowRight className="h-3 w-3 mt-1 text-emerald-500 shrink-0" /> {issue}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* General Recommendations */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" /> General SEO Recommendations</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-3 rounded-lg bg-muted/50 border">
                      <p className="font-medium text-sm mb-1">Internal Linking</p>
                      <p className="text-xs text-muted-foreground">Ensure all pages link to at least 2-3 other pages. Use keyword-rich anchor text for internal links.</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50 border">
                      <p className="font-medium text-sm mb-1">Keyword Density</p>
                      <p className="text-xs text-muted-foreground">Target keywords like &quot;Kickstarter alternative&quot;, &quot;crowdfunding&quot;, &quot;better than Kickstarter&quot; should appear in titles, descriptions, and H1/H2 tags.</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50 border">
                      <p className="font-medium text-sm mb-1">Content Freshness</p>
                      <p className="text-xs text-muted-foreground">Update key pages regularly. Add blog posts, success stories, and case studies to improve content freshness signals.</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50 border">
                      <p className="font-medium text-sm mb-1">Structured Data</p>
                      <p className="text-xs text-muted-foreground">Add JSON-LD for Organization, FAQ, BreadcrumbList, and Product schemas where appropriate.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* ============================================ */}
      {/* Dialogs */}
      {/* ============================================ */}

      {/* Meta Tags Dialog */}
      <Dialog open={metaDialogOpen} onOpenChange={setMetaDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPage ? "Edit Meta Tags" : "Add Page Meta Tags"}</DialogTitle>
            <DialogDescription>Configure SEO meta tags for a page</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Page Path</Label><Input value={metaForm.path} onChange={(e) => setMetaForm({ ...metaForm, path: e.target.value })} placeholder="/about-us" disabled={!!editingPage} /></div>
            <div><Label>Title</Label><Input value={metaForm.title} onChange={(e) => setMetaForm({ ...metaForm, title: e.target.value })} placeholder="Page Title | IndieCrowdfund" /><p className="text-xs text-muted-foreground mt-1">{metaForm.title.length} chars (50-60 recommended)</p></div>
            <div><Label>Description</Label><Textarea value={metaForm.description} onChange={(e) => setMetaForm({ ...metaForm, description: e.target.value })} placeholder="SEO description..." rows={3} /><p className="text-xs text-muted-foreground mt-1">{metaForm.description.length} chars (50-160 recommended)</p></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>OG Title</Label><Input value={metaForm.ogTitle} onChange={(e) => setMetaForm({ ...metaForm, ogTitle: e.target.value })} /></div>
              <div><Label>OG Image URL</Label><Input value={metaForm.ogImage} onChange={(e) => setMetaForm({ ...metaForm, ogImage: e.target.value })} /></div>
            </div>
            <div><Label>OG Description</Label><Textarea value={metaForm.ogDescription} onChange={(e) => setMetaForm({ ...metaForm, ogDescription: e.target.value })} rows={2} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Twitter Title</Label><Input value={metaForm.twitterTitle} onChange={(e) => setMetaForm({ ...metaForm, twitterTitle: e.target.value })} /></div>
              <div><Label>Canonical URL</Label><Input value={metaForm.canonicalUrl} onChange={(e) => setMetaForm({ ...metaForm, canonicalUrl: e.target.value })} /></div>
            </div>
            <div><Label>Twitter Description</Label><Textarea value={metaForm.twitterDesc} onChange={(e) => setMetaForm({ ...metaForm, twitterDesc: e.target.value })} rows={2} /></div>
            <div><Label>Keywords (comma-separated)</Label><Input value={metaForm.keywords} onChange={(e) => setMetaForm({ ...metaForm, keywords: e.target.value })} placeholder="crowdfunding, Kickstarter alternative" /></div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2"><Switch checked={metaForm.noIndex} onCheckedChange={(v) => setMetaForm({ ...metaForm, noIndex: v })} /><Label>noindex</Label></div>
              <div className="flex items-center gap-2"><Switch checked={metaForm.noFollow} onCheckedChange={(v) => setMetaForm({ ...metaForm, noFollow: v })} /><Label>nofollow</Label></div>
            </div>

            {/* Google Preview */}
            <div className="p-3 rounded-lg bg-muted/50 border">
              <p className="text-xs text-muted-foreground mb-2">Google Search Preview:</p>
              <p className="text-blue-600 dark:text-blue-400 text-base font-medium truncate">{metaForm.title || "Page Title"}</p>
              <p className="text-emerald-600 dark:text-emerald-400 text-xs">indiecrowdfund.com{metaForm.path || "/page"}</p>
              <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">{metaForm.description || "Meta description will appear here..."}</p>
            </div>

            <Button onClick={saveMeta} disabled={actionLoading} className="w-full">
              {actionLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              Save Meta Tags
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Keyword Dialog */}
      <Dialog open={keywordDialogOpen} onOpenChange={setKeywordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingKeyword ? "Edit Keyword" : "Add Keyword"}</DialogTitle>
            <DialogDescription>Track and manage SEO keywords</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Keyword</Label><Input value={keywordForm.keyword} onChange={(e) => setKeywordForm({ ...keywordForm, keyword: e.target.value })} placeholder="kickstarter alternative" /></div>
            <div><Label>Category</Label>
              <Select value={keywordForm.category} onValueChange={(v) => setKeywordForm({ ...keywordForm, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">Primary</SelectItem>
                  <SelectItem value="secondary">Secondary</SelectItem>
                  <SelectItem value="long-tail">Long-tail</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Search Volume</Label><Input type="number" value={keywordForm.searchVolume} onChange={(e) => setKeywordForm({ ...keywordForm, searchVolume: e.target.value })} /></div>
              <div><Label>Difficulty (0-100)</Label><Input type="number" value={keywordForm.difficulty} onChange={(e) => setKeywordForm({ ...keywordForm, difficulty: e.target.value })} /></div>
              <div><Label>Current Rank</Label><Input type="number" value={keywordForm.currentRank} onChange={(e) => setKeywordForm({ ...keywordForm, currentRank: e.target.value })} /></div>
            </div>
            <div><Label>Target Pages (comma-separated)</Label><Input value={keywordForm.targetPages} onChange={(e) => setKeywordForm({ ...keywordForm, targetPages: e.target.value })} placeholder="/, /discover, /about-us" /></div>
            <div><Label>Notes</Label><Textarea value={keywordForm.notes} onChange={(e) => setKeywordForm({ ...keywordForm, notes: e.target.value })} rows={2} /></div>
            <Button onClick={saveKeyword} disabled={actionLoading} className="w-full">
              {actionLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              {editingKeyword ? "Update Keyword" : "Add Keyword"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Redirect Dialog */}
      <Dialog open={redirectDialogOpen} onOpenChange={setRedirectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRedirect ? "Edit Redirect" : "Add Redirect"}</DialogTitle>
            <DialogDescription>Configure URL redirects for SEO</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>From Path</Label><Input value={redirectForm.fromPath} onChange={(e) => setRedirectForm({ ...redirectForm, fromPath: e.target.value })} placeholder="/old-page" /></div>
            <div><Label>To Path</Label><Input value={redirectForm.toPath} onChange={(e) => setRedirectForm({ ...redirectForm, toPath: e.target.value })} placeholder="/new-page" /></div>
            <div><Label>Status Code</Label>
              <Select value={redirectForm.statusCode} onValueChange={(v) => setRedirectForm({ ...redirectForm, statusCode: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="301">301 - Permanent</SelectItem>
                  <SelectItem value="302">302 - Temporary</SelectItem>
                  <SelectItem value="307">307 - Temporary (Strict)</SelectItem>
                  <SelectItem value="308">308 - Permanent (Strict)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={saveRedirect} disabled={actionLoading} className="w-full">
              {actionLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              {editingRedirect ? "Update Redirect" : "Create Redirect"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
