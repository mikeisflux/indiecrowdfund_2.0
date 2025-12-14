"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
} from "lucide-react";

export interface CampaignForm {
  name: string;
  targetAudience: string;
  projectCategory: string;
  subjectTemplate: string;
  introMessage: string;
  autoGenerateCopy: boolean;
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
            <p className="text-sm text-zinc-500 mt-2">Your campaign is being prepared with AI-generated content.</p>
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
                <p className="text-xs text-zinc-500">Select a template to auto-fill campaign settings</p>
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
                    onValueChange={(value) => onFormChange({ ...form, targetAudience: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Subscribers</SelectItem>
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
                    <p className="text-xs text-zinc-500 mb-2">
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
