"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Plus,
  Eye,
  EyeOff,
  Edit,
  Trash2,
  MoreHorizontal,
  Calendar,
  Globe,
  Lock,
  Loader2,
  Send,
  AlertTriangle,
  Sparkles,
  Settings,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { getCSRFHeaders } from "@/lib/csrf";
import { UserProfileDropdown } from "@/components/user-profile-dropdown";
import { NotificationsDropdown } from "@/components/notifications/notifications-dropdown";
import RichTextEditor from "@/components/rich-text-editor";

interface Project {
  id: string;
  title: string;
  slug: string;
  status: string;
}

interface ProjectUpdate {
  id: string;
  title: string;
  content: string;
  visibility: "public" | "backers_only";
  status: "draft" | "published";
  createdAt: string;
  publishedAt: string | null;
}

const SELECTED_PROJECT_KEY = "indiecrowdfund_selected_project";

export default function UpdatesPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [updates, setUpdates] = useState<ProjectUpdate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingUpdates, setIsLoadingUpdates] = useState(false);

  // Dialog state
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUpdate, setEditingUpdate] = useState<ProjectUpdate | null>(null);
  const [confirmDeleteUpdate, setConfirmDeleteUpdate] = useState<ProjectUpdate | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isBackersOnly, setIsBackersOnly] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPublishing, setIsPublishing] = useState<string | null>(null);

  // Fetch projects
  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/creator/dashboard?days=30", {
        headers: getCSRFHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);

        // Set selected project from localStorage or first project
        const savedProjectId = localStorage.getItem(SELECTED_PROJECT_KEY);
        if (savedProjectId && data.projects.some((p: Project) => p.id === savedProjectId)) {
          setSelectedProjectId(savedProjectId);
        } else if (data.projects.length > 0) {
          setSelectedProjectId(data.projects[0].id);
        }
      }
    } catch (error) {
      console.error("Error fetching projects:", error);
      toast.error("Failed to load projects");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch updates for selected project
  const fetchUpdates = useCallback(async () => {
    if (!selectedProjectId) return;

    setIsLoadingUpdates(true);
    try {
      const res = await fetch(`/api/creator/indiekit/updates?projectId=${selectedProjectId}`, {
        headers: getCSRFHeaders(),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to load updates");
      }

      const data = await res.json();
      setUpdates(data.updates || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load updates");
    } finally {
      setIsLoadingUpdates(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    if (selectedProjectId) {
      fetchUpdates();
      localStorage.setItem(SELECTED_PROJECT_KEY, selectedProjectId);
    }
  }, [selectedProjectId, fetchUpdates]);

  const resetForm = () => {
    setTitle("");
    setContent("");
    setIsBackersOnly(false);
  };

  const handleCreate = () => {
    resetForm();
    setIsCreateDialogOpen(true);
  };

  const handleEdit = (update: ProjectUpdate) => {
    setEditingUpdate(update);
    setTitle(update.title);
    setContent(update.content);
    setIsBackersOnly(update.visibility === "backers_only");
    setIsEditDialogOpen(true);
  };

  const handleSaveUpdate = async (publish: boolean = false) => {
    if (!selectedProjectId) {
      toast.error("No project selected");
      return;
    }

    if (!title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    if (!content.trim()) {
      toast.error("Please enter content");
      return;
    }

    setIsSaving(true);
    try {
      const isEditing = !!editingUpdate;
      const method = isEditing ? "PATCH" : "POST";
      const body = isEditing
        ? {
            updateId: editingUpdate.id,
            title,
            content,
            visibility: isBackersOnly ? "backers_only" : "public",
            status: publish ? "published" : editingUpdate.status,
          }
        : {
            projectId: selectedProjectId,
            title,
            content,
            visibility: isBackersOnly ? "backers_only" : "public",
            status: publish ? "published" : "draft",
          };

      const res = await fetch("/api/creator/indiekit/updates", {
        method,
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save update");
      }

      toast.success(publish ? "Update published!" : "Update saved as draft");
      setIsCreateDialogOpen(false);
      setIsEditDialogOpen(false);
      setEditingUpdate(null);
      resetForm();
      fetchUpdates();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save update");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublishToggle = async (update: ProjectUpdate) => {
    setIsPublishing(update.id);
    try {
      const newStatus = update.status === "published" ? "draft" : "published";
      const res = await fetch("/api/creator/indiekit/updates", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          action: newStatus === "published" ? "publish" : "unpublish",
          updateId: update.id,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update status");
      }

      toast.success(newStatus === "published" ? "Update published!" : "Update unpublished");
      fetchUpdates();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update status");
    } finally {
      setIsPublishing(null);
    }
  };

  const handleDelete = async () => {
    if (!confirmDeleteUpdate) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/creator/indiekit/updates?updateId=${confirmDeleteUpdate.id}`, {
        method: "DELETE",
        headers: getCSRFHeaders(),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete update");
      }

      toast.success("Update deleted");
      setConfirmDeleteUpdate(null);
      fetchUpdates();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete update");
    } finally {
      setIsDeleting(false);
    }
  };

  const publishedUpdates = updates.filter((u) => u.status === "published");
  const draftUpdates = updates.filter((u) => u.status === "draft");

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <div className="flex min-h-screen items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
              IndieCrowdfund
            </Link>
            <Badge variant="outline" className="border-primary/30 text-primary hidden sm:flex">
              <Sparkles className="w-3 h-3 mr-1" />
              Creator Dashboard
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <NotificationsDropdown />
            <Link href="/dashboard/settings" className="hidden sm:block">
              <Button variant="ghost" size="icon">
                <Settings className="h-5 w-5" />
              </Button>
            </Link>
            <UserProfileDropdown />
          </div>
        </div>
      </header>

      {/* Sub Navigation */}
      <div className="border-b bg-background/60 backdrop-blur-sm">
        <div className="container flex items-center gap-4 py-3 h-14">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
          <div className="flex-1" />
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger className="w-[280px] bg-card/50 backdrop-blur border-border/50">
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="container relative py-6">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              Post Updates
            </h1>
            <p className="text-muted-foreground">
              Keep your backers informed about your project progress
            </p>
          </div>
          <Button
            onClick={handleCreate}
            className="bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90"
            disabled={!selectedProjectId}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Update
          </Button>
        </div>

        {!selectedProjectId ? (
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground">Select a project to manage updates</p>
            </CardContent>
          </Card>
        ) : isLoadingUpdates ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Published Updates */}
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-green-500" />
                  Published Updates
                  <Badge variant="secondary">{publishedUpdates.length}</Badge>
                </CardTitle>
                <CardDescription>Updates visible to your backers</CardDescription>
              </CardHeader>
              <CardContent>
                {publishedUpdates.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Globe className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>No published updates yet</p>
                    <p className="text-sm">Create and publish an update to share with your backers</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {publishedUpdates.map((update) => (
                      <div
                        key={update.id}
                        className="flex items-start justify-between p-4 rounded-lg border bg-card/50 hover:bg-card/80 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium truncate">{update.title}</h3>
                            {update.visibility === "backers_only" ? (
                              <Badge variant="secondary" className="shrink-0">
                                <Lock className="h-3 w-3 mr-1" />
                                Backers Only
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="shrink-0">
                                <Globe className="h-3 w-3 mr-1" />
                                Public
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {update.publishedAt
                                ? new Date(update.publishedAt).toLocaleDateString()
                                : new Date(update.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(update)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handlePublishToggle(update)}
                              disabled={isPublishing === update.id}
                            >
                              <EyeOff className="h-4 w-4 mr-2" />
                              Unpublish
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setConfirmDeleteUpdate(update)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Draft Updates */}
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-amber-500" />
                  Drafts
                  <Badge variant="secondary">{draftUpdates.length}</Badge>
                </CardTitle>
                <CardDescription>Unpublished updates</CardDescription>
              </CardHeader>
              <CardContent>
                {draftUpdates.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>No drafts</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {draftUpdates.map((update) => (
                      <div
                        key={update.id}
                        className="flex items-start justify-between p-4 rounded-lg border border-dashed bg-card/30 hover:bg-card/50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium truncate">{update.title}</h3>
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                              Draft
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(update.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => handlePublishToggle(update)}
                            disabled={isPublishing === update.id}
                            className="bg-gradient-to-r from-primary to-purple-500"
                          >
                            {isPublishing === update.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Send className="h-4 w-4 mr-1" />
                                Publish
                              </>
                            )}
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(update)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setConfirmDeleteUpdate(update)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Create Update Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Update</DialogTitle>
            <DialogDescription>
              Share news and progress with your backers
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Update title..."
              />
            </div>

            <div className="space-y-2">
              <Label>Content</Label>
              <div className="min-h-[300px] border rounded-md">
                <RichTextEditor
                  content={content}
                  onChange={setContent}
                  placeholder="Write your update..."
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div className="space-y-0.5">
                <Label htmlFor="backers-only">Backers Only</Label>
                <p className="text-sm text-muted-foreground">
                  Only backers can see this update
                </p>
              </div>
              <Switch
                id="backers-only"
                checked={isBackersOnly}
                onCheckedChange={setIsBackersOnly}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleSaveUpdate(false)}
              disabled={isSaving}
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Draft
            </Button>
            <Button
              onClick={() => handleSaveUpdate(true)}
              disabled={isSaving}
              className="bg-gradient-to-r from-primary to-purple-500"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Update Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Update</DialogTitle>
            <DialogDescription>
              Make changes to your update
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Update title..."
              />
            </div>

            <div className="space-y-2">
              <Label>Content</Label>
              <div className="min-h-[300px] border rounded-md">
                <RichTextEditor
                  content={content}
                  onChange={setContent}
                  placeholder="Write your update..."
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div className="space-y-0.5">
                <Label htmlFor="edit-backers-only">Backers Only</Label>
                <p className="text-sm text-muted-foreground">
                  Only backers can see this update
                </p>
              </div>
              <Switch
                id="edit-backers-only"
                checked={isBackersOnly}
                onCheckedChange={setIsBackersOnly}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false);
                setEditingUpdate(null);
                resetForm();
              }}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleSaveUpdate(false)}
              disabled={isSaving}
              className="bg-gradient-to-r from-primary to-purple-500"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!confirmDeleteUpdate} onOpenChange={() => setConfirmDeleteUpdate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Update
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{confirmDeleteUpdate?.title}&rdquo;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDeleteUpdate(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Deleting...
                </>
              ) : (
                "Delete Update"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
