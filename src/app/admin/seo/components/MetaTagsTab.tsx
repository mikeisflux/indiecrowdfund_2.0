"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  Loader2,
  Plus,
  Pencil,
  FileText,
  Eye,
  EyeOff,
} from "lucide-react";
import { SeoPageMeta, MetaForm } from "./types";
import { ScoreBadge, EmptyState } from "./helpers";

interface MetaTagsTabProps {
  pages: SeoPageMeta[];
  pageSearch: string;
  onPageSearchChange: (value: string) => void;
  showMetaDialog: boolean;
  onShowMetaDialogChange: (open: boolean) => void;
  editingPage: SeoPageMeta | null;
  metaForm: MetaForm;
  onMetaFormChange: (form: MetaForm) => void;
  isSavingMeta: boolean;
  onSaveMeta: () => void;
  onEditMeta: (page: SeoPageMeta) => void;
  onResetMetaForm: () => void;
}

export function MetaTagsTab({
  pages,
  pageSearch,
  onPageSearchChange,
  showMetaDialog,
  onShowMetaDialogChange,
  editingPage,
  metaForm,
  onMetaFormChange,
  isSavingMeta,
  onSaveMeta,
  onEditMeta,
  onResetMetaForm,
}: MetaTagsTabProps) {
  const filteredPages = pages.filter(
    (p) =>
      p.path.toLowerCase().includes(pageSearch.toLowerCase()) ||
      (p.title && p.title.toLowerCase().includes(pageSearch.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <CardTitle>Meta Tags Manager</CardTitle>
              <CardDescription>Manage SEO meta tags for all pages</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search pages..."
                  value={pageSearch}
                  onChange={(e) => onPageSearchChange(e.target.value)}
                  className="pl-9 w-60"
                />
              </div>
              <Button
                onClick={() => {
                  onResetMetaForm();
                  onShowMetaDialogChange(true);
                }}
                className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Page
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredPages.length > 0 ? (
            <ScrollArea className="h-[600px]">
              <div className="space-y-2">
                {filteredPages.map((page) => (
                  <div
                    key={page.id}
                    className="border rounded-lg p-4 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        {page.lastAuditScore !== null && (
                          <ScoreBadge score={page.lastAuditScore} />
                        )}
                        <span className="font-mono text-sm font-medium">{page.path}</span>
                        {page.noIndex && (
                          <Badge variant="outline" className="text-xs">
                            <EyeOff className="h-3 w-3 mr-1" />
                            noindex
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEditMeta(page)}
                      >
                        <Pencil className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                    </div>

                    {page.title && (
                      <p className="text-sm truncate mb-1">
                        <span className="text-muted-foreground">Title:</span>{" "}
                        {page.title}
                      </p>
                    )}
                    {page.description && (
                      <p className="text-sm truncate text-muted-foreground">
                        {page.description}
                      </p>
                    )}

                    {/* Google Preview */}
                    {(page.title || page.description) && (
                      <div className="mt-3 p-3 rounded-lg bg-white/5 border border-border/50">
                        <p className="text-xs text-muted-foreground mb-1">Google Preview:</p>
                        <div>
                          <p className="text-blue-400 text-sm hover:underline cursor-default truncate">
                            {page.title || page.path} - IndieCrowdfund
                          </p>
                          <p className="text-emerald-500 text-xs truncate">
                            www.indiecrowdfund.com{page.path}
                          </p>
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                            {page.description || "No description set."}
                          </p>
                        </div>
                      </div>
                    )}

                    {page.keywords && page.keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {page.keywords.map((kw, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {kw}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <EmptyState
              icon={FileText}
              title="No Pages Found"
              description={pageSearch ? "Try adjusting your search." : "Add your first page meta tags to get started."}
            />
          )}
        </CardContent>
      </Card>

      {/* Meta Tags Dialog */}
      <Dialog open={showMetaDialog} onOpenChange={(open) => { if (!open) { onShowMetaDialogChange(false); onResetMetaForm(); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{editingPage ? "Edit" : "Add"} Page Meta Tags</DialogTitle>
            <DialogDescription>
              {editingPage
                ? `Editing meta tags for ${editingPage.path}`
                : "Create meta tags for a new page path"}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4 py-2">
              <div>
                <Label htmlFor="meta-path">Page Path</Label>
                <Input
                  id="meta-path"
                  placeholder="/about-us"
                  value={metaForm.path}
                  onChange={(e) => onMetaFormChange({ ...metaForm, path: e.target.value })}
                  disabled={!!editingPage}
                />
              </div>

              <div>
                <Label htmlFor="meta-title">Title</Label>
                <Input
                  id="meta-title"
                  placeholder="Page Title - IndieCrowdfund"
                  value={metaForm.title}
                  onChange={(e) => onMetaFormChange({ ...metaForm, title: e.target.value })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {metaForm.title.length}/60 characters (recommended 50-60)
                </p>
              </div>

              <div>
                <Label htmlFor="meta-description">Description</Label>
                <Textarea
                  id="meta-description"
                  placeholder="A compelling description of this page..."
                  value={metaForm.description}
                  onChange={(e) => onMetaFormChange({ ...metaForm, description: e.target.value })}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {metaForm.description.length}/160 characters (recommended 120-155)
                </p>
                <Progress
                  value={Math.min((metaForm.description.length / 160) * 100, 100)}
                  className="h-1 mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="meta-og-title">OG Title</Label>
                  <Input
                    id="meta-og-title"
                    placeholder="Social media title"
                    value={metaForm.ogTitle}
                    onChange={(e) => onMetaFormChange({ ...metaForm, ogTitle: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="meta-og-desc">OG Description</Label>
                  <Input
                    id="meta-og-desc"
                    placeholder="Social media description"
                    value={metaForm.ogDescription}
                    onChange={(e) => onMetaFormChange({ ...metaForm, ogDescription: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="meta-og-image">OG Image URL</Label>
                <Input
                  id="meta-og-image"
                  placeholder="https://www.indiecrowdfund.com/og-image.jpg"
                  value={metaForm.ogImage}
                  onChange={(e) => onMetaFormChange({ ...metaForm, ogImage: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="meta-twitter-title">Twitter Title</Label>
                  <Input
                    id="meta-twitter-title"
                    placeholder="Twitter card title"
                    value={metaForm.twitterTitle}
                    onChange={(e) => onMetaFormChange({ ...metaForm, twitterTitle: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="meta-twitter-desc">Twitter Description</Label>
                  <Input
                    id="meta-twitter-desc"
                    placeholder="Twitter card description"
                    value={metaForm.twitterDesc}
                    onChange={(e) => onMetaFormChange({ ...metaForm, twitterDesc: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="meta-canonical">Canonical URL</Label>
                <Input
                  id="meta-canonical"
                  placeholder="https://www.indiecrowdfund.com/page"
                  value={metaForm.canonicalUrl}
                  onChange={(e) => onMetaFormChange({ ...metaForm, canonicalUrl: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="meta-keywords">Keywords (comma-separated)</Label>
                <Input
                  id="meta-keywords"
                  placeholder="crowdfunding, indie, creators"
                  value={metaForm.keywords}
                  onChange={(e) => onMetaFormChange({ ...metaForm, keywords: e.target.value })}
                />
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={metaForm.noIndex}
                    onCheckedChange={(checked) => onMetaFormChange({ ...metaForm, noIndex: checked })}
                  />
                  <Label>noIndex</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={metaForm.noFollow}
                    onCheckedChange={(checked) => onMetaFormChange({ ...metaForm, noFollow: checked })}
                  />
                  <Label>noFollow</Label>
                </div>
              </div>

              {/* Live Google Preview */}
              {(metaForm.title || metaForm.description) && (
                <div className="p-4 rounded-lg bg-white/5 border border-border/50">
                  <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                    <Eye className="h-3 w-3" /> Google Search Preview
                  </p>
                  <div>
                    <p className="text-blue-400 text-sm hover:underline cursor-default truncate">
                      {metaForm.title || metaForm.path || "Page Title"} - IndieCrowdfund
                    </p>
                    <p className="text-emerald-500 text-xs truncate">
                      www.indiecrowdfund.com{metaForm.path || "/"}
                    </p>
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                      {metaForm.description || "No description provided."}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => { onShowMetaDialogChange(false); onResetMetaForm(); }}>
              Cancel
            </Button>
            <Button
              onClick={onSaveMeta}
              disabled={isSavingMeta}
              className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
            >
              {isSavingMeta && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingPage ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
