"use client";

import { useState, useEffect } from "react";
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
  FileText,
  Plus,
  Eye,
  EyeOff,
  Edit,
  Trash2,
  MoreHorizontal,
  MessageSquare,
  Calendar,
  Users,
  Globe,
  Lock,
  Loader2,
  Send,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { getCSRFHeaders } from "@/lib/csrf";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { formatDistanceToNow } from "date-fns";

interface ProjectUpdate {
  id: string;
  title: string;
  content: string;
  visibility: "public" | "backers_only";
  isPublished: boolean;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  commentsCount: number;
  viewsCount: number;
}

interface UpdatesTabProps {
  projectId?: string;
  projectName?: string;
  hasActiveCampaign?: boolean;
}

export function UpdatesTab({ projectId, projectName, hasActiveCampaign = false }: UpdatesTabProps) {
  const [updates, setUpdates] = useState<ProjectUpdate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUpdate, setEditingUpdate] = useState<ProjectUpdate | null>(null);
  const [confirmDeleteUpdate, setConfirmDeleteUpdate] = useState<ProjectUpdate | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState<"public" | "backers_only">("public");
  const [isBackersOnly, setIsBackersOnly] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPublishing, setIsPublishing] = useState<string | null>(null);

  // Fetch updates
  useEffect(() => {
    if (projectId) {
      fetchUpdates();
    }
  }, [projectId]);

  const fetchUpdates = async () => {
    if (!projectId) return;

    setIsLoading(true);
    try {
      const res = await fetch(`/api/creator/indiekit/updates?projectId=${projectId}`, {
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
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setContent("");
    setVisibility("public");
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
    setVisibility(update.visibility);
    setIsBackersOnly(update.visibility === "backers_only");
    setIsEditDialogOpen(true);
  };

  const handleSaveUpdate = async (publish: boolean = false) => {
    if (!projectId) {
      toast.error("No project selected");
      return;
    }

    if (!title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    if (!content.trim() || content === "<p></p>") {
      toast.error("Please enter some content");
      return;
    }

    setIsSaving(true);
    try {
      const isEditing = !!editingUpdate;
      const res = await fetch("/api/creator/indiekit/updates", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          projectId,
          ...(isEditing && { updateId: editingUpdate.id }),
          title: title.trim(),
          content,
          visibility: isBackersOnly ? "backers_only" : "public",
          publish,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Failed to ${isEditing ? "update" : "create"} update`);
      }

      toast.success(
        publish
          ? `Update ${isEditing ? "updated and" : ""} published!`
          : `Update ${isEditing ? "updated" : "saved as draft"}`
      );

      setIsCreateDialogOpen(false);
      setIsEditDialogOpen(false);
      setEditingUpdate(null);
      resetForm();
      fetchUpdates();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async (update: ProjectUpdate) => {
    if (!projectId) return;

    setIsPublishing(update.id);
    try {
      const res = await fetch("/api/creator/indiekit/updates", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          projectId,
          action: "publish",
          updateId: update.id,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to publish update");
      }

      toast.success("Update published!");
      fetchUpdates();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to publish");
    } finally {
      setIsPublishing(null);
    }
  };

  const handleUnpublish = async (update: ProjectUpdate) => {
    if (!projectId) return;

    setIsPublishing(update.id);
    try {
      const res = await fetch("/api/creator/indiekit/updates", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          projectId,
          action: "unpublish",
          updateId: update.id,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to unpublish update");
      }

      toast.success("Update unpublished");
      fetchUpdates();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to unpublish");
    } finally {
      setIsPublishing(null);
    }
  };

  const handleDelete = async () => {
    if (!projectId || !confirmDeleteUpdate) return;

    setIsDeleting(true);
    try {
      const res = await fetch(
        `/api/creator/indiekit/updates?projectId=${projectId}&updateId=${confirmDeleteUpdate.id}`,
        {
          method: "DELETE",
          headers: getCSRFHeaders(),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete update");
      }

      toast.success("Update deleted");
      setConfirmDeleteUpdate(null);
      fetchUpdates();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    } finally {
      setIsDeleting(false);
    }
  };

  const publishedUpdates = updates.filter((u) => u.isPublished);
  const draftUpdates = updates.filter((u) => !u.isPublished);

  if (!hasActiveCampaign) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Active Campaign</h3>
            <p className="text-muted-foreground mb-4">
              You need an active campaign to post updates to your backers.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-teal-600" />
          <div>
            <h3 className="text-lg font-semibold">Project Updates</h3>
            <p className="text-sm text-muted-foreground">
              Keep your backers informed with project updates
            </p>
          </div>
        </div>
        <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          New Update
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total Updates</span>
            </div>
            <p className="text-2xl font-bold mt-1">{updates.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Published</span>
            </div>
            <p className="text-2xl font-bold mt-1">{publishedUpdates.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Edit className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Drafts</span>
            </div>
            <p className="text-2xl font-bold mt-1">{draftUpdates.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Drafts Section */}
      {draftUpdates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-amber-600" />
              Drafts
            </CardTitle>
            <CardDescription>Unpublished updates ready for editing</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {draftUpdates.map((update) => (
                <div key={update.id} className="flex items-start justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{update.title}</h4>
                      <Badge variant="secondary">Draft</Badge>
                      {update.visibility === "backers_only" && (
                        <Badge variant="outline" className="gap-1">
                          <Lock className="h-3 w-3" />
                          Backers Only
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Last edited {formatDistanceToNow(new Date(update.updatedAt), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePublish(update)}
                      disabled={isPublishing === update.id}
                    >
                      {isPublishing === update.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      Publish
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleEdit(update)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => setConfirmDeleteUpdate(update)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Published Updates */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-green-600" />
            Published Updates
          </CardTitle>
          <CardDescription>Updates visible to your audience</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : publishedUpdates.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No published updates yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first update to keep your backers informed about your project&apos;s progress.
              </p>
              <Button onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Update
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {publishedUpdates.map((update) => (
                <div key={update.id} className="flex items-start justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{update.title}</h4>
                      {update.visibility === "backers_only" ? (
                        <Badge variant="outline" className="gap-1">
                          <Lock className="h-3 w-3" />
                          Backers Only
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1">
                          <Globe className="h-3 w-3" />
                          Public
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {update.publishedAt
                          ? formatDistanceToNow(new Date(update.publishedAt), { addSuffix: true })
                          : "Just now"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {update.viewsCount} views
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {update.commentsCount} comments
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
                        onClick={() => handleUnpublish(update)}
                        disabled={isPublishing === update.id}
                      >
                        <EyeOff className="h-4 w-4 mr-2" />
                        Unpublish
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => setConfirmDeleteUpdate(update)}
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

      {/* Create/Edit Dialog */}
      <Dialog
        open={isCreateDialogOpen || isEditDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateDialogOpen(false);
            setIsEditDialogOpen(false);
            setEditingUpdate(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingUpdate ? "Edit Update" : "Create Project Update"}
            </DialogTitle>
            <DialogDescription>
              {editingUpdate
                ? "Make changes to your update"
                : `Share progress with your backers for ${projectName || "this project"}`
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="update-title">Title *</Label>
              <Input
                id="update-title"
                placeholder="e.g., Production Update - Week 3"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Content *</Label>
              <RichTextEditor
                value={content}
                onChange={setContent}
                placeholder="Share your progress with your backers..."
                projectId={projectId}
                className="min-h-[300px]"
              />
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                {isBackersOnly ? (
                  <Lock className="h-5 w-5 text-amber-600" />
                ) : (
                  <Globe className="h-5 w-5 text-green-600" />
                )}
                <div>
                  <p className="font-medium">
                    {isBackersOnly ? "Backers Only" : "Public Update"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isBackersOnly
                      ? "Only backers of this project can see this update"
                      : "Anyone visiting your project page can see this update"
                    }
                  </p>
                </div>
              </div>
              <Switch
                checked={isBackersOnly}
                onCheckedChange={setIsBackersOnly}
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateDialogOpen(false);
                setIsEditDialogOpen(false);
                setEditingUpdate(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => handleSaveUpdate(false)}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save as Draft"
              )}
            </Button>
            <Button
              className="bg-teal-600 hover:bg-teal-700"
              onClick={() => handleSaveUpdate(true)}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Publishing...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Publish Now
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Dialog */}
      <Dialog open={!!confirmDeleteUpdate} onOpenChange={(open) => !open && setConfirmDeleteUpdate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Delete Update?
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{confirmDeleteUpdate?.title}&quot;? This action cannot be undone.
              {confirmDeleteUpdate?.isPublished && (
                <span className="block mt-2 text-amber-600">
                  Warning: This is a published update. Deleting it will remove it from your project page.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteUpdate(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
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
