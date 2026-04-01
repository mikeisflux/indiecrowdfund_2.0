"use client";

import { getCSRFHeaders } from "@/lib/csrf";
import { fetchWithRetry } from "@/lib/fetch-utils";
import { toast } from "sonner";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, RefreshCw, Search, FileText, Tag, Link2, Clock, Sparkles, BarChart3 } from "lucide-react";

import {
  SeoAudit,
  PageAuditResult,
  SeoPageMeta,
  SeoKeyword,
  SeoRedirect,
  SeoCronLog,
  DashboardData,
  AiSuggestion,
  MetaForm,
  KeywordForm,
  RedirectForm,
  DashboardTab,
  PageAuditTab,
  MetaTagsTab,
  KeywordsTab,
  RedirectsTab,
  CronTab,
  AiSuggestionsTab,
} from "./components";

export default function SeoManagementPage() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isLoading, setIsLoading] = useState(true);

  // Dashboard state
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isRunningAudit, setIsRunningAudit] = useState(false);
  const [auditHistory, setAuditHistory] = useState<SeoAudit[]>([]);

  // Page Audit state
  const [auditResults, setAuditResults] = useState<PageAuditResult[]>([]);

  // Meta Tags state
  const [pages, setPages] = useState<SeoPageMeta[]>([]);
  const [pageSearch, setPageSearch] = useState("");
  const [showMetaDialog, setShowMetaDialog] = useState(false);
  const [editingPage, setEditingPage] = useState<SeoPageMeta | null>(null);
  const [metaForm, setMetaForm] = useState<MetaForm>({
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
  const [keywordForm, setKeywordForm] = useState<KeywordForm>({
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
  const [redirectForm, setRedirectForm] = useState<RedirectForm>({
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

  // AI Suggestions state
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestion[]>([]);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);

  // Fix All state
  const [isFixingAll, setIsFixingAll] = useState(false);
  const [isFixingPage, setIsFixingPage] = useState<string | null>(null);

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

  // ─── Fix All / Fix Page Handlers ─────────────────────────────────

  const handleFixAll = async (overwriteExisting = false) => {
    setIsFixingAll(true);
    try {
      const response = await fetchWithRetry("/api/admin/seo/fix-all", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({ fixMissing: true, overwriteExisting }),
      });
      if (response.ok) {
        const json = await response.json();
        const { summary } = json.data;
        toast.success(
          `Fixed ${summary.totalFieldsFixed} fields across ${summary.created + summary.updated} pages (${summary.created} created, ${summary.updated} updated, ${summary.skipped} already good)`
        );
        // Re-run audit to update scores
        await handleRunAudit();
        await fetchPages();
      } else {
        const err = await response.json();
        toast.error(err.error || "Failed to apply fixes");
      }
    } catch {
      toast.error("Network error applying fixes");
    } finally {
      setIsFixingAll(false);
    }
  };

  const handleFixPage = async (path: string) => {
    setIsFixingPage(path);
    try {
      const response = await fetchWithRetry("/api/admin/seo/fix-all", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({ paths: [path], fixMissing: true, overwriteExisting: false }),
      });
      if (response.ok) {
        const json = await response.json();
        const result = json.data.results[0];
        if (result.fieldsFixed.length > 0) {
          toast.success(`Fixed ${result.fieldsFixed.length} fields for ${path}: ${result.fieldsFixed.join(", ")}`);
        } else {
          toast.info(`No missing fields to fix for ${path}`);
        }
        // Re-run audit to update scores
        await handleRunAudit();
        await fetchPages();
      } else {
        const err = await response.json();
        toast.error(err.error || "Failed to fix page");
      }
    } catch {
      toast.error("Network error fixing page");
    } finally {
      setIsFixingPage(null);
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

  // ─── Open meta editor from page audit tab ────────────────────────

  const handleOpenMetaEditorFromAudit = (path: string) => {
    const existing = pages.find((p) => p.path === path);
    if (existing) {
      openEditMeta(existing);
    } else {
      resetMetaForm();
      setMetaForm((prev) => ({ ...prev, path }));
      setShowMetaDialog(true);
    }
    setActiveTab("meta");
  };

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

        <TabsContent value="dashboard" className="space-y-6">
          <DashboardTab
            dashboardData={dashboardData}
            auditHistory={auditHistory}
            isFixingAll={isFixingAll}
            isFixingPage={isFixingPage}
            isRunningAudit={isRunningAudit}
            onFixPage={handleFixPage}
            onFixAll={handleFixAll}
            onEditMeta={(page) => {
              openEditMeta(page);
              setActiveTab("meta");
            }}
          />
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <PageAuditTab
            auditResults={auditResults}
            isFixingAll={isFixingAll}
            isFixingPage={isFixingPage}
            isRunningAudit={isRunningAudit}
            pages={pages}
            onFixAll={handleFixAll}
            onFixPage={handleFixPage}
            onRunAudit={handleRunAudit}
            onOpenMetaEditor={handleOpenMetaEditorFromAudit}
          />
        </TabsContent>

        <TabsContent value="meta" className="space-y-4">
          <MetaTagsTab
            pages={pages}
            pageSearch={pageSearch}
            onPageSearchChange={setPageSearch}
            showMetaDialog={showMetaDialog}
            onShowMetaDialogChange={setShowMetaDialog}
            editingPage={editingPage}
            metaForm={metaForm}
            onMetaFormChange={setMetaForm}
            isSavingMeta={isSavingMeta}
            onSaveMeta={handleSaveMeta}
            onEditMeta={openEditMeta}
            onResetMetaForm={resetMetaForm}
          />
        </TabsContent>

        <TabsContent value="keywords" className="space-y-4">
          <KeywordsTab
            keywords={keywords}
            keywordSearch={keywordSearch}
            onKeywordSearchChange={setKeywordSearch}
            keywordCategoryFilter={keywordCategoryFilter}
            onKeywordCategoryFilterChange={setKeywordCategoryFilter}
            showKeywordDialog={showKeywordDialog}
            onShowKeywordDialogChange={setShowKeywordDialog}
            editingKeyword={editingKeyword}
            keywordForm={keywordForm}
            onKeywordFormChange={setKeywordForm}
            isSavingKeyword={isSavingKeyword}
            onSaveKeyword={handleSaveKeyword}
            onDeleteKeyword={handleDeleteKeyword}
            onEditKeyword={openEditKeyword}
            onResetKeywordForm={resetKeywordForm}
          />
        </TabsContent>

        <TabsContent value="redirects" className="space-y-4">
          <RedirectsTab
            redirects={redirects}
            showRedirectDialog={showRedirectDialog}
            onShowRedirectDialogChange={setShowRedirectDialog}
            editingRedirect={editingRedirect}
            redirectForm={redirectForm}
            onRedirectFormChange={setRedirectForm}
            isSavingRedirect={isSavingRedirect}
            onSaveRedirect={handleSaveRedirect}
            onEditRedirect={openEditRedirect}
            onToggleRedirect={handleToggleRedirect}
            onResetRedirectForm={resetRedirectForm}
            showDeleteRedirectDialog={showDeleteRedirectDialog}
            onShowDeleteRedirectDialogChange={setShowDeleteRedirectDialog}
            redirectToDelete={redirectToDelete}
            onSetRedirectToDelete={setRedirectToDelete}
            onDeleteRedirect={handleDeleteRedirect}
          />
        </TabsContent>

        <TabsContent value="cron" className="space-y-4">
          <CronTab
            cronLogs={cronLogs}
            isRunningCron={isRunningCron}
            onRunCron={handleRunCron}
          />
        </TabsContent>

        <TabsContent value="ai" className="space-y-4">
          <AiSuggestionsTab
            aiSuggestions={aiSuggestions}
            isGeneratingSuggestions={isGeneratingSuggestions}
            isFixingAll={isFixingAll}
            isFixingPage={isFixingPage}
            isRunningAudit={isRunningAudit}
            onGenerateSuggestions={handleGenerateAiSuggestions}
            onFixAll={handleFixAll}
            onFixPage={handleFixPage}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
