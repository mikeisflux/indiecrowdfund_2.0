"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { sanitizeHtml } from "@/lib/utils/sanitize";
import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  ArrowLeft,
  Mail,
  Send,
  Eye,
  Save,
  Loader2,
  User,
  AlertTriangle,
  Users,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";

interface EmailCampaign {
  id: string;
  name: string;
  subject: string;
  htmlContent: string;
  status: string;
  recipientCount: number;
  filters: {
    projectId?: string;
    stageId?: string;
  } | null;
}

const personalizationTags = [
  { tag: "{{FIRST_NAME}}", label: "First Name" },
  { tag: "{{PROJECT_NAME}}", label: "Project Name" },
  { tag: "{{PROJECT_URL}}", label: "Project URL" },
  { tag: "{{BACKER_COUNT}}", label: "Backer Count" },
  { tag: "{{PERCENT_FUNDED}}", label: "Percent Funded" },
  { tag: "{{DAYS_LEFT}}", label: "Days Left" },
  { tag: "{{CREATOR_NAME}}", label: "Creator Name" },
  { tag: "{{PRELAUNCH_URL}}", label: "Pre-launch URL" },
];

export default function EmailCampaignEditPage() {
  const router = useRouter();
  const params = useParams();
  const campaignId = params?.id as string;

  const [campaign, setCampaign] = useState<EmailCampaign | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [trackOpens, setTrackOpens] = useState(true);
  const [recipientSegment, setRecipientSegment] = useState("all_backers");

  // Fetch campaign data
  const fetchCampaign = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/creator/indiekit/campaigns?campaignId=${campaignId}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch campaign");
      }

      // The API returns campaigns array, find the one we need
      const foundCampaign = data.campaigns?.find((c: EmailCampaign) => c.id === campaignId) || data.campaign;

      if (foundCampaign) {
        setCampaign(foundCampaign);
        setName(foundCampaign.name || "");
        setSubject(foundCampaign.subject || "");
        setHtmlContent(foundCampaign.htmlContent || "");
      } else {
        throw new Error("Campaign not found");
      }
    } catch (error) {
      console.error("Error fetching campaign:", error);
      toast.error(error instanceof Error ? error.message : "Failed to load campaign");
    } finally {
      setIsLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    fetchCampaign();
  }, [fetchCampaign]);

  // Track unsaved changes
  useEffect(() => {
    if (campaign) {
      const hasChanges =
        name !== campaign.name ||
        subject !== campaign.subject ||
        htmlContent !== campaign.htmlContent;
      setHasUnsavedChanges(hasChanges);
    }
  }, [name, subject, htmlContent, campaign]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Please enter a campaign name");
      return;
    }

    setIsSaving(true);
    try {
      const res = await apiFetch("/api/creator/indiekit/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({
          action: "update",
          campaignId,
          name,
          subject,
          content: htmlContent,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save campaign");
      }

      setCampaign(data.campaign);
      setHasUnsavedChanges(false);
      toast.success("Campaign saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save campaign");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSend = async () => {
    if (!subject.trim()) {
      toast.error("Please enter an email subject");
      return;
    }
    if (!htmlContent.trim()) {
      toast.error("Please enter email content");
      return;
    }

    setIsSending(true);
    try {
      // First save any unsaved changes
      if (hasUnsavedChanges) {
        await handleSave();
      }

      // Then send the campaign
      const res = await apiFetch("/api/creator/indiekit/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({
          action: "send",
          campaignId,
          projectId: campaign?.filters?.projectId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send campaign");
      }

      toast.success("Campaign is being sent!");
      setShowSendDialog(false);
      router.push("/dashboard/indiekit?tab=email-campaigns");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send campaign");
    } finally {
      setIsSending(false);
    }
  };

  const insertTag = (tag: string) => {
    setHtmlContent(htmlContent + tag);
  };

  const getPreviewContent = () => {
    return htmlContent
      .replace(/{{FIRST_NAME}}/g, "John")
      .replace(/{{PROJECT_NAME}}/g, "My Awesome Project")
      .replace(/{{PROJECT_URL}}/g, "https://example.com/project")
      .replace(/{{BACKER_COUNT}}/g, "1,234")
      .replace(/{{PERCENT_FUNDED}}/g, "150")
      .replace(/{{DAYS_LEFT}}/g, "5")
      .replace(/{{CREATOR_NAME}}/g, "Project Creator")
      .replace(/{{PRELAUNCH_URL}}/g, "https://example.com/prelaunch")
      .replace(/{{MILESTONE}}/g, "$50,000")
      .replace(/{{STRETCH_GOAL_NAME}}/g, "Bonus Content Pack")
      .replace(/{{NEXT_STRETCH_GOAL}}/g, "$75,000");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
          <p className="text-muted-foreground">Loading campaign...</p>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Campaign Not Found</h2>
            <p className="text-muted-foreground mb-4">
              The email campaign you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it.
            </p>
            <Link href="/dashboard/indiekit?tab=email-campaigns">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Campaigns
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="container max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard/indiekit?tab=email-campaigns">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-semibold flex items-center gap-2">
                  <Mail className="h-5 w-5 text-teal-600" />
                  {name || "Untitled Campaign"}
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={campaign.status === "DRAFT" ? "secondary" : "default"}>
                    {campaign.status}
                  </Badge>
                  {hasUnsavedChanges && (
                    <Badge variant="outline" className="text-amber-600 border-amber-300">
                      Unsaved changes
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setShowPreview(!showPreview)}
              >
                <Eye className="h-4 w-4 mr-2" />
                {showPreview ? "Hide Preview" : "Preview"}
              </Button>
              <Button
                variant="outline"
                onClick={handleSave}
                disabled={isSaving || !hasUnsavedChanges}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Draft
              </Button>
              <Button
                className="bg-teal-600 hover:bg-teal-700"
                onClick={() => setShowSendDialog(true)}
                disabled={campaign.status !== "DRAFT"}
              >
                <Send className="h-4 w-4 mr-2" />
                Send Campaign
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container max-w-6xl mx-auto px-4 py-6">
        <div className={`grid gap-6 ${showPreview ? "grid-cols-2" : "grid-cols-1"}`}>
          {/* Editor Panel */}
          <div className="space-y-6">
            {/* Campaign Details */}
            <Card>
              <CardHeader>
                <CardTitle>Campaign Details</CardTitle>
                <CardDescription>Basic information about your email campaign</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Campaign Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Launch Announcement"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Internal name for your reference (not shown to recipients)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subject">Email Subject</Label>
                  <Input
                    id="subject"
                    placeholder="e.g., We're live! Back now for early bird pricing"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Recipients</Label>
                  <Select value={recipientSegment} onValueChange={setRecipientSegment}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all_backers">All Backers</SelectItem>
                      <SelectItem value="email_list">Email List Subscribers</SelectItem>
                      <SelectItem value="prelaunch">Pre-launch Signups</SelectItem>
                      <SelectItem value="unfulfilled">Unfulfilled Orders</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox
                    id="track"
                    checked={trackOpens}
                    onCheckedChange={(checked) => setTrackOpens(checked as boolean)}
                  />
                  <Label htmlFor="track" className="text-sm cursor-pointer">
                    Track email opens and clicks
                  </Label>
                </div>
              </CardContent>
            </Card>

            {/* Personalization Tags */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Personalization Tags
                </CardTitle>
                <CardDescription>Click to insert dynamic content</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {personalizationTags.map((p) => (
                    <Badge
                      key={p.tag}
                      variant="outline"
                      className="cursor-pointer hover:bg-teal-50 hover:border-teal-300 transition-colors"
                      onClick={() => insertTag(p.tag)}
                    >
                      {p.label}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Email Content */}
            <Card>
              <CardHeader>
                <CardTitle>Email Content</CardTitle>
                <CardDescription>Compose your email message</CardDescription>
              </CardHeader>
              <CardContent>
                <EmailEditor
                  value={htmlContent}
                  onChange={setHtmlContent}
                  placeholder="Write your email content here..."
                  minHeight="400px"
                  uploadUrl="/api/creator/media/upload"
                />
              </CardContent>
            </Card>
          </div>

          {/* Preview Panel */}
          {showPreview && (
            <div className="space-y-6">
              <Card className="sticky top-24">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Email Preview
                  </CardTitle>
                  <CardDescription>How your email will appear to recipients</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg overflow-hidden">
                    {/* Email Header Preview */}
                    <div className="bg-muted p-4 border-b">
                      <p className="text-sm text-muted-foreground">Subject:</p>
                      <p className="font-medium">
                        {subject
                          .replace(/{{PROJECT_NAME}}/g, "My Awesome Project")
                          .replace(/{{FIRST_NAME}}/g, "John")
                        || "(No subject)"}
                      </p>
                    </div>
                    {/* Email Body Preview */}
                    <div className="p-6 bg-white min-h-[400px]">
                      {htmlContent ? (
                        <div
                          className="prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(getPreviewContent()) }}
                        />
                      ) : (
                        <p className="text-muted-foreground text-center py-12">
                          Start typing to see a preview of your email
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Send Confirmation Dialog */}
      <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-teal-600" />
              Send Campaign
            </DialogTitle>
            <DialogDescription>
              You&apos;re about to send this email campaign. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <Users className="h-5 w-5 text-teal-600" />
              <div>
                <p className="font-medium">Recipients</p>
                <p className="text-sm text-muted-foreground">
                  {recipientSegment === "all_backers" && "All backers will receive this email"}
                  {recipientSegment === "email_list" && "All email list subscribers will receive this email"}
                  {recipientSegment === "prelaunch" && "Pre-launch signups will receive this email"}
                  {recipientSegment === "unfulfilled" && "Backers with unfulfilled orders will receive this email"}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">Subject: {subject || "(No subject)"}</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">Open tracking: {trackOpens ? "Enabled" : "Disabled"}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSendDialog(false)}>
              Cancel
            </Button>
            <Button
              className="bg-teal-600 hover:bg-teal-700"
              onClick={handleSend}
              disabled={isSending}
            >
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Now
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
