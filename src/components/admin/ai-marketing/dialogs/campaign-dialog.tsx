"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmailEditor } from "@/components/ui/email-editor";
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
  Brain,
  Sparkles,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  LayoutGrid,
  Filter,
  Loader2,
} from "lucide-react";

export interface CampaignForm {
  name: string;
  targetAudience: string;
  projectCategory: string;
  subjectTemplate: string;
  introMessage: string;
  autoGenerateCopy: boolean;
  includeProjectRecommendations: boolean;
  selectedSegments: string[];
}

interface SubscriberSegment {
  id: string;
  name: string;
  description: string;
  count: number;
  filterType: "tag" | "source";
  filterValues: string[];
}

export interface CampaignTemplate {
  id: string;
  name: string;
  targetAudience: string;
  projectCategory: string;
  subjectTemplate: string;
  introMessage: string;
}

interface CampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: CampaignForm;
  onFormChange: (form: CampaignForm) => void;
  templates: CampaignTemplate[];
  isCreating: boolean;
  error: string | null;
  success: string | null;
  onApplyTemplate: (templateId: string) => void;
  onCreate: () => void;
  onReset: () => void;
}

export function CampaignDialog({
  open,
  onOpenChange,
  form,
  onFormChange,
  templates,
  isCreating,
  error,
  success,
  onApplyTemplate,
  onCreate,
  onReset,
}: CampaignDialogProps) {
  const [availableSegments, setAvailableSegments] = useState<SubscriberSegment[]>([]);
  const [segmentsLoading, setSegmentsLoading] = useState(false);

  // Fetch available segments when dialog opens
  useEffect(() => {
    if (open) {
      const fetchSegments = async () => {
        setSegmentsLoading(true);
        try {
          const response = await fetch("/api/admin/ai-marketing/subscribers/tags");
          if (response.ok) {
            const data = await response.json();
            setAvailableSegments(data.segments || []);
          }
        } catch (err) {
          console.error("Failed to fetch segments:", err);
        } finally {
          setSegmentsLoading(false);
        }
      };
      fetchSegments();
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) onReset();
      else onOpenChange(true);
    }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create AI-Powered Campaign</DialogTitle>
          <DialogDescription>
            Let AI match projects to users based on their interests and behavior
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-8 text-center">
            <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
            <h3 className="font-semibold text-lg text-emerald-700">{success}</h3>
            <p className="text-sm text-muted-foreground mt-2">Your campaign is being prepared with AI-generated content.</p>
          </div>
        ) : (
          <>
            <div className="space-y-4 py-4">
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/20 dark:text-red-400">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    {error}
                  </div>
                </div>
              )}

              {/* Quick Start Template */}
              <div className="space-y-2">
                <Label>Quick Start Template</Label>
                <Select onValueChange={onApplyTemplate}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a campaign template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Select a template to auto-fill campaign settings</p>
              </div>

              {/* AI Auto-Generate Toggle */}
              <div className="flex items-center justify-between rounded-lg border bg-violet-50 p-4 dark:bg-violet-950/20">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-5 w-5 text-violet-600" />
                  <div>
                    <Label className="text-violet-900 dark:text-violet-100">AI Auto-Generate Copy</Label>
                    <p className="text-sm text-violet-700 dark:text-violet-300">
                      Let AI write the subject line and intro message
                    </p>
                  </div>
                </div>
                <Switch
                  checked={form.autoGenerateCopy}
                  onCheckedChange={(checked) => onFormChange({ ...form, autoGenerateCopy: checked })}
                />
              </div>

              {/* Include Project Recommendations Toggle */}
              <div className="flex items-center justify-between rounded-lg border bg-blue-50 p-4 dark:bg-blue-950/20">
                <div className="flex items-center gap-3">
                  <LayoutGrid className="h-5 w-5 text-blue-600" />
                  <div>
                    <Label className="text-blue-900 dark:text-blue-100">Include Project Recommendations</Label>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Add &quot;Projects we think you&apos;ll love&quot; section at the bottom
                    </p>
                  </div>
                </div>
                <Switch
                  checked={form.includeProjectRecommendations}
                  onCheckedChange={(checked) => onFormChange({ ...form, includeProjectRecommendations: checked })}
                />
              </div>

              <div className="space-y-2">
                <Label>Campaign Name</Label>
                <Input
                  placeholder="e.g., Tech Enthusiasts - November 2024"
                  value={form.name}
                  onChange={(e) => onFormChange({ ...form, name: e.target.value })}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Target Audience</Label>
                  <Select
                    value={form.targetAudience}
                    onValueChange={(value) => onFormChange({ ...form, targetAudience: value, selectedSegments: [] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Subscribers</SelectItem>
                      <SelectItem value="subscriber">Newsletter Subscribers</SelectItem>
                      <SelectItem value="backers">Previous Backers</SelectItem>
                      <SelectItem value="high-value">High-Value Backers</SelectItem>
                      <SelectItem value="at-risk">At-Risk Churners</SelectItem>
                      <SelectItem value="creators">Project Creators</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Project Categories</Label>
                  <Select
                    value={form.projectCategory}
                    onValueChange={(value) => onFormChange({ ...form, projectCategory: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="technology">Technology</SelectItem>
                      <SelectItem value="games">Games</SelectItem>
                      <SelectItem value="film">Film & Video</SelectItem>
                      <SelectItem value="design">Design</SelectItem>
                      <SelectItem value="music">Music</SelectItem>
                      <SelectItem value="art">Art</SelectItem>
                      <SelectItem value="publishing">Publishing</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Subscriber Segment Selection - only show for subscriber audience types */}
              {(form.targetAudience === "all" || form.targetAudience === "subscriber") && (
                <div className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <Label>Target Specific Subscriber Segments</Label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Select which subscriber lists should receive this campaign. If none selected, all subscribers in the target audience will be included.
                  </p>
                  {segmentsLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading segments...
                    </div>
                  ) : availableSegments.length > 0 ? (
                    <ScrollArea className="h-40 rounded-lg border p-3">
                      <div className="space-y-2">
                        {availableSegments.map((segment) => (
                          <div
                            key={segment.id}
                            className="flex items-center justify-between rounded-lg border p-2 hover:bg-muted/50 dark:hover:bg-muted"
                          >
                            <div className="flex items-center gap-3">
                              <Checkbox
                                id={`create-${segment.id}`}
                                checked={form.selectedSegments?.includes(segment.id) || false}
                                onCheckedChange={(checked) => {
                                  const currentSegments = form.selectedSegments || [];
                                  if (checked) {
                                    onFormChange({ ...form, selectedSegments: [...currentSegments, segment.id] });
                                  } else {
                                    onFormChange({ ...form, selectedSegments: currentSegments.filter(id => id !== segment.id) });
                                  }
                                }}
                              />
                              <div>
                                <label
                                  htmlFor={`create-${segment.id}`}
                                  className="text-sm font-medium cursor-pointer"
                                >
                                  {segment.name}
                                </label>
                                <p className="text-xs text-muted-foreground">{segment.description}</p>
                              </div>
                            </div>
                            <Badge variant="secondary" className="text-xs">
                              {segment.count.toLocaleString()}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                      No subscriber segments found. Import subscribers with tags to create segments.
                    </div>
                  )}
                  {form.selectedSegments && form.selectedSegments.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between rounded-lg bg-blue-50 p-3 dark:bg-blue-950/20">
                        <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                          Estimated Recipients
                        </span>
                        <span className="text-lg font-bold text-blue-600">
                          {form.selectedSegments.reduce((sum, id) => {
                            const segment = availableSegments.find(s => s.id === id);
                            return sum + (segment?.count || 0);
                          }, 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">Selected segments:</span>
                        <div className="flex flex-wrap gap-1">
                          {form.selectedSegments.map(id => {
                            const segment = availableSegments.find(s => s.id === id);
                            return segment ? (
                              <Badge key={id} variant="default" className="text-xs">
                                {segment.name}
                              </Badge>
                            ) : null;
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!form.autoGenerateCopy && (
                <>
                  <div className="space-y-2">
                    <Label>Email Subject</Label>
                    <Input
                      placeholder="e.g., Projects you'll love this week"
                      value={form.subjectTemplate}
                      onChange={(e) => onFormChange({ ...form, subjectTemplate: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Email Body Content</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Design your email with rich formatting. Drag & drop or paste images directly.
                    </p>
                    <EmailEditor
                      value={form.introMessage}
                      onChange={(value) => onFormChange({ ...form, introMessage: value })}
                      placeholder="Start designing your email... AI will add personalized project recommendations below your content."
                      minHeight="200px"
                    />
                  </div>
                </>
              )}

              {form.autoGenerateCopy && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/20">
                  <div className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-emerald-600" />
                    <p className="font-medium text-emerald-900 dark:text-emerald-100">AI Will Generate</p>
                  </div>
                  <ul className="mt-2 text-sm text-emerald-700 dark:text-emerald-300 space-y-1">
                    <li>• Compelling email subject line optimized for opens</li>
                    <li>• Personalized intro message for your audience</li>
                    <li>• 3-5 project recommendations per recipient</li>
                    <li>• Custom reasons why each project matches the user</li>
                  </ul>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onReset} disabled={isCreating}>
                Cancel
              </Button>
              <Button onClick={onCreate} disabled={isCreating}>
                {isCreating ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Creating with AI...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Create Campaign
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
