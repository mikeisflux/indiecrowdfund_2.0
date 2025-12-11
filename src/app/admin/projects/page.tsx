"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  FolderKanban,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  ThumbsUp,
  ThumbsDown,
  History,
  User,
  Calendar,
  DollarSign,
  Image as ImageIcon,
  Video,
  Flag,
  RefreshCw,
  AlertCircle,
  RotateCcw,
  Loader2,
} from "lucide-react";

interface Creator {
  id: string;
  name: string | null;
  email: string;
  emailVerified: Date | null;
  createdAt: string;
  _count: {
    createdProjects: number;
  };
}

interface Project {
  id: string;
  title: string;
  subtitle: string | null;
  slug: string;
  description: string | null;
  category: string;
  goalAmount: number;
  currentAmount: number;
  currency: string;
  durationType: "FIXED_DAYS" | "END_DATE" | null;
  durationDays: number | null;
  endDate: string | null;
  videoUrl: string | null;
  imageUrl: string | null;
  risks: string | null;
  status: string;
  createdAt: string;
  creator: Creator;
  rewards: { id: string }[];
  _count: {
    pledges: number;
  };
}

interface ReviewHistory {
  id: string;
  projectId: string;
  action: string;
  reviewerEmail: string | null;
  notes: string | null;
  createdAt: string;
  project?: {
    title: string;
  };
}

interface Stats {
  pending: number;
  approvedToday: number;
  rejectedToday: number;
}

const rejectionReasons = [
  { value: "INCOMPLETE_INFORMATION", label: "Incomplete Information" },
  { value: "POLICY_VIOLATION", label: "Policy Violation" },
  { value: "PROHIBITED_CONTENT", label: "Prohibited Content" },
  { value: "INTELLECTUAL_PROPERTY", label: "Intellectual Property Issues" },
  { value: "FRAUD_SUSPECTED", label: "Suspected Fraud" },
  { value: "UNREALISTIC_GOALS", label: "Unrealistic Goals" },
  { value: "MISSING_REWARDS", label: "Missing or Inadequate Rewards" },
  { value: "IDENTITY_VERIFICATION", label: "Identity Verification Required" },
  { value: "OTHER", label: "Other" },
];

export default function ProjectsPage() {
  const [activeTab, setActiveTab] = useState("pending");
  const [projects, setProjects] = useState<Project[]>([]);
  const [reviewHistory, setReviewHistory] = useState<ReviewHistory[]>([]);
  const [stats, setStats] = useState<Stats>({ pending: 0, approvedToday: 0, rejectedToday: 0 });
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
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

  const fetchReviewHistory = useCallback(async () => {
    try {
      // For now, we'll show recent reviews from the projects API
      // In production, you'd have a dedicated history endpoint
      const response = await fetch("/api/admin/projects/review?status=APPROVED&limit=10");
      if (response.ok) {
        await response.json();
        // Transform to review history format
        setReviewHistory([]);
      }
    } catch (error) {
      console.error("Error fetching review history:", error);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
    fetchReviewHistory();
  }, [fetchProjects, fetchReviewHistory]);

  const getFlags = (project: Project): string[] => {
    const flags: string[] = [];
    if (project.creator._count.createdProjects === 1) {
      flags.push("first_project");
    }
    if (!project.creator.emailVerified) {
      flags.push("unverified_creator");
    }
    if (project.goalAmount > 100000) {
      flags.push("high_goal");
    }
    if (!project.videoUrl) {
      flags.push("no_video");
    }
    return flags;
  };

  const getFlagBadge = (flag: string) => {
    const flagConfig: Record<string, { label: string; variant: "destructive" | "outline" | "secondary" }> = {
      first_project: { label: "First Project", variant: "secondary" },
      unverified_creator: { label: "Unverified", variant: "destructive" },
      high_goal: { label: "High Goal", variant: "outline" },
      no_video: { label: "No Video", variant: "outline" },
    };
    const config = flagConfig[flag] || { label: flag, variant: "outline" as const };
    return (
      <Badge key={flag} variant={config.variant} className="text-xs">
        {config.label}
      </Badge>
    );
  };

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
        // Refresh the projects list
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDuration = (project: Project) => {
    if (project.durationType === "END_DATE" && project.endDate) {
      const endDate = new Date(project.endDate);
      return `Ends ${endDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    } else if (project.durationDays) {
      return `${project.durationDays} days`;
    }
    return "30 days";
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Project Review Center</h1>
          <p className="text-zinc-500">Review and approve project submissions</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => setActiveTab("history")}>
            <History className="mr-2 h-4 w-4" />
            Review History
          </Button>
          <Button variant="outline" onClick={() => fetchProjects()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-amber-100 p-2 dark:bg-amber-900/30">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pending}</p>
                <p className="text-xs text-zinc-500">Pending Review</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-emerald-100 p-2 dark:bg-emerald-900/30">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.approvedToday}</p>
                <p className="text-xs text-zinc-500">Approved Today</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-red-100 p-2 dark:bg-red-900/30">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.rejectedToday}</p>
                <p className="text-xs text-zinc-500">Rejected Today</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-blue-100 p-2 dark:bg-blue-900/30">
                <Flag className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{flaggedProjects.length}</p>
                <p className="text-xs text-zinc-500">Flagged Projects</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending">
            <Clock className="mr-2 h-4 w-4" />
            Pending Review
            {filteredProjects.length > 0 && (
              <Badge variant="destructive" className="ml-2">{filteredProjects.length}</Badge>
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
            /* Projects Queue */
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Project List */}
              <div className="space-y-4">
                {filteredProjects.map((project) => {
                  const flags = getFlags(project);
                  return (
                    <Card
                      key={project.id}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        selectedProject?.id === project.id ? "ring-2 ring-emerald-500" : ""
                      } ${flags.length > 2 ? "border-red-200 bg-red-50/30 dark:bg-red-950/10" : ""}`}
                      onClick={() => setSelectedProject(project)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          {/* Project Image */}
                          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 relative overflow-hidden">
                            {project.imageUrl ? (
                              <Image src={project.imageUrl} alt="" fill className="object-cover" />
                            ) : (
                              <FolderKanban className="h-6 w-6 text-zinc-400" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between">
                              <div>
                                <h4 className="font-semibold truncate">{project.title}</h4>
                                <p className="text-sm text-zinc-500 truncate">{project.subtitle || "No subtitle"}</p>
                              </div>
                              <Badge variant="outline">{project.category}</Badge>
                            </div>

                            <div className="mt-2 flex items-center gap-4 text-xs text-zinc-500">
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {project.creator.name || project.creator.email}
                              </span>
                              <span className="flex items-center gap-1">
                                <DollarSign className="h-3 w-3" />
                                ${project.goalAmount.toLocaleString()}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDate(project.createdAt)}
                              </span>
                            </div>

                            {flags.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {flags.map((flag) => getFlagBadge(flag))}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Project Detail Panel */}
              {selectedProject ? (
                <Card className="h-fit sticky top-6">
                  <CardHeader className="border-b">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>{selectedProject.title}</CardTitle>
                        <CardDescription>{selectedProject.subtitle || "No subtitle"}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Accordion type="multiple" defaultValue={["overview", "creator"]} className="w-full">
                      {/* Overview */}
                      <AccordionItem value="overview">
                        <AccordionTrigger className="px-4">Project Overview</AccordionTrigger>
                        <AccordionContent className="px-4 pb-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="rounded-lg border p-3">
                              <p className="text-xs text-zinc-500">Goal</p>
                              <p className="font-semibold">${selectedProject.goalAmount.toLocaleString()} {selectedProject.currency}</p>
                            </div>
                            <div className="rounded-lg border p-3">
                              <p className="text-xs text-zinc-500">Duration</p>
                              <p className="font-semibold">{formatDuration(selectedProject)}</p>
                            </div>
                            <div className="rounded-lg border p-3">
                              <p className="text-xs text-zinc-500">Category</p>
                              <p className="font-semibold">{selectedProject.category}</p>
                            </div>
                            <div className="rounded-lg border p-3">
                              <p className="text-xs text-zinc-500">Rewards</p>
                              <p className="font-semibold">{selectedProject.rewards.length} tiers</p>
                            </div>
                          </div>

                          <div className="mt-4 flex items-center gap-4">
                            {selectedProject.videoUrl ? (
                              <Badge variant="outline" className="text-emerald-600">
                                <Video className="mr-1 h-3 w-3" /> Has Video
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-amber-600">
                                <Video className="mr-1 h-3 w-3" /> No Video
                              </Badge>
                            )}
                            {selectedProject.imageUrl && (
                              <Badge variant="outline">
                                <ImageIcon className="mr-1 h-3 w-3" /> Has Cover
                              </Badge>
                            )}
                          </div>

                          {selectedProject.description && (
                            <div className="mt-4">
                              <p className="text-xs text-zinc-500 mb-1">Description Preview</p>
                              <div
                                className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-3 prose prose-sm max-w-none"
                                dangerouslySetInnerHTML={{ __html: selectedProject.description }}
                              />
                            </div>
                          )}

                          {selectedProject.risks && (
                            <div className="mt-4">
                              <p className="text-xs text-zinc-500 mb-1">Risks & Challenges</p>
                              <div
                                className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2 prose prose-sm max-w-none"
                                dangerouslySetInnerHTML={{ __html: selectedProject.risks }}
                              />
                            </div>
                          )}
                        </AccordionContent>
                      </AccordionItem>

                      {/* Creator Info */}
                      <AccordionItem value="creator">
                        <AccordionTrigger className="px-4">Creator Information</AccordionTrigger>
                        <AccordionContent className="px-4 pb-4">
                          <div className="flex items-start gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 font-semibold text-zinc-600">
                              {(selectedProject.creator.name || selectedProject.creator.email).charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold">{selectedProject.creator.name || "No name"}</p>
                                {selectedProject.creator.emailVerified ? (
                                  <Badge className="bg-blue-100 text-blue-700">
                                    <CheckCircle className="mr-1 h-3 w-3" /> Verified
                                  </Badge>
                                ) : (
                                  <Badge variant="destructive">
                                    <AlertCircle className="mr-1 h-3 w-3" /> Unverified
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-zinc-500">{selectedProject.creator.email}</p>
                            </div>
                          </div>

                          <div className="mt-4 grid grid-cols-2 gap-3">
                            <div className="rounded-lg border p-3">
                              <p className="text-xs text-zinc-500">Total Projects</p>
                              <p className="font-semibold">{selectedProject.creator._count.createdProjects}</p>
                            </div>
                            <div className="rounded-lg border p-3">
                              <p className="text-xs text-zinc-500">Member Since</p>
                              <p className="font-semibold">{formatDate(selectedProject.creator.createdAt)}</p>
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>

                      {/* Flags */}
                      {getFlags(selectedProject).length > 0 && (
                        <AccordionItem value="flags">
                          <AccordionTrigger className="px-4">
                            Flags
                            <Badge variant="destructive" className="ml-2">
                              {getFlags(selectedProject).length}
                            </Badge>
                          </AccordionTrigger>
                          <AccordionContent className="px-4 pb-4">
                            <div className="space-y-2">
                              {getFlags(selectedProject).map((flag) => (
                                <div key={flag} className="flex items-center gap-2 text-sm text-amber-700">
                                  <Flag className="h-4 w-4" />
                                  <span className="capitalize">{flag.replace(/_/g, " ")}</span>
                                </div>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      )}
                    </Accordion>

                    {/* Action Buttons */}
                    <div className="p-4 border-t bg-zinc-50 dark:bg-zinc-800/50">
                      <div className="flex items-center gap-2 mb-4">
                        <Button variant="outline" className="flex-1" asChild>
                          <a href={`/projects/${selectedProject.slug}`} target="_blank" rel="noopener noreferrer">
                            <Eye className="mr-2 h-4 w-4" />
                            Preview Project
                          </a>
                        </Button>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          onClick={handleApprove}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                        >
                          <ThumbsUp className="mr-2 h-4 w-4" />
                          Approve
                        </Button>
                        <Button
                          variant="outline"
                          onClick={handleRequestChanges}
                          className="flex-1"
                        >
                          <RotateCcw className="mr-2 h-4 w-4" />
                          Request Changes
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={handleReject}
                          className="flex-1"
                        >
                          <ThumbsDown className="mr-2 h-4 w-4" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="h-[400px] flex items-center justify-center">
                  <div className="text-center text-zinc-500">
                    <FolderKanban className="h-12 w-12 mx-auto mb-3 text-zinc-300" />
                    <p className="font-medium">Select a project to review</p>
                    <p className="text-sm">Click on a project from the queue to see details</p>
                  </div>
                </Card>
              )}
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
          <Card>
            <CardHeader>
              <CardTitle>Review History</CardTitle>
              <CardDescription>Recent project review decisions</CardDescription>
            </CardHeader>
            <CardContent>
              {reviewHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <History className="h-12 w-12 text-zinc-300 mb-4" />
                  <h3 className="font-medium text-zinc-900 dark:text-white mb-2">No review history yet</h3>
                  <p className="text-sm text-zinc-500">Review decisions will appear here.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {reviewHistory.map((review) => (
                    <div key={review.id} className="flex items-center gap-4 rounded-lg border p-4">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                        review.action === "APPROVED" ? "bg-emerald-100" :
                        review.action === "REJECTED" ? "bg-red-100" :
                        "bg-amber-100"
                      }`}>
                        {review.action === "APPROVED" ? (
                          <CheckCircle className="h-5 w-5 text-emerald-600" />
                        ) : review.action === "REJECTED" ? (
                          <XCircle className="h-5 w-5 text-red-600" />
                        ) : (
                          <RotateCcw className="h-5 w-5 text-amber-600" />
                        )}
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{review.project?.title || "Project"}</p>
                          <Badge variant={
                            review.action === "APPROVED" ? "default" :
                            review.action === "REJECTED" ? "destructive" :
                            "secondary"
                          }>
                            {review.action.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        <p className="text-sm text-zinc-500">
                          {review.notes || "No notes"}
                        </p>
                      </div>

                      <div className="text-right text-sm text-zinc-500">
                        <p>{review.reviewerEmail || "Admin"}</p>
                        <p>{formatDate(review.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Approve/Request Changes Dialog */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {reviewAction === "approve" ? "Approve Project" : "Request Changes"}
            </DialogTitle>
            <DialogDescription>
              {reviewAction === "approve"
                ? "The project will be approved and the creator can launch it."
                : "The creator will be notified to make changes before resubmitting."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Notes to Creator</Label>
              <Textarea
                placeholder={reviewAction === "approve"
                  ? "Optional: Add any notes for the creator..."
                  : "Explain what changes are needed..."}
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label>Internal Notes (not sent to creator)</Label>
              <Textarea
                placeholder="Add internal notes for other reviewers..."
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                rows={2}
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="sendEmail"
                checked={sendEmail}
                onCheckedChange={(checked) => setSendEmail(checked === true)}
              />
              <Label htmlFor="sendEmail" className="text-sm">
                Send email notification to creator
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReviewDialog(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              onClick={submitReview}
              disabled={isSubmitting}
              className={reviewAction === "approve" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : reviewAction === "approve" ? (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Approve Project
                </>
              ) : (
                <>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Request Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-red-600">Reject Project</DialogTitle>
            <DialogDescription>
              The project will be rejected and the creator will be notified.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Rejection Reason *</Label>
              <Select value={rejectionReason} onValueChange={setRejectionReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a reason..." />
                </SelectTrigger>
                <SelectContent>
                  {rejectionReasons.map((reason) => (
                    <SelectItem key={reason.value} value={reason.value}>
                      {reason.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Explanation to Creator *</Label>
              <Textarea
                placeholder="Provide a clear explanation for the rejection..."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label>Internal Notes</Label>
              <Textarea
                placeholder="Add internal notes..."
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                rows={2}
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="sendEmailReject"
                checked={sendEmail}
                onCheckedChange={(checked) => setSendEmail(checked === true)}
              />
              <Label htmlFor="sendEmailReject" className="text-sm">
                Send rejection email to creator
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={submitReview}
              disabled={isSubmitting || !rejectionReason || !reviewNotes}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject Project
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
