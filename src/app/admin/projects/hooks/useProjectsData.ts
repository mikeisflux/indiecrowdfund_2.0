"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { fetchWithRetry, apiFetch } from "@/lib/fetch-utils";
import { toast } from "sonner";
import { Project, ReviewHistory, Stats, getFlags } from "../components";

const PROJECTS_PER_PAGE = 20;

// The review API caps `limit` at 100 and defaults to 20 (oldest-first), so a
// single un-paginated fetch silently truncates any list past the cap — that's
// how funded campaigns went missing from the Closed Campaigns tab. Walk every
// page and return the full set.
async function fetchAllProjectPages(baseParams: Record<string, string>): Promise<Project[]> {
  const all: Project[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const params = new URLSearchParams({ ...baseParams, limit: "100", page: String(page) });
    const response = await fetchWithRetry(`/api/admin/projects/review?${params}`);
    if (!response.ok) break;
    const data = await response.json();
    all.push(...(data.projects || []));
    totalPages = data.pagination?.totalPages || 1;
    page++;
  } while (page <= totalPages);
  return all;
}

export function useProjectsData() {
  const [activeTab, setActiveTab] = useState("pending");
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjects, setActiveProjects] = useState<Project[]>([]);
  const [closedProjects, setClosedProjects] = useState<Project[]>([]);
  const [prelaunchProjects, setPrelaunchProjects] = useState<Project[]>([]);
  const [prelaunchReviewProjects, setPrelaunchReviewProjects] = useState<Project[]>([]);
  const [unsubmittedProjects, setUnsubmittedProjects] = useState<Project[]>([]);
  const [reviewHistory, setReviewHistory] = useState<ReviewHistory[]>([]);
  const [stats, setStats] = useState<Stats>({
    pending: 0,
    approvedToday: 0,
    rejectedToday: 0,
    activeCampaigns: 0,
    prelaunchActive: 0,
    prelaunchReview: 0,
  });
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

  // Prelaunch vanity URL state
  const [showPrelaunchVanityDialog, setShowPrelaunchVanityDialog] = useState(false);
  const [prelaunchVanityUrl, setPrelaunchVanityUrl] = useState<string | null>(null);

  // Review form state
  const [reviewNotes, setReviewNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [sendEmail, setSendEmail] = useState(true);

  // Reset pagination when search or filters change
  useEffect(() => {
    setActivePage(1);
    setClosedPage(1);
  }, [searchQuery, categoryFilter]);

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
      const categoryParams: Record<string, string> =
        categoryFilter !== "all" ? { category: categoryFilter } : {};

      const [liveProjects, approvedProjects, fundedProjects, failedProjects] = await Promise.all([
        fetchAllProjectPages({ status: "LIVE", ...categoryParams }),
        fetchAllProjectPages({ status: "APPROVED", ...categoryParams }),
        fetchAllProjectPages({ status: "FUNDED", ...categoryParams }),
        fetchAllProjectPages({ status: "FAILED", ...categoryParams }),
      ]);

      const allProjects: Project[] = [...liveProjects, ...approvedProjects];

      // Closed campaigns: FUNDED and FAILED status projects
      const closedCampaigns: Project[] = [...fundedProjects, ...failedProjects];

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
      const prelaunch = await fetchAllProjectPages({
        prelaunchActive: "true",
        ...(categoryFilter !== "all" && { category: categoryFilter }),
      });
      setPrelaunchProjects(prelaunch);
      setStats((prev) => ({
        ...prev,
        prelaunchActive: prelaunch.length,
      }));
    } catch (error) {
      console.error("Error fetching prelaunch projects after retries:", error);
    }
  }, [categoryFilter]);

  const fetchPrelaunchReviewProjects = useCallback(async () => {
    try {
      const prelaunchReviewList = await fetchAllProjectPages({
        prelaunchReview: "true",
        ...(categoryFilter !== "all" && { category: categoryFilter }),
      });
      setPrelaunchReviewProjects(prelaunchReviewList);
      setStats((prev) => ({
        ...prev,
        prelaunchReview: prelaunchReviewList.length,
      }));
    } catch (error) {
      console.error("Error fetching prelaunch review projects after retries:", error);
    }
  }, [categoryFilter]);

  const fetchUnsubmittedProjects = useCallback(async () => {
    try {
      const drafts = await fetchAllProjectPages({
        status: "DRAFT",
        ...(categoryFilter !== "all" && { category: categoryFilter }),
      });
      setUnsubmittedProjects(drafts);
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
          data.changes.forEach(
            (c: {
              title: string;
              oldAmount: number;
              newAmount: number;
              oldBackers: number;
              newBackers: number;
            }) => {
              toast.info(
                `${c.title}: $${c.oldAmount} → $${c.newAmount}, ${c.oldBackers} → ${c.newBackers} backers`
              );
            }
          );
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

  // Initial fetch of all data
  useEffect(() => {
    fetchProjects();
    fetchActiveProjects();
    fetchPrelaunchProjects();
    fetchPrelaunchReviewProjects();
    fetchUnsubmittedProjects();
    fetchReviewHistory();
  }, [
    fetchProjects,
    fetchActiveProjects,
    fetchPrelaunchProjects,
    fetchPrelaunchReviewProjects,
    fetchUnsubmittedProjects,
    fetchReviewHistory,
  ]);

  // Refetch on tab change
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
  }, [
    activeTab,
    fetchActiveProjects,
    fetchProjects,
    fetchPrelaunchProjects,
    fetchPrelaunchReviewProjects,
    fetchUnsubmittedProjects,
    fetchReviewHistory,
  ]);

  // Update prelaunch vanity URL when selected project changes in prelaunch tab
  useEffect(() => {
    if (activeTab === "prelaunch" && selectedProject) {
      setPrelaunchVanityUrl(selectedProject.creator?.vanityUrl || null);
    }
  }, [activeTab, selectedProject]);

  // Action handlers
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
        headers: { "Content-Type": "application/json" },
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
        headers: { "Content-Type": "application/json" },
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
        headers: { "Content-Type": "application/json" },
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

  // Derived / filtered arrays
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

  // Pagination
  const activePageCount = Math.ceil(filteredActiveProjects.length / PROJECTS_PER_PAGE);
  const paginatedActiveProjects = useMemo(
    () =>
      filteredActiveProjects.slice(
        (activePage - 1) * PROJECTS_PER_PAGE,
        activePage * PROJECTS_PER_PAGE
      ),
    [filteredActiveProjects, activePage]
  );

  const closedPageCount = Math.ceil(filteredClosedProjects.length / PROJECTS_PER_PAGE);
  const paginatedClosedProjects = useMemo(
    () =>
      filteredClosedProjects.slice(
        (closedPage - 1) * PROJECTS_PER_PAGE,
        closedPage * PROJECTS_PER_PAGE
      ),
    [filteredClosedProjects, closedPage]
  );

  return {
    // data
    projects,
    activeProjects,
    closedProjects,
    prelaunchProjects,
    prelaunchReviewProjects,
    unsubmittedProjects,
    reviewHistory,
    stats,
    // selected / dialog state
    selectedProject,
    setSelectedProject,
    showReviewDialog,
    setShowReviewDialog,
    showRejectDialog,
    setShowRejectDialog,
    showDeactivateDialog,
    setShowDeactivateDialog,
    showMakeLiveDialog,
    setShowMakeLiveDialog,
    reviewAction,
    // form state
    reviewNotes,
    setReviewNotes,
    internalNotes,
    setInternalNotes,
    rejectionReason,
    setRejectionReason,
    sendEmail,
    setSendEmail,
    // loading state
    isLoading,
    isSubmitting,
    isSyncingStats,
    // filters
    searchQuery,
    setSearchQuery,
    categoryFilter,
    setCategoryFilter,
    activeTab,
    setActiveTab,
    // pagination
    activePage,
    setActivePage,
    closedPage,
    setClosedPage,
    PROJECTS_PER_PAGE,
    // prelaunch vanity
    showPrelaunchVanityDialog,
    setShowPrelaunchVanityDialog,
    prelaunchVanityUrl,
    setPrelaunchVanityUrl,
    // derived/filtered
    filteredProjects,
    filteredActiveProjects,
    filteredClosedProjects,
    filteredPrelaunchProjects,
    filteredPrelaunchReviewProjects,
    filteredUnsubmittedProjects,
    flaggedProjects,
    paginatedActiveProjects,
    paginatedClosedProjects,
    activePageCount,
    closedPageCount,
    // actions
    handleApprove,
    handleReject,
    handleRequestChanges,
    handleDeactivate,
    handleMakeLive,
    submitReview,
    submitDeactivate,
    submitMakeLive,
    syncAllProjectStats,
    fetchProjects,
    // Expose setter so the UI can drop a project from the list
    // instantly after delete (no waiting for refetch).
    setUnsubmittedProjects,
  };
}
