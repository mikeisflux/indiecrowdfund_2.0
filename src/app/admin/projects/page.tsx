"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
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
  AlertTriangle,
  Eye,
  ThumbsUp,
  ThumbsDown,
  ExternalLink,
  History,
  User,
  Calendar,
  DollarSign,
  Image as ImageIcon,
  Video,
  Flag,
  RefreshCw,
  Mail,
  AlertCircle,
  Brain,
  RotateCcw,
} from "lucide-react";

// Mock data for projects pending review
const pendingProjects = [
  {
    id: "proj-001",
    title: "Revolutionary Solar Battery Pack",
    subtitle: "Portable power for the modern adventurer",
    creator: {
      id: "user-001",
      name: "Green Tech Labs",
      email: "contact@greentechlabs.com",
      verified: true,
      previousProjects: 2,
      successRate: 100,
      totalRaised: 145000,
      joinedAt: "2022-06-15",
    },
    category: "Technology",
    goal: 50000,
    currency: "USD",
    duration: 30,
    hasVideo: true,
    imageCount: 8,
    rewardCount: 5,
    submittedAt: "2024-03-18T10:30:00Z",
    flags: [],
    aiScore: 92,
    description: "A compact solar battery pack that can charge your devices anywhere...",
    risks: "Manufacturing delays possible due to component sourcing...",
  },
  {
    id: "proj-002",
    title: "Mystery Box Crypto Investment",
    subtitle: "Guaranteed 10x returns on your investment",
    creator: {
      id: "user-002",
      name: "CryptoGains",
      email: "info@cryptogains.xyz",
      verified: false,
      previousProjects: 0,
      successRate: 0,
      totalRaised: 0,
      joinedAt: "2024-03-15",
    },
    category: "Technology",
    goal: 500000,
    currency: "USD",
    duration: 14,
    hasVideo: false,
    imageCount: 1,
    rewardCount: 1,
    submittedAt: "2024-03-18T09:00:00Z",
    flags: ["first_project", "unverified_creator", "unrealistic_goal", "no_video", "suspicious_claims"],
    aiScore: 15,
    description: "Invest in our mystery crypto boxes for guaranteed returns...",
    risks: "No risks - guaranteed returns!",
  },
  {
    id: "proj-003",
    title: "Indie Film: Echoes of Tomorrow",
    subtitle: "A sci-fi short film about humanity's future",
    creator: {
      id: "user-003",
      name: "Starlight Productions",
      email: "hello@starlightprod.com",
      verified: true,
      previousProjects: 1,
      successRate: 100,
      totalRaised: 25000,
      joinedAt: "2023-01-20",
    },
    category: "Film & Video",
    goal: 35000,
    currency: "USD",
    duration: 45,
    hasVideo: true,
    imageCount: 12,
    rewardCount: 8,
    submittedAt: "2024-03-17T16:45:00Z",
    flags: [],
    aiScore: 88,
    description: "A compelling sci-fi narrative exploring themes of hope and resilience...",
    risks: "Post-production timeline may extend if we exceed our stretch goals...",
  },
  {
    id: "proj-004",
    title: "Artisan Coffee Subscription Box",
    subtitle: "Premium roasts from around the world",
    creator: {
      id: "user-004",
      name: "Bean Masters Co",
      email: "orders@beanmasters.co",
      verified: true,
      previousProjects: 0,
      successRate: 0,
      totalRaised: 0,
      joinedAt: "2024-02-01",
    },
    category: "Food & Drink",
    goal: 15000,
    currency: "USD",
    duration: 30,
    hasVideo: true,
    imageCount: 6,
    rewardCount: 4,
    submittedAt: "2024-03-17T14:20:00Z",
    flags: ["first_project"],
    aiScore: 78,
    description: "We source the finest coffee beans from sustainable farms worldwide...",
    risks: "Supply chain disruptions may affect delivery schedules...",
  },
];

const reviewHistory = [
  { id: "1", projectTitle: "Smart Home Device", action: "APPROVED", reviewer: "admin@example.com", date: "2024-03-17 15:30", notes: "Great project, all requirements met." },
  { id: "2", projectTitle: "Crypto Trading Bot", action: "REJECTED", reviewer: "admin@example.com", date: "2024-03-17 14:00", notes: "Violates financial services policy." },
  { id: "3", projectTitle: "Board Game: Quest", action: "APPROVED", reviewer: "moderator@example.com", date: "2024-03-17 11:45", notes: "Approved after creator added more details." },
  { id: "4", projectTitle: "Fitness App", action: "REQUESTED_CHANGES", reviewer: "admin@example.com", date: "2024-03-16 16:20", notes: "Need clearer delivery timeline." },
];

const reviewStats = {
  pending: 23,
  approvedToday: 12,
  rejectedToday: 3,
  avgReviewTime: "2.4 hours",
  aiApprovalRate: 68,
};

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
  const [selectedProject, setSelectedProject] = useState<typeof pendingProjects[0] | null>(null);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [reviewAction, setReviewAction] = useState<"approve" | "reject" | "changes" | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [flagFilter, setFlagFilter] = useState("all");

  // Review form state
  const [reviewNotes, setReviewNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [sendEmail, setSendEmail] = useState(true);

  const getAIScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-600 bg-emerald-100";
    if (score >= 50) return "text-amber-600 bg-amber-100";
    return "text-red-600 bg-red-100";
  };

  const getFlagBadge = (flag: string) => {
    const flagConfig: Record<string, { label: string; variant: "destructive" | "outline" | "secondary" }> = {
      first_project: { label: "First Project", variant: "secondary" },
      unverified_creator: { label: "Unverified", variant: "destructive" },
      unrealistic_goal: { label: "High Goal", variant: "outline" },
      no_video: { label: "No Video", variant: "outline" },
      suspicious_claims: { label: "Suspicious Claims", variant: "destructive" },
      high_goal: { label: "High Goal", variant: "outline" },
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

  const submitReview = () => {
    // Submit review logic here
    console.log("Submitting review:", {
      projectId: selectedProject?.id,
      action: reviewAction,
      notes: reviewNotes,
      internalNotes,
      rejectionReason: reviewAction === "reject" ? rejectionReason : null,
      sendEmail,
    });
    setShowReviewDialog(false);
    setShowRejectDialog(false);
    setSelectedProject(null);
    setReviewNotes("");
    setInternalNotes("");
    setRejectionReason("");
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Project Review Center</h1>
          <p className="text-zinc-500">Review and approve project submissions</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline">
            <History className="mr-2 h-4 w-4" />
            Review History
          </Button>
          <Button variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-amber-100 p-2 dark:bg-amber-900/30">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{reviewStats.pending}</p>
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
                <p className="text-2xl font-bold">{reviewStats.approvedToday}</p>
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
                <p className="text-2xl font-bold">{reviewStats.rejectedToday}</p>
                <p className="text-xs text-zinc-500">Rejected Today</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-blue-100 p-2 dark:bg-blue-900/30">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{reviewStats.avgReviewTime}</p>
                <p className="text-xs text-zinc-500">Avg Review Time</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-violet-100 p-2 dark:bg-violet-900/30">
                <Brain className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{reviewStats.aiApprovalRate}%</p>
                <p className="text-xs text-zinc-500">AI Approval Rate</p>
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
            <Badge variant="destructive" className="ml-2">{pendingProjects.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="flagged">
            <Flag className="mr-2 h-4 w-4" />
            Flagged
            <Badge variant="secondary" className="ml-2">
              {pendingProjects.filter(p => p.flags.length > 0).length}
            </Badge>
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
                <SelectItem value="technology">Technology</SelectItem>
                <SelectItem value="film">Film & Video</SelectItem>
                <SelectItem value="games">Games</SelectItem>
                <SelectItem value="design">Design</SelectItem>
                <SelectItem value="food">Food & Drink</SelectItem>
              </SelectContent>
            </Select>
            <Select value={flagFilter} onValueChange={setFlagFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Flags" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                <SelectItem value="flagged">Flagged Only</SelectItem>
                <SelectItem value="clean">No Flags</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Projects Queue */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Project List */}
            <div className="space-y-4">
              {pendingProjects.map((project) => (
                <Card
                  key={project.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedProject?.id === project.id ? "ring-2 ring-emerald-500" : ""
                  } ${project.flags.length > 2 ? "border-red-200 bg-red-50/30 dark:bg-red-950/10" : ""}`}
                  onClick={() => setSelectedProject(project)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      {/* AI Score */}
                      <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${getAIScoreColor(project.aiScore)}`}>
                        <span className="text-lg font-bold">{project.aiScore}</span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-semibold truncate">{project.title}</h4>
                            <p className="text-sm text-zinc-500 truncate">{project.subtitle}</p>
                          </div>
                          <Badge variant="outline">{project.category}</Badge>
                        </div>

                        <div className="mt-2 flex items-center gap-4 text-xs text-zinc-500">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {project.creator.name}
                          </span>
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            ${project.goal.toLocaleString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(project.submittedAt)}
                          </span>
                        </div>

                        {project.flags.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {project.flags.map((flag) => getFlagBadge(flag))}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Project Detail Panel */}
            {selectedProject ? (
              <Card className="h-fit sticky top-6">
                <CardHeader className="border-b">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{selectedProject.title}</CardTitle>
                      <CardDescription>{selectedProject.subtitle}</CardDescription>
                    </div>
                    <div className={`flex h-14 w-14 items-center justify-center rounded-xl ${getAIScoreColor(selectedProject.aiScore)}`}>
                      <div className="text-center">
                        <span className="text-xl font-bold">{selectedProject.aiScore}</span>
                        <p className="text-[10px]">AI Score</p>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Accordion type="multiple" defaultValue={["overview", "creator", "flags"]} className="w-full">
                    {/* Overview */}
                    <AccordionItem value="overview">
                      <AccordionTrigger className="px-4">Project Overview</AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="rounded-lg border p-3">
                            <p className="text-xs text-zinc-500">Goal</p>
                            <p className="font-semibold">${selectedProject.goal.toLocaleString()} {selectedProject.currency}</p>
                          </div>
                          <div className="rounded-lg border p-3">
                            <p className="text-xs text-zinc-500">Duration</p>
                            <p className="font-semibold">{selectedProject.duration} days</p>
                          </div>
                          <div className="rounded-lg border p-3">
                            <p className="text-xs text-zinc-500">Category</p>
                            <p className="font-semibold">{selectedProject.category}</p>
                          </div>
                          <div className="rounded-lg border p-3">
                            <p className="text-xs text-zinc-500">Rewards</p>
                            <p className="font-semibold">{selectedProject.rewardCount} tiers</p>
                          </div>
                        </div>

                        <div className="mt-4 flex items-center gap-4">
                          <div className="flex items-center gap-2 text-sm">
                            {selectedProject.hasVideo ? (
                              <Badge variant="outline" className="text-emerald-600">
                                <Video className="mr-1 h-3 w-3" /> Has Video
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-amber-600">
                                <Video className="mr-1 h-3 w-3" /> No Video
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Badge variant="outline">
                              <ImageIcon className="mr-1 h-3 w-3" /> {selectedProject.imageCount} Images
                            </Badge>
                          </div>
                        </div>

                        <div className="mt-4">
                          <p className="text-xs text-zinc-500 mb-1">Description Preview</p>
                          <p className="text-sm text-zinc-600 line-clamp-3">{selectedProject.description}</p>
                        </div>

                        <div className="mt-4">
                          <p className="text-xs text-zinc-500 mb-1">Risks & Challenges</p>
                          <p className="text-sm text-zinc-600 line-clamp-2">{selectedProject.risks}</p>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* Creator Info */}
                    <AccordionItem value="creator">
                      <AccordionTrigger className="px-4">Creator Information</AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        <div className="flex items-start gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 font-semibold text-zinc-600">
                            {selectedProject.creator.name.charAt(0)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold">{selectedProject.creator.name}</p>
                              {selectedProject.creator.verified ? (
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
                            <p className="text-xs text-zinc-500">Previous Projects</p>
                            <p className="font-semibold">{selectedProject.creator.previousProjects}</p>
                          </div>
                          <div className="rounded-lg border p-3">
                            <p className="text-xs text-zinc-500">Success Rate</p>
                            <p className="font-semibold">{selectedProject.creator.successRate}%</p>
                          </div>
                          <div className="rounded-lg border p-3">
                            <p className="text-xs text-zinc-500">Total Raised</p>
                            <p className="font-semibold">${selectedProject.creator.totalRaised.toLocaleString()}</p>
                          </div>
                          <div className="rounded-lg border p-3">
                            <p className="text-xs text-zinc-500">Member Since</p>
                            <p className="font-semibold">{selectedProject.creator.joinedAt}</p>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    {/* AI Analysis & Flags */}
                    <AccordionItem value="flags">
                      <AccordionTrigger className="px-4">
                        AI Analysis
                        {selectedProject.flags.length > 0 && (
                          <Badge variant="destructive" className="ml-2">
                            {selectedProject.flags.length} Flags
                          </Badge>
                        )}
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        <div className="rounded-lg border bg-violet-50 p-4 dark:bg-violet-950/20">
                          <div className="flex items-center gap-2 mb-3">
                            <Brain className="h-5 w-5 text-violet-600" />
                            <span className="font-semibold text-violet-900 dark:text-violet-100">AI Assessment</span>
                          </div>

                          <div className="flex items-center gap-4 mb-4">
                            <div>
                              <p className="text-sm text-violet-700 dark:text-violet-300">Confidence Score</p>
                              <div className="flex items-center gap-2">
                                <Progress value={selectedProject.aiScore} className="h-2 w-24" />
                                <span className="font-semibold">{selectedProject.aiScore}%</span>
                              </div>
                            </div>
                          </div>

                          {selectedProject.flags.length > 0 ? (
                            <div className="space-y-2">
                              <p className="text-sm font-medium text-red-700 dark:text-red-300">Flags Raised:</p>
                              {selectedProject.flags.map((flag) => (
                                <div key={flag} className="flex items-center gap-2 text-sm">
                                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                                  <span className="capitalize">{flag.replace(/_/g, " ")}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                              <CheckCircle className="h-4 w-4" />
                              <span className="text-sm">No flags raised - project looks good!</span>
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>

                  {/* Action Buttons */}
                  <div className="p-4 border-t bg-zinc-50 dark:bg-zinc-800/50">
                    <div className="flex items-center gap-2 mb-4">
                      <Button variant="outline" className="flex-1" asChild>
                        <a href={`/projects/${selectedProject.id}`} target="_blank">
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Preview
                        </a>
                      </Button>
                      <Button variant="outline" className="flex-1">
                        <Mail className="mr-2 h-4 w-4" />
                        Contact
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
        </TabsContent>

        {/* Flagged Tab */}
        <TabsContent value="flagged" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Flagged Projects</CardTitle>
              <CardDescription>Projects with AI-detected issues requiring attention</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pendingProjects.filter(p => p.flags.length > 0).map((project) => (
                  <div key={project.id} className="flex items-center gap-4 rounded-lg border border-red-200 bg-red-50/50 p-4 dark:bg-red-950/10">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${getAIScoreColor(project.aiScore)}`}>
                      <span className="text-lg font-bold">{project.aiScore}</span>
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold">{project.title}</h4>
                        <Badge variant="outline">{project.category}</Badge>
                      </div>
                      <p className="text-sm text-zinc-500">by {project.creator.name}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {project.flags.map((flag) => getFlagBadge(flag))}
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
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Review History</CardTitle>
            </CardHeader>
            <CardContent>
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
                        <p className="font-medium">{review.projectTitle}</p>
                        <Badge variant={
                          review.action === "APPROVED" ? "default" :
                          review.action === "REJECTED" ? "destructive" :
                          "secondary"
                        }>
                          {review.action.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      <p className="text-sm text-zinc-500">
                        {review.notes}
                      </p>
                    </div>

                    <div className="text-right text-sm text-zinc-500">
                      <p>{review.reviewer}</p>
                      <p>{review.date}</p>
                    </div>
                  </div>
                ))}
              </div>
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
            <Button variant="outline" onClick={() => setShowReviewDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={submitReview}
              className={reviewAction === "approve" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
            >
              {reviewAction === "approve" ? (
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

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:bg-amber-950/20">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-amber-800 dark:text-amber-200">
                    This action cannot be undone
                  </p>
                  <p className="text-amber-700 dark:text-amber-300">
                    The creator will need to create a new project submission.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={submitReview}
              disabled={!rejectionReason || !reviewNotes}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Reject Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
