"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { sanitizeHtml } from "@/lib/utils/sanitize";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { EmailEditor } from "@/components/ui/email-editor";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Mail,
  Send,
  ChevronLeft,
  MoreHorizontal,
  CheckCircle2,
  Calendar,
  Filter,
  Upload,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ImportEmailDialog } from "./import-email-dialog";

interface Project {
  id: string;
  title: string;
  slug: string;
  status: string;
}

interface EmailTemplate {
  subject?: string;
  body?: string;
  name?: string;
}

interface EmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: Project[];
  selectedProjectId: string;
  onProjectChange?: (projectId: string) => void;
  memberCount?: number;
  userEmail?: string;
  onImportComplete?: () => void;
  initialTemplate?: EmailTemplate | null;
}

type EditorStep = "campaign" | "customize" | "send" | "results";

export function EmailDialog({
  open,
  onOpenChange,
  projects,
  selectedProjectId,
  onProjectChange,
  memberCount = 0,
  userEmail = "",
  onImportComplete,
  initialTemplate,
}: EmailDialogProps) {
  const [activeStep, setActiveStep] = useState<EditorStep>("campaign");
  const [currentProjectId, setCurrentProjectId] = useState(selectedProjectId);
  const currentProject = projects.find(p => p.id === currentProjectId) || projects[0];
  const projectTitle = currentProject?.title || "Select a project";

  const [emailTitle, setEmailTitle] = useState(initialTemplate?.subject || `Special Early Access: ${projectTitle}`);
  const [senderName, setSenderName] = useState("");
  const [emailBody, setEmailBody] = useState(initialTemplate?.body || "");

  // Send step state
  const [testEmail, setTestEmail] = useState(userEmail);
  const [replyToEmail, setReplyToEmail] = useState(userEmail);
  const [isEditingReplyTo, setIsEditingReplyTo] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isSendingCampaign, setIsSendingCampaign] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");

  // Filter Members: a creator with a heterogeneous list (CSV imports,
  // teaser signups, manually-added) can scope a campaign send to one
  // or more EmailListSubscriber.source values. When `selectedSources`
  // is null we send to every subscribed member (back-compat default).
  // The breakdown is fetched from /api/creator/email-marketing/subscribers
  // when the popover opens; we group by `sourceType` and show counts.
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
  const [selectedSources, setSelectedSources] = useState<string[] | null>(null);
  const [sourceBreakdown, setSourceBreakdown] = useState<{
    label: string;
    sources: string[];   // EmailListSubscriber.source values mapped to this group
    count: number;
  }[]>([]);
  const [breakdownLoading, setBreakdownLoading] = useState(false);

  const fetchSourceBreakdown = useCallback(async () => {
    setBreakdownLoading(true);
    try {
      const r = await apiFetch("/api/creator/email-marketing/subscribers");
      if (!r.ok) return;
      const data = await r.json();
      const subs: Array<{ status: string; source: string; sourceType: string }> = data.subscribers || [];
      // Group by sourceType (which the API normalizes for us). Only
      // count subscribed-status records since unsubscribed/bounced
      // aren't sendable.
      const groups: Record<string, { label: string; sources: Set<string>; count: number }> = {
        import: { label: "Imported (CSV / project)", sources: new Set(), count: 0 },
        teaser: { label: "Teaser signups", sources: new Set(), count: 0 },
        manual: { label: "Manually added", sources: new Set(), count: 0 },
      };
      for (const s of subs) {
        if (s.status !== "active") continue;
        const g = groups[s.sourceType];
        if (!g) continue;
        g.sources.add(s.source);
        g.count += 1;
      }
      setSourceBreakdown(
        Object.values(groups)
          .filter((g) => g.count > 0)
          .map((g) => ({ label: g.label, sources: Array.from(g.sources), count: g.count }))
      );
    } finally {
      setBreakdownLoading(false);
    }
  }, []);

  useEffect(() => {
    if (filterPopoverOpen && sourceBreakdown.length === 0 && !breakdownLoading) {
      fetchSourceBreakdown();
    }
  }, [filterPopoverOpen, sourceBreakdown.length, breakdownLoading, fetchSourceBreakdown]);

  // Effective recipient count after applying source filter. When no
  // filter is set, fall back to the full count from the parent.
  const filteredCount = selectedSources === null
    ? memberCount
    : sourceBreakdown
        .filter((g) => g.sources.some((s) => selectedSources.includes(s)))
        .reduce((sum, g) => sum + g.count, 0);

  const toggleGroup = (groupSources: string[]) => {
    setSelectedSources((prev) => {
      // Treat null (no filter) as "everything selected" for the toggle
      // semantics: clicking a group when no filter is set becomes a
      // single-group filter; clicking that group again clears the
      // filter back to null.
      const all = sourceBreakdown.flatMap((g) => g.sources);
      const current = prev ?? all;
      const isOn = groupSources.every((s) => current.includes(s));
      const next = isOn
        ? current.filter((s) => !groupSources.includes(s))
        : Array.from(new Set([...current, ...groupSources]));
      return next.length === all.length ? null : next;
    });
  };

  // Initialize/update form when project changes or template is provided
  useEffect(() => {
    if (initialTemplate) {
      // If a template is provided, use it
      if (initialTemplate.subject) {
        setEmailTitle(initialTemplate.subject.replace(/{{PROJECT_NAME}}/g, currentProject?.title || "Your Project"));
      }
      if (initialTemplate.body) {
        setEmailBody(initialTemplate.body.replace(/{{PROJECT_NAME}}/g, currentProject?.title || "Your Project"));
      }
      // Start on customize step when using a template
      setActiveStep("customize");
    } else if (currentProject) {
      setEmailTitle(`Special Early Access: ${currentProject.title}`);
      setEmailBody(`<p>Hi!</p>
<p>We're excited to launch our next project: <strong>${currentProject.title}</strong>.</p>
<p>As a fan of ours, we want to ask for your commitment to pledge on day ONE so that we can have the strongest launch possible.</p>
<p>Click here to see the project and back us today!</p>`);
    }
  }, [currentProject, initialTemplate]);

  // Sync with parent's selected project when dialog opens
  useEffect(() => {
    if (open && selectedProjectId) {
      setCurrentProjectId(selectedProjectId);
    }
  }, [open, selectedProjectId]);

  // Sync user email when prop changes
  useEffect(() => {
    if (userEmail) {
      setTestEmail(userEmail);
      setReplyToEmail(userEmail);
    }
  }, [userEmail]);

  const handleProjectChange = (projectId: string) => {
    setCurrentProjectId(projectId);
    onProjectChange?.(projectId);
  };

  const handleSendTestEmail = async () => {
    if (!testEmail || !testEmail.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }

    setIsSendingTest(true);
    try {
      const response = await apiFetch("/api/creator/email/send-test", {
        method: "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({
          to: testEmail,
          subject: emailTitle,
          htmlContent: emailBody,
          senderName: senderName || undefined,
          replyTo: replyToEmail || undefined,
          // Pass projectId so {{PROJECT_NAME}}, {{PROJECT_URL}},
          // {{PROJECT_LINK}}, and {{PRELAUNCH_URL}} resolve the same
          // way they will in the real batch send. FIRST_NAME / NAME
          // resolve from the creator's own profile since they're
          // sending the test to themselves.
          projectId: currentProjectId || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send test email");
      }

      toast.success(`Test email sent to ${testEmail}`);
    } catch (error) {
      console.error("Send test email error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to send test email");
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleSendCampaign = async () => {
    if (filteredCount === 0) {
      toast.error(
        selectedSources === null
          ? "No members in your email list. Import members first."
          : "No members match the current filter. Adjust the filter or send to everyone."
      );
      return;
    }

    if (!emailTitle.trim() || !emailBody.trim()) {
      toast.error("Please add a subject and email body");
      return;
    }

    setIsSendingCampaign(true);
    try {
      const response = await apiFetch("/api/creator/email/campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({
          subject: emailTitle,
          content: emailBody,
          projectId: currentProjectId,
          senderName: senderName || undefined,
          replyTo: replyToEmail || undefined,
          ...(selectedSources && { sources: selectedSources }),
          ...(scheduledDate && { scheduledFor: new Date(scheduledDate).toISOString() }),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send campaign");
      }

      toast.success(data.message || (scheduledDate
        ? `Campaign scheduled for ${new Date(scheduledDate).toLocaleString()}`
        : `Campaign sent to ${data.campaign?.recipientCount || memberCount} members`));
      setActiveStep("results");
    } catch (error) {
      console.error("Send campaign error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to send campaign");
    } finally {
      setIsSendingCampaign(false);
    }
  };

  const handleImportComplete = () => {
    onImportComplete?.();
    toast.success("Emails imported to your list");
  };

  const steps: { id: EditorStep; label: string }[] = [
    { id: "campaign", label: "Your Email Campaign" },
    { id: "customize", label: "Customize" },
    { id: "send", label: "Send" },
    { id: "results", label: "Results" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <VisuallyHidden>
          <DialogTitle>Email Campaign Composer</DialogTitle>
          <DialogDescription>Create and send email campaigns to your backers</DialogDescription>
        </VisuallyHidden>
        {/* Header */}
        <div className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back to Emails
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Actions
                    <MoreHorizontal className="h-4 w-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>Save Draft</DropdownMenuItem>
                  <DropdownMenuItem>Preview</DropdownMenuItem>
                  <DropdownMenuItem>Duplicate</DropdownMenuItem>
                  <DropdownMenuItem className="text-red-600">Delete</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="mt-2">
            <h2 className="text-lg font-semibold">{emailTitle}</h2>
            {currentProject && (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Badge variant="outline" className="text-teal-600">IC</Badge>
                {currentProject.title}
              </p>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Navigation */}
          <div className="w-[120px] sm:w-[200px] border-r bg-muted/30 p-4">
            <nav className="space-y-1">
              {steps.map((step) => (
                <button
                  key={step.id}
                  onClick={() => setActiveStep(step.id)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-md text-sm transition-colors",
                    activeStep === step.id
                      ? "bg-teal-100 text-teal-700 font-medium"
                      : "hover:bg-muted text-muted-foreground"
                  )}
                >
                  {step.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeStep === "campaign" && (
              <div className="space-y-6 max-w-2xl">
                {/* Connect with Project */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Connect with a Project</h3>
                  {currentProject ? (
                    <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <span>Connected to</span>
                      <Badge variant="outline" className="text-teal-600">IC</Badge>
                      <span className="font-medium">{currentProject.title}</span>
                    </div>
                  ) : (
                    <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                      <span className="text-yellow-700">No project selected</span>
                    </div>
                  )}
                  {projects.length > 1 && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Not this project? Select a different one:
                      </p>
                      <Select value={currentProjectId} onValueChange={handleProjectChange}>
                        <SelectTrigger className="w-full max-w-xs">
                          <SelectValue placeholder="Select a project" />
                        </SelectTrigger>
                        <SelectContent>
                          {projects.map((project) => (
                            <SelectItem key={project.id} value={project.id}>
                              {project.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <hr />

                {/* Email Preview */}
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    1. Your audience will receive an email.
                  </p>

                  {/* Email Preview Card with teal left border */}
                  <div className="border-l-4 border-teal-500 bg-white shadow-md rounded-r-lg p-6 max-w-[600px]">
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold">{emailTitle}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          From: {senderName || "Add Sender"}
                        </p>
                      </div>
                      <hr />
                      <div
                        className="text-sm text-muted-foreground prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(emailBody) }}
                      />
                    </div>
                  </div>

                  <Button
                    variant="link"
                    className="text-teal-600 p-0 h-auto"
                    onClick={() => setActiveStep("customize")}
                  >
                    Customize this email »
                  </Button>
                </div>

                <hr />

                {/* Unsubscribe Info Link */}
                <div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="link" className="text-teal-600 p-0 h-auto text-sm">
                        What happens to a member that unsubscribes?
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-96 text-sm space-y-3" align="start">
                      <p className="font-semibold">When a subscriber unsubscribes:</p>
                      <ul className="space-y-2 list-disc pl-4 text-muted-foreground">
                        <li>
                          They click the <span className="font-medium text-foreground">Unsubscribe</span> link at the
                          bottom of any campaign email — it&apos;s a one-click signed token, no login required.
                        </li>
                        <li>
                          Their record stays in your subscribers list with a{" "}
                          <span className="font-medium text-foreground">Unsubscribed</span> badge instead of being
                          deleted, so a future CSV re-import won&apos;t silently re-add them.
                        </li>
                        <li>
                          They&apos;re excluded from every future campaign send — the Send To count and Filter
                          Members popover only consider <span className="font-medium text-foreground">subscribed</span>{" "}
                          members.
                        </li>
                        <li>
                          Bounced emails work the same way (status flips to{" "}
                          <span className="font-medium text-foreground">Bounced</span>) so you don&apos;t keep
                          spending sender reputation on dead addresses.
                        </li>
                      </ul>
                      <p className="text-xs text-muted-foreground pt-1 border-t">
                        Unsubscribe is required by CAN-SPAM, GDPR, and most email providers — every campaign
                        IndieCrowdfund sends includes the link automatically.
                      </p>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}

            {activeStep === "customize" && (
              <div className="space-y-6 max-w-2xl">
                <h3 className="text-lg font-semibold">Customize Your Email</h3>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email-subject">Email Subject</Label>
                    <Input
                      id="email-subject"
                      value={emailTitle}
                      onChange={(e) => setEmailTitle(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sender-name">From Name</Label>
                    <Input
                      id="sender-name"
                      placeholder="Your Name or Company"
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email-body">Email Body</Label>
                    <EmailEditor
                      value={emailBody}
                      onChange={setEmailBody}
                      placeholder="Compose your email..."
                      minHeight="250px"
                      uploadUrl="/api/creator/media/upload"
                    />
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p className="font-medium">Personalization variables:</p>
                      <div className="flex flex-wrap gap-1">
                        {[
                          { label: "First Name", value: "{{FIRST_NAME}}" },
                          { label: "Project Name", value: "{{PROJECT_NAME}}" },
                          { label: "Creator Name", value: "{{CREATOR_NAME}}" },
                          { label: "Project URL", value: "{{PROJECT_URL}}" },
                          { label: "Project Link", value: "{{PROJECT_LINK}}" },
                          { label: "Prelaunch URL", value: "{{PRELAUNCH_URL}}" },
                        ].map((v) => (
                          <button
                            key={v.value}
                            type="button"
                            className="px-2 py-0.5 bg-muted rounded text-xs hover:bg-muted/80 font-mono"
                            onClick={() => setEmailBody((prev) => prev + v.value)}
                          >
                            {v.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setActiveStep("campaign")}
                  >
                    Preview
                  </Button>
                  <Button
                    className="bg-teal-600 hover:bg-teal-700"
                    onClick={() => setActiveStep("send")}
                  >
                    Continue to Send
                  </Button>
                </div>
              </div>
            )}

            {activeStep === "send" && (
              <div className="space-y-6 max-w-2xl">
                {/* Test Your Email Section */}
                <div className="space-y-4 p-6 border rounded-lg">
                  <h3 className="text-lg font-semibold">1. Test Your Email</h3>
                  <p className="text-sm text-muted-foreground">
                    Review the email and the page that the email links to for any errors before sending it out.
                  </p>
                  <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
                    <div className="flex-1">
                      <Label htmlFor="test-email" className="sr-only">Test email address</Label>
                      <Input
                        id="test-email"
                        type="email"
                        placeholder="Enter email address"
                        value={testEmail}
                        onChange={(e) => setTestEmail(e.target.value)}
                        className="max-w-xs"
                      />
                    </div>
                    <Button
                      variant="outline"
                      onClick={handleSendTestEmail}
                      disabled={isSendingTest || !testEmail}
                    >
                      {isSendingTest ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Mail className="h-4 w-4 mr-2" />
                          Send Test Email
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Send Your Emails Section */}
                <div className="space-y-4 p-6 border rounded-lg">
                  <h3 className="text-lg font-semibold">2. Send Your Emails</h3>

                  {/* FREE Banner */}
                  <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="text-sm font-medium">Email campaigns are FREE - no limits, no charges</span>
                  </div>

                  {/* Send To Count */}
                  <div className="space-y-2">
                    <Label>Send To</Label>
                    <div className="flex items-end gap-4">
                      <div>
                        <p className="text-4xl font-bold">{filteredCount.toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground">
                          {filteredCount === 0
                            ? "No members match the filter"
                            : selectedSources === null
                            ? "members in your email list"
                            : `members match the filter (of ${memberCount.toLocaleString()} total)`}
                        </p>
                      </div>
                      <Popover open={filterPopoverOpen} onOpenChange={setFilterPopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Filter className="h-4 w-4 mr-2" />
                            Filter Members
                            {selectedSources !== null && (
                              <Badge variant="secondary" className="ml-2 px-1.5 py-0 h-5 text-[10px]">
                                {selectedSources.length}
                              </Badge>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 p-0" align="end">
                          <div className="p-3 border-b">
                            <p className="text-sm font-semibold">Filter recipients</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Send only to subscribers from selected sources.
                            </p>
                          </div>
                          <div className="p-3 space-y-2">
                            {breakdownLoading && (
                              <div className="flex items-center justify-center py-4 text-xs text-muted-foreground">
                                <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                                Loading…
                              </div>
                            )}
                            {!breakdownLoading && sourceBreakdown.length === 0 && (
                              <p className="text-xs text-muted-foreground py-2">
                                No source breakdown available — your list may be empty or
                                only contain backers (added separately).
                              </p>
                            )}
                            {!breakdownLoading && sourceBreakdown.map((g) => {
                              const all = sourceBreakdown.flatMap((x) => x.sources);
                              const current = selectedSources ?? all;
                              const isOn = g.sources.every((s) => current.includes(s));
                              return (
                                <label
                                  key={g.label}
                                  className="flex items-center gap-2 cursor-pointer hover:bg-muted/40 rounded px-1.5 py-1.5"
                                >
                                  <Checkbox
                                    checked={isOn}
                                    onCheckedChange={() => toggleGroup(g.sources)}
                                  />
                                  <span className="text-sm flex-1">{g.label}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {g.count.toLocaleString()}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                          <div className="p-3 border-t flex items-center justify-between gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedSources(null)}
                              disabled={selectedSources === null}
                            >
                              Reset
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => setFilterPopoverOpen(false)}
                            >
                              Done
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  {/* Send Button */}
                  <Button
                    className="bg-teal-600 hover:bg-teal-700"
                    disabled={memberCount === 0 || isSendingCampaign}
                    onClick={handleSendCampaign}
                  >
                    {isSendingCampaign ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {scheduledDate ? "Scheduling..." : "Sending Campaign..."}
                      </>
                    ) : (
                      <>
                        {scheduledDate ? (
                          <>
                            <Calendar className="h-4 w-4 mr-2" />
                            Schedule Email Campaign
                          </>
                        ) : (
                          <>
                            <Send className="h-4 w-4 mr-2" />
                            Send Email Campaign
                          </>
                        )}
                      </>
                    )}
                  </Button>

                  {/* Schedule */}
                  <div className="space-y-2 pt-4 border-t">
                    <Label>Scheduled Send Date - Pacific Time</Label>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <Input
                        type="datetime-local"
                        className="w-auto"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Reply Email Section */}
                  <div className="space-y-2 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      Replies by members to this campaign will be sent to your support email:
                    </p>
                    <div className="flex items-center gap-2">
                      {isEditingReplyTo ? (
                        <>
                          <Input
                            type="email"
                            value={replyToEmail}
                            onChange={(e) => setReplyToEmail(e.target.value)}
                            className="max-w-xs"
                            autoFocus
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsEditingReplyTo(false)}
                          >
                            Save
                          </Button>
                        </>
                      ) : (
                        <>
                          <span className="text-sm font-medium font-mono">
                            {replyToEmail || "Not set"}
                          </span>
                          <Button
                            variant="link"
                            className="text-teal-600 p-0 h-auto text-sm"
                            onClick={() => setIsEditingReplyTo(true)}
                          >
                            Edit »
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Import Email List Section */}
                  <div className="space-y-2 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      Do you have an email list that you would like to add to this campaign?
                    </p>
                    <Button variant="outline" onClick={() => setIsImportDialogOpen(true)}>
                      <Upload className="h-4 w-4 mr-2" />
                      Import Email List
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {activeStep === "results" && (
              <div className="space-y-6 max-w-2xl">
                <h3 className="text-lg font-semibold">Campaign Results</h3>
                <div className="text-center py-12 text-muted-foreground">
                  <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No results yet. Send your campaign to see results here.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>

      {/* Import Email Dialog */}
      <ImportEmailDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        projectId={currentProjectId}
        onImport={handleImportComplete}
      />
    </Dialog>
  );
}
