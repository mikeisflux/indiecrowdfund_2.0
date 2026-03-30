"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Edit2,
  Trash2,
  MoreVertical,
  Eye,
  EyeOff,
  RefreshCw,
  Save,
  ArrowUp,
  ArrowDown,
  Megaphone,
  ExternalLink,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";

interface AnnouncementBar {
  id: string;
  text: string;
  linkUrl: string | null;
  linkText: string | null;
  backgroundColor: string;
  textColor: string;
  dismissible: boolean;
  isActive: boolean;
  startDate: string | null;
  endDate: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

const defaultAnnouncement: Partial<AnnouncementBar> = {
  text: "",
  linkUrl: "",
  linkText: "",
  backgroundColor: "#2563eb",
  textColor: "#ffffff",
  dismissible: true,
  isActive: true,
  startDate: null,
  endDate: null,
};

export default function AnnouncementBarPage() {
  const [announcements, setAnnouncements] = useState<AnnouncementBar[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0 });

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Partial<AnnouncementBar> | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Fetch announcements
  const fetchAnnouncements = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/announcement-bar");
      if (response.ok) {
        const data = await response.json();
        setAnnouncements(data.announcements || []);
        setStats(data.stats || { total: 0, active: 0, inactive: 0 });
      } else {
        toast.error("Failed to load announcements");
      }
    } catch (error) {
      console.error("Failed to fetch announcements:", error);
      toast.error("Failed to load announcements");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  // Create or update announcement
  const handleSave = async () => {
    if (!editingAnnouncement?.text) {
      toast.error("Text is required");
      return;
    }

    setIsSaving(true);
    try {
      const method = isEditing ? "PUT" : "POST";
      const response = await apiFetch("/api/admin/announcement-bar", {
        method,
        json: editingAnnouncement,
      });

      if (response.ok) {
        toast.success(isEditing ? "Announcement updated" : "Announcement created");
        setIsDialogOpen(false);
        setEditingAnnouncement(null);
        fetchAnnouncements();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to save announcement");
      }
    } catch (error) {
      console.error("Error saving announcement:", error);
      toast.error("Failed to save announcement");
    } finally {
      setIsSaving(false);
    }
  };

  // Delete announcement
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this announcement?")) return;

    try {
      const response = await apiFetch(`/api/admin/announcement-bar?id=${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Announcement deleted");
        fetchAnnouncements();
      } else {
        toast.error("Failed to delete announcement");
      }
    } catch (error) {
      console.error("Error deleting announcement:", error);
      toast.error("Failed to delete announcement");
    }
  };

  // Toggle active status
  const toggleActive = async (announcement: AnnouncementBar) => {
    try {
      const response = await apiFetch("/api/admin/announcement-bar", {
        method: "PUT",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({ id: announcement.id, isActive: !announcement.isActive }),
      });

      if (response.ok) {
        toast.success(announcement.isActive ? "Announcement hidden" : "Announcement visible");
        fetchAnnouncements();
      }
    } catch (error) {
      console.error("Error toggling announcement:", error);
    }
  };

  // Move announcement up/down
  const moveAnnouncement = async (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= announcements.length) return;

    const newAnnouncements = [...announcements];
    [newAnnouncements[index], newAnnouncements[newIndex]] = [newAnnouncements[newIndex], newAnnouncements[index]];

    try {
      const response = await apiFetch("/api/admin/announcement-bar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({ announcementIds: newAnnouncements.map((a) => a.id) }),
      });

      if (response.ok) {
        setAnnouncements(newAnnouncements);
        toast.success("Order updated");
      }
    } catch (error) {
      console.error("Error reordering:", error);
    }
  };

  // Open create dialog
  const openCreateDialog = () => {
    setEditingAnnouncement({ ...defaultAnnouncement });
    setIsEditing(false);
    setIsDialogOpen(true);
  };

  // Open edit dialog
  const openEditDialog = (announcement: AnnouncementBar) => {
    setEditingAnnouncement({ ...announcement });
    setIsEditing(true);
    setIsDialogOpen(true);
  };

  // Format date for display
  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-primary" />
            Announcement Bar
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage the announcement bar that appears at the top of your site
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchAnnouncements} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Add Announcement
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Total Announcements</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-500">{stats.active}</div>
            <p className="text-xs text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-muted-foreground">{stats.inactive}</div>
            <p className="text-xs text-muted-foreground">Inactive</p>
          </CardContent>
        </Card>
      </div>

      {/* Info Card */}
      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Megaphone className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-blue-500">How it works</p>
              <p className="text-muted-foreground mt-1">
                The first active announcement (by sort order) will be displayed at the top of your website.
                Users can dismiss the announcement, which will be remembered for 24 hours.
                Use the scheduling options to automatically show/hide announcements based on date.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Announcements List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : announcements.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Megaphone className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-medium">No announcements yet</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Create your first announcement to display at the top of your site.
            </p>
            <Button className="mt-4" onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Add Announcement
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {announcements.map((announcement, index) => (
            <Card key={announcement.id} className={!announcement.isActive ? "opacity-60" : ""}>
              <CardContent className="py-4">
                <div className="flex items-start gap-4">
                  {/* Reorder buttons */}
                  <div className="flex flex-col gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => moveAnnouncement(index, "up")}
                      disabled={index === 0}
                    >
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => moveAnnouncement(index, "down")}
                      disabled={index === announcements.length - 1}
                    >
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* Preview bar */}
                  <div
                    className="flex-1 rounded-md py-2 px-4 text-sm text-center"
                    style={{
                      backgroundColor: announcement.backgroundColor,
                      color: announcement.textColor,
                    }}
                  >
                    {announcement.text}
                    {announcement.linkUrl && (
                      <>
                        {" "}
                        <span className="underline font-semibold">
                          {announcement.linkText || announcement.linkUrl}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Status badges */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant={announcement.isActive ? "default" : "secondary"}>
                      {announcement.isActive ? "Active" : "Inactive"}
                    </Badge>
                    {announcement.startDate || announcement.endDate ? (
                      <Badge variant="outline" className="gap-1">
                        <Calendar className="h-3 w-3" />
                        Scheduled
                      </Badge>
                    ) : null}
                  </div>

                  {/* Actions */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditDialog(announcement)}>
                        <Edit2 className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggleActive(announcement)}>
                        {announcement.isActive ? (
                          <>
                            <EyeOff className="h-4 w-4 mr-2" />
                            Hide
                          </>
                        ) : (
                          <>
                            <Eye className="h-4 w-4 mr-2" />
                            Show
                          </>
                        )}
                      </DropdownMenuItem>
                      {announcement.linkUrl && (
                        <DropdownMenuItem asChild>
                          <a href={announcement.linkUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Open Link
                          </a>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => handleDelete(announcement.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Schedule info */}
                {(announcement.startDate || announcement.endDate) && (
                  <div className="mt-3 ml-14 text-xs text-muted-foreground flex items-center gap-4">
                    {announcement.startDate && (
                      <span>Starts: {formatDate(announcement.startDate)}</span>
                    )}
                    {announcement.endDate && (
                      <span>Ends: {formatDate(announcement.endDate)}</span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Announcement" : "Create Announcement"}</DialogTitle>
            <DialogDescription>
              Configure the announcement bar that will be displayed at the top of your site.
            </DialogDescription>
          </DialogHeader>

          {editingAnnouncement && (
            <div className="space-y-6 py-4">
              {/* Preview */}
              <div>
                <Label className="mb-2 block">Preview</Label>
                <div
                  className="rounded-md py-2.5 px-4 text-sm text-center"
                  style={{
                    backgroundColor: editingAnnouncement.backgroundColor || "#2563eb",
                    color: editingAnnouncement.textColor || "#ffffff",
                  }}
                >
                  {editingAnnouncement.text || "Your announcement text here"}
                  {editingAnnouncement.linkUrl && (
                    <>
                      {" "}
                      <span className="underline font-semibold">
                        {editingAnnouncement.linkText || editingAnnouncement.linkUrl}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Text */}
              <div className="space-y-2">
                <Label htmlFor="text">Announcement Text *</Label>
                <Textarea
                  id="text"
                  value={editingAnnouncement.text || ""}
                  onChange={(e) =>
                    setEditingAnnouncement({ ...editingAnnouncement, text: e.target.value })
                  }
                  placeholder="For instant support, please join our Discord."
                  rows={2}
                />
              </div>

              {/* Link */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="linkUrl">Link URL</Label>
                  <Input
                    id="linkUrl"
                    type="url"
                    value={editingAnnouncement.linkUrl || ""}
                    onChange={(e) =>
                      setEditingAnnouncement({ ...editingAnnouncement, linkUrl: e.target.value })
                    }
                    placeholder="https://discord.gg/..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="linkText">Link Text</Label>
                  <Input
                    id="linkText"
                    value={editingAnnouncement.linkText || ""}
                    onChange={(e) =>
                      setEditingAnnouncement({ ...editingAnnouncement, linkText: e.target.value })
                    }
                    placeholder="Join Now"
                  />
                  <p className="text-xs text-muted-foreground">
                    If empty, the URL will be displayed
                  </p>
                </div>
              </div>

              {/* Colors */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="backgroundColor">Background Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="backgroundColor"
                      type="color"
                      value={editingAnnouncement.backgroundColor || "#2563eb"}
                      onChange={(e) =>
                        setEditingAnnouncement({
                          ...editingAnnouncement,
                          backgroundColor: e.target.value,
                        })
                      }
                      className="w-12 h-10 p-1 cursor-pointer"
                    />
                    <Input
                      type="text"
                      value={editingAnnouncement.backgroundColor || "#2563eb"}
                      onChange={(e) =>
                        setEditingAnnouncement({
                          ...editingAnnouncement,
                          backgroundColor: e.target.value,
                        })
                      }
                      className="flex-1"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="textColor">Text Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="textColor"
                      type="color"
                      value={editingAnnouncement.textColor || "#ffffff"}
                      onChange={(e) =>
                        setEditingAnnouncement({
                          ...editingAnnouncement,
                          textColor: e.target.value,
                        })
                      }
                      className="w-12 h-10 p-1 cursor-pointer"
                    />
                    <Input
                      type="text"
                      value={editingAnnouncement.textColor || "#ffffff"}
                      onChange={(e) =>
                        setEditingAnnouncement({
                          ...editingAnnouncement,
                          textColor: e.target.value,
                        })
                      }
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>

              {/* Quick Color Presets */}
              <div className="space-y-2">
                <Label>Quick Presets</Label>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { bg: "#2563eb", text: "#ffffff", label: "Blue" },
                    { bg: "#16a34a", text: "#ffffff", label: "Green" },
                    { bg: "#dc2626", text: "#ffffff", label: "Red" },
                    { bg: "#9333ea", text: "#ffffff", label: "Purple" },
                    { bg: "#ea580c", text: "#ffffff", label: "Orange" },
                    { bg: "#1f2937", text: "#ffffff", label: "Dark" },
                    { bg: "#fbbf24", text: "#1f2937", label: "Yellow" },
                  ].map((preset) => (
                    <Button
                      key={preset.label}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setEditingAnnouncement({
                          ...editingAnnouncement,
                          backgroundColor: preset.bg,
                          textColor: preset.text,
                        })
                      }
                      className="gap-2"
                    >
                      <div
                        className="w-4 h-4 rounded-full border"
                        style={{ backgroundColor: preset.bg }}
                      />
                      {preset.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Scheduling */}
              <div className="space-y-4">
                <Label>Scheduling (Optional)</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate" className="text-sm font-normal text-muted-foreground">
                      Start Date
                    </Label>
                    <Input
                      id="startDate"
                      type="datetime-local"
                      value={
                        editingAnnouncement.startDate
                          ? new Date(editingAnnouncement.startDate).toISOString().slice(0, 16)
                          : ""
                      }
                      onChange={(e) =>
                        setEditingAnnouncement({
                          ...editingAnnouncement,
                          startDate: e.target.value || null,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate" className="text-sm font-normal text-muted-foreground">
                      End Date
                    </Label>
                    <Input
                      id="endDate"
                      type="datetime-local"
                      value={
                        editingAnnouncement.endDate
                          ? new Date(editingAnnouncement.endDate).toISOString().slice(0, 16)
                          : ""
                      }
                      onChange={(e) =>
                        setEditingAnnouncement({
                          ...editingAnnouncement,
                          endDate: e.target.value || null,
                        })
                      }
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Leave empty to show immediately and indefinitely.
                </p>
              </div>

              {/* Options */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="dismissible">Allow Dismissal</Label>
                    <p className="text-xs text-muted-foreground">
                      Users can close the announcement (remembers for 24 hours)
                    </p>
                  </div>
                  <Switch
                    id="dismissible"
                    checked={editingAnnouncement.dismissible ?? true}
                    onCheckedChange={(checked) =>
                      setEditingAnnouncement({ ...editingAnnouncement, dismissible: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="isActive">Active</Label>
                    <p className="text-xs text-muted-foreground">
                      Display this announcement on the site
                    </p>
                  </div>
                  <Switch
                    id="isActive"
                    checked={editingAnnouncement.isActive ?? true}
                    onCheckedChange={(checked) =>
                      setEditingAnnouncement({ ...editingAnnouncement, isActive: checked })
                    }
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {isEditing ? "Save Changes" : "Create Announcement"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
