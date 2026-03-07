"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { getCSRFHeaders } from "@/lib/csrf";
import Image from "next/image";

import { useState, useEffect, useCallback } from "react";
import { sanitizeEmailHtml } from "@/lib/utils/sanitize";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
  Loader2,
  Inbox,
  Trash2,
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
  Paperclip,
  Download,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  ComposeEmailDialog,
  MailboxDialog,
  type Mailbox,
  type Email,
  type EmailSettings,
  FOLDER_ICONS,
  FOLDER_LABELS,
  getFileIcon,
  formatFileSize,
} from "./components";

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
    attachments?: Array<{ filename: string; data: string; contentType?: string; url?: string }>;
  } | null>(null);

  // Delete confirmation dialogs
  const [deleteMailboxConfirm, setDeleteMailboxConfirm] = useState<{ open: boolean; mailbox: Mailbox | null }>({
    open: false,
    mailbox: null,
  });
  const [deleteEmailConfirm, setDeleteEmailConfirm] = useState(false);
  const [isDeletingMailbox, setIsDeletingMailbox] = useState(false);
  const [isDeletingEmail, setIsDeletingEmail] = useState(false);

  // Empty folder confirmation
  const [emptyFolderConfirm, setEmptyFolderConfirm] = useState(false);
  const [isEmptyingFolder, setIsEmptyingFolder] = useState(false);

  // Image lightbox state
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

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

  const handleDeleteMailbox = async () => {
    const mailbox = deleteMailboxConfirm.mailbox;
    if (!mailbox) return;

    setIsDeletingMailbox(true);
    try {
      const response = await apiFetch(`/api/admin/mailboxes/${mailbox.id}?force=true`, {
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
    } finally {
      setIsDeletingMailbox(false);
    }
  };

  const handleToggleStar = async (email: Email) => {
    if (!selectedMailbox) return;

    try {
      await apiFetch(`/api/admin/mailboxes/${selectedMailbox.id}/emails/${email.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", },
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
      await apiFetch(`/api/admin/mailboxes/${selectedMailbox.id}/emails/${email.id}`, {
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

    // Include attachments from the original email for forwarding
    const forwardAttachments = email.attachments?.files?.map((att) => ({
      filename: att.filename,
      contentType: att.contentType,
      r2Key: att.r2Key,
      data: "", // Will be fetched by the server
    })) || [];

    setComposeMode("forward");
    setComposePrefill({
      to: "",
      subject: fwdSubject,
      body: forwardBody,
      attachments: forwardAttachments,
    });
    setIsComposing(true);
  };

  const handleDeleteSelectedEmail = async () => {
    if (!selectedMailbox || !selectedEmail) return;

    setIsDeletingEmail(true);
    try {
      const response = await apiFetch(
        `/api/admin/mailboxes/${selectedMailbox.id}/emails/${selectedEmail.id}`,
        { method: "DELETE" }
      );
      if (response.ok) {
        setEmails(emails.filter(e => e.id !== selectedEmail.id));
        setSelectedEmail(null);
      }
    } catch (error) {
      console.error("Error deleting email:", error);
    } finally {
      setIsDeletingEmail(false);
    }
  };

  const handleNewCompose = () => {
    setComposeMode("new");
    setComposePrefill(null);
    setIsComposing(true);
  };

  const handleEmptyFolder = async () => {
    if (!selectedMailbox) return;

    setIsEmptyingFolder(true);
    try {
      const response = await apiFetch(
        `/api/admin/mailboxes/${selectedMailbox.id}/emails?folder=${selectedFolder}`,
        { method: "DELETE" }
      );
      if (response.ok) {
        const data = await response.json();
        console.log(`Emptied ${data.deletedCount} emails from ${selectedFolder}`);
        setEmails([]);
        setSelectedEmail(null);
        // Refresh mailbox folder counts
        await fetchMailboxes();
      }
    } catch (error) {
      console.error("Error emptying folder:", error);
    } finally {
      setIsEmptyingFolder(false);
    }
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white">Email Center</h1>
          <p className="text-zinc-500">Manage mailboxes and send emails</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <Button variant="outline" size="sm" asChild className="flex-1 sm:flex-none">
            <a href="/admin/settings">
              <Settings className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Email Settings</span>
            </a>
          </Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700 flex-1 sm:flex-none"
            onClick={handleNewCompose}
            disabled={!isConfigured || mailboxes.length === 0}
          >
            <Send className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Compose</span>
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
                            onClick={() => setDeleteMailboxConfirm({ open: true, mailbox })}
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
      <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
        {/* Folders */}
        {selectedMailbox && (
          <div className="hidden lg:block w-40 flex-shrink-0">
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
        <div className="w-full lg:w-80 flex-shrink-0">
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
                {selectedMailbox && (selectedMailbox.folders?.[selectedFolder] || 0) > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                    onClick={() => setEmptyFolderConfirm(true)}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Empty
                  </Button>
                )}
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
                    onClick={() => setDeleteEmailConfirm(true)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-auto">
                {/* Attachments Section */}
                {selectedEmail.attachments && selectedEmail.attachments.count > 0 && (
                  <div className="mb-4 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Paperclip className="h-4 w-4 text-zinc-500" />
                      <span className="text-sm font-medium">
                        {selectedEmail.attachments.count} Attachment{selectedEmail.attachments.count !== 1 ? "s" : ""}
                      </span>
                    </div>
                    {selectedEmail.attachments.files && selectedEmail.attachments.files.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {selectedEmail.attachments.files.map((attachment) => {
                          const Icon = getFileIcon(attachment.contentType);
                          const isImage = attachment.contentType.startsWith("image/");
                          return (
                            <a
                              key={attachment.id}
                              href={`/api/admin/mailboxes/${selectedMailbox?.id}/emails/${selectedEmail.id}/attachments/${attachment.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-zinc-700 rounded-md border hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors group"
                              onClick={(e) => {
                                // For images, show in lightbox instead of downloading
                                if (isImage) {
                                  e.preventDefault();
                                  setExpandedImage(`/api/admin/mailboxes/${selectedMailbox?.id}/emails/${selectedEmail.id}/attachments/${attachment.id}`);
                                }
                              }}
                            >
                              <Icon className="h-4 w-4 text-zinc-500 group-hover:text-emerald-600" />
                              <div className="flex flex-col min-w-0">
                                <span className="text-sm truncate max-w-[150px]" title={attachment.filename}>
                                  {attachment.filename}
                                </span>
                                <span className="text-xs text-zinc-400">
                                  {formatFileSize(attachment.size)}
                                </span>
                              </div>
                              <Download className="h-3 w-3 text-zinc-400 group-hover:text-emerald-600 ml-1" />
                            </a>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-500">
                        Attachment files not available for download
                      </p>
                    )}
                  </div>
                )}

                {/* Email Body */}
                {selectedEmail.bodyHtml ? (
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none [&_img]:cursor-zoom-in [&_img]:transition-opacity [&_img]:hover:opacity-80"
                    dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(selectedEmail.bodyHtml) }}
                    onClick={(e) => {
                      const target = e.target as HTMLElement;
                      if (target.tagName === "IMG") {
                        const src = target.getAttribute("src");
                        if (src) {
                          setExpandedImage(src);
                        }
                      }
                    }}
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

      {/* Delete Mailbox Confirmation */}
      <ConfirmDialog
        open={deleteMailboxConfirm.open}
        onOpenChange={(open) => setDeleteMailboxConfirm({ ...deleteMailboxConfirm, open })}
        title="Delete Mailbox?"
        description={`Are you sure you want to delete "${deleteMailboxConfirm.mailbox?.name}"? This will delete all emails in this mailbox.`}
        confirmText="Delete"
        variant="destructive"
        onConfirm={handleDeleteMailbox}
        loading={isDeletingMailbox}
      />

      {/* Delete Email Confirmation */}
      <ConfirmDialog
        open={deleteEmailConfirm}
        onOpenChange={setDeleteEmailConfirm}
        title="Delete Email?"
        description="Are you sure you want to delete this email? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
        onConfirm={handleDeleteSelectedEmail}
        loading={isDeletingEmail}
      />

      {/* Empty Folder Confirmation */}
      <ConfirmDialog
        open={emptyFolderConfirm}
        onOpenChange={setEmptyFolderConfirm}
        title={`Empty ${FOLDER_LABELS[selectedFolder] || selectedFolder}?`}
        description={`This will permanently delete all ${(selectedMailbox?.folders?.[selectedFolder] || 0).toLocaleString()} emails in ${FOLDER_LABELS[selectedFolder]?.toLowerCase() || selectedFolder}. This action cannot be undone.`}
        confirmText="Empty Folder"
        variant="destructive"
        onConfirm={handleEmptyFolder}
        loading={isEmptyingFolder}
      />

      {/* Image Lightbox */}
      <Dialog open={!!expandedImage} onOpenChange={() => setExpandedImage(null)}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 overflow-hidden bg-black/95">
          <DialogHeader className="sr-only">
            <DialogTitle>Image Preview</DialogTitle>
            <DialogDescription>Expanded view of email image</DialogDescription>
          </DialogHeader>
          <div className="relative flex items-center justify-center min-h-[300px] p-4">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 text-white hover:bg-white/20 z-10"
              onClick={() => setExpandedImage(null)}
            >
              <X className="h-6 w-6" />
            </Button>
            {expandedImage && (
              <Image
                src={expandedImage}
                alt="Expanded email image"
                width={800}
                height={600}
                className="max-w-full max-h-[80vh] object-contain"
                unoptimized
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
