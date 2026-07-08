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
  ExternalLink,
  Loader2,
  Newspaper,
} from "lucide-react";
import { slugify } from "@/lib/utils";

interface PressRelease {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  imageUrl: string | null;
  authorName: string | null;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface FormState {
  id: string | null;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  imageUrl: string;
  authorName: string;
  isPublished: boolean;
  publishedAt: string; // YYYY-MM-DD or ""
}

const EMPTY_FORM: FormState = {
  id: null,
  slug: "",
  title: "",
  excerpt: "",
  content: "",
  imageUrl: "",
  authorName: "The IndieCrowdfund Team",
  isPublished: false,
  publishedAt: "",
};

function toDateInputValue(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  return isNaN(d.getTime()) ? "" : d.toISOString().split("T")[0];
}

export default function AdminPressPage() {
  const [releases, setReleases] = useState<PressRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchReleases = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/press");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      const data = await res.json();
      setReleases(data.releases || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load press releases");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReleases();
  }, [fetchReleases]);

  const openNew = () => {
    setForm(EMPTY_FORM);
    setSlugTouched(false);
    setDialogOpen(true);
  };

  const openEdit = (release: PressRelease) => {
    setForm({
      id: release.id,
      slug: release.slug,
      title: release.title,
      excerpt: release.excerpt || "",
      content: release.content,
      imageUrl: release.imageUrl || "",
      authorName: release.authorName || "",
      isPublished: release.isPublished,
      publishedAt: toDateInputValue(release.publishedAt),
    });
    setSlugTouched(true);
    setDialogOpen(true);
  };

  const onTitleChange = (title: string) => {
    setForm((prev) => ({
      ...prev,
      title,
      // Auto-fill slug from title until the admin edits it manually.
      slug: slugTouched ? prev.slug : slugify(title),
    }));
  };

  const onSlugChange = (slug: string) => {
    setSlugTouched(true);
    setForm((prev) => ({ ...prev, slug }));
  };

  const submit = async () => {
    if (!form.title.trim() || !form.slug.trim() || !form.content.trim()) {
      toast.error("Title, slug, and content are required");
      return;
    }
    setSubmitting(true);
    try {
      const body = {
        slug: form.slug.trim(),
        title: form.title.trim(),
        excerpt: form.excerpt.trim() || null,
        content: form.content,
        imageUrl: form.imageUrl.trim() || null,
        authorName: form.authorName.trim() || null,
        isPublished: form.isPublished,
        publishedAt: form.publishedAt
          ? new Date(form.publishedAt + "T00:00:00").toISOString()
          : null,
      };

      const isEdit = !!form.id;
      const res = await apiFetch(
        isEdit ? `/api/admin/press/${form.id}` : "/api/admin/press",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      toast.success(isEdit ? "Press release updated" : "Press release created");
      setDialogOpen(false);
      fetchReleases();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (release: PressRelease) => {
    if (!confirm(`Delete "${release.title}"? This soft-deletes the release; it can be restored from the database.`)) {
      return;
    }
    setDeletingId(release.id);
    try {
      const res = await apiFetch(`/api/admin/press/${release.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      toast.success("Press release deleted");
      fetchReleases();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="container max-w-6xl py-8">
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/15">
            <Newspaper className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Press</h1>
            <p className="text-sm text-muted-foreground">
              Manage press releases shown at <code className="text-xs">/press</code>.
            </p>
          </div>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" />
          New Press Release
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Press Releases</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading…
            </div>
          ) : releases.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              No press releases yet. Create the first one above.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {releases.map((release) => (
                  <TableRow key={release.id}>
                    <TableCell className="font-medium">
                      <div>{release.title}</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        /press/{release.slug}
                      </div>
                    </TableCell>
                    <TableCell>
                      {release.isPublished ? (
                        <Badge variant="default" className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                          Published
                        </Badge>
                      ) : (
                        <Badge variant="outline">Draft</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {release.publishedAt
                        ? new Date(release.publishedAt).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {release.isPublished ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                          >
                            <a
                              href={`/press/${release.slug}`}
                              target="_blank"
                              rel="noreferrer"
                              title="View public page"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(release)}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => remove(release)}
                          disabled={deletingId === release.id}
                          title="Delete"
                        >
                          {deletingId === release.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 text-red-500" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {form.id ? "Edit Press Release" : "New Press Release"}
            </DialogTitle>
            <DialogDescription>
              Content is HTML — use <code className="text-xs">&lt;p&gt;</code>,{" "}
              <code className="text-xs">&lt;h2&gt;</code>,{" "}
              <code className="text-xs">&lt;ul&gt;&lt;li&gt;</code>,{" "}
              <code className="text-xs">&lt;strong&gt;</code>, and{" "}
              <code className="text-xs">&lt;a href=&quot;…&quot;&gt;</code> for
              formatting.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => onTitleChange(e.target.value)}
                placeholder="IndieCrowdfund Welcomes…"
                maxLength={300}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={form.slug}
                onChange={(e) => onSlugChange(e.target.value)}
                placeholder="indiecrowdfund-welcomes-creators"
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground">
                Lowercase letters, numbers, hyphens. URL:{" "}
                <code className="text-xs">/press/{form.slug || "your-slug"}</code>
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="excerpt">Excerpt (shown on /press list)</Label>
              <Textarea
                id="excerpt"
                value={form.excerpt}
                onChange={(e) =>
                  setForm((p) => ({ ...p, excerpt: e.target.value }))
                }
                placeholder="One- or two-sentence summary…"
                rows={3}
                maxLength={1000}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="content">Content (HTML)</Label>
              <Textarea
                id="content"
                value={form.content}
                onChange={(e) =>
                  setForm((p) => ({ ...p, content: e.target.value }))
                }
                placeholder='<p><strong>Today</strong> — body of the release…</p>'
                rows={18}
                className="font-mono text-sm"
              />
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="imageUrl">Hero image URL (optional)</Label>
                <Input
                  id="imageUrl"
                  value={form.imageUrl}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, imageUrl: e.target.value }))
                  }
                  placeholder="https://…"
                  maxLength={2000}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="authorName">Author / byline</Label>
                <Input
                  id="authorName"
                  value={form.authorName}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, authorName: e.target.value }))
                  }
                  placeholder="The IndieCrowdfund Team"
                  maxLength={200}
                />
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label htmlFor="isPublished" className="cursor-pointer">
                    Published
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Off = draft (hidden from /press).
                  </p>
                </div>
                <Switch
                  id="isPublished"
                  checked={form.isPublished}
                  onCheckedChange={(v) =>
                    setForm((p) => ({ ...p, isPublished: v }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="publishedAt">Published date</Label>
                <Input
                  id="publishedAt"
                  type="date"
                  value={form.publishedAt}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, publishedAt: e.target.value }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Leave blank to auto-stamp when first published.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving…
                </>
              ) : form.id ? (
                "Save changes"
              ) : (
                "Create"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
