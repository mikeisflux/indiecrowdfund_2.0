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
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { User, UserPledge, EmailLogEntry } from "../types";
import { getRoleBadge } from "../utils";

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
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-zinc-200 text-2xl font-bold text-zinc-600">
                {user.name?.charAt(0) || user.email.charAt(0).toUpperCase()}
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
                <p className="text-zinc-500">{user.email}</p>
                <p className="mt-1 text-sm text-zinc-500">
                  Member since {user.createdAt ? formatDistanceToNow(new Date(user.createdAt), { addSuffix: true }) : "N/A"}
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Card>
                <CardContent className="p-4 text-center">
                  <Star className="h-6 w-6 mx-auto text-blue-500 mb-2" />
                  <p className="text-2xl font-bold">{user.pledgeCount}</p>
                  <p className="text-xs text-zinc-500">Pledges Made</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Crown className="h-6 w-6 mx-auto text-violet-500 mb-2" />
                  <p className="text-2xl font-bold">{user.projectCount}</p>
                  <p className="text-xs text-zinc-500">Projects Created</p>
                </CardContent>
              </Card>
            </div>

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
          </TabsContent>

          {/* Backer History Tab */}
          <TabsContent value="pledges" className="py-4">
            {loadingPledges ? (
              <div className="text-center py-8 text-zinc-500">Loading pledges...</div>
            ) : pledges.length === 0 ? (
              <div className="text-center py-8 text-zinc-500">No pledges found</div>
            ) : (
              <div className="space-y-4">
                {pledges.map((pledge) => (
                  <Card key={pledge.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <a
                              href={`/projects/${pledge.project.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium hover:underline"
                            >
                              {pledge.project.title}
                            </a>
                            <Badge variant={pledge.status === "COMPLETED" ? "default" : "secondary"}>
                              {pledge.status}
                            </Badge>
                            {pledge.confirmationEmailSent && (
                              <Badge variant="outline" className="text-green-600">
                                <CheckCircle className="h-3 w-3 mr-1" /> Email Sent
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-zinc-500 mt-1">
                            {pledge.reward?.title || "No reward"} • {new Date(pledge.createdAt).toLocaleDateString()}
                          </p>
                          <p className="text-lg font-semibold mt-2">
                            <DollarSign className="inline h-4 w-4" />
                            {pledge.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
              <div className="text-center py-8 text-zinc-500">Loading emails...</div>
            ) : emails.length === 0 ? (
              <div className="text-center py-8 text-zinc-500">No emails found</div>
            ) : (
              <div className="space-y-4">
                {emails.map((email) => (
                  <Card key={email.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{email.type.replace(/_/g, " ")}</Badge>
                            <span className="text-sm text-zinc-500">
                              {new Date(email.sentAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="font-medium mt-2">{email.subject || "No subject"}</p>
                          <p className="text-sm text-zinc-500">To: {email.recipientEmail}</p>
                          {email.project && (
                            <p className="text-sm text-zinc-500">Project: {email.project.title}</p>
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
