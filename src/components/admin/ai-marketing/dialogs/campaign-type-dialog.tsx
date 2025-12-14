"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EmailEditor } from "@/components/ui/email-editor";
import { Loader2, Users, UserCheck, Layers, Send, Check, AlertCircle } from "lucide-react";
import { getCSRFHeaders } from "@/lib/csrf";

interface CampaignTypeConfig {
  type: string;
  description: string;
  recipientCount: number;
  sampleRecipients: Array<{ id: string; email: string; name: string | null }>;
  projects: Array<{
    id: string;
    title: string;
    description: string | null;
    category: string | null;
    goalAmount: number;
    currentAmount: number;
    imageUrl: string | null;
  }>;
  aiSettings: {
    emailPersonalization: boolean;
    sendTimeOptimization: boolean;
    contentOptimization: boolean;
  };
}

interface CampaignTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignType: "subscriber" | "backer" | "creator" | null;
  onSuccess?: () => void;
}

export function CampaignTypeDialog({
  open,
  onOpenChange,
  campaignType,
  onSuccess,
}: CampaignTypeDialogProps) {
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [config, setConfig] = useState<CampaignTypeConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [intro, setIntro] = useState("");
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);

  useEffect(() => {
    if (open && campaignType) {
      fetchConfig();
    } else {
      // Reset state when dialog closes
      setConfig(null);
      setError(null);
      setSuccess(null);
      setName("");
      setSubject("");
      setIntro("");
      setSelectedProjects([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, campaignType]);

  const fetchConfig = async () => {
    if (!campaignType) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/ai-marketing/campaigns/${campaignType}`, {
        headers: getCSRFHeaders(),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch campaign configuration");
      }

      const data = await response.json();
      setConfig(data);

      // Set default name based on type
      const typeNames = {
        subscriber: "Newsletter Subscriber Campaign",
        backer: "Backer Engagement Campaign",
        creator: "Creator Notification Campaign",
      };
      setName(typeNames[campaignType] || "New Campaign");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load configuration");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!campaignType || !name) return;

    setCreating(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/admin/ai-marketing/campaigns/${campaignType}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getCSRFHeaders(),
        },
        body: JSON.stringify({
          name,
          subjectTemplate: subject,
          introMessage: intro,
          projectIds: selectedProjects.length > 0 ? selectedProjects : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create campaign");
      }

      setSuccess(
        `Campaign "${data.campaign.name}" created! ` +
        `${data.campaign.eligibleRecipients} recipients eligible ` +
        `(${data.campaign.skippedDueToLimits} skipped due to email limits).`
      );

      // Call success callback after a delay
      setTimeout(() => {
        onSuccess?.();
        onOpenChange(false);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create campaign");
    } finally {
      setCreating(false);
    }
  };

  const toggleProject = (projectId: string) => {
    setSelectedProjects((prev) =>
      prev.includes(projectId)
        ? prev.filter((id) => id !== projectId)
        : [...prev, projectId]
    );
  };

  const getTypeIcon = () => {
    switch (campaignType) {
      case "subscriber":
        return <Users className="h-5 w-5 text-blue-600" />;
      case "backer":
        return <UserCheck className="h-5 w-5 text-emerald-600" />;
      case "creator":
        return <Layers className="h-5 w-5 text-violet-600" />;
      default:
        return null;
    }
  };

  const getTypeTitle = () => {
    switch (campaignType) {
      case "subscriber":
        return "Subscriber Campaign";
      case "backer":
        return "Backer Campaign";
      case "creator":
        return "Creator Campaign";
      default:
        return "Campaign";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-zinc-100 p-2">{getTypeIcon()}</div>
            <div>
              <DialogTitle>{getTypeTitle()}</DialogTitle>
              <DialogDescription>
                {config?.description || "Configure and create your campaign"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-red-600">
            <AlertCircle className="h-5 w-5" />
            <p>{error}</p>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 rounded-lg bg-green-50 p-4 text-green-600">
            <Check className="h-5 w-5" />
            <p>{success}</p>
          </div>
        )}

        {config && !loading && !success && (
          <div className="space-y-6">
            {/* Recipient Count */}
            <div className="rounded-lg bg-zinc-50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">Potential Recipients</span>
                <span className="text-2xl font-bold">{config.recipientCount.toLocaleString()}</span>
              </div>
              {config.sampleRecipients.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-zinc-400">Sample: {config.sampleRecipients.slice(0, 3).map(r => r.email).join(", ")}</p>
                </div>
              )}
            </div>

            {/* AI Features */}
            <div className="flex flex-wrap gap-2">
              {config.aiSettings.emailPersonalization && (
                <Badge variant="secondary">AI Personalization</Badge>
              )}
              {config.aiSettings.sendTimeOptimization && (
                <Badge variant="secondary">Optimal Send Time</Badge>
              )}
              {config.aiSettings.contentOptimization && (
                <Badge variant="secondary">Content Optimization</Badge>
              )}
            </div>

            {/* Campaign Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Campaign Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter campaign name"
              />
            </div>

            {/* Subject Template */}
            <div className="space-y-2">
              <Label htmlFor="subject">Subject Line (optional)</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="AI will generate if left empty"
              />
            </div>

            {/* Intro Message with Rich Text Editor */}
            <div className="space-y-2">
              <Label>Email Body Content (optional)</Label>
              <p className="text-xs text-zinc-500 mb-2">
                Design your email content below. Drag & drop or paste images directly. AI will add personalized project recommendations after your content.
              </p>
              <EmailEditor
                value={intro}
                onChange={setIntro}
                placeholder="Start designing your email... Drag & drop images, add formatting, and create beautiful HTML emails."
                minHeight="200px"
              />
            </div>

            {/* Project Selection */}
            {config.projects.length > 0 && (
              <div className="space-y-2">
                <Label>Featured Projects (select to include)</Label>
                <div className="grid gap-2 max-h-48 overflow-y-auto">
                  {config.projects.map((project) => (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => toggleProject(project.id)}
                      className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                        selectedProjects.includes(project.id)
                          ? "border-emerald-500 bg-emerald-50"
                          : "border-zinc-200 hover:bg-zinc-50"
                      }`}
                    >
                      <div className="flex-1">
                        <p className="font-medium">{project.title}</p>
                        <p className="text-xs text-zinc-500">
                          {project.category} • ${(project.currentAmount / 100).toLocaleString()} raised
                        </p>
                      </div>
                      {selectedProjects.includes(project.id) && (
                        <Check className="h-5 w-5 text-emerald-600" />
                      )}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-zinc-500">
                  {selectedProjects.length === 0
                    ? "All live projects will be included"
                    : `${selectedProjects.length} project(s) selected`}
                </p>
              </div>
            )}

            {/* Create Button */}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={creating || !name}>
                {creating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Create Campaign
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
