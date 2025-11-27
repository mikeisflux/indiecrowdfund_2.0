"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Flag,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  MessageSquare,
  FileText,
  Users,
  FolderKanban,
  Search,
  Filter,
  MoreHorizontal,
  Ban,
  ThumbsUp,
  ThumbsDown,
  ExternalLink,
  History,
  Trash2,
} from "lucide-react";

// Mock reports data
const reports = [
  {
    id: "1",
    type: "project",
    reason: "Fraud/Scam",
    targetId: "proj-123",
    targetName: "Amazing Widget Pro",
    reportedBy: "user@example.com",
    description: "This project appears to be using fake testimonials and stolen images.",
    status: "pending",
    priority: "high",
    createdAt: "2024-03-18 14:23",
    updatedAt: null,
  },
  {
    id: "2",
    type: "user",
    reason: "Harassment",
    targetId: "user-456",
    targetName: "aggressive_user",
    reportedBy: "victim@example.com",
    description: "This user has been sending threatening messages.",
    status: "pending",
    priority: "high",
    createdAt: "2024-03-18 12:45",
    updatedAt: null,
  },
  {
    id: "3",
    type: "comment",
    reason: "Spam",
    targetId: "comment-789",
    targetName: "Project comment",
    reportedBy: "creator@example.com",
    description: "Spam links to external websites.",
    status: "resolved",
    priority: "low",
    createdAt: "2024-03-17 09:30",
    updatedAt: "2024-03-17 11:00",
  },
  {
    id: "4",
    type: "project",
    reason: "Copyright Violation",
    targetId: "proj-456",
    targetName: "Super Cool Game",
    reportedBy: "copyright@holder.com",
    description: "Using copyrighted assets without permission.",
    status: "investigating",
    priority: "medium",
    createdAt: "2024-03-16 16:20",
    updatedAt: "2024-03-17 10:00",
  },
  {
    id: "5",
    type: "update",
    reason: "Misleading Content",
    targetId: "update-321",
    targetName: "Project Update #5",
    reportedBy: "backer@example.com",
    description: "The update contains false claims about shipping dates.",
    status: "dismissed",
    priority: "low",
    createdAt: "2024-03-15 11:00",
    updatedAt: "2024-03-16 09:00",
  },
];

const moderationStats = {
  pending: 23,
  investigating: 8,
  resolved: 456,
  dismissed: 89,
  avgResponseTime: "4.2 hours",
};

const pendingReviews = [
  {
    id: "1",
    type: "project",
    name: "Revolutionary Tech Gadget",
    creator: "new_creator@email.com",
    submittedAt: "2024-03-18 10:00",
    category: "Technology",
    fundingGoal: 50000,
    flags: ["first_project", "high_goal"],
  },
  {
    id: "2",
    type: "project",
    name: "Indie Film: Dark Waters",
    creator: "filmmaker@studio.com",
    submittedAt: "2024-03-18 09:30",
    category: "Film",
    fundingGoal: 25000,
    flags: [],
  },
  {
    id: "3",
    type: "project",
    name: "Artisan Coffee Subscription",
    creator: "coffee@lover.com",
    submittedAt: "2024-03-17 16:00",
    category: "Food",
    fundingGoal: 10000,
    flags: ["unverified_creator"],
  },
];

export default function ModerationPage() {
  const [activeTab, setActiveTab] = useState("reports");
  const [selectedReport, setSelectedReport] = useState<typeof reports[0] | null>(null);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "high":
        return <Badge className="bg-red-100 text-red-700">High</Badge>;
      case "medium":
        return <Badge className="bg-amber-100 text-amber-700">Medium</Badge>;
      default:
        return <Badge className="bg-zinc-100 text-zinc-700">Low</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-amber-100 text-amber-700"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
      case "investigating":
        return <Badge className="bg-blue-100 text-blue-700"><Eye className="h-3 w-3 mr-1" /> Investigating</Badge>;
      case "resolved":
        return <Badge className="bg-emerald-100 text-emerald-700"><CheckCircle className="h-3 w-3 mr-1" /> Resolved</Badge>;
      case "dismissed":
        return <Badge className="bg-zinc-100 text-zinc-700"><XCircle className="h-3 w-3 mr-1" /> Dismissed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "project":
        return <Badge variant="outline"><FolderKanban className="h-3 w-3 mr-1" /> Project</Badge>;
      case "user":
        return <Badge variant="outline"><Users className="h-3 w-3 mr-1" /> User</Badge>;
      case "comment":
        return <Badge variant="outline"><MessageSquare className="h-3 w-3 mr-1" /> Comment</Badge>;
      case "update":
        return <Badge variant="outline"><FileText className="h-3 w-3 mr-1" /> Update</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Moderation</h1>
          <p className="text-zinc-500">Review reports and moderate content</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline">
            <History className="mr-2 h-4 w-4" />
            View History
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
                <p className="text-2xl font-bold">{moderationStats.pending}</p>
                <p className="text-xs text-zinc-500">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-blue-100 p-2 dark:bg-blue-900/30">
                <Eye className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{moderationStats.investigating}</p>
                <p className="text-xs text-zinc-500">Investigating</p>
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
                <p className="text-2xl font-bold">{moderationStats.resolved}</p>
                <p className="text-xs text-zinc-500">Resolved</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-zinc-100 p-2 dark:bg-zinc-800">
                <XCircle className="h-5 w-5 text-zinc-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{moderationStats.dismissed}</p>
                <p className="text-xs text-zinc-500">Dismissed</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-violet-100 p-2 dark:bg-violet-900/30">
                <Shield className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{moderationStats.avgResponseTime}</p>
                <p className="text-xs text-zinc-500">Avg Response</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="reports">
            <Flag className="mr-2 h-4 w-4" />
            Reports
            {moderationStats.pending > 0 && (
              <Badge variant="destructive" className="ml-2">
                {moderationStats.pending}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="review">
            <Eye className="mr-2 h-4 w-4" />
            Project Review
            <Badge variant="secondary" className="ml-2">
              {pendingReviews.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="banned">
            <Ban className="mr-2 h-4 w-4" />
            Banned Content
          </TabsTrigger>
        </TabsList>

        {/* Reports Tab */}
        <TabsContent value="reports" className="mt-6 space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <Input
                placeholder="Search reports..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="investigating">Investigating</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="dismissed">Dismissed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Reports List */}
          <div className="space-y-4">
            {reports.map((report) => (
              <Card key={report.id} className={`${
                report.priority === "high" && report.status === "pending"
                  ? "border-red-200 bg-red-50/50 dark:bg-red-950/10"
                  : ""
              }`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                      <Flag className={`h-5 w-5 ${
                        report.priority === "high" ? "text-red-500" : "text-zinc-500"
                      }`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold">{report.reason}</h4>
                        {getTypeBadge(report.type)}
                        {getPriorityBadge(report.priority)}
                        {getStatusBadge(report.status)}
                      </div>

                      <p className="mt-1 text-sm">
                        <span className="text-zinc-500">Target:</span>{" "}
                        <span className="font-medium">{report.targetName}</span>
                      </p>

                      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2">
                        {report.description}
                      </p>

                      <div className="mt-3 flex items-center gap-4 text-xs text-zinc-500">
                        <span>Reported by: {report.reportedBy}</span>
                        <span>•</span>
                        <span>{report.createdAt}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedReport(report);
                          setShowReportDialog(true);
                        }}
                      >
                        <Eye className="mr-1 h-4 w-4" />
                        Review
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Project Review Tab */}
        <TabsContent value="review" className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Projects Pending Review</CardTitle>
              <CardDescription>Review and approve new project submissions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pendingReviews.map((project) => (
                  <div key={project.id} className="flex items-center gap-4 rounded-lg border p-4">
                    <div className="flex h-16 w-24 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                      <FolderKanban className="h-8 w-8 text-zinc-400" />
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold">{project.name}</h4>
                        {project.flags.includes("first_project") && (
                          <Badge variant="outline" className="text-amber-600">
                            First Project
                          </Badge>
                        )}
                        {project.flags.includes("high_goal") && (
                          <Badge variant="outline" className="text-blue-600">
                            High Goal
                          </Badge>
                        )}
                        {project.flags.includes("unverified_creator") && (
                          <Badge variant="outline" className="text-red-600">
                            Unverified
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-zinc-500">
                        by {project.creator} • {project.category} • ${project.fundingGoal.toLocaleString()} goal
                      </p>
                      <p className="text-xs text-zinc-400 mt-1">
                        Submitted: {project.submittedAt}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm">
                        <ExternalLink className="mr-1 h-4 w-4" />
                        Preview
                      </Button>
                      <Button variant="outline" size="sm" className="text-emerald-600">
                        <ThumbsUp className="mr-1 h-4 w-4" />
                        Approve
                      </Button>
                      <Button variant="outline" size="sm" className="text-red-600">
                        <ThumbsDown className="mr-1 h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Banned Content Tab */}
        <TabsContent value="banned" className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Banned Keywords & Patterns</CardTitle>
              <CardDescription>Manage auto-moderation rules</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Input placeholder="Add banned keyword or pattern..." />
                  <Button>Add</Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {["spam-link", "scam", "fake", "fraud", "offensive-term"].map((word) => (
                    <Badge key={word} variant="secondary" className="gap-1 px-3 py-1">
                      {word}
                      <button className="ml-1 hover:text-red-500">
                        <XCircle className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Banned Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { name: "spammer_123", reason: "Spam", date: "2024-03-10" },
                  { name: "scam_user", reason: "Fraud", date: "2024-03-08" },
                  { name: "harasser_456", reason: "Harassment", date: "2024-03-05" },
                ].map((user, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      <Ban className="h-5 w-5 text-red-500" />
                      <div>
                        <p className="font-medium">{user.name}</p>
                        <p className="text-xs text-zinc-500">
                          Banned for: {user.reason} • {user.date}
                        </p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      Unban
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Report Review Dialog */}
      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Report</DialogTitle>
          </DialogHeader>
          {selectedReport && (
            <div className="py-4 space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                {getTypeBadge(selectedReport.type)}
                {getPriorityBadge(selectedReport.priority)}
                {getStatusBadge(selectedReport.status)}
              </div>

              <div className="rounded-lg border p-4 space-y-3">
                <div>
                  <p className="text-sm text-zinc-500">Reason</p>
                  <p className="font-semibold">{selectedReport.reason}</p>
                </div>
                <div>
                  <p className="text-sm text-zinc-500">Target</p>
                  <p className="font-medium">{selectedReport.targetName}</p>
                </div>
                <div>
                  <p className="text-sm text-zinc-500">Description</p>
                  <p>{selectedReport.description}</p>
                </div>
                <div className="flex gap-6">
                  <div>
                    <p className="text-sm text-zinc-500">Reported By</p>
                    <p>{selectedReport.reportedBy}</p>
                  </div>
                  <div>
                    <p className="text-sm text-zinc-500">Reported At</p>
                    <p>{selectedReport.createdAt}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Moderator Notes</p>
                <Textarea placeholder="Add notes about this report..." rows={3} />
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View Content
                </Button>
                <Button variant="outline" className="flex-1">
                  <Users className="mr-2 h-4 w-4" />
                  View Reporter
                </Button>
              </div>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowReportDialog(false)}>
              Close
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" className="text-zinc-600">
                <XCircle className="mr-2 h-4 w-4" />
                Dismiss
              </Button>
              <Button variant="outline" className="text-amber-600">
                <Ban className="mr-2 h-4 w-4" />
                Take Action
              </Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700">
                <CheckCircle className="mr-2 h-4 w-4" />
                Mark Resolved
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
