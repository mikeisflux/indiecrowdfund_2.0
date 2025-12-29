"use client";

import { getCSRFHeaders } from "@/lib/csrf";
import { fetchWithRetry } from "@/lib/fetch-utils";
import { toast } from "sonner";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Link2,
  Search,
  Trash2,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Calendar,
  User,
  ExternalLink,
  Filter,
  Clock,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ProjectLink {
  id: string;
  title: string;
  slug: string;
  status: string;
  creator: {
    id: string;
    name: string | null;
    email: string;
    vanityUrl: string | null;
  };
  createdAt: string;
  updatedAt: string;
  backerCount: number;
  currentAmount: number;
  goalAmount: number;
  fullUrl: string;
}

interface Stats {
  total: number;
  draft: number;
  unused90Days: number;
}

export default function LinkSanitizerPage() {
  const [projects, setProjects] = useState<ProjectLink[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, draft: 0, unused90Days: 0 });
  const [isRunningCleanup, setIsRunningCleanup] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [unusedFilter, setUnusedFilter] = useState("all");
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<ProjectLink | null>(null);

  const fetchProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (unusedFilter !== "all") params.set("unused", unusedFilter);
      if (searchQuery) params.set("search", searchQuery);

      const response = await fetchWithRetry(`/api/admin/link-sanitizer?${params}`);
      if (response.ok) {
        const data = await response.json();
        setProjects(data.projects || []);
        setStats(data.stats || { total: 0, draft: 0, unused90Days: 0 });
      }
    } catch (error) {
      console.error("Error fetching projects:", error);
      toast.error("Failed to load projects");
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, unusedFilter, searchQuery]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedProjects(new Set(projects.map(p => p.id)));
    } else {
      setSelectedProjects(new Set());
    }
  };

  const handleSelectProject = (projectId: string, checked: boolean) => {
    const newSelected = new Set(selectedProjects);
    if (checked) {
      newSelected.add(projectId);
    } else {
      newSelected.delete(projectId);
    }
    setSelectedProjects(newSelected);
  };

  const handleDeleteProject = async (project: ProjectLink) => {
    setProjectToDelete(project);
    setShowDeleteDialog(true);
  };

  const handleBulkDelete = () => {
    if (selectedProjects.size === 0) {
      toast.error("No projects selected");
      return;
    }
    setProjectToDelete(null);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      const idsToDelete = projectToDelete
        ? [projectToDelete.id]
        : Array.from(selectedProjects);

      const response = await fetch("/api/admin/link-sanitizer", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...getCSRFHeaders(),
        },
        body: JSON.stringify({ projectIds: idsToDelete }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`Deleted ${data.deletedCount} project(s)`);
        setSelectedProjects(new Set());
        fetchProjects();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to delete projects");
      }
    } catch (error) {
      console.error("Error deleting projects:", error);
      toast.error("Failed to delete projects");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setProjectToDelete(null);
    }
  };

  const runCleanup = async () => {
    setIsRunningCleanup(true);
    try {
      const response = await fetch("/api/cron/cleanup-projects", {
        method: "POST",
        headers: getCSRFHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.cleanedCount > 0) {
          toast.success(`Cleaned up ${data.cleanedCount} unused project(s)`);
        } else {
          toast.info("No unused projects found to clean up");
        }
        fetchProjects();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to run cleanup");
      }
    } catch (error) {
      console.error("Error running cleanup:", error);
      toast.error("Failed to run cleanup");
    } finally {
      setIsRunningCleanup(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      DRAFT: "secondary",
      SUBMITTED: "outline",
      APPROVED: "default",
      LIVE: "default",
      FUNDED: "default",
      FAILED: "destructive",
      CANCELLED: "destructive",
      PAUSED: "secondary",
    };
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
  };

  const isUnused = (project: ProjectLink) => {
    const daysSinceUpdate = Math.floor(
      (Date.now() - new Date(project.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    return project.status === "DRAFT" && project.backerCount === 0 && daysSinceUpdate >= 90;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Link Sanitizer</h1>
          <p className="text-muted-foreground">
            Manage project URLs and clean up unused projects
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={runCleanup}
            variant="default"
            disabled={isRunningCleanup || stats.unused90Days === 0}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {isRunningCleanup ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Running Cleanup...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Run Cleanup ({stats.unused90Days})
              </>
            )}
          </Button>
          <Button onClick={fetchProjects} variant="outline" disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
            <Link2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Draft Projects</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.draft}</div>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-400">Unused 90+ Days</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">{stats.unused90Days}</div>
            <p className="text-xs text-amber-600">Eligible for cleanup</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filter Projects</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by title, slug, or creator..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="SUBMITTED">Submitted</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="LIVE">Live</SelectItem>
                <SelectItem value="FUNDED">Funded</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={unusedFilter} onValueChange={setUnusedFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Unused Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                <SelectItem value="90">Unused 90+ Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedProjects.size > 0 && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-red-700 dark:text-red-400">
                {selectedProjects.size} project(s) selected
              </span>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Selected
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Projects Table */}
      <Card>
        <CardHeader>
          <CardTitle>Project Links</CardTitle>
          <CardDescription>
            All project URLs and their status. Select unused projects for cleanup.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Link2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No projects found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={selectedProjects.size === projects.length && projects.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Creator</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow
                    key={project.id}
                    className={isUnused(project) ? "bg-amber-50/50 dark:bg-amber-950/10" : ""}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedProjects.has(project.id)}
                        onCheckedChange={(checked) => handleSelectProject(project.id, checked as boolean)}
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{project.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {project.backerCount} backers | ${Number(project.currentAmount).toLocaleString()} / ${Number(project.goalAmount).toLocaleString()}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {project.fullUrl}
                        </code>
                        <a
                          href={`/${project.fullUrl}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm">{project.creator.name || "Unknown"}</p>
                          <p className="text-xs text-muted-foreground">{project.creator.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {getStatusBadge(project.status)}
                        {isUnused(project) && (
                          <Badge variant="outline" className="text-amber-600 border-amber-300">
                            Unused
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true })}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteProject(project)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-100"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project{selectedProjects.size > 1 ? "s" : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              {projectToDelete ? (
                <>
                  Are you sure you want to delete &quot;{projectToDelete.title}&quot;? This action cannot be undone and will permanently remove the project and all associated data.
                </>
              ) : (
                <>
                  Are you sure you want to delete {selectedProjects.size} project(s)? This action cannot be undone and will permanently remove the projects and all associated data.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
