"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/fetch-utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  Layers,
  Plus,
  Trash2,
  Users,
  Tag,
  RefreshCw,
  Loader2,
  Edit,
  X,
  Copy,
} from "lucide-react";
import { toast } from "sonner";

interface SegmentRule {
  type: "tag" | "source";
  values: string[];
  operator: "AND" | "OR";
}

interface Segment {
  id: string;
  name: string;
  description: string | null;
  rules: SegmentRule[];
  cachedCount: number;
  createdAt: string;
}

interface TagData {
  name: string;
  count: number;
  type: "tag";
}

interface SourceData {
  name: string;
  count: number;
  type: "source";
}

export function TagSegmentsTab() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [availableTags, setAvailableTags] = useState<TagData[]>([]);
  const [availableSources, setAvailableSources] = useState<SourceData[]>([]);
  const [totalSubscribers, setTotalSubscribers] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formRules, setFormRules] = useState<SegmentRule[]>([
    { type: "tag", values: [], operator: "OR" },
  ]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [segRes, tagRes] = await Promise.all([
        fetch("/api/admin/ai-marketing/segments"),
        fetch("/api/admin/ai-marketing/subscribers/tags"),
      ]);
      if (segRes.ok) {
        const data = await segRes.json();
        setSegments(data.segments || []);
      }
      if (tagRes.ok) {
        const data = await tagRes.json();
        setAvailableTags(data.tags || []);
        setAvailableSources(data.sources || []);
        setTotalSubscribers(data.totalSubscribers || 0);
      }
    } catch {
      toast.error("Failed to load segment data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const openCreate = () => {
    setEditingSegment(null);
    setFormName("");
    setFormDescription("");
    setFormRules([{ type: "tag", values: [], operator: "OR" }]);
    setShowCreateDialog(true);
  };

  const openEdit = (seg: Segment) => {
    setEditingSegment(seg);
    setFormName(seg.name);
    setFormDescription(seg.description || "");
    setFormRules(seg.rules.length ? seg.rules : [{ type: "tag", values: [], operator: "OR" }]);
    setShowCreateDialog(true);
  };

  const addRule = () => {
    setFormRules((prev) => [...prev, { type: "tag", values: [], operator: "OR" }]);
  };

  const removeRule = (index: number) => {
    setFormRules((prev) => prev.filter((_, i) => i !== index));
  };

  const updateRule = (index: number, patch: Partial<SegmentRule>) => {
    setFormRules((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...patch, values: patch.type && patch.type !== r.type ? [] : (patch.values ?? r.values) } : r))
    );
  };

  const toggleValue = (ruleIndex: number, value: string) => {
    setFormRules((prev) =>
      prev.map((r, i) => {
        if (i !== ruleIndex) return r;
        const has = r.values.includes(value);
        return { ...r, values: has ? r.values.filter((v) => v !== value) : [...r.values, value] };
      })
    );
  };

  const handleSave = async () => {
    if (!formName.trim()) { toast.error("Segment name is required"); return; }
    const validRules = formRules.filter((r) => r.values.length > 0);
    if (!validRules.length) { toast.error("Add at least one rule with values selected"); return; }

    setIsSaving(true);
    try {
      const payload = { name: formName, description: formDescription, rules: validRules };
      const res = editingSegment
        ? await apiFetch("/api/admin/ai-marketing/segments", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: editingSegment.id, ...payload }),
          })
        : await apiFetch("/api/admin/ai-marketing/segments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to save");
      }
      toast.success(editingSegment ? "Segment updated" : "Segment created");
      setShowCreateDialog(false);
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save segment");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setIsDeleting(id);
    try {
      const res = await apiFetch("/api/admin/ai-marketing/segments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Segment deleted");
      setSegments((prev) => prev.filter((s) => s.id !== id));
    } catch {
      toast.error("Failed to delete segment");
    } finally {
      setIsDeleting(null);
    }
  };

  const copySegmentId = (id: string) => {
    navigator.clipboard.writeText(`segment:${id}`);
    toast.success("Segment ID copied — use it in campaign filters");
  };

  return (
    <div className="mt-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Tag Segments</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Build reusable subscriber segments from tags and sources. Use them in email campaigns.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New Segment
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Layers className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{segments.length}</p>
              <p className="text-xs text-muted-foreground">Saved Segments</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Tag className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{availableTags.length}</p>
              <p className="text-xs text-muted-foreground">Available Tags</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalSubscribers.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Total Subscribers</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Segments list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Your Segments
          </CardTitle>
          <CardDescription>
            Click <strong>Use in Campaign</strong> to copy the segment ID for use when creating campaigns.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : segments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Layers className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="font-medium text-muted-foreground">No segments yet</p>
              <p className="text-sm text-muted-foreground mt-1">Create your first segment to target specific groups of subscribers.</p>
              <Button className="mt-4" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Create Segment
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {segments.map((seg) => (
                <div key={seg.id} className="flex items-start justify-between p-4 border rounded-lg gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium">{seg.name}</p>
                      <Badge variant="secondary" className="text-xs">
                        <Users className="h-3 w-3 mr-1" />
                        {seg.cachedCount.toLocaleString()} subscribers
                      </Badge>
                    </div>
                    {seg.description && (
                      <p className="text-sm text-muted-foreground mt-0.5">{seg.description}</p>
                    )}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {(seg.rules as SegmentRule[]).map((rule, i) => (
                        <div key={i} className="flex items-center gap-1 flex-wrap">
                          {i > 0 && <span className="text-xs text-muted-foreground font-medium">AND</span>}
                          <Badge variant="outline" className="text-xs gap-1">
                            {rule.type === "tag" ? <Tag className="h-2.5 w-2.5" /> : <Users className="h-2.5 w-2.5" />}
                            {rule.type === "tag" ? "Tag" : "Source"}:{" "}
                            <span className="font-medium">{rule.values.join(` ${rule.operator} `)}</span>
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => copySegmentId(seg.id)} title="Copy ID for campaign use">
                      <Copy className="h-3.5 w-3.5 mr-1" />
                      Use in Campaign
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(seg)}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(seg.id)}
                      disabled={isDeleting === seg.id}
                    >
                      {isDeleting === seg.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSegment ? "Edit Segment" : "Create Tag Segment"}</DialogTitle>
            <DialogDescription>
              Define rules using tags and sources to match subscribers. Multiple rules are combined with AND logic.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Name + Description */}
            <div className="space-y-2">
              <Label htmlFor="seg-name">Segment Name <span className="text-destructive">*</span></Label>
              <Input
                id="seg-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Comic Book Fans, VIP Backers"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="seg-desc">Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Textarea
                id="seg-desc"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Describe what this segment represents..."
                rows={2}
                className="resize-none"
              />
            </div>

            {/* Rules */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Filter Rules</Label>
                <Button variant="outline" size="sm" onClick={addRule}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Rule
                </Button>
              </div>

              {formRules.map((rule, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-3 relative">
                  {index > 0 && (
                    <div className="absolute -top-3 left-4 bg-background px-2 text-xs font-medium text-muted-foreground">
                      AND
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs text-muted-foreground">Filter by</Label>
                      <Select
                        value={rule.type}
                        onValueChange={(v) => updateRule(index, { type: v as "tag" | "source" })}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="tag">Tag</SelectItem>
                          <SelectItem value="source">Source</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs text-muted-foreground">Match logic</Label>
                      <Select
                        value={rule.operator}
                        onValueChange={(v) => updateRule(index, { operator: v as "AND" | "OR" })}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="OR">Match ANY (OR)</SelectItem>
                          <SelectItem value="AND">Match ALL (AND)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {formRules.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 mt-5 text-muted-foreground hover:text-destructive"
                        onClick={() => removeRule(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  {/* Tag/Source picker */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Select {rule.type === "tag" ? "tags" : "sources"}
                      {rule.values.length > 0 && (
                        <span className="ml-2 text-primary font-medium">
                          {rule.values.length} selected
                        </span>
                      )}
                    </Label>
                    <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1">
                      {(rule.type === "tag" ? availableTags : availableSources).map((item) => {
                        const selected = rule.values.includes(item.name);
                        return (
                          <button
                            key={item.name}
                            type="button"
                            onClick={() => toggleValue(index, item.name)}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs border transition-colors ${
                              selected
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background hover:bg-muted border-border"
                            }`}
                          >
                            {item.name}
                            <span className={`text-[10px] ${selected ? "opacity-80" : "text-muted-foreground"}`}>
                              ({item.count})
                            </span>
                          </button>
                        );
                      })}
                      {(rule.type === "tag" ? availableTags : availableSources).length === 0 && (
                        <p className="text-xs text-muted-foreground">No {rule.type === "tag" ? "tags" : "sources"} available yet</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</>
              ) : (
                <><Layers className="h-4 w-4 mr-2" />{editingSegment ? "Update Segment" : "Create Segment"}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
