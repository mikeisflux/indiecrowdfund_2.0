"use client";

import { getCSRFHeaders } from "@/lib/csrf";
import { useState, useEffect, useCallback } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
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
  Mail,
  Inbox,
  Send,
  Star,
  Archive,
  Search,
  Filter,
  RefreshCw,
  Loader2,
  ChevronLeft,
  Clock,
  Tag,
  AtSign,
  CheckCircle,
  Copy,
  Plus,
  Reply,
  ReplyAll,
  Forward,
  Trash2,
  MoreHorizontal,
  Paperclip,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface EmailThread {
  id: string;
  subject: string;
  preview: string;
  from: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
  projectTitle: string | null;
  projectSlug: string | null;
  status: "unread" | "read" | "replied" | "archived";
  starred: boolean;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

interface EmailMessage {
  id: string;
  threadId: string;
  content: string;
  sender: {
    id: string;
    name: string;
    email: string;
    image: string | null;
    isCreator: boolean;
  };
  createdAt: string;
}

type FilterType = "all" | "unread" | "starred" | "archived";

interface EmailSetupState {
  hasEmailSetup: boolean;
  emailHandle: string | null;
  fullEmail: string | null;
  isCreator: boolean;
  suggestedHandle: string;
}

interface InboxTabProps {
  projectId?: string;
}

export function InboxTab({ projectId }: InboxTabProps) {
  const [threads, setThreads] = useState<EmailThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<EmailThread | null>(null);
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [replyContent, setReplyContent] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Compose dialog state
  const [showComposeDialog, setShowComposeDialog] = useState(false);
  const [composeMode, setComposeMode] = useState<"new" | "reply" | "replyAll" | "forward">("new");
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeContent, setComposeContent] = useState("");
  const [isComposing, setIsComposing] = useState(false);
  const [composeAttachments, setComposeAttachments] = useState<File[]>([]);
  const [replyAttachments, setReplyAttachments] = useState<File[]>([]);

  // Project state for email association
  const [projects, setProjects] = useState<{ id: string; title: string }[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projectId || "");

  // Email setup state
  const [emailSetup, setEmailSetup] = useState<EmailSetupState | null>(null);
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [emailHandle, setEmailHandle] = useState("");
  const [settingUpEmail, setSettingUpEmail] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; threadId: string }>({
    open: false,
    threadId: "",
  });
  const [isDeleting, setIsDeleting] = useState(false);

  // Check email setup on mount
  useEffect(() => {
    const checkEmailSetup = async () => {
      try {
        const res = await fetch("/api/creator/email/setup");
        if (res.ok) {
          const data = await res.json();
          setEmailSetup(data);
          if (data.suggestedHandle) {
            setEmailHandle(data.suggestedHandle);
          }
          if (!data.hasEmailSetup) {
            setShowSetupDialog(true);
          }
        }
      } catch (error) {
        console.error("Error checking email setup:", error);
      } finally {
        setCheckingSetup(false);
      }
    };
    checkEmailSetup();
  }, []);

  // Fetch user's projects for email association
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await fetch("/api/creator/indiekit");
        if (res.ok) {
          const data = await res.json();
          if (data.projects?.length > 0) {
            setProjects(data.projects);
            // Auto-select the passed project or the first project
            if (projectId) {
              setSelectedProjectId(projectId);
            } else {
              const activeProject = data.projects.find((p: { prelaunchActive?: boolean }) => p.prelaunchActive) || data.projects[0];
              setSelectedProjectId(activeProject.id);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching projects:", error);
      }
    };
    fetchProjects();
  }, [projectId]);

  // Handle email setup submission
  const handleSetupEmail = async () => {
    if (!emailHandle.trim()) {
      toast.error("Please enter an email handle");
      return;
    }

    setSettingUpEmail(true);
    try {
      const res = await fetch("/api/creator/email/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({ handle: emailHandle }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to set up email");
        return;
      }

      setEmailSetup((prev) => prev ? {
        ...prev,
        hasEmailSetup: true,
        emailHandle: data.emailHandle,
        fullEmail: data.fullEmail,
      } : null);
      setSetupComplete(true);
      toast.success("Email address created successfully!");

      // Close dialog after a short delay to show success
      setTimeout(() => {
        setShowSetupDialog(false);
        setSetupComplete(false);
      }, 2000);
    } catch (error) {
      console.error("Error setting up email:", error);
      toast.error("Failed to set up email");
    } finally {
      setSettingUpEmail(false);
    }
  };

  const copyEmailToClipboard = () => {
    if (emailSetup?.fullEmail) {
      navigator.clipboard.writeText(emailSetup.fullEmail);
      toast.success("Email address copied!");
    }
  };

  // Fetch email threads
  const fetchThreads = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter !== "all") params.set("filter", filter);
      if (searchQuery) params.set("search", searchQuery);

      const res = await fetch(`/api/creator/email/threads?${params}`);
      if (!res.ok) throw new Error("Failed to fetch threads");

      const data = await res.json();
      setThreads(data.threads || []);
    } catch (error) {
      console.error("Error fetching threads:", error);
      toast.error("Failed to load inbox");
    } finally {
      setLoading(false);
    }
  }, [filter, searchQuery]);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  // Fetch messages for selected thread
  const fetchMessages = useCallback(async (threadId: string) => {
    try {
      setLoadingMessages(true);
      const res = await fetch(`/api/creator/email/threads/${threadId}/messages`);
      if (!res.ok) throw new Error("Failed to fetch messages");

      const data = await res.json();
      setMessages(data.messages || []);

      // Mark as read
      if (selectedThread?.status === "unread") {
        await fetch(`/api/creator/email/threads/${threadId}/read`, {
          method: "POST",
          headers: getCSRFHeaders(),
        });
        setThreads((prev) =>
          prev.map((t) =>
            t.id === threadId ? { ...t, status: "read" as const } : t
          )
        );
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
      toast.error("Failed to load messages");
    } finally {
      setLoadingMessages(false);
    }
  }, [selectedThread?.status]);

  useEffect(() => {
    if (selectedThread) {
      fetchMessages(selectedThread.id);
    }
  }, [selectedThread, fetchMessages]);

  // Send reply
  const handleSendReply = async () => {
    if (!replyContent.trim() || !selectedThread) return;

    setIsSending(true);
    try {
      const attachments = replyAttachments.length > 0 ? await filesToAttachments(replyAttachments) : undefined;

      const res = await fetch(`/api/creator/email/threads/${selectedThread.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({ content: replyContent, attachments }),
      });

      if (!res.ok) throw new Error("Failed to send reply");

      const data = await res.json();
      setMessages((prev) => [...prev, data.message]);
      setReplyContent("");
      setReplyAttachments([]);
      setThreads((prev) =>
        prev.map((t) =>
          t.id === selectedThread.id ? { ...t, status: "replied" as const } : t
        )
      );
      toast.success("Reply sent!");
    } catch (error) {
      console.error("Error sending reply:", error);
      toast.error("Failed to send reply");
    } finally {
      setIsSending(false);
    }
  };

  // Toggle star
  const toggleStar = async (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/creator/email/threads/${threadId}/star`, {
        method: "POST",
        headers: getCSRFHeaders(),
      });
      setThreads((prev) =>
        prev.map((t) =>
          t.id === threadId ? { ...t, starred: !t.starred } : t
        )
      );
    } catch (error) {
      console.error("Error toggling star:", error);
    }
  };

  // Archive thread
  const archiveThread = async (threadId: string) => {
    try {
      await fetch(`/api/creator/email/threads/${threadId}/archive`, {
        method: "POST",
        headers: getCSRFHeaders(),
      });
      setThreads((prev) =>
        prev.map((t) =>
          t.id === threadId ? { ...t, status: "archived" as const } : t
        )
      );
      if (selectedThread?.id === threadId) {
        setSelectedThread(null);
        setMessages([]);
      }
      toast.success("Thread archived");
    } catch (error) {
      console.error("Error archiving thread:", error);
    }
  };

  // Delete thread
  const deleteThread = async () => {
    const threadId = deleteConfirm.threadId;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/creator/email/threads/${threadId}/delete`, {
        method: "DELETE",
        headers: getCSRFHeaders(),
      });
      if (!res.ok) throw new Error("Failed to delete");
      setThreads((prev) => prev.filter((t) => t.id !== threadId));
      if (selectedThread?.id === threadId) {
        setSelectedThread(null);
        setMessages([]);
      }
      toast.success("Conversation deleted");
    } catch (error) {
      console.error("Error deleting thread:", error);
      toast.error("Failed to delete conversation");
    } finally {
      setIsDeleting(false);
    }
  };

  // Open compose dialog for new email
  const openComposeNew = () => {
    setComposeMode("new");
    setComposeTo("");
    setComposeSubject("");
    setComposeContent("");
    setComposeAttachments([]);
    setShowComposeDialog(true);
  };

  // Open compose dialog for reply
  const openComposeReply = () => {
    if (!selectedThread) return;
    setComposeMode("reply");
    setComposeTo(selectedThread.from.email);
    setComposeSubject(`Re: ${selectedThread.subject}`);
    setComposeContent("");
    setComposeAttachments([]);
    setShowComposeDialog(true);
  };

  // Open compose dialog for reply all (same as reply for now since it's 1-to-1)
  const openComposeReplyAll = () => {
    if (!selectedThread) return;
    setComposeMode("replyAll");
    setComposeTo(selectedThread.from.email);
    setComposeSubject(`Re: ${selectedThread.subject}`);
    setComposeContent("");
    setComposeAttachments([]);
    setShowComposeDialog(true);
  };

  // Open compose dialog for forward
  const openComposeForward = () => {
    if (!selectedThread) return;
    setComposeMode("forward");
    setComposeTo("");
    setComposeSubject(`Fwd: ${selectedThread.subject}`);
    setComposeAttachments([]);
    // Build forwarded content from messages
    const forwardedContent = messages
      .map((msg) => {
        const date = format(new Date(msg.createdAt), "MMM d, yyyy 'at' h:mm a");
        return `--- From ${msg.sender.name} on ${date} ---\n${msg.content}`;
      })
      .join("\n\n");
    setComposeContent(`\n\n---------- Forwarded message ----------\n${forwardedContent}`);
    setShowComposeDialog(true);
  };

  // Convert files to base64 for API submission
  const filesToAttachments = async (files: File[]) => {
    return Promise.all(
      files.map(
        (file) =>
          new Promise<{ filename: string; data: string; contentType: string }>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
              const dataUrl = reader.result as string;
              const base64 = dataUrl.split(",")[1] || "";
              resolve({ filename: file.name, data: base64, contentType: file.type });
            };
            reader.readAsDataURL(file);
          })
      )
    );
  };

  const handleComposeFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const maxSize = 10 * 1024 * 1024; // 10MB per file
    const validFiles = files.filter((f) => {
      if (f.size > maxSize) {
        toast.error(`${f.name} exceeds 10MB limit`);
        return false;
      }
      return true;
    });
    setComposeAttachments((prev) => [...prev, ...validFiles]);
    e.target.value = "";
  };

  const handleReplyFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const maxSize = 10 * 1024 * 1024;
    const validFiles = files.filter((f) => {
      if (f.size > maxSize) {
        toast.error(`${f.name} exceeds 10MB limit`);
        return false;
      }
      return true;
    });
    setReplyAttachments((prev) => [...prev, ...validFiles]);
    e.target.value = "";
  };

  // Send composed email
  const handleSendComposed = async () => {
    // Require project for new emails
    if (composeMode === "new" && !selectedProjectId) {
      toast.error("Please select a project. You must have an active project or prelaunch page to send emails.");
      return;
    }
    if (!composeTo.trim()) {
      toast.error("Please enter a recipient email");
      return;
    }
    if (!composeContent.trim()) {
      toast.error("Please enter a message");
      return;
    }

    setIsComposing(true);
    try {
      const attachments = composeAttachments.length > 0 ? await filesToAttachments(composeAttachments) : undefined;

      let res;
      if (composeMode === "forward" && selectedThread) {
        // Use forward endpoint
        res = await fetch(`/api/creator/email/threads/${selectedThread.id}/forward`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
          body: JSON.stringify({
            to: composeTo,
            additionalMessage: composeContent.split("---------- Forwarded message ----------")[0].trim(),
            attachments,
          }),
        });
      } else if ((composeMode === "reply" || composeMode === "replyAll") && selectedThread) {
        // Use reply endpoint
        res = await fetch(`/api/creator/email/threads/${selectedThread.id}/reply`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
          body: JSON.stringify({ content: composeContent, attachments }),
        });
      } else {
        // Use compose endpoint for new emails
        res = await fetch("/api/creator/email/compose", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
          body: JSON.stringify({
            to: composeTo,
            subject: composeSubject,
            content: composeContent,
            projectId: selectedProjectId || undefined,
            attachments,
          }),
        });
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send email");
      }

      // If it was a reply, add the message to the current view
      if ((composeMode === "reply" || composeMode === "replyAll") && selectedThread) {
        const data = await res.json();
        if (data.message) {
          setMessages((prev) => [...prev, data.message]);
          setThreads((prev) =>
            prev.map((t) =>
              t.id === selectedThread.id ? { ...t, status: "replied" as const } : t
            )
          );
        }
      }

      toast.success(
        composeMode === "new" ? "Email sent!" :
        composeMode === "forward" ? "Email forwarded!" :
        "Reply sent!"
      );
      setShowComposeDialog(false);
      setComposeTo("");
      setComposeSubject("");
      setComposeContent("");
      setComposeAttachments([]);
    } catch (error) {
      console.error("Error sending email:", error);
      toast.error(error instanceof Error ? error.message : "Failed to send email");
    } finally {
      setIsComposing(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const unreadCount = threads.filter((t) => t.status === "unread").length;

  // Show loading state while checking setup
  if (checkingSetup) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Email Setup Dialog */}
      <Dialog open={showSetupDialog} onOpenChange={(open) => {
        // Prevent closing if email not set up yet
        if (!emailSetup?.hasEmailSetup && !open) return;
        setShowSetupDialog(open);
      }}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => {
          if (!emailSetup?.hasEmailSetup) e.preventDefault();
        }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AtSign className="h-5 w-5 text-primary" />
              {setupComplete ? "Email Address Created!" : "Set Up Your Creator Email"}
            </DialogTitle>
            <DialogDescription>
              {setupComplete
                ? "Your personalized email address is ready to use."
                : "Create your own @indiecrowdfund.com email address to receive messages from backers."}
            </DialogDescription>
          </DialogHeader>

          {setupComplete ? (
            <div className="py-6">
              <div className="flex items-center justify-center gap-3 p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-900">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div>
                  <p className="font-medium text-green-800 dark:text-green-200">
                    {emailSetup?.fullEmail}
                  </p>
                  <p className="text-sm text-green-600 dark:text-green-400">
                    Ready to receive emails!
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="emailHandle">Your Email Handle</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="emailHandle"
                      value={emailHandle}
                      onChange={(e) => setEmailHandle(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""))}
                      placeholder="yourname"
                      className="flex-1"
                    />
                    <span className="text-muted-foreground whitespace-nowrap">@indiecrowdfund.com</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Use letters, numbers, dots, hyphens, or underscores. 3-30 characters.
                  </p>
                </div>

                {emailHandle && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Your email will be:</p>
                    <p className="font-medium">{emailHandle}@indiecrowdfund.com</p>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  onClick={handleSetupEmail}
                  disabled={settingUpEmail || !emailHandle.trim()}
                  className="w-full sm:w-auto"
                >
                  {settingUpEmail && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Email Address
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Inbox className="h-5 w-5" />
            Inbox
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-1">
                {unreadCount}
              </Badge>
            )}
          </h3>
          <p className="text-sm text-muted-foreground">Messages from backers and fans</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={openComposeNew} size="sm" className="bg-teal-600 hover:bg-teal-700">
            <Plus className="h-4 w-4 mr-2" />
            Compose
          </Button>
          {emailSetup?.fullEmail && (
            <Button
              variant="outline"
              size="sm"
              onClick={copyEmailToClipboard}
              className="hidden sm:flex items-center gap-2"
            >
              <AtSign className="h-4 w-4" />
              {emailSetup.fullEmail}
              <Copy className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Email Interface */}
      <div className="grid lg:grid-cols-3 gap-6 h-[600px] lg:h-[calc(100vh-320px)] min-h-[500px] max-h-[800px]">
        {/* Thread List */}
        <Card className="lg:col-span-1 flex flex-col">
          <CardHeader className="pb-3 flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Mail className="h-4 w-4" />
                Messages
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={fetchThreads}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            {/* Search and Filter */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search messages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filter} onValueChange={(v: FilterType) => setFilter(v)}>
                <SelectTrigger>
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Messages</SelectItem>
                  <SelectItem value="unread">Unread</SelectItem>
                  <SelectItem value="starred">Starred</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>

          <CardContent className="flex-1 overflow-hidden p-0">
            <ScrollArea className="h-full">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : threads.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                  <Inbox className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-medium">No messages yet</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Messages from backers will appear here
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {threads.map((thread) => (
                    <div
                      key={thread.id}
                      onClick={() => setSelectedThread(thread)}
                      className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                        selectedThread?.id === thread.id ? "bg-muted" : ""
                      } ${thread.status === "unread" ? "bg-blue-50/50 dark:bg-blue-950/20" : ""}`}
                    >
                      <div className="flex items-start gap-3">
                        <Avatar className="h-10 w-10 flex-shrink-0">
                          <AvatarImage src={thread.from.image || undefined} />
                          <AvatarFallback>{getInitials(thread.from.name)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className={`font-medium truncate ${thread.status === "unread" ? "text-foreground" : "text-muted-foreground"}`}>
                              {thread.from.name}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => toggleStar(thread.id, e)}
                                className="p-1 hover:bg-muted rounded"
                              >
                                <Star className={`h-4 w-4 ${thread.starred ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
                              </button>
                            </div>
                          </div>
                          <p className={`text-sm truncate ${thread.status === "unread" ? "font-medium" : ""}`}>
                            {thread.subject}
                          </p>
                          <p className="text-xs text-muted-foreground truncate mt-1">
                            {thread.preview}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            {thread.projectTitle && (
                              <Badge variant="outline" className="text-xs">
                                <Tag className="h-3 w-3 mr-1" />
                                {thread.projectTitle}
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDistanceToNow(new Date(thread.updatedAt), { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Message View */}
        <Card className="lg:col-span-2 flex flex-col">
          {selectedThread ? (
            <>
              <CardHeader className="flex-shrink-0 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="lg:hidden"
                      onClick={() => setSelectedThread(null)}
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <div>
                      <CardTitle className="text-lg">{selectedThread.subject}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {selectedThread.messageCount} message{selectedThread.messageCount !== 1 ? "s" : ""} •
                        From {selectedThread.from.name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={openComposeReply}
                      title="Reply"
                    >
                      <Reply className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={openComposeReplyAll}
                      title="Reply All"
                    >
                      <ReplyAll className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={openComposeForward}
                      title="Forward"
                    >
                      <Forward className="h-4 w-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => archiveThread(selectedThread.id)}>
                          <Archive className="h-4 w-4 mr-2" />
                          Archive
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setDeleteConfirm({ open: true, threadId: selectedThread.id })}
                          className="text-red-600 focus:text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="flex-1 overflow-hidden p-0 flex flex-col">
                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  {loadingMessages ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {messages.map((message) => (
                        <div key={message.id} className="flex gap-3">
                          <Avatar className="h-10 w-10 flex-shrink-0">
                            <AvatarImage src={message.sender.image || undefined} />
                            <AvatarFallback>{getInitials(message.sender.name)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">{message.sender.name}</span>
                              {message.sender.isCreator && (
                                <Badge variant="secondary" className="text-xs">You</Badge>
                              )}
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(message.createdAt), "MMM d, yyyy 'at' h:mm a")}
                              </span>
                            </div>
                            <div className="prose prose-sm dark:prose-invert max-w-none">
                              <p className="whitespace-pre-wrap">{message.content}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>

                {/* Reply Box */}
                <div className="border-t p-4 flex-shrink-0">
                  <div className="flex gap-3">
                    <Textarea
                      placeholder="Type your reply..."
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      className="min-h-[100px]"
                    />
                  </div>
                  {replyAttachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {replyAttachments.map((file, i) => (
                        <div key={i} className="flex items-center gap-1 bg-muted rounded px-2 py-1 text-xs">
                          <Paperclip className="h-3 w-3" />
                          <span className="max-w-[150px] truncate">{file.name}</span>
                          <span className="text-muted-foreground">({(file.size / 1024).toFixed(0)}KB)</span>
                          <button onClick={() => setReplyAttachments((prev) => prev.filter((_, idx) => idx !== i))} className="ml-1 hover:text-destructive">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex justify-between mt-3">
                    <label className="cursor-pointer">
                      <input type="file" multiple className="hidden" onChange={handleReplyFileSelect} />
                      <Button type="button" variant="ghost" size="sm" asChild>
                        <span><Paperclip className="h-4 w-4 mr-1" />Attach</span>
                      </Button>
                    </label>
                    <Button onClick={handleSendReply} disabled={isSending || !replyContent.trim()} className="bg-teal-600 hover:bg-teal-700">
                      {isSending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      Send Reply
                    </Button>
                  </div>
                </div>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex-1 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <Mail className="h-16 w-16 mx-auto mb-4 opacity-20" />
                <h3 className="text-lg font-medium">Select a conversation</h3>
                <p className="text-sm mt-1">Choose a thread from the left to read messages</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>

      {/* Compose Email Dialog */}
      <Dialog open={showComposeDialog} onOpenChange={setShowComposeDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {composeMode === "new" && <Mail className="h-5 w-5 text-teal-600" />}
              {composeMode === "reply" && <Reply className="h-5 w-5 text-teal-600" />}
              {composeMode === "replyAll" && <ReplyAll className="h-5 w-5 text-teal-600" />}
              {composeMode === "forward" && <Forward className="h-5 w-5 text-teal-600" />}
              {composeMode === "new" ? "Compose Email" :
               composeMode === "reply" ? "Reply" :
               composeMode === "replyAll" ? "Reply All" :
               "Forward Email"}
            </DialogTitle>
            <DialogDescription>
              {composeMode === "new" ? "Send a new email to any platform user" :
               composeMode === "forward" ? "Forward this conversation to someone else" :
               "Send your reply"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Project selector for new emails */}
            {composeMode === "new" && (
              <div className="space-y-2">
                <Label htmlFor="compose-project">Project</Label>
                {projects.length > 0 ? (
                  <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                    <SelectTrigger id="compose-project">
                      <SelectValue placeholder="Select a project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    You need an active project or prelaunch page to send emails.
                  </p>
                )}
              </div>
            )}

            {/* To */}
            <div className="space-y-2">
              <Label htmlFor="compose-to">To</Label>
              <Input
                id="compose-to"
                type="email"
                placeholder="recipient@example.com"
                value={composeTo}
                onChange={(e) => setComposeTo(e.target.value)}
                disabled={composeMode === "reply" || composeMode === "replyAll"}
              />
            </div>

            {/* Subject - only for new and forward */}
            {(composeMode === "new" || composeMode === "forward") && (
              <div className="space-y-2">
                <Label htmlFor="compose-subject">Subject</Label>
                <Input
                  id="compose-subject"
                  placeholder="Email subject..."
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                />
              </div>
            )}

            {/* Message */}
            <div className="space-y-2">
              <Label htmlFor="compose-content">Message</Label>
              <Textarea
                id="compose-content"
                placeholder="Write your message..."
                value={composeContent}
                onChange={(e) => setComposeContent(e.target.value)}
                rows={10}
                className="font-mono text-sm"
              />
            </div>

            {/* Attachments */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Attachments</Label>
                <label className="cursor-pointer">
                  <input type="file" multiple className="hidden" onChange={handleComposeFileSelect} />
                  <Button type="button" variant="outline" size="sm" asChild>
                    <span><Paperclip className="h-4 w-4 mr-1" />Add Files</span>
                  </Button>
                </label>
              </div>
              {composeAttachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {composeAttachments.map((file, i) => (
                    <div key={i} className="flex items-center gap-1 bg-muted rounded px-2 py-1 text-xs">
                      <Paperclip className="h-3 w-3" />
                      <span className="max-w-[200px] truncate">{file.name}</span>
                      <span className="text-muted-foreground">({(file.size / 1024).toFixed(0)}KB)</span>
                      <button onClick={() => setComposeAttachments((prev) => prev.filter((_, idx) => idx !== i))} className="ml-1 hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowComposeDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSendComposed}
              disabled={isComposing || (composeMode === "new" && !selectedProjectId)}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {isComposing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              {composeMode === "forward" ? "Forward" : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => setDeleteConfirm({ ...deleteConfirm, open })}
        title="Delete Conversation?"
        description="Are you sure you want to delete this conversation? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
        onConfirm={deleteThread}
        loading={isDeleting}
      />
    </div>
  );
}
