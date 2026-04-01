"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
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
import {
  Search,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Tag,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { SeoKeyword, KeywordForm } from "./types";
import { EmptyState } from "./helpers";

interface KeywordsTabProps {
  keywords: SeoKeyword[];
  keywordSearch: string;
  onKeywordSearchChange: (value: string) => void;
  keywordCategoryFilter: string;
  onKeywordCategoryFilterChange: (value: string) => void;
  showKeywordDialog: boolean;
  onShowKeywordDialogChange: (open: boolean) => void;
  editingKeyword: SeoKeyword | null;
  keywordForm: KeywordForm;
  onKeywordFormChange: (form: KeywordForm) => void;
  isSavingKeyword: boolean;
  onSaveKeyword: () => void;
  onDeleteKeyword: (id: string) => void;
  onEditKeyword: (kw: SeoKeyword) => void;
  onResetKeywordForm: () => void;
}

export function KeywordsTab({
  keywords,
  keywordSearch,
  onKeywordSearchChange,
  keywordCategoryFilter,
  onKeywordCategoryFilterChange,
  showKeywordDialog,
  onShowKeywordDialogChange,
  editingKeyword,
  keywordForm,
  onKeywordFormChange,
  isSavingKeyword,
  onSaveKeyword,
  onDeleteKeyword,
  onEditKeyword,
  onResetKeywordForm,
}: KeywordsTabProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <CardTitle>Keyword Tracker</CardTitle>
              <CardDescription>Monitor keyword rankings and performance</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search keywords..."
                  value={keywordSearch}
                  onChange={(e) => onKeywordSearchChange(e.target.value)}
                  className="pl-9 w-48"
                />
              </div>
              <Select value={keywordCategoryFilter} onValueChange={onKeywordCategoryFilterChange}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="primary">Primary</SelectItem>
                  <SelectItem value="secondary">Secondary</SelectItem>
                  <SelectItem value="long-tail">Long-tail</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={() => {
                  onResetKeywordForm();
                  onShowKeywordDialogChange(true);
                }}
                className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Keyword
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {keywords.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Keyword</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Category</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Volume</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Difficulty</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Rank</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Change</th>
                    <th className="text-right py-2 px-3 text-muted-foreground font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {keywords.map((kw) => {
                    const rankChange =
                      kw.previousRank !== null && kw.currentRank !== null
                        ? kw.previousRank - kw.currentRank
                        : null;
                    return (
                      <tr key={kw.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-2 px-3 font-medium">{kw.keyword}</td>
                        <td className="py-2 px-3">
                          {kw.category ? (
                            <Badge
                              variant="outline"
                              className={
                                kw.category === "primary"
                                  ? "border-emerald-500/50 text-emerald-400"
                                  : kw.category === "secondary"
                                    ? "border-blue-500/50 text-blue-400"
                                    : "border-purple-500/50 text-purple-400"
                              }
                            >
                              {kw.category}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">--</span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          {kw.searchVolume !== null ? kw.searchVolume.toLocaleString() : "--"}
                        </td>
                        <td className="py-2 px-3">
                          {kw.difficulty !== null ? (
                            <div className="flex items-center gap-2">
                              <Progress value={kw.difficulty} className="w-16 h-2" />
                              <span className="text-xs">{kw.difficulty}</span>
                            </div>
                          ) : (
                            "--"
                          )}
                        </td>
                        <td className="py-2 px-3 font-mono">
                          {kw.currentRank !== null ? `#${kw.currentRank}` : "--"}
                        </td>
                        <td className="py-2 px-3">
                          {rankChange !== null ? (
                            <div
                              className={`flex items-center gap-1 text-sm ${
                                rankChange > 0
                                  ? "text-emerald-500"
                                  : rankChange < 0
                                    ? "text-red-500"
                                    : "text-muted-foreground"
                              }`}
                            >
                              {rankChange > 0 ? (
                                <ArrowUpRight className="h-3 w-3" />
                              ) : rankChange < 0 ? (
                                <ArrowDownRight className="h-3 w-3" />
                              ) : null}
                              <span>{rankChange > 0 ? `+${rankChange}` : rankChange === 0 ? "=" : rankChange}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">--</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => onEditKeyword(kw)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onDeleteKeyword(kw.id)}
                              className="text-red-400 hover:text-red-500"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={Tag}
              title="No Keywords Tracked"
              description="Start tracking keywords to monitor your search engine rankings."
            />
          )}
        </CardContent>
      </Card>

      {/* Keyword Dialog */}
      <Dialog open={showKeywordDialog} onOpenChange={(open) => { if (!open) { onShowKeywordDialogChange(false); onResetKeywordForm(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingKeyword ? "Edit" : "Add"} Keyword</DialogTitle>
            <DialogDescription>
              {editingKeyword ? "Update keyword tracking details" : "Add a new keyword to track"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="kw-keyword">Keyword</Label>
              <Input
                id="kw-keyword"
                placeholder="crowdfunding platform"
                value={keywordForm.keyword}
                onChange={(e) => onKeywordFormChange({ ...keywordForm, keyword: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="kw-category">Category</Label>
              <Select
                value={keywordForm.category}
                onValueChange={(val) => onKeywordFormChange({ ...keywordForm, category: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">Primary</SelectItem>
                  <SelectItem value="secondary">Secondary</SelectItem>
                  <SelectItem value="long-tail">Long-tail</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="kw-target">Target Pages (comma-separated)</Label>
              <Input
                id="kw-target"
                placeholder="/discover, /about-us"
                value={keywordForm.targetPages}
                onChange={(e) => onKeywordFormChange({ ...keywordForm, targetPages: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="kw-volume">Search Volume</Label>
                <Input
                  id="kw-volume"
                  type="number"
                  placeholder="1000"
                  value={keywordForm.searchVolume}
                  onChange={(e) => onKeywordFormChange({ ...keywordForm, searchVolume: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="kw-difficulty">Difficulty (0-100)</Label>
                <Input
                  id="kw-difficulty"
                  type="number"
                  placeholder="45"
                  value={keywordForm.difficulty}
                  onChange={(e) => onKeywordFormChange({ ...keywordForm, difficulty: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="kw-rank">Current Rank</Label>
                <Input
                  id="kw-rank"
                  type="number"
                  placeholder="12"
                  value={keywordForm.currentRank}
                  onChange={(e) => onKeywordFormChange({ ...keywordForm, currentRank: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="kw-notes">Notes</Label>
              <Textarea
                id="kw-notes"
                placeholder="Optional notes about this keyword..."
                value={keywordForm.notes}
                onChange={(e) => onKeywordFormChange({ ...keywordForm, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { onShowKeywordDialogChange(false); onResetKeywordForm(); }}>
              Cancel
            </Button>
            <Button
              onClick={onSaveKeyword}
              disabled={isSavingKeyword}
              className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
            >
              {isSavingKeyword && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingKeyword ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
