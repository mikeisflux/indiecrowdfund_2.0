"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  CheckCircle,
  XCircle,
  Eye,
  Download,
  Star,
  Crown,
  ExternalLink,
  DollarSign,
  Trash2,
  Wallet,
  Loader2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { apiFetch } from "@/lib/fetch-utils";
import { User, UserPledge, EmailLogEntry } from "../types";
import { getRoleBadge } from "../utils";

interface MergePreviewUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
  _count: { pledges: number; createdProjects: number; sessions: number };
}

/**
 * Fold another account into this one. For the backer whose history ended
 * up split across two addresses: everything on the other account (pledges,
 * messages, follows, wallet) moves here and the other login is retired.
 */
function MergeAccountSection({ user, onMerged }: { user: User; onMerged?: () => void }) {
  const [other, setOther] = useState("");
  const [preview, setPreview] = useState<{ merge: MergePreviewUser | null; problems: string[] } | null>(null);
  const [busy, setBusy] = useState<"preview" | "merge" | null>(null);

  const lookUp = async () => {
    setBusy("preview");
    setPreview(null);
    try {
      const res = await fetch(`/api/admin/users/merge?keep=${encodeURIComponent(user.id)}&merge=${encodeURIComponent(other.trim())}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Lookup failed");
      setPreview({ merge: data.merge, problems: data.problems || [] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setBusy(null);
    }
  };

  const merge = async () => {
    if (!preview?.merge) return;
    if (!window.confirm(`Move everything from ${preview.merge.email} into ${user.email} and retire ${preview.merge.email}? This cannot be undone.`)) return;
    setBusy("merge");
    try {
      const res = await apiFetch("/api/admin/users/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keep: user.id, merge: preview.merge.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Merge failed");
      toast.success(`Merged ${data.merged?.email}: ${data.merged?.pledgesMoved ?? 0} pledge(s) moved to ${user.email}`);
      setPreview(null);
      setOther("");
      onMerged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Merge failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mt-6 rounded-lg border p-4 space-y-3">
      <div>
        <p className="font-medium">Merge another account into this one</p>
        <p className="text-sm text-muted-foreground">
          Enter the other account&apos;s email or id. Its pledges, messages, follows and wallet move to <strong>{user.email}</strong>, and the other login is retired.
          This account keeps its password and settings.
        </p>
      </div>
      <div className="flex gap-2">
        <Input value={other} onChange={(e) => setOther(e.target.value)} placeholder="other-address@example.com" className="font-mono" />
        <Button variant="outline" onClick={lookUp} disabled={busy !== null || !other.trim()}>
          {busy === "preview" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Look up"}
        </Button>
      </div>
      {preview && (
        <div className="rounded-md bg-muted/50 p-3 text-sm space-y-2">
          {preview.merge ? (
            <p>
              <strong>{preview.merge.name || "No name"}</strong> · {preview.merge.email} · {preview.merge.role} · joined{" "}
              {formatDistanceToNow(new Date(preview.merge.createdAt), { addSuffix: true })} · {preview.merge._count.pledges} pledge(s),{" "}
              {preview.merge._count.createdProjects} project(s)
            </p>
          ) : (
            <p className="text-muted-foreground">No active account found.</p>
          )}
          {preview.problems.map((p, i) => (
            <p key={i} className="text-red-600">
              {p}
            </p>
          ))}
          {preview.merge && preview.problems.length === 0 && (
            <Button onClick={merge} disabled={busy !== null} className="bg-red-600 hover:bg-red-700">
              {busy === "merge" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Merge {preview.merge.email} into {user.email}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

interface UserDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  activeTab: string;
  onTabChange: (tab: string) => void;
  pledges: UserPledge[];
  emails: EmailLogEntry[];
  loadingPledges: boolean;
  loadingEmails: boolean;
  cancellingPledge: string | null;
  refundingPledge: string | null;
  resendingReceipt: string | null;
  onCancelPledge: (pledgeId: string) => void;
  onRefundPledge: (pledgeId: string) => void;
  onDeletePledge: (pledgeId: string) => void;
  onResendReceipt: (pledgeId: string) => void;
  onViewEmail: (email: EmailLogEntry) => void;
  onDownloadEmail: (emailId: string) => void;
  onEditUser: (user: User) => void;
  onZeroWalletBalance?: (userId: string) => void;
  zeroingWallet?: boolean;
  /** Called after another account was merged into this one, so the list refreshes. */
  onMerged?: () => void;
  /** Only super admins see the merge tool. */
  canMerge?: boolean;
}

export function UserDetailsDialog({
  open,
  onOpenChange,
  user,
  activeTab,
  onTabChange,
  pledges,
  emails,
  loadingPledges,
  loadingEmails,
  cancellingPledge,
  refundingPledge,
  resendingReceipt,
  onCancelPledge,
  onRefundPledge,
  onDeletePledge,
  onResendReceipt,
  onViewEmail,
  onDownloadEmail,
  onEditUser,
  onZeroWalletBalance,
  zeroingWallet,
  onMerged,
  canMerge,
}: UserDetailsDialogProps) {
  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>User Details</DialogTitle>
          <DialogDescription>
            View and manage user account information, backer history, and emails.
          </DialogDescription>
        </DialogHeader>
        <Tabs value={activeTab} onValueChange={onTabChange}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="pledges">Backer History ({user.pledgeCount})</TabsTrigger>
            <TabsTrigger value="emails">Email History</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="py-4">
            <div className="flex items-start gap-6">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-zinc-200 text-2xl font-bold text-muted-foreground">
                {user.name?.charAt(0) || (user.email?.charAt(0) || "U").toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-semibold">{user.name || "No name"}</h3>
                  {getRoleBadge(user.role)}
                  {user.emailVerified && (
                    <Badge className="bg-emerald-100 text-emerald-700">
                      <CheckCircle className="h-3 w-3 mr-1" /> Verified
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground">{user.email}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Member since {user.createdAt ? formatDistanceToNow(new Date(user.createdAt), { addSuffix: true }) : "N/A"}
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Card>
                <CardContent className="p-4 text-center">
                  <Star className="h-6 w-6 mx-auto text-blue-500 mb-2" />
                  <p className="text-2xl font-bold">{user.pledgeCount}</p>
                  <p className="text-xs text-muted-foreground">Pledges Made</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Crown className="h-6 w-6 mx-auto text-violet-500 mb-2" />
                  <p className="text-2xl font-bold">{user.projectCount}</p>
                  <p className="text-xs text-muted-foreground">Projects Created</p>
                </CardContent>
              </Card>
            </div>

            {/* Divinity Payments Wallet */}
            {user.divinityCoinBalance > 0 && (
              <div className="mt-6 flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Divinity Payments Wallet Balance</p>
                  <p className="text-lg font-bold text-emerald-600">
                    ${Number(user.divinityCoinBalance).toFixed(2)}
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => onZeroWalletBalance?.(user.id)}
                  disabled={zeroingWallet}
                >
                  {zeroingWallet ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Wallet className="h-4 w-4 mr-2" />
                  )}
                  Zero DivinitCoin Wallet Balance
                </Button>
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => onTabChange("emails")}>
                <Mail className="mr-2 h-4 w-4" />
                View Emails
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => onTabChange("pledges")}>
                <Star className="mr-2 h-4 w-4" />
                View Pledges
              </Button>
              <Button variant="outline" className="flex-1" asChild>
                <a href={`/u/${user.id}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View Profile
                </a>
              </Button>
            </div>

            {canMerge && (
              <MergeAccountSection
                user={user}
                onMerged={() => {
                  onOpenChange(false);
                  onMerged?.();
                }}
              />
            )}
          </TabsContent>

          {/* Backer History Tab */}
          <TabsContent value="pledges" className="py-4">
            {loadingPledges ? (
              <div className="text-center py-8 text-muted-foreground">Loading pledges...</div>
            ) : pledges.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No pledges found</div>
            ) : (
              <div className="space-y-4">
                {pledges.map((pledge) => (
                  <Card key={pledge.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            {pledge.project.creatorVanityUrl ? (
                              <a
                                href={`/projects/${pledge.project.creatorVanityUrl}/${pledge.project.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium hover:underline"
                              >
                                {pledge.project.title}
                              </a>
                            ) : (
                              <span className="font-medium text-muted-foreground" title="Creator has no vanity URL set">
                                {pledge.project.title}
                              </span>
                            )}
                            <Badge variant={pledge.status === "COMPLETED" ? "default" : "secondary"}>
                              {pledge.status}
                            </Badge>
                            {pledge.confirmationEmailSent && (
                              <Badge variant="outline" className="text-green-600">
                                <CheckCircle className="h-3 w-3 mr-1" /> Email Sent
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {pledge.reward?.title || "No reward"} • {new Date(pledge.createdAt).toLocaleDateString()}
                          </p>
                          <p className="text-lg font-semibold mt-2">
                            <DollarSign className="inline h-4 w-4" />
                            {Number(pledge.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                        <div className="flex flex-col gap-2">
                          {/* Resend Receipt button */}
                          {(pledge.status === "PENDING" || pledge.status === "COMPLETED") && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-blue-600 border-blue-200 hover:bg-blue-50"
                              onClick={() => onResendReceipt(pledge.id)}
                              disabled={resendingReceipt === pledge.id}
                            >
                              <Mail className="h-3 w-3 mr-1" />
                              {resendingReceipt === pledge.id ? "Sending..." : "Resend Receipt"}
                            </Button>
                          )}
                          {/* Cancel button for PENDING pledges */}
                          {pledge.status === "PENDING" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-amber-600 border-amber-200 hover:bg-amber-50"
                              onClick={() => onCancelPledge(pledge.id)}
                              disabled={cancellingPledge === pledge.id}
                            >
                              <XCircle className="h-3 w-3 mr-1" />
                              {cancellingPledge === pledge.id ? "Cancelling..." : "Cancel"}
                            </Button>
                          )}
                          {/* Refund button for COMPLETED pledges */}
                          {pledge.status === "COMPLETED" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-orange-600 border-orange-200 hover:bg-orange-50"
                              onClick={() => onRefundPledge(pledge.id)}
                              disabled={refundingPledge === pledge.id}
                            >
                              <DollarSign className="h-3 w-3 mr-1" />
                              {refundingPledge === pledge.id ? "Refunding..." : "Refund"}
                            </Button>
                          )}
                          {/* Delete button for cancelled/failed pledges */}
                          {(pledge.status === "CANCELLED" || pledge.status === "FAILED" || pledge.status === "PENDING") && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 border-red-200 hover:bg-red-50"
                              onClick={() => onDeletePledge(pledge.id)}
                              disabled={cancellingPledge === pledge.id}
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              {cancellingPledge === pledge.id ? "Deleting..." : "Delete"}
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Email History Tab */}
          <TabsContent value="emails" className="py-4">
            {loadingEmails ? (
              <div className="text-center py-8 text-muted-foreground">Loading emails...</div>
            ) : emails.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No emails found</div>
            ) : (
              <div className="space-y-4">
                {emails.map((email) => (
                  <Card key={email.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{email.type.replace(/_/g, " ")}</Badge>
                            <span className="text-sm text-muted-foreground">
                              {new Date(email.sentAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="font-medium mt-2">{email.subject || "No subject"}</p>
                          <p className="text-sm text-muted-foreground">To: {email.recipientEmail}</p>
                          {email.project && (
                            <p className="text-sm text-muted-foreground">Project: {email.project.title}</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {email.htmlContent && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onViewEmail(email)}
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                View
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onDownloadEmail(email.id)}
                              >
                                <Download className="h-3 w-3 mr-1" />
                                Download
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={() => {
            onOpenChange(false);
            onEditUser(user);
          }}>Edit User</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
