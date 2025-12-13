"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FolderKanban,
  Search,
  Clock,
  CheckCircle,
  Eye,
  History,
  Flag,
  RefreshCw,
  Loader2,
  Zap,
} from "lucide-react";
import {
  Project,
  ReviewHistory,
  Stats,
  getFlags,
  getFlagBadge,
  ReviewStatsCards,
  ProjectListItem,
  ProjectDetailPanel,
  ActiveProjectPanel,
  ReviewHistoryTab,
  ReviewDialog,
  RejectDialog,
  DeactivateDialog,
  MakeLiveDialog,
} from "./components";

export default function ProjectsPage() {
  const [activeTab, setActiveTab] = useState("pending");
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjects, setActiveProjects] = useState<Project[]>([]);
  const [reviewHistory, setReviewHistory] = useState<ReviewHistory[]>([]);
  const [stats, setStats] = useState<Stats>({ pending: 0, approvedToday: 0, rejectedToday: 0, activeCampaigns: 0 });
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
      const response = await fetch(`/api/admin/projects/review?${params}`);
      if (response.ok) {
        const data = await response.json();
        setProjects(data.projects || []);
        setStats(data.stats || { pending: 0, approvedToday: 0, rejectedToday: 0 });
      }
    } catch (error) {
      console.error("Error fetching projects:", error);
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

      const [liveResponse, approvedResponse] = await Promise.all([
        fetch(`/api/admin/projects/review?${liveParams}`),
        fetch(`/api/admin/projects/review?${approvedParams}`),
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

      setActiveProjects(allProjects);
      setStats((prev) => ({
        ...prev,
        activeCampaigns: allProjects.length,
      }));
    } catch (error) {
      console.error("Error fetching active projects:", error);
    }
  }, [categoryFilter]);

  const fetchReviewHistory = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/projects/history?limit=50");
      if (response.ok) {
        const data = await response.json();
        setReviewHistory(data.reviews || []);
      }
    } catch (error) {
      console.error("Error fetching review history:", error);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
    fetchActiveProjects();
    fetchReviewHistory();
  }, [fetchProjects, fetchActiveProjects, fetchReviewHistory]);

  useEffect(() => {
    setSelectedProject(null);
    if (activeTab === "active") {
      fetchActiveProjects();
    } else if (activeTab === "pending") {
      fetchProjects();
    } else if (activeTab === "history") {
      fetchReviewHistory();
    }
  }, [activeTab, fetchActiveProjects, fetchProjects, fetchReviewHistory]);

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
      const response = await fetch("/api/admin/projects/status", {
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
      } else {
        const data = await response.json();
        alert(data.error || "Failed to make project live");
      }
    } catch (error) {
      console.error("Error making project live:", error);
      alert("Failed to make project live");
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitDeactivate = async () => {
    if (!selectedProject) return;

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/admin/projects/status", {
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
      } else {
        const data = await response.json();
        alert(data.error || "Failed to deactivate project");
      }
    } catch (error) {
      console.error("Error deactivating project:", error);
      alert("Failed to deactivate project");
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitReview = async () => {
    if (!selectedProject) return;

    setIsSubmitting(true);

    try {
      const actionMap = {
        approve: "APPROVED",
        reject: "REJECTED",
        changes: "REQUESTED_CHANGES",
      };

      const response = await fetch("/api/admin/projects/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProject.id,
          action: actionMap[reviewAction!],
          notes: reviewNotes,
          internalNotes,
          rejectionReason: reviewAction === "reject" ? rejectionReason : null,
          sendEmail,
        }),
      });

      if (response.ok) {
        await fetchProjects();
        setShowReviewDialog(false);
        setShowRejectDialog(false);
        setSelectedProject(null);
        setReviewNotes("");
        setInternalNotes("");
        setRejectionReason("");
      } else {
        const data = await response.json();
        alert(data.error || "Failed to submit review");
      }
    } catch (error) {
      console.error("Error submitting review:", error);
      alert("Failed to submit review");
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
        <TabsList>
          <TabsTrigger value="pending">
            <Clock className="mr-2 h-4 w-4" />
            Pending Review
            {filteredProjects.length > 0 && (
              <Badge variant="destructive" className="ml-2">{filteredProjects.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="active">
            <Zap className="mr-2 h-4 w-4" />
            Active Campaigns
            {activeProjects.length > 0 && (
              <Badge variant="default" className="ml-2 bg-emerald-600">{activeProjects.length}</Badge>
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
          {/* Filters */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <Input
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="Technology">Technology</SelectItem>
                <SelectItem value="Film & Video">Film & Video</SelectItem>
                <SelectItem value="Games">Games</SelectItem>
                <SelectItem value="Design">Design</SelectItem>
                <SelectItem value="Food & Drink">Food & Drink</SelectItem>
                <SelectItem value="Music">Music</SelectItem>
                <SelectItem value="Art">Art</SelectItem>
              </SelectContent>
            </Select>
          </div>

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
          {/* Filters */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <Input
                placeholder="Search active campaigns..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="Technology">Technology</SelectItem>
                <SelectItem value="Film & Video">Film & Video</SelectItem>
                <SelectItem value="Games">Games</SelectItem>
                <SelectItem value="Design">Design</SelectItem>
                <SelectItem value="Food & Drink">Food & Drink</SelectItem>
                <SelectItem value="Music">Music</SelectItem>
                <SelectItem value="Art">Art</SelectItem>
              </SelectContent>
            </Select>
          </div>

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
                {filteredActiveProjects.map((project) => (
                  <ProjectListItem
                    key={project.id}
                    project={project}
                    isSelected={selectedProject?.id === project.id}
                    onClick={() => setSelectedProject(project)}
                    showStatus
                    showFunding
                  />
                ))}
              </div>

              <ActiveProjectPanel
                project={selectedProject}
                onMakeLive={handleMakeLive}
                onDeactivate={handleDeactivate}
              />
            </div>
          )}
        </TabsContent>

        {/* Flagged Tab */}
        <TabsContent value="flagged" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Flagged Projects</CardTitle>
              <CardDescription>Projects with issues requiring attention</CardDescription>
            </CardHeader>
            <CardContent>
              {flaggedProjects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <CheckCircle className="h-12 w-12 text-emerald-300 mb-4" />
                  <h3 className="font-medium text-zinc-900 dark:text-white mb-2">No flagged projects</h3>
                  <p className="text-sm text-zinc-500">All projects look good!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {flaggedProjects.map((project) => {
                    const flags = getFlags(project);
                    return (
                      <div key={project.id} className="flex items-center gap-4 rounded-lg border border-red-200 bg-red-50/50 p-4 dark:bg-red-950/10">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-100 relative overflow-hidden">
                          {project.imageUrl ? (
                            <Image src={project.imageUrl} alt="" fill className="object-cover" />
                          ) : (
                            <FolderKanban className="h-6 w-6 text-zinc-400" />
                          )}
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{project.title}</h4>
                            <Badge variant="outline">{project.category}</Badge>
                          </div>
                          <p className="text-sm text-zinc-500">by {project.creator.name || project.creator.email}</p>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {flags.map((flag) => getFlagBadge(flag))}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedProject(project);
                              setActiveTab("pending");
                            }}
                          >
                            <Eye className="mr-1 h-4 w-4" />
                            Review
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
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
