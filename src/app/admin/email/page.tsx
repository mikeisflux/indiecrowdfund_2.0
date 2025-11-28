"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Mail,
  Send,
  Settings,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Inbox,
  SendHorizontal,
  FileText,
  Trash2,
  Archive,
  Star,
  MoreVertical,
  Plus,
  Pencil,
  Search,
  RefreshCw,
  X,
  AlertCircle,
  Reply,
  Forward,
  ReplyAll,
} from "lucide-react";

interface Mailbox {
  id: string;
  name: string;
  email: string;
  description?: string;
  color?: string;
  isDefault: boolean;
  isActive: boolean;
  unreadCount: number;
  totalEmails: number;
  folders?: Record<string, number>;
}

interface Email {
  id: string;
  fromEmail: string;
  fromName?: string;
  toEmail: string;
  toName?: string;
  subject: string;
  bodyHtml?: string;
  bodyText?: string;
  folder: string;
  status: string;
  isRead: boolean;
  isStarred: boolean;
  sentAt?: string;
  receivedAt?: string;
  createdAt: string;
}

interface EmailSettings {
  provider: string;
  sendgridApiKey: string;
  smtpFromEmail: string;
  smtpFromName: string;
}

const FOLDER_ICONS: Record<string, typeof Inbox> = {
  INBOX: Inbox,
  SENT: SendHorizontal,
  DRAFTS: FileText,
  TRASH: Trash2,
  ARCHIVE: Archive,
};

const FOLDER_LABELS: Record<string, string> = {
  INBOX: "Inbox",
  SENT: "Sent",
  DRAFTS: "Drafts",
  TRASH: "Trash",
  ARCHIVE: "Archive",
};

export default function EmailPage() {
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [selectedMailbox, setSelectedMailbox] = useState<Mailbox | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string>("INBOX");
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [settings, setSettings] = useState<EmailSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingEmails, setIsLoadingEmails] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Dialog states
  const [isComposing, setIsComposing] = useState(false);
  const [isEditingMailbox, setIsEditingMailbox] = useState(false);
  const [editingMailbox, setEditingMailbox] = useState<Mailbox | null>(null);
  const [composeMode, setComposeMode] = useState<"new" | "reply" | "replyAll" | "forward">("new");
  const [composePrefill, setComposePrefill] = useState<{
    to?: string;
    subject?: string;
    body?: string;
    inReplyTo?: string;
  } | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/settings");
      if (response.ok) {
        const data = await response.json();
        setSettings({
          provider: data.settings.emailProvider || "sendgrid",
          sendgridApiKey: data.settings.sendgridApiKey || "",
          smtpFromEmail: data.settings.smtpFromEmail || "",
          smtpFromName: data.settings.smtpFromName || "",
        });
        const hasApiKey = data.settings.sendgridApiKey === "••••••••" ||
          (data.settings.sendgridApiKey && data.settings.sendgridApiKey.length > 10);
        const hasSmtpConfig = data.settings.emailProvider === "smtp" &&
          data.settings.smtpHost && data.settings.smtpUser;
        setIsConfigured(hasApiKey || hasSmtpConfig);
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    }
  }, []);

  const fetchMailboxes = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/mailboxes");
      if (response.ok) {
        const data = await response.json();
        setMailboxes(data.mailboxes || []);
        // Auto-select first mailbox or default
        if (data.mailboxes?.length > 0 && !selectedMailbox) {
          const defaultMailbox = data.mailboxes.find((m: Mailbox) => m.isDefault) || data.mailboxes[0];
          setSelectedMailbox(defaultMailbox);
        }
      }
    } catch (error) {
      console.error("Error fetching mailboxes:", error);
    }
  }, [selectedMailbox]);

  const fetchEmails = useCallback(async () => {
    if (!selectedMailbox) return;

    setIsLoadingEmails(true);
    try {
      const params = new URLSearchParams({
        folder: selectedFolder,
        ...(searchQuery && { search: searchQuery }),
      });
      const response = await fetch(`/api/admin/mailboxes/${selectedMailbox.id}/emails?${params}`);
      if (response.ok) {
        const data = await response.json();
        setEmails(data.emails || []);
      }
    } catch (error) {
      console.error("Error fetching emails:", error);
    } finally {
      setIsLoadingEmails(false);
    }
  }, [selectedMailbox, selectedFolder, searchQuery]);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await Promise.all([fetchSettings(), fetchMailboxes()]);
      setIsLoading(false);
    };
    init();
  }, [fetchSettings, fetchMailboxes]);

  useEffect(() => {
    if (selectedMailbox) {
      fetchEmails();
    }
  }, [selectedMailbox, selectedFolder, fetchEmails]);

  const handleCreateMailbox = () => {
    setEditingMailbox(null);
    setIsEditingMailbox(true);
  };

  const handleEditMailbox = (mailbox: Mailbox) => {
    setEditingMailbox(mailbox);
    setIsEditingMailbox(true);
  };

  const handleDeleteMailbox = async (mailbox: Mailbox) => {
    if (!confirm(`Are you sure you want to delete "${mailbox.name}"? This will delete all emails in this mailbox.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/mailboxes/${mailbox.id}?force=true`, {
        method: "DELETE",
      });
      if (response.ok) {
        await fetchMailboxes();
        if (selectedMailbox?.id === mailbox.id) {
          setSelectedMailbox(mailboxes.find(m => m.id !== mailbox.id) || null);
        }
      }
    } catch (error) {
      console.error("Error deleting mailbox:", error);
    }
  };

  const handleToggleStar = async (email: Email) => {
    if (!selectedMailbox) return;

    try {
      await fetch(`/api/admin/mailboxes/${selectedMailbox.id}/emails/${email.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isStarred: !email.isStarred }),
      });
      setEmails(emails.map(e => e.id === email.id ? { ...e, isStarred: !e.isStarred } : e));
    } catch (error) {
      console.error("Error toggling star:", error);
    }
  };

  const handleDeleteEmail = async (email: Email) => {
    if (!selectedMailbox) return;

    try {
      await fetch(`/api/admin/mailboxes/${selectedMailbox.id}/emails/${email.id}`, {
        method: "DELETE",
      });
      setEmails(emails.filter(e => e.id !== email.id));
      if (selectedEmail?.id === email.id) {
        setSelectedEmail(null);
      }
    } catch (error) {
      console.error("Error deleting email:", error);
    }
  };

  const handleSelectEmail = async (email: Email) => {
    if (!selectedMailbox) return;

    // Fetch full email details including body
    try {
      const response = await fetch(`/api/admin/mailboxes/${selectedMailbox.id}/emails/${email.id}`);
      if (response.ok) {
        const data = await response.json();
        console.log("Fetched email data:", data.email);
        console.log("bodyHtml length:", data.email?.bodyHtml?.length || 0);
        console.log("bodyText length:", data.email?.bodyText?.length || 0);
        setSelectedEmail(data.email);
        // Update read status in list
        setEmails(emails.map(e => e.id === email.id ? { ...e, isRead: true } : e));
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error("Error fetching email - status:", response.status, errorData);
        // Fallback to list data if fetch fails
        setSelectedEmail(email);
      }
    } catch (error) {
      console.error("Error fetching email:", error);
      setSelectedEmail(email);
    }
  };

  const handleReply = (email: Email, replyAll: boolean = false) => {
    const replySubject = email.subject.toLowerCase().startsWith("re:")
      ? email.subject
      : `Re: ${email.subject}`;

    const quotedBody = `\n\n---\nOn ${new Date(email.sentAt || email.createdAt).toLocaleString()}, ${email.fromName || email.fromEmail} wrote:\n\n${email.bodyText || ""}`;

    setComposeMode(replyAll ? "replyAll" : "reply");
    setComposePrefill({
      to: email.fromEmail,
      subject: replySubject,
      body: quotedBody,
      inReplyTo: email.id,
    });
    setIsComposing(true);
  };

  const handleForward = (email: Email) => {
    const fwdSubject = email.subject.toLowerCase().startsWith("fwd:")
      ? email.subject
      : `Fwd: ${email.subject}`;

    const forwardBody = `\n\n---\nForwarded message:\nFrom: ${email.fromName || email.fromEmail}\nDate: ${new Date(email.sentAt || email.createdAt).toLocaleString()}\nSubject: ${email.subject}\n\n${email.bodyText || ""}`;

    setComposeMode("forward");
    setComposePrefill({
      to: "",
      subject: fwdSubject,
      body: forwardBody,
    });
    setIsComposing(true);
  };

  const handleDeleteSelectedEmail = async () => {
    if (!selectedMailbox || !selectedEmail) return;

    if (!confirm("Are you sure you want to delete this email?")) return;

    try {
      const response = await fetch(
        `/api/admin/mailboxes/${selectedMailbox.id}/emails/${selectedEmail.id}`,
        { method: "DELETE" }
      );
      if (response.ok) {
        setEmails(emails.filter(e => e.id !== selectedEmail.id));
        setSelectedEmail(null);
      }
    } catch (error) {
      console.error("Error deleting email:", error);
    }
  };

  const handleNewCompose = () => {
    setComposeMode("new");
    setComposePrefill(null);
    setIsComposing(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto mb-4" />
          <p className="text-zinc-500">Loading email settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Email Center</h1>
          <p className="text-zinc-500">Manage mailboxes and send emails</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" asChild>
            <a href="/admin/settings">
              <Settings className="mr-2 h-4 w-4" />
              Email Settings
            </a>
          </Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={handleNewCompose}
            disabled={!isConfigured || mailboxes.length === 0}
          >
            <Send className="mr-2 h-4 w-4" />
            Compose
          </Button>
        </div>
      </div>

      {/* Configuration Status */}
      {!isConfigured && (
        <Alert className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Email is not configured. Please add your SendGrid API key in{" "}
            <a href="/admin/settings" className="font-medium underline">Settings → Email</a>{" "}
            to enable email functionality.
          </AlertDescription>
        </Alert>
      )}

      {/* Inbound Email Setup Info */}
      {isConfigured && mailboxes.length > 0 && (
        <Alert className="mb-4 border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20">
          <Mail className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-700 dark:text-blue-400">
            <strong>Inbound Email Webhook:</strong> To receive emails, configure SendGrid Inbound Parse to POST to{" "}
            <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded text-xs">
              {typeof window !== "undefined" ? window.location.origin : "https://yourdomain.com"}/api/webhooks/email/inbound
            </code>
          </AlertDescription>
        </Alert>
      )}

      {/* Mailboxes - Horizontal Row */}
      <Card className="mb-4">
        <CardContent className="p-3">
          <div className="flex items-center gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex-shrink-0">Mailboxes</h3>
            {mailboxes.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <Mail className="h-4 w-4 text-zinc-300" />
                <span>No mailboxes yet</span>
                <Button size="sm" variant="outline" onClick={handleCreateMailbox}>
                  <Plus className="h-3 w-3 mr-1" />
                  Create
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 flex-wrap flex-1">
                  {mailboxes.map((mailbox) => (
                    <div
                      key={mailbox.id}
                      className={`group flex items-center gap-2 rounded-lg px-3 py-1.5 cursor-pointer transition-colors border ${
                        selectedMailbox?.id === mailbox.id
                          ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800"
                          : "hover:bg-zinc-50 border-transparent dark:hover:bg-zinc-800"
                      }`}
                      onClick={() => setSelectedMailbox(mailbox)}
                    >
                      <div
                        className="h-2 w-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: mailbox.color || "#3B82F6" }}
                      />
                      <span className="text-sm font-medium">{mailbox.name}</span>
                      {mailbox.isDefault && (
                        <Badge variant="secondary" className="text-[10px] px-1 py-0">Default</Badge>
                      )}
                      {mailbox.unreadCount > 0 && (
                        <Badge className="bg-emerald-600 text-[10px]">
                          {mailbox.unreadCount}
                        </Badge>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 opacity-0 group-hover:opacity-100"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditMailbox(mailbox)}>
                            <Pencil className="h-3 w-3 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => handleDeleteMailbox(mailbox)}
                          >
                            <Trash2 className="h-3 w-3 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={handleCreateMailbox}>
                  <Plus className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Folders */}
        {selectedMailbox && (
          <div className="w-40 flex-shrink-0">
            <Card className="h-full">
              <CardHeader className="pb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Folders</h3>
              </CardHeader>
              <CardContent className="p-2">
                <div className="space-y-1">
                  {Object.entries(FOLDER_LABELS).map(([key, label]) => {
                    const Icon = FOLDER_ICONS[key];
                    const count = selectedMailbox.folders?.[key] || 0;
                    return (
                      <button
                        key={key}
                        className={`w-full flex items-center justify-between rounded-lg px-2 py-1.5 text-sm transition-colors ${
                          selectedFolder === key
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                            : "hover:bg-zinc-50 dark:hover:bg-zinc-800"
                        }`}
                        onClick={() => setSelectedFolder(key)}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <span>{label}</span>
                        </div>
                        {count > 0 && (
                          <span className="text-xs text-zinc-500">{count}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Email List */}
        <div className="w-80 flex-shrink-0">
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 max-w-sm relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                  <Input
                    placeholder="Search emails..."
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={fetchEmails}
                  disabled={isLoadingEmails}
                >
                  <RefreshCw className={`h-4 w-4 ${isLoadingEmails ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
              {!selectedMailbox ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-4">
                  <Mail className="h-12 w-12 text-zinc-300 mb-4" />
                  <h3 className="font-medium text-zinc-900 dark:text-white mb-2">No mailbox selected</h3>
                  <p className="text-sm text-zinc-500">
                    Select a mailbox from the sidebar or create a new one.
                  </p>
                </div>
              ) : isLoadingEmails ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
                </div>
              ) : emails.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-4">
                  <Inbox className="h-12 w-12 text-zinc-300 mb-4" />
                  <h3 className="font-medium text-zinc-900 dark:text-white mb-2">No emails</h3>
                  <p className="text-sm text-zinc-500">
                    {selectedFolder === "INBOX"
                      ? "Your inbox is empty."
                      : `No emails in ${FOLDER_LABELS[selectedFolder]?.toLowerCase() || selectedFolder}.`}
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-full">
                  <div className="divide-y">
                    {emails.map((email) => (
                      <div
                        key={email.id}
                        className={`flex items-start gap-3 p-3 cursor-pointer transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800 ${
                          !email.isRead ? "bg-blue-50/50 dark:bg-blue-900/10" : ""
                        } ${selectedEmail?.id === email.id ? "bg-emerald-50 dark:bg-emerald-900/20" : ""}`}
                        onClick={() => handleSelectEmail(email)}
                      >
                        <button
                          className="flex-shrink-0 mt-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleStar(email);
                          }}
                        >
                          <Star
                            className={`h-4 w-4 ${
                              email.isStarred
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-zinc-300 hover:text-zinc-400"
                            }`}
                          />
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-sm truncate ${!email.isRead ? "font-semibold" : ""}`}>
                              {selectedFolder === "SENT" ? email.toEmail : (email.fromName || email.fromEmail)}
                            </span>
                            <span className="text-xs text-zinc-500 flex-shrink-0">
                              {new Date(email.sentAt || email.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <p className={`text-sm truncate ${!email.isRead ? "font-medium" : "text-zinc-600 dark:text-zinc-400"}`}>
                            {email.subject}
                          </p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 flex-shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleDeleteEmail(email)}>
                              <Trash2 className="h-3 w-3 mr-2" />
                              {email.folder === "TRASH" ? "Delete permanently" : "Move to trash"}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Email Detail */}
        {selectedEmail && (
          <div className="flex-1 min-w-0">
            <Card className="h-full flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium truncate">{selectedEmail.subject}</CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setSelectedEmail(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="text-xs text-zinc-500 space-y-1 mt-2">
                  <p><span className="font-medium">From:</span> {selectedEmail.fromName || selectedEmail.fromEmail}</p>
                  <p><span className="font-medium">To:</span> {selectedEmail.toEmail}</p>
                  <p><span className="font-medium">Date:</span> {new Date(selectedEmail.sentAt || selectedEmail.createdAt).toLocaleString()}</p>
                </div>
                {/* Action Buttons */}
                <div className="flex items-center gap-1 mt-3 pt-3 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleReply(selectedEmail)}
                    disabled={!isConfigured}
                  >
                    <Reply className="h-3 w-3 mr-1" />
                    Reply
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleReply(selectedEmail, true)}
                    disabled={!isConfigured}
                  >
                    <ReplyAll className="h-3 w-3 mr-1" />
                    Reply All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleForward(selectedEmail)}
                    disabled={!isConfigured}
                  >
                    <Forward className="h-3 w-3 mr-1" />
                    Forward
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={handleDeleteSelectedEmail}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-auto">
                {selectedEmail.bodyHtml ? (
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: selectedEmail.bodyHtml }}
                  />
                ) : selectedEmail.bodyText ? (
                  <p className="text-sm whitespace-pre-wrap">{selectedEmail.bodyText}</p>
                ) : (
                  <div className="text-center py-8">
                    <AlertCircle className="h-8 w-8 text-zinc-300 mx-auto mb-2" />
                    <p className="text-sm text-zinc-500">No email content available</p>
                    <p className="text-xs text-zinc-400 mt-1">
                      bodyHtml: {selectedEmail.bodyHtml?.length || 0} chars,
                      bodyText: {selectedEmail.bodyText?.length || 0} chars
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Compose Email Dialog */}
      <ComposeEmailDialog
        open={isComposing}
        onOpenChange={(open) => {
          setIsComposing(open);
          if (!open) {
            setComposeMode("new");
            setComposePrefill(null);
          }
        }}
        mailboxes={mailboxes}
        selectedMailbox={selectedMailbox}
        settings={settings}
        mode={composeMode}
        prefill={composePrefill}
        onSent={() => {
          fetchEmails();
          fetchMailboxes();
        }}
      />

      {/* Mailbox Edit Dialog */}
      <MailboxDialog
        open={isEditingMailbox}
        onOpenChange={setIsEditingMailbox}
        mailbox={editingMailbox}
        onSaved={() => {
          fetchMailboxes();
          setIsEditingMailbox(false);
        }}
      />
    </div>
  );
}

function ComposeEmailDialog({
  open,
  onOpenChange,
  mailboxes,
  selectedMailbox,
  settings,
  mode = "new",
  prefill,
  onSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mailboxes: Mailbox[];
  selectedMailbox: Mailbox | null;
  settings: EmailSettings | null;
  mode?: "new" | "reply" | "replyAll" | "forward";
  prefill?: { to?: string; subject?: string; body?: string; inReplyTo?: string } | null;
  onSent: () => void;
}) {
  const [fromMailboxId, setFromMailboxId] = useState(selectedMailbox?.id || "");
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Suppress unused variable warning
  void settings;

  useEffect(() => {
    if (selectedMailbox) {
      setFromMailboxId(selectedMailbox.id);
    }
  }, [selectedMailbox]);

  // Handle prefill data for reply/forward
  useEffect(() => {
    if (open && prefill) {
      setTo(prefill.to || "");
      setSubject(prefill.subject || "");
      setBody(prefill.body || "");
    } else if (!open) {
      // Reset form when closing
      setTo("");
      setSubject("");
      setBody("");
      setError(null);
      setSuccess(false);
    }
  }, [open, prefill]);

  const handleSend = async () => {
    if (!fromMailboxId || !to || !subject || !body) {
      setError("Please fill in all fields");
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/mailboxes/${fromMailboxId}/emails`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toEmail: to,
          subject,
          bodyHtml: body.replace(/\n/g, "<br>"),
          bodyText: body,
          sendNow: true,
        }),
      });

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => {
          onOpenChange(false);
          onSent();
          // Reset form
          setTo("");
          setSubject("");
          setBody("");
          setSuccess(false);
        }, 1500);
      } else {
        const data = await response.json();
        setError(data.error || "Failed to send email");
      }
    } catch {
      setError("Failed to send email");
    } finally {
      setIsSending(false);
    }
  };

  if (success) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="flex flex-col items-center justify-center py-8">
            <CheckCircle className="h-12 w-12 text-emerald-500 mb-4" />
            <h3 className="font-medium text-lg">Email Sent!</h3>
            <p className="text-sm text-zinc-500">Your email has been sent to {to}</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "reply" ? "Reply" : mode === "replyAll" ? "Reply All" : mode === "forward" ? "Forward" : "Compose Email"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label>From</Label>
            <Select value={fromMailboxId} onValueChange={setFromMailboxId}>
              <SelectTrigger>
                <SelectValue placeholder="Select mailbox" />
              </SelectTrigger>
              <SelectContent>
                {mailboxes.map((mailbox) => (
                  <SelectItem key={mailbox.id} value={mailbox.id}>
                    {mailbox.name} ({mailbox.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="to">To</Label>
            <Input
              id="to"
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">Message</Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message..."
              className="min-h-[200px]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
            Cancel
          </Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={handleSend}
            disabled={isSending}
          >
            {isSending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MailboxDialog({
  open,
  onOpenChange,
  mailbox,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mailbox: Mailbox | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#3B82F6");
  const [isDefault, setIsDefault] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mailbox) {
      setName(mailbox.name);
      setEmail(mailbox.email);
      setDescription(mailbox.description || "");
      setColor(mailbox.color || "#3B82F6");
      setIsDefault(mailbox.isDefault);
    } else {
      setName("");
      setEmail("");
      setDescription("");
      setColor("#3B82F6");
      setIsDefault(false);
    }
  }, [mailbox, open]);

  const handleSave = async () => {
    if (!name || !email) {
      setError("Name and email are required");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const url = mailbox
        ? `/api/admin/mailboxes/${mailbox.id}`
        : "/api/admin/mailboxes";

      const response = await fetch(url, {
        method: mailbox ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          description: description || null,
          color,
          isDefault,
        }),
      });

      if (response.ok) {
        onSaved();
      } else {
        const data = await response.json();
        setError(data.error || "Failed to save mailbox");
      }
    } catch {
      setError("Failed to save mailbox");
    } finally {
      setIsSaving(false);
    }
  };

  const colorOptions = [
    "#3B82F6", // Blue
    "#10B981", // Emerald
    "#8B5CF6", // Violet
    "#F59E0B", // Amber
    "#EF4444", // Red
    "#EC4899", // Pink
    "#06B6D4", // Cyan
    "#84CC16", // Lime
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mailbox ? "Edit Mailbox" : "Create Mailbox"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Support, Sales, Info"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g., support@company.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this mailbox for?"
            />
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex gap-2">
              {colorOptions.map((c) => (
                <button
                  key={c}
                  className={`h-8 w-8 rounded-full transition-transform ${
                    color === c ? "ring-2 ring-offset-2 ring-zinc-400 scale-110" : ""
                  }`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isDefault"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300"
            />
            <Label htmlFor="isDefault" className="text-sm font-normal">
              Set as default mailbox
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                {mailbox ? "Save Changes" : "Create Mailbox"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
