"use client";

import { fetchWithRetry, apiFetch } from "@/lib/fetch-utils";
import { toast } from "sonner";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FolderKanban,
  Clock,
  CheckCircle,
  History,
  Flag,
  RefreshCw,
  Loader2,
  Zap,
  Sparkles,
  Archive,
  FileEdit,
} from "lucide-react";
import {
  Project,
  ReviewHistory,
  Stats,
  getFlags,
  ReviewStatsCards,
  ProjectListItem,
  ProjectDetailPanel,
  ActiveProjectPanel,
  ReviewHistoryTab,
  ReviewDialog,
  RejectDialog,
  DeactivateDialog,
  MakeLiveDialog,
  ProjectsFilterBar,
  PrelaunchProjectCard,
  PrelaunchDetailPanel,
  UnsubmittedProjectCard,
  UnsubmittedDetailPanel,
  FlaggedTab,
} from "./components";

export default function ProjectsPage() {
  const [activeTab, setActiveTab] = useState("pending");
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjects, setActiveProjects] = useState<Project[]>([]);
  const [closedProjects, setClosedProjects] = useState<Project[]>([]);
  const [prelaunchProjects, setPrelaunchProjects] = useState<Project[]>([]);
  const [prelaunchReviewProjects, setPrelaunchReviewProjects] = useState<Project[]>([]);
  const [unsubmittedProjects, setUnsubmittedProjects] = useState<Project[]>([]);
  const [reviewHistory, setReviewHistory] = useState<ReviewHistory[]>([]);
  const [stats, setStats] = useState<Stats>({ pending: 0, approvedToday: 0, rejectedToday: 0, activeCampaigns: 0, prelaunchActive: 0, prelaunchReview: 0 });
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);
  const [showMakeLiveDialog, setShowMakeLiveDialog] = useState(false);
  const [reviewAction, setReviewAction] = useState<"approve" | "reject" | "changes" | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncingStats, setIsSyncingStats] = useState(false);
  const [activePage, setActivePage] = useState(1);
  const [closedPage, setClosedPage] = useState(1);
  const PROJECTS_PER_PAGE = 20;

  // Reset pagination when search or filters change
  useEffect(() => { setActivePage(1); setClosedPage(1); }, [searchQuery, categoryFilter]);

  // Prelaunch vanity URL state
  const [showPrelaunchVanityDialog, setShowPrelaunchVanityDialog] = useState(false);
  const [prelaunchVanityUrl, setPrelaunchVanityUrl] = useState<string | null>(null);

  // Review form state
  const [reviewNotes, setReviewNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [sendEmail, setSendEmail] = useState(true);

  const fetchProjects = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        status: "SUBMITTED",
        ...(categoryFilter !== "all" && { category: categoryFilter }),
      });
      const response = await fetchWithRetry(`/api/admin/projects/review?${params}`);
      if (response.ok) {
        const data = await response.json();
        setProjects(data.projects || []);
        setStats(data.stats || { pending: 0, approvedToday: 0, rejectedToday: 0 });
      }
    } catch (error) {
      console.error("Error fetching projects after retries:", error);
    } finally {
      setIsLoading(false);
    }
  }, [categoryFilter]);

  const fetchActiveProjects = useCallback(async () => {
    try {
      const liveParams = new URLSearchParams({
        status: "LIVE",
        ...(categoryFilter !== "all" && { category: categoryFilter }),
      });
      const approvedParams = new URLSearchParams({
        status: "APPROVED",
        ...(categoryFilter !== "all" && { category: categoryFilter }),
      });
      const fundedParams = new URLSearchParams({
        status: "FUNDED",
        ...(categoryFilter !== "all" && { category: categoryFilter }),
      });
      const failedParams = new URLSearchParams({
        status: "FAILED",
        ...(categoryFilter !== "all" && { category: categoryFilter }),
      });

      const [liveResponse, approvedResponse, fundedResponse, failedResponse] = await Promise.all([
        fetchWithRetry(`/api/admin/projects/review?${liveParams}`),
        fetchWithRetry(`/api/admin/projects/review?${approvedParams}`),
        fetchWithRetry(`/api/admin/projects/review?${fundedParams}`),
        fetchWithRetry(`/api/admin/projects/review?${failedParams}`),
      ]);

      const allProjects: Project[] = [];
      if (liveResponse.ok) {
        const liveData = await liveResponse.json();
        allProjects.push(...(liveData.projects || []));
      }
      if (approvedResponse.ok) {
        const approvedData = await approvedResponse.json();
        allProjects.push(...(approvedData.projects || []));
      }

      // Closed campaigns: FUNDED and FAILED status projects
      const closedCampaigns: Project[] = [];
      if (fundedResponse.ok) {
        const fundedData = await fundedResponse.json();
        closedCampaigns.push(...(fundedData.projects || []));
      }
      if (failedResponse.ok) {
        const failedData = await failedResponse.json();
        closedCampaigns.push(...(failedData.projects || []));
      }

      // Also check LIVE/APPROVED projects whose endDate has passed
      const now = new Date();
      const activeOnly = allProjects.filter((project) => {
        if (!project.endDate) return true; // No end date = still active
        return new Date(project.endDate) > now;
      });
      const expiredActive = allProjects.filter((project) => {
        if (!project.endDate) return false;
        return new Date(project.endDate) <= now;
      });

      // Combine all closed campaigns
      const allClosed = [...closedCampaigns, ...expiredActive];

      setActiveProjects(activeOnly);
      setClosedProjects(allClosed);
      setStats((prev) => ({
        ...prev,
        activeCampaigns: activeOnly.length,
      }));
    } catch (error) {
      console.error("Error fetching active projects:", error);
    }
  }, [categoryFilter]);

  const fetchPrelaunchProjects = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        prelaunchActive: "true",
        ...(categoryFilter !== "all" && { category: categoryFilter }),
      });
      const response = await fetchWithRetry(`/api/admin/projects/review?${params}`);
      if (response.ok) {
        const data = await response.json();
        setPrelaunchProjects(data.projects || []);
        setStats((prev) => ({
          ...prev,
          prelaunchActive: data.projects?.length || 0,
        }));
      }
    } catch (error) {
      console.error("Error fetching prelaunch projects after retries:", error);
    }
  }, [categoryFilter]);

  const fetchPrelaunchReviewProjects = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        prelaunchReview: "true",
        ...(categoryFilter !== "all" && { category: categoryFilter }),
      });
      const response = await fetchWithRetry(`/api/admin/projects/review?${params}`);
      if (response.ok) {
        const data = await response.json();
        setPrelaunchReviewProjects(data.projects || []);
        setStats((prev) => ({
          ...prev,
          prelaunchReview: data.projects?.length || 0,
        }));
      }
    } catch (error) {
      console.error("Error fetching prelaunch review projects after retries:", error);
    }
  }, [categoryFilter]);

  const fetchUnsubmittedProjects = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        status: "DRAFT",
        ...(categoryFilter !== "all" && { category: categoryFilter }),
        limit: "100",
      });
      const response = await fetchWithRetry(`/api/admin/projects/review?${params}`);
      if (response.ok) {
        const data = await response.json();
        setUnsubmittedProjects(data.projects || []);
      }
    } catch (error) {
      console.error("Error fetching unsubmitted projects:", error);
    }
  }, [categoryFilter]);

  const fetchReviewHistory = useCallback(async () => {
    try {
      const response = await fetchWithRetry("/api/admin/projects/history?limit=50");
      if (response.ok) {
        const data = await response.json();
        setReviewHistory(data.reviews || []);
      }
    } catch (error) {
      console.error("Error fetching review history after retries:", error);
    }
  }, []);

  const syncAllProjectStats = async () => {
    setIsSyncingStats(true);
    try {
      const response = await apiFetch("/api/admin/sync-all-project-stats", {
        method: "POST",
      });
      const data = await response.json();
      if (response.ok) {
        toast.success(`Synced ${data.updated} of ${data.total} projects`);
        if (data.changes?.length > 0) {
          data.changes.forEach((c: { title: string; oldAmount: number; newAmount: number; oldBackers: number; newBackers: number }) => {
            toast.info(`${c.title}: $${c.oldAmount} → $${c.newAmount}, ${c.oldBackers} → ${c.newBackers} backers`);
          });
        }
        // Refresh active projects to show updated stats
        fetchActiveProjects();
      } else {
        toast.error(data.error || "Failed to sync stats");
      }
    } catch (error) {
      console.error("Sync error:", error);
      toast.error("Failed to sync project stats");
    } finally {
      setIsSyncingStats(false);
    }
  };

  useEffect(() => {
    fetchProjects();
    fetchActiveProjects();
    fetchPrelaunchProjects();
    fetchPrelaunchReviewProjects();
    fetchUnsubmittedProjects();
    fetchReviewHistory();
  }, [fetchProjects, fetchActiveProjects, fetchPrelaunchProjects, fetchPrelaunchReviewProjects, fetchUnsubmittedProjects, fetchReviewHistory]);

  useEffect(() => {
    setSelectedProject(null);
    if (activeTab === "active") {
      fetchActiveProjects();
    } else if (activeTab === "closed") {
      fetchActiveProjects(); // This also fetches closed projects
    } else if (activeTab === "pending") {
      fetchProjects();
    } else if (activeTab === "prelaunchReview") {
      fetchPrelaunchReviewProjects();
    } else if (activeTab === "prelaunch") {
      fetchPrelaunchProjects();
    } else if (activeTab === "unsubmitted") {
      fetchUnsubmittedProjects();
    } else if (activeTab === "history") {
      fetchReviewHistory();
    }
  }, [activeTab, fetchActiveProjects, fetchProjects, fetchPrelaunchProjects, fetchPrelaunchReviewProjects, fetchUnsubmittedProjects, fetchReviewHistory]);

  // Update prelaunch vanity URL when selected project changes in prelaunch tab
  useEffect(() => {
    if (activeTab === "prelaunch" && selectedProject) {
      setPrelaunchVanityUrl(selectedProject.creator?.vanityUrl || null);
    }
  }, [activeTab, selectedProject]);

  const handleApprove = () => {
    setReviewAction("approve");
    setShowReviewDialog(true);
  };

  const handleReject = () => {
    setReviewAction("reject");
    setShowRejectDialog(true);
  };

  const handleRequestChanges = () => {
    setReviewAction("changes");
    setShowReviewDialog(true);
  };

  const handleDeactivate = () => {
    setShowDeactivateDialog(true);
  };

  const handleMakeLive = () => {
    setShowMakeLiveDialog(true);
  };

  const submitMakeLive = async () => {
    if (!selectedProject) return;

    setIsSubmitting(true);

    try {
      const response = await apiFetch("/api/admin/projects/status", {
        method: "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({
          projectId: selectedProject.id,
          action: "MAKE_LIVE",
          notes: "Campaign made live by admin",
          sendEmail,
        }),
      });

      if (response.ok) {
        await fetchActiveProjects();
        setShowMakeLiveDialog(false);
        setSelectedProject(null);
        toast.success("Project is now live!");
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to make project live");
      }
    } catch (error) {
      console.error("Error making project live:", error);
      toast.error("Failed to make project live");
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitDeactivate = async () => {
    if (!selectedProject) return;

    setIsSubmitting(true);

    try {
      const response = await apiFetch("/api/admin/projects/status", {
        method: "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({
          projectId: selectedProject.id,
          action: "SEND_TO_REVIEW",
          notes: "Campaign deactivated by admin",
          sendEmail,
        }),
      });

      if (response.ok) {
        await fetchActiveProjects();
        await fetchProjects();
        setShowDeactivateDialog(false);
        setSelectedProject(null);
        toast.success("Project deactivated");
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to deactivate project");
      }
    } catch (error) {
      console.error("Error deactivating project:", error);
      toast.error("Failed to deactivate project");
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitReview = async () => {
    if (!selectedProject) return;

    setIsSubmitting(true);
    const isPrelaunchReview = activeTab === "prelaunchReview";

    try {
      const actionMap = {
        approve: "APPROVED",
        reject: "REJECTED",
        changes: "REQUESTED_CHANGES",
      };

      const response = await apiFetch("/api/admin/projects/review", {
        method: "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({
          projectId: selectedProject.id,
          action: actionMap[reviewAction!],
          notes: reviewNotes,
          internalNotes,
          rejectionReason: reviewAction === "reject" ? rejectionReason : null,
          sendEmail,
          isPrelaunch: isPrelaunchReview,
        }),
      });

      if (response.ok) {
        if (isPrelaunchReview) {
          await fetchPrelaunchReviewProjects();
          await fetchPrelaunchProjects();
        } else {
          await fetchProjects();
        }
        setShowReviewDialog(false);
        setShowRejectDialog(false);
        setSelectedProject(null);
        setReviewNotes("");
        setInternalNotes("");
        setRejectionReason("");
        toast.success(`Review submitted: ${reviewAction}`);
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to submit review");
      }
    } catch (error) {
      console.error("Error submitting review:", error);
      toast.error("Failed to submit review");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredProjects = projects.filter((project) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        project.title.toLowerCase().includes(query) ||
        project.creator.name?.toLowerCase().includes(query) ||
        project.creator.email.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const filteredActiveProjects = activeProjects.filter((project) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      project.title.toLowerCase().includes(query) ||
      project.creator.name?.toLowerCase().includes(query) ||
      project.creator.email.toLowerCase().includes(query)
    );
  });

  const filteredClosedProjects = closedProjects.filter((project) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      project.title.toLowerCase().includes(query) ||
      project.creator.name?.toLowerCase().includes(query) ||
      project.creator.email.toLowerCase().includes(query)
    );
  });

  // Paginated active/closed projects
  const activePageCount = Math.ceil(filteredActiveProjects.length / PROJECTS_PER_PAGE);
  const paginatedActiveProjects = useMemo(() =>
    filteredActiveProjects.slice((activePage - 1) * PROJECTS_PER_PAGE, activePage * PROJECTS_PER_PAGE),
    [filteredActiveProjects, activePage]
  );
  const closedPageCount = Math.ceil(filteredClosedProjects.length / PROJECTS_PER_PAGE);
  const paginatedClosedProjects = useMemo(() =>
    filteredClosedProjects.slice((closedPage - 1) * PROJECTS_PER_PAGE, closedPage * PROJECTS_PER_PAGE),
    [filteredClosedProjects, closedPage]
  );

  const filteredPrelaunchProjects = prelaunchProjects.filter((project) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      project.title.toLowerCase().includes(query) ||
      project.creator.name?.toLowerCase().includes(query) ||
      project.creator.email.toLowerCase().includes(query)
    );
  });

  const filteredPrelaunchReviewProjects = prelaunchReviewProjects.filter((project) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      project.title.toLowerCase().includes(query) ||
      project.creator.name?.toLowerCase().includes(query) ||
      project.creator.email.toLowerCase().includes(query)
    );
  });

  const filteredUnsubmittedProjects = unsubmittedProjects.filter((project) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      project.title.toLowerCase().includes(query) ||
      project.creator.name?.toLowerCase().includes(query) ||
      project.creator.email.toLowerCase().includes(query)
    );
  });

  const flaggedProjects = filteredProjects.filter((p) => getFlags(p).length > 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto mb-4" />
          <p className="text-zinc-500">Loading projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white">Project Review Center</h1>
          <p className="text-zinc-500">Review and approve project submissions</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            variant="outline"
            onClick={syncAllProjectStats}
            disabled={isSyncingStats}
            className="flex-1 sm:flex-none"
          >
            {isSyncingStats ? (
              <Loader2 className="h-4 w-4 animate-spin sm:mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 sm:mr-2" />
            )}
            <span className="hidden sm:inline">{isSyncingStats ? "Syncing..." : "Sync All Stats"}</span>
          </Button>
          <Button variant="outline" onClick={() => setActiveTab("history")} className="flex-1 sm:flex-none">
            <History className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Review History</span>
          </Button>
          <Button variant="outline" onClick={() => fetchProjects()} className="flex-1 sm:flex-none">
            <RefreshCw className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <ReviewStatsCards stats={stats} flaggedCount={flaggedProjects.length} />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="pending">
            <Clock className="mr-2 h-4 w-4" />
            Project Review
            {filteredProjects.length > 0 && (
              <Badge variant="destructive" className="ml-2">{filteredProjects.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="prelaunchReview">
            <Sparkles className="mr-2 h-4 w-4" />
            Prelaunch Review
            {prelaunchReviewProjects.length > 0 && (
              <Badge variant="destructive" className="ml-2">{prelaunchReviewProjects.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="active">
            <Zap className="mr-2 h-4 w-4" />
            Active Campaigns
            {activeProjects.length > 0 && (
              <Badge variant="default" className="ml-2 bg-emerald-600">{activeProjects.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="prelaunch">
            <Sparkles className="mr-2 h-4 w-4" />
            Active Prelaunch
            {prelaunchProjects.length > 0 && (
              <Badge variant="default" className="ml-2 bg-amber-500">{prelaunchProjects.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="closed">
            <Archive className="mr-2 h-4 w-4" />
            Closed Campaigns
            {closedProjects.length > 0 && (
              <Badge variant="secondary" className="ml-2">{closedProjects.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="unsubmitted">
            <FileEdit className="mr-2 h-4 w-4" />
            Unsubmitted Projects
            {unsubmittedProjects.length > 0 && (
              <Badge variant="secondary" className="ml-2">{unsubmittedProjects.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="flagged">
            <Flag className="mr-2 h-4 w-4" />
            Flagged
            {flaggedProjects.length > 0 && (
              <Badge variant="secondary" className="ml-2">{flaggedProjects.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="mr-2 h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        {/* Pending Review Tab */}
        <TabsContent value="pending" className="mt-6 space-y-4">
          <ProjectsFilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            categoryFilter={categoryFilter}
            onCategoryChange={setCategoryFilter}
            searchPlaceholder="Search projects..."
          />

          {filteredProjects.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <FolderKanban className="h-12 w-12 text-zinc-300 mb-4" />
                <h3 className="font-medium text-zinc-900 dark:text-white mb-2">No projects pending review</h3>
                <p className="text-sm text-zinc-500 max-w-sm">
                  All submitted projects have been reviewed. New submissions will appear here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-4">
                {filteredProjects.map((project) => (
                  <ProjectListItem
                    key={project.id}
                    project={project}
                    isSelected={selectedProject?.id === project.id}
                    onClick={() => setSelectedProject(project)}
                  />
                ))}
              </div>

              <ProjectDetailPanel
                project={selectedProject}
                onApprove={handleApprove}
                onReject={handleReject}
                onRequestChanges={handleRequestChanges}
              />
            </div>
          )}
        </TabsContent>

        {/* Active Campaigns Tab */}
        <TabsContent value="active" className="mt-6 space-y-4">
          <ProjectsFilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            categoryFilter={categoryFilter}
            onCategoryChange={setCategoryFilter}
            searchPlaceholder="Search active campaigns..."
          />

          {activeProjects.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Zap className="h-12 w-12 text-zinc-300 mb-4" />
                <h3 className="font-medium text-zinc-900 dark:text-white mb-2">No active campaigns</h3>
                <p className="text-sm text-zinc-500 max-w-sm">
                  There are no live campaigns currently running.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-4">
                {paginatedActiveProjects.map((project) => (
                  <ProjectListItem
                    key={project.id}
                    project={project}
                    isSelected={selectedProject?.id === project.id}
                    onClick={() => setSelectedProject(project)}
                    showStatus
                    showFunding
                  />
                ))}
                {activePageCount > 1 && (
                  <div className="flex items-center justify-between pt-4">
                    <p className="text-sm text-muted-foreground">
                      Showing {(activePage - 1) * PROJECTS_PER_PAGE + 1}-{Math.min(activePage * PROJECTS_PER_PAGE, filteredActiveProjects.length)} of {filteredActiveProjects.length}
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={activePage <= 1} onClick={() => setActivePage(p => p - 1)}>Previous</Button>
                      <Button variant="outline" size="sm" disabled={activePage >= activePageCount} onClick={() => setActivePage(p => p + 1)}>Next</Button>
                    </div>
                  </div>
                )}
              </div>

              <ActiveProjectPanel
                project={selectedProject}
                onMakeLive={handleMakeLive}
                onDeactivate={handleDeactivate}
              />
            </div>
          )}
        </TabsContent>

        {/* Prelaunch Review Tab */}
        <TabsContent value="prelaunchReview" className="mt-6 space-y-4">
          <ProjectsFilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            categoryFilter={categoryFilter}
            onCategoryChange={setCategoryFilter}
            searchPlaceholder="Search prelaunch submissions..."
          />

          {filteredPrelaunchReviewProjects.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Sparkles className="h-12 w-12 text-zinc-300 mb-4" />
                <h3 className="font-medium text-zinc-900 dark:text-white mb-2">No prelaunch pages pending review</h3>
                <p className="text-sm text-zinc-500 max-w-sm">
                  All prelaunch submissions have been reviewed. New submissions will appear here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-4">
                {filteredPrelaunchReviewProjects.map((project) => (
                  <ProjectListItem
                    key={project.id}
                    project={project}
                    isSelected={selectedProject?.id === project.id}
                    onClick={() => setSelectedProject(project)}
                    badge={<Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">Prelaunch</Badge>}
                  />
                ))}
              </div>

              <ProjectDetailPanel
                project={selectedProject}
                onApprove={handleApprove}
                onReject={handleReject}
                onRequestChanges={handleRequestChanges}
                isPrelaunch
              />
            </div>
          )}
        </TabsContent>

        {/* Active Prelaunch Tab */}
        <TabsContent value="prelaunch" className="mt-6 space-y-4">
          <ProjectsFilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            categoryFilter={categoryFilter}
            onCategoryChange={setCategoryFilter}
            searchPlaceholder="Search prelaunch projects..."
            includeComics
          />

          {prelaunchProjects.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Sparkles className="h-12 w-12 text-amber-300 mb-4" />
                <h3 className="font-medium text-zinc-900 dark:text-white mb-2">No prelaunch pages</h3>
                <p className="text-sm text-zinc-500 max-w-sm">
                  There are no active prelaunch pages currently published.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-4">
                {filteredPrelaunchProjects.map((project) => (
                  <PrelaunchProjectCard
                    key={project.id}
                    project={project}
                    isSelected={selectedProject?.id === project.id}
                    onClick={() => setSelectedProject(project)}
                  />
                ))}
              </div>

              <PrelaunchDetailPanel
                selectedProject={selectedProject}
                prelaunchVanityUrl={prelaunchVanityUrl}
                showPrelaunchVanityDialog={showPrelaunchVanityDialog}
                onShowPrelaunchVanityDialogChange={setShowPrelaunchVanityDialog}
                onVanityUrlSuccess={(newVanityUrl) => setPrelaunchVanityUrl(newVanityUrl)}
              />
            </div>
          )}
        </TabsContent>

        {/* Closed Campaigns Tab */}
        <TabsContent value="closed" className="mt-6 space-y-4">
          <ProjectsFilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            categoryFilter={categoryFilter}
            onCategoryChange={setCategoryFilter}
            searchPlaceholder="Search closed campaigns..."
            includeComics
          />

          {closedProjects.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Archive className="h-12 w-12 text-zinc-300 mb-4" />
                <h3 className="font-medium text-zinc-900 dark:text-white mb-2">No closed campaigns</h3>
                <p className="text-sm text-zinc-500 max-w-sm">
                  Campaigns that have ended will appear here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-4">
                {paginatedClosedProjects.map((project) => (
                  <ProjectListItem
                    key={project.id}
                    project={project}
                    isSelected={selectedProject?.id === project.id}
                    onClick={() => setSelectedProject(project)}
                    showStatus
                    showFunding
                    badge={<Badge variant="secondary" className="text-xs">Ended</Badge>}
                  />
                ))}
                {closedPageCount > 1 && (
                  <div className="flex items-center justify-between pt-4">
                    <p className="text-sm text-muted-foreground">
                      Showing {(closedPage - 1) * PROJECTS_PER_PAGE + 1}-{Math.min(closedPage * PROJECTS_PER_PAGE, filteredClosedProjects.length)} of {filteredClosedProjects.length}
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={closedPage <= 1} onClick={() => setClosedPage(p => p - 1)}>Previous</Button>
                      <Button variant="outline" size="sm" disabled={closedPage >= closedPageCount} onClick={() => setClosedPage(p => p + 1)}>Next</Button>
                    </div>
                  </div>
                )}
              </div>

              <ActiveProjectPanel
                project={selectedProject}
                onMakeLive={handleMakeLive}
                onDeactivate={handleDeactivate}
              />
            </div>
          )}
        </TabsContent>

        {/* Unsubmitted Projects Tab */}
        <TabsContent value="unsubmitted" className="mt-6 space-y-4">
          <ProjectsFilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            categoryFilter={categoryFilter}
            onCategoryChange={setCategoryFilter}
            searchPlaceholder="Search unsubmitted projects..."
            includeComics
          />

          {filteredUnsubmittedProjects.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <FileEdit className="h-12 w-12 text-zinc-300 mb-4" />
                <h3 className="font-medium text-zinc-900 dark:text-white mb-2">No unsubmitted projects</h3>
                <p className="text-sm text-zinc-500 max-w-sm">
                  There are no saved draft projects that haven&apos;t been submitted for review.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-4">
                {filteredUnsubmittedProjects.map((project) => (
                  <UnsubmittedProjectCard
                    key={project.id}
                    project={project}
                    isSelected={selectedProject?.id === project.id}
                    onClick={() => setSelectedProject(project)}
                  />
                ))}
              </div>

              <UnsubmittedDetailPanel selectedProject={selectedProject} />
            </div>
          )}
        </TabsContent>

        {/* Flagged Tab */}
        <TabsContent value="flagged" className="mt-6">
          <FlaggedTab
            flaggedProjects={flaggedProjects}
            onReviewProject={(project) => {
              setSelectedProject(project);
              setActiveTab("pending");
            }}
          />
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="mt-6">
          <ReviewHistoryTab reviewHistory={reviewHistory} />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <ReviewDialog
        open={showReviewDialog}
        onOpenChange={setShowReviewDialog}
        reviewAction={reviewAction === "reject" ? null : reviewAction}
        reviewNotes={reviewNotes}
        onReviewNotesChange={setReviewNotes}
        internalNotes={internalNotes}
        onInternalNotesChange={setInternalNotes}
        sendEmail={sendEmail}
        onSendEmailChange={setSendEmail}
        isSubmitting={isSubmitting}
        onSubmit={submitReview}
      />

      <RejectDialog
        open={showRejectDialog}
        onOpenChange={setShowRejectDialog}
        rejectionReason={rejectionReason}
        onRejectionReasonChange={setRejectionReason}
        reviewNotes={reviewNotes}
        onReviewNotesChange={setReviewNotes}
        internalNotes={internalNotes}
        onInternalNotesChange={setInternalNotes}
        sendEmail={sendEmail}
        onSendEmailChange={setSendEmail}
        isSubmitting={isSubmitting}
        onSubmit={submitReview}
      />

      <DeactivateDialog
        open={showDeactivateDialog}
        onOpenChange={setShowDeactivateDialog}
        isSubmitting={isSubmitting}
        onSubmit={submitDeactivate}
      />

      <MakeLiveDialog
        open={showMakeLiveDialog}
        onOpenChange={setShowMakeLiveDialog}
        sendEmail={sendEmail}
        onSendEmailChange={setSendEmail}
        isSubmitting={isSubmitting}
        onSubmit={submitMakeLive}
      />
    </div>
  );
}
