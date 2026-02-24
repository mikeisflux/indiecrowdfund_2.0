"use client";

import { useState, useEffect, useCallback } from "react";
import { TabsContent } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import {
  Mail,
  Plus,
  Pencil,
  Trash2,
  Shield,
  RefreshCw,
  Ban,
  Globe,
  AtSign,
  Hash,
  Inbox,
} from "lucide-react";
import { toast } from "sonner";
import { getCSRFHeaders } from "@/lib/csrf";

// Types
interface Mailbox {
  id: string;
  name: string;
  email: string;
  description: string | null;
  color: string | null;
  imapHost: string | null;
  imapPort: number | null;
  smtpHost: string | null;
  smtpPort: number | null;
  username: string | null;
  password: string | null;
  useSSL: boolean;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  unreadCount?: number;
  totalEmails?: number;
}

interface BlocklistEntry {
  id: string;
  type: "EMAIL" | "DOMAIN" | "IP" | "PATTERN";
  value: string;
  reason: string | null;
  source: string | null;
  blockedCount: number;
  lastBlockedAt: string | null;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
}

// Mailbox Form Dialog
function MailboxDialog({
  open,
  onOpenChange,
  mailbox,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mailbox?: Mailbox | null;
  onSave: () => void;
}) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    description: "",
    color: "#3B82F6",
    imapHost: "",
    imapPort: "",
    smtpHost: "",
    smtpPort: "",
    username: "",
    password: "",
    useSSL: true,
    isDefault: false,
    isActive: true,
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (mailbox) {
      setFormData({
        name: mailbox.name || "",
        email: mailbox.email || "",
        description: mailbox.description || "",
        color: mailbox.color || "#3B82F6",
        imapHost: mailbox.imapHost || "",
        imapPort: mailbox.imapPort?.toString() || "",
        smtpHost: mailbox.smtpHost || "",
        smtpPort: mailbox.smtpPort?.toString() || "",
        username: mailbox.username || "",
        password: "",
        useSSL: mailbox.useSSL,
        isDefault: mailbox.isDefault,
        isActive: mailbox.isActive,
      });
    } else {
      setFormData({
        name: "",
        email: "",
        description: "",
        color: "#3B82F6",
        imapHost: "",
        imapPort: "",
        smtpHost: "",
        smtpPort: "",
        username: "",
        password: "",
        useSSL: true,
        isDefault: false,
        isActive: true,
      });
    }
  }, [mailbox, open]);

  const handleSubmit = async () => {
    if (!formData.name || !formData.email) {
      toast.error("Name and email are required");
      return;
    }

    setIsSaving(true);
    try {
      const url = mailbox
        ? `/api/admin/mailboxes/${mailbox.id}`
        : "/api/admin/mailboxes";
      const method = mailbox ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          ...formData,
          imapPort: formData.imapPort ? parseInt(formData.imapPort) : null,
          smtpPort: formData.smtpPort ? parseInt(formData.smtpPort) : null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save mailbox");
      }

      toast.success(mailbox ? "Mailbox updated" : "Mailbox created");
      onOpenChange(false);
      onSave();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save mailbox");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mailbox ? "Edit Mailbox" : "Add Mailbox"}</DialogTitle>
          <DialogDescription>
            Configure a mailbox for receiving and sending emails.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Support"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="support@indiecrowdfund.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Main support inbox for customer inquiries"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="color">Color</Label>
              <div className="flex gap-2">
                <Input
                  id="color"
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-12 h-10 p-1"
                />
                <Input
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  placeholder="#3B82F6"
                />
              </div>
            </div>
          </div>

          <div className="border-t pt-4 mt-4">
            <h4 className="font-medium mb-4">Mail Server Settings (Optional)</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="imapHost">IMAP Host</Label>
                <Input
                  id="imapHost"
                  value={formData.imapHost}
                  onChange={(e) => setFormData({ ...formData, imapHost: e.target.value })}
                  placeholder="imap.gmail.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="imapPort">IMAP Port</Label>
                <Input
                  id="imapPort"
                  value={formData.imapPort}
                  onChange={(e) => setFormData({ ...formData, imapPort: e.target.value })}
                  placeholder="993"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtpHost">SMTP Host</Label>
                <Input
                  id="smtpHost"
                  value={formData.smtpHost}
                  onChange={(e) => setFormData({ ...formData, smtpHost: e.target.value })}
                  placeholder="smtp.gmail.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtpPort">SMTP Port</Label>
                <Input
                  id="smtpPort"
                  value={formData.smtpPort}
                  onChange={(e) => setFormData({ ...formData, smtpPort: e.target.value })}
                  placeholder="587"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="username@gmail.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={mailbox ? "••••••••" : "Enter password"}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6 pt-4">
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.useSSL}
                onCheckedChange={(checked) => setFormData({ ...formData, useSSL: checked })}
              />
              <Label>Use SSL/TLS</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.isDefault}
                onCheckedChange={(checked) => setFormData({ ...formData, isDefault: checked })}
              />
              <Label>Default Mailbox</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
              <Label>Active</Label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Blocklist Entry Form Dialog
function BlocklistDialog({
  open,
  onOpenChange,
  entry,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry?: BlocklistEntry | null;
  onSave: () => void;
}) {
  const [formData, setFormData] = useState({
    type: "EMAIL" as "EMAIL" | "DOMAIN" | "IP" | "PATTERN",
    value: "",
    reason: "",
    isActive: true,
    expiresAt: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (entry) {
      setFormData({
        type: entry.type,
        value: entry.value,
        reason: entry.reason || "",
        isActive: entry.isActive,
        expiresAt: entry.expiresAt ? entry.expiresAt.split("T")[0] : "",
      });
    } else {
      setFormData({
        type: "EMAIL",
        value: "",
        reason: "",
        isActive: true,
        expiresAt: "",
      });
    }
  }, [entry, open]);

  const handleSubmit = async () => {
    if (!formData.value) {
      toast.error("Value is required");
      return;
    }

    setIsSaving(true);
    try {
      const url = entry
        ? `/api/admin/email-blocklist/${entry.id}`
        : "/api/admin/email-blocklist";
      const method = entry ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          ...formData,
          source: entry ? entry.source : "manual",
          expiresAt: formData.expiresAt || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save blocklist entry");
      }

      toast.success(entry ? "Entry updated" : "Entry added to blocklist");
      onOpenChange(false);
      onSave();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save entry");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{entry ? "Edit Block Entry" : "Add to Blocklist"}</DialogTitle>
          <DialogDescription>
            Block emails from specific addresses, domains, or IP addresses.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="type">Block Type</Label>
            <Select
              value={formData.type}
              onValueChange={(value) => setFormData({ ...formData, type: value as typeof formData.type })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EMAIL">
                  <div className="flex items-center gap-2">
                    <AtSign className="h-4 w-4" />
                    Email Address
                  </div>
                </SelectItem>
                <SelectItem value="DOMAIN">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Domain
                  </div>
                </SelectItem>
                <SelectItem value="IP">
                  <div className="flex items-center gap-2">
                    <Hash className="h-4 w-4" />
                    IP Address
                  </div>
                </SelectItem>
                <SelectItem value="PATTERN">
                  <div className="flex items-center gap-2">
                    <Ban className="h-4 w-4" />
                    Pattern (Regex)
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="value">
              {formData.type === "EMAIL" && "Email Address"}
              {formData.type === "DOMAIN" && "Domain Name"}
              {formData.type === "IP" && "IP Address"}
              {formData.type === "PATTERN" && "Pattern"}
            </Label>
            <Input
              id="value"
              value={formData.value}
              onChange={(e) => setFormData({ ...formData, value: e.target.value })}
              placeholder={
                formData.type === "EMAIL" ? "spam@example.com" :
                formData.type === "DOMAIN" ? "spammer.com" :
                formData.type === "IP" ? "192.168.1.1" :
                ".*@tempmail\\..*"
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason</Label>
            <Textarea
              id="reason"
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              placeholder="Why is this being blocked?"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expiresAt">Expires (Optional)</Label>
            <Input
              id="expiresAt"
              type="date"
              value={formData.expiresAt}
              onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Leave empty for permanent block
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={formData.isActive}
              onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
            />
            <Label>Active</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CommunicationSettings() {
  // Mailboxes state
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [loadingMailboxes, setLoadingMailboxes] = useState(true);
  const [mailboxDialogOpen, setMailboxDialogOpen] = useState(false);
  const [editingMailbox, setEditingMailbox] = useState<Mailbox | null>(null);
  const [deletingMailbox, setDeletingMailbox] = useState<Mailbox | null>(null);

  // Blocklist state
  const [blocklist, setBlocklist] = useState<BlocklistEntry[]>([]);
  const [loadingBlocklist, setLoadingBlocklist] = useState(true);
  const [blocklistDialogOpen, setBlocklistDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<BlocklistEntry | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<BlocklistEntry | null>(null);
  const [purging, setPurging] = useState(false);
  const [purgeConfirmOpen, setPurgeConfirmOpen] = useState(false);

  // Fetch mailboxes
  const fetchMailboxes = useCallback(async () => {
    try {
      setLoadingMailboxes(true);
      const response = await fetch("/api/admin/mailboxes");
      if (!response.ok) throw new Error("Failed to fetch mailboxes");
      const data = await response.json();
      setMailboxes(data.mailboxes || []);
    } catch (error) {
      console.error("Error fetching mailboxes:", error);
      toast.error("Failed to load mailboxes");
    } finally {
      setLoadingMailboxes(false);
    }
  }, []);

  // Fetch blocklist
  const fetchBlocklist = useCallback(async () => {
    try {
      setLoadingBlocklist(true);
      const response = await fetch("/api/admin/email-blocklist");
      if (!response.ok) throw new Error("Failed to fetch blocklist");
      const data = await response.json();
      setBlocklist(data.entries || []);
    } catch (error) {
      console.error("Error fetching blocklist:", error);
      toast.error("Failed to load blocklist");
    } finally {
      setLoadingBlocklist(false);
    }
  }, []);

  useEffect(() => {
    fetchMailboxes();
    fetchBlocklist();
  }, [fetchMailboxes, fetchBlocklist]);

  // Delete mailbox
  const handleDeleteMailbox = async () => {
    if (!deletingMailbox) return;

    try {
      const response = await fetch(`/api/admin/mailboxes/${deletingMailbox.id}`, {
        method: "DELETE",
        headers: getCSRFHeaders(),
      });

      if (!response.ok) throw new Error("Failed to delete mailbox");

      toast.success("Mailbox deleted");
      setDeletingMailbox(null);
      fetchMailboxes();
    } catch {
      toast.error("Failed to delete mailbox");
    }
  };

  // Delete blocklist entry
  const handleDeleteEntry = async () => {
    if (!deletingEntry) return;

    try {
      const response = await fetch(`/api/admin/email-blocklist/${deletingEntry.id}`, {
        method: "DELETE",
        headers: getCSRFHeaders(),
      });

      if (!response.ok) throw new Error("Failed to delete entry");

      toast.success("Entry removed from blocklist");
      setDeletingEntry(null);
      fetchBlocklist();
    } catch {
      toast.error("Failed to delete entry");
    }
  };

  // Purge webhook-added blocklist entries for Microsoft email domains
  const handlePurgeWebhookBlocks = async () => {
    setPurging(true);
    try {
      const response = await fetch("/api/admin/email-blocklist/purge", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          domains: [
            "hotmail.com", "hotmail.co.uk", "hotmail.fr", "hotmail.de",
            "hotmail.it", "hotmail.es", "hotmail.ca", "hotmail.co.jp",
            "outlook.com", "outlook.co.uk", "outlook.fr", "outlook.de",
            "live.com", "live.co.uk", "live.fr", "live.ca",
            "msn.com",
          ],
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to purge entries");
      }

      const data = await response.json();
      toast.success(`Purged ${data.purged} blocklist entries, restored ${data.restoredSubscribers} subscribers`);
      setPurgeConfirmOpen(false);
      fetchBlocklist();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to purge entries");
    } finally {
      setPurging(false);
    }
  };

  // Count webhook-added Microsoft email blocks for the purge button badge
  const webhookMicrosoftCount = blocklist.filter(
    (e) =>
      e.type === "EMAIL" &&
      (e.source === "webhook-bounce" || e.source === "sendgrid-bounce" || e.source === "mailgun-bounce") &&
      /(@hotmail\.|@outlook\.|@live\.|@msn\.)/i.test(e.value)
  ).length;

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "EMAIL":
        return <AtSign className="h-4 w-4" />;
      case "DOMAIN":
        return <Globe className="h-4 w-4" />;
      case "IP":
        return <Hash className="h-4 w-4" />;
      case "PATTERN":
        return <Ban className="h-4 w-4" />;
      default:
        return null;
    }
  };

  return (
    <TabsContent value="communication" className="mt-6 space-y-6">
      {/* Mailboxes Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Inbox className="h-5 w-5 text-blue-600" />
              <div>
                <CardTitle>Mailboxes</CardTitle>
                <CardDescription>
                  Manage email mailboxes for the platform
                </CardDescription>
              </div>
            </div>
            <Button
              onClick={() => {
                setEditingMailbox(null);
                setMailboxDialogOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Mailbox
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingMailboxes ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : mailboxes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No mailboxes configured</p>
              <p className="text-sm">Add a mailbox to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Emails</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mailboxes.map((mailbox) => (
                  <TableRow key={mailbox.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: mailbox.color || "#3B82F6" }}
                        />
                        <span className="font-medium">{mailbox.name}</span>
                        {mailbox.isDefault && (
                          <Badge variant="secondary" className="text-xs">Default</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {mailbox.email}
                    </TableCell>
                    <TableCell>
                      {mailbox.unreadCount !== undefined && (
                        <span>
                          {mailbox.unreadCount > 0 && (
                            <Badge variant="destructive" className="mr-1">
                              {mailbox.unreadCount}
                            </Badge>
                          )}
                          {mailbox.totalEmails || 0} total
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={mailbox.isActive ? "default" : "secondary"}>
                        {mailbox.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingMailbox(mailbox);
                            setMailboxDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeletingMailbox(mailbox)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Email Blocklist Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-red-600" />
              <div>
                <CardTitle>Email Blocklist</CardTitle>
                <CardDescription>
                  Block spam and unwanted email addresses, domains, or IPs
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {webhookMicrosoftCount > 0 && (
                <Button
                  variant="outline"
                  className="text-orange-600 border-orange-300 hover:bg-orange-50"
                  onClick={() => setPurgeConfirmOpen(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Purge Hotmail/Outlook Blocks
                  <Badge variant="secondary" className="ml-2">{webhookMicrosoftCount}</Badge>
                </Button>
              )}
              <Button
                onClick={() => {
                  setEditingEntry(null);
                  setBlocklistDialogOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Block Entry
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingBlocklist ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : blocklist.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No blocked entries</p>
              <p className="text-sm">Add entries to block spam and unwanted emails</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Blocked</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {blocklist.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTypeIcon(entry.type)}
                        <Badge variant="outline">{entry.type}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {entry.value}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate">
                      {entry.reason || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {entry.blockedCount} blocked
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={entry.isActive ? "destructive" : "secondary"}>
                        {entry.isActive ? "Blocking" : "Disabled"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingEntry(entry);
                            setBlocklistDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeletingEntry(entry)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <MailboxDialog
        open={mailboxDialogOpen}
        onOpenChange={setMailboxDialogOpen}
        mailbox={editingMailbox}
        onSave={fetchMailboxes}
      />

      <BlocklistDialog
        open={blocklistDialogOpen}
        onOpenChange={setBlocklistDialogOpen}
        entry={editingEntry}
        onSave={fetchBlocklist}
      />

      {/* Delete Mailbox Confirmation */}
      <AlertDialog open={!!deletingMailbox} onOpenChange={() => setDeletingMailbox(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Mailbox</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the mailbox &quot;{deletingMailbox?.name}&quot;?
              This will also delete all emails in this mailbox.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMailbox}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Entry Confirmation */}
      <AlertDialog open={!!deletingEntry} onOpenChange={() => setDeletingEntry(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Block Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove &quot;{deletingEntry?.value}&quot; from the blocklist?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEntry}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Purge Webhook Blocks Confirmation */}
      <AlertDialog open={purgeConfirmOpen} onOpenChange={setPurgeConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Purge Hotmail/Outlook Blocks</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove {webhookMicrosoftCount} webhook-added blocklist entries
              for Hotmail, Outlook, Live, and MSN email addresses. These were likely
              blocked due to temporary ISP rejections, not invalid addresses.
              <br /><br />
              Subscriber records will also be restored so these addresses receive future emails.
              Only entries added by webhooks will be removed — manual blocks are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={purging}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePurgeWebhookBlocks}
              disabled={purging}
              className="bg-orange-600 text-white hover:bg-orange-700"
            >
              {purging ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Purging...
                </>
              ) : (
                `Purge ${webhookMicrosoftCount} Entries`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TabsContent>
  );
}
