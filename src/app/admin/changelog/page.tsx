"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  FileText,
  Sparkles,
  Bug,
  Zap,
  Shield,
  Gauge,
  Palette,
  Code,
  Package,
  ExternalLink,
  GitBranch,
} from "lucide-react";

interface ChangelogEntry {
  id: string;
  title: string;
  description: string;
  category: string;
  version: string | null;
  commitHash: string | null;
  branch: string | null;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
  author: {
    name: string | null;
    email: string;
  } | null;
}

const CATEGORIES = [
  { value: "FEATURE", label: "New Feature", icon: Sparkles, color: "text-emerald-500" },
  { value: "BUGFIX", label: "Bug Fix", icon: Bug, color: "text-red-500" },
  { value: "IMPROVEMENT", label: "Improvement", icon: Zap, color: "text-blue-500" },
  { value: "SECURITY", label: "Security", icon: Shield, color: "text-purple-500" },
  { value: "PERFORMANCE", label: "Performance", icon: Gauge, color: "text-amber-500" },
  { value: "UI_UX", label: "UI/UX", icon: Palette, color: "text-pink-500" },
  { value: "API", label: "API", icon: Code, color: "text-cyan-500" },
  { value: "DOCUMENTATION", label: "Documentation", icon: FileText, color: "text-gray-500" },
  { value: "OTHER", label: "Other", icon: Package, color: "text-slate-500" },
];

interface ChangelogStats {
  total: number;
  published: number;
  drafts: number;
  bugfixes: number;
}

export default function AdminChangelogPage() {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [stats, setStats] = useState<ChangelogStats>({ total: 0, published: 0, drafts: 0, bugfixes: 0 });
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ChangelogEntry | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("FEATURE");
  const [version, setVersion] = useState("");
  const [commitHash, setCommitHash] = useState("");
  const [branch, setBranch] = useState("");
  const [isPublished, setIsPublished] = useState(false);

  const fetchEntries = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/changelog?limit=100");
      if (response.ok) {
        const data = await response.json();
        setEntries(data.entries || []);
        if (data.stats) {
          setStats(data.stats);
        }
      }
    } catch (error) {
      console.error("Error fetching changelog:", error);
      toast.error("Failed to load changelog entries");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setCategory("FEATURE");
    setVersion("");
    setCommitHash("");
    setBranch("");
    setIsPublished(false);
    setEditingEntry(null);
  };

  const openNewDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (entry: ChangelogEntry) => {
    setEditingEntry(entry);
    setTitle(entry.title);
    setDescription(entry.description);
    setCategory(entry.category);
    setVersion(entry.version || "");
    setCommitHash(entry.commitHash || "");
    setBranch(entry.branch || "");
    setIsPublished(entry.isPublished);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!title.trim() || !description.trim()) {
      toast.error("Title and description are required");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        id: editingEntry?.id,
        title: title.trim(),
        description: description.trim(),
        category,
        version: version.trim() || null,
        commitHash: commitHash.trim() || null,
        branch: branch.trim() || null,
        isPublished,
      };

      const response = await apiFetch("/api/admin/changelog", {
        method: editingEntry ? "PUT" : "POST",
        json: payload,
      });

      if (response.ok) {
        toast.success(editingEntry ? "Entry updated" : "Entry created");
        setDialogOpen(false);
        resetForm();
        fetchEntries();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to save entry");
      }
    } catch (error) {
      console.error("Error saving entry:", error);
      toast.error("Failed to save entry");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await apiFetch(`/api/admin/changelog?id=${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Entry deleted");
        setDeleteConfirm(null);
        fetchEntries();
      } else {
        toast.error("Failed to delete entry");
      }
    } catch (error) {
      console.error("Error deleting entry:", error);
      toast.error("Failed to delete entry");
    }
  };

  const togglePublished = async (entry: ChangelogEntry) => {
    try {
      const response = await apiFetch("/api/admin/changelog", {
        method: "PUT",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({
          id: entry.id,
          isPublished: !entry.isPublished,
        }),
      });

      if (response.ok) {
        toast.success(entry.isPublished ? "Unpublished" : "Published");
        fetchEntries();
      }
    } catch (error) {
      console.error("Error toggling publish:", error);
      toast.error("Failed to update entry");
    }
  };

  const handleExtractFromGit = async () => {
    setExtracting(true);
    try {
      const response = await apiFetch("/api/admin/changelog/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({ force: true }),
      });

      const data = await response.json();

      if (response.ok) {
        const { stats } = data;
        toast.success(
          `Sync complete! Created: ${stats.created}, Updated: ${stats.updated}, Skipped: ${stats.skipped}`
        );
        fetchEntries();
      } else {
        toast.error(data.error || "Failed to extract changelog");
        console.error("Extraction failed:", data.details, data.output);
      }
    } catch (error) {
      console.error("Error extracting from git:", error);
      toast.error("Failed to run extraction script");
    } finally {
      setExtracting(false);
    }
  };

  const getCategoryIcon = (cat: string) => {
    const found = CATEGORIES.find(c => c.value === cat);
    if (!found) return Package;
    return found.icon;
  };

  const getCategoryColor = (cat: string) => {
    const found = CATEGORIES.find(c => c.value === cat);
    return found?.color || "text-slate-500";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Changelog Management</h1>
          <p className="text-muted-foreground">
            Document updates, fixes, and improvements
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <a href="/changelog" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              View Public Page
            </a>
          </Button>
          <Button
            variant="outline"
            onClick={handleExtractFromGit}
            disabled={extracting}
          >
            {extracting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <GitBranch className="h-4 w-4 mr-2" />
            )}
            {extracting ? "Syncing..." : "Sync from Git"}
          </Button>
          <Button onClick={openNewDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Add Entry
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Total Entries</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-emerald-500">
              {stats.published}
            </div>
            <p className="text-xs text-muted-foreground">Published</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-amber-500">
              {stats.drafts}
            </div>
            <p className="text-xs text-muted-foreground">Drafts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-red-500">
              {stats.bugfixes}
            </div>
            <p className="text-xs text-muted-foreground">Bug Fixes</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No changelog entries yet</p>
              <Button variant="outline" className="mt-4" onClick={openNewDialog}>
                Create your first entry
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => {
                  const Icon = getCategoryIcon(entry.category);
                  return (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Icon className={`h-4 w-4 ${getCategoryColor(entry.category)}`} />
                          <span className="text-sm">
                            {CATEGORIES.find(c => c.value === entry.category)?.label || entry.category}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-md">
                          <p className="font-medium truncate">{entry.title}</p>
                          {entry.commitHash && (
                            <p className="text-xs text-muted-foreground font-mono">
                              {entry.commitHash.substring(0, 7)}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {entry.version ? (
                          <Badge variant="outline" className="font-mono">
                            v{entry.version}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={entry.isPublished ? "default" : "secondary"}
                          className={entry.isPublished ? "bg-emerald-500" : ""}
                        >
                          {entry.isPublished ? "Published" : "Draft"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          <div>{new Date(entry.createdAt).toLocaleDateString()}</div>
                          <div className="text-xs">{new Date(entry.createdAt).toLocaleTimeString()}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => togglePublished(entry)}
                            title={entry.isPublished ? "Unpublish" : "Publish"}
                          >
                            {entry.isPublished ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(entry)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteConfirm(entry.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingEntry ? "Edit Changelog Entry" : "New Changelog Entry"}
            </DialogTitle>
            <DialogDescription>
              Document a change, fix, or improvement to the platform.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => {
                      const Icon = cat.icon;
                      return (
                        <SelectItem key={cat.value} value={cat.value}>
                          <div className="flex items-center gap-2">
                            <Icon className={`h-4 w-4 ${cat.color}`} />
                            {cat.label}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="version">Version (optional)</Label>
                <Input
                  id="version"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="e.g., 1.2.0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Brief summary of the change"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detailed description of what changed, why, and any relevant context..."
                rows={5}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="commitHash">Commit Hash (optional)</Label>
                <Input
                  id="commitHash"
                  value={commitHash}
                  onChange={(e) => setCommitHash(e.target.value)}
                  placeholder="e.g., abc1234"
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="branch">Branch (optional)</Label>
                <Input
                  id="branch"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="e.g., main"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <div className="flex items-center gap-2">
                <Switch
                  id="published"
                  checked={isPublished}
                  onCheckedChange={setIsPublished}
                />
                <Label htmlFor="published">Publish immediately</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingEntry ? "Save Changes" : "Create Entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Entry</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this changelog entry? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
