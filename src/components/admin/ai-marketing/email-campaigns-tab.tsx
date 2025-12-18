"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Sparkles,
  Users,
  UserCheck,
  Layers,
  Tag,
  Send,
  ShoppingCart,
  ArrowRight,
  Upload,
  Store,
  Eye,
  MousePointer,
  Clock,
  CheckCircle,
  AlertCircle,
  Play,
  Brain,
  MoreHorizontal,
  Pencil,
  Copy,
  Trash2,
  Loader2,
} from "lucide-react";
import { getCSRFHeaders } from "@/lib/csrf";

interface EmailStats {
  totalSent: number;
  avgOpenRate: string;
  avgClickRate: string;
  totalOpens: number;
  totalClicks: number;
}

interface EmailCampaign {
  id: string;
  name: string;
  status: string;
  recipients: number;
  opens: number;
  clicks: number;
  conversions: number;
  sentAt: string | null;
  scheduledFor?: string | null;
}

interface CampaignDetails {
  id: string;
  name: string;
  subject: string;
  htmlContent: string;
  targetAudience: string;
  status: string;
  scheduledFor: string | null;
  sentAt: string | null;
  recipientCount: number;
  sentCount: number;
  openCount: number;
  clickCount: number;
  bounceCount: number;
  unsubscribeCount: number;
  createdAt: string;
}

interface EmailCampaignsTabProps {
  emailStats: EmailStats | null;
  emailCampaigns: EmailCampaign[];
  setShowCampaignDialog: (show: boolean) => void;
  onConfigureCampaignType?: (type: "subscriber" | "backer" | "creator" | "retailer") => void;
  onImportCSV?: () => void;
  onRefresh?: () => void;
}

export function EmailCampaignsTab({
  emailStats,
  emailCampaigns,
  setShowCampaignDialog,
  onConfigureCampaignType,
  onImportCSV,
  onRefresh,
}: EmailCampaignsTabProps) {
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignDetails | null>(null);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState<EmailCampaign | null>(null);
  const [campaignToSend, setCampaignToSend] = useState<EmailCampaign | null>(null);
  const [isResend, setIsResend] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState("");
  const [editSubject, setEditSubject] = useState("");

  // Fetch campaign details
  const fetchCampaignDetails = async (id: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/ai-marketing/campaigns/manage/${id}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedCampaign(data.campaign);
        setEditName(data.campaign.name);
        setEditSubject(data.campaign.subject);
        setShowPreviewDialog(true);
      }
    } catch (error) {
      console.error("Failed to fetch campaign details:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Send campaign (or resend)
  const handleSendCampaign = async () => {
    if (!campaignToSend) return;
    setActionLoading(campaignToSend.id);
    try {
      const response = await fetch(`/api/admin/ai-marketing/campaigns/manage/${campaignToSend.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({ resend: isResend }),
      });
      if (response.ok) {
        onRefresh?.();
      }
    } catch (error) {
      console.error("Failed to send campaign:", error);
    } finally {
      setActionLoading(null);
      setShowSendDialog(false);
      setCampaignToSend(null);
      setIsResend(false);
    }
  };

  // Delete campaign
  const handleDeleteCampaign = async () => {
    if (!campaignToDelete) return;
    setActionLoading(campaignToDelete.id);
    try {
      const response = await fetch(`/api/admin/ai-marketing/campaigns/manage/${campaignToDelete.id}`, {
        method: "DELETE",
        headers: { ...getCSRFHeaders() },
      });
      if (response.ok) {
        onRefresh?.();
      }
    } catch (error) {
      console.error("Failed to delete campaign:", error);
    } finally {
      setActionLoading(null);
      setShowDeleteDialog(false);
      setCampaignToDelete(null);
    }
  };

  // Duplicate campaign
  const handleDuplicateCampaign = async (campaign: EmailCampaign) => {
    setActionLoading(campaign.id);
    try {
      const response = await fetch(`/api/admin/ai-marketing/campaigns/manage/${campaign.id}/duplicate`, {
        method: "POST",
        headers: { ...getCSRFHeaders() },
      });
      if (response.ok) {
        onRefresh?.();
      }
    } catch (error) {
      console.error("Failed to duplicate campaign:", error);
    } finally {
      setActionLoading(null);
    }
  };

  // Save campaign edits
  const handleSaveEdit = async () => {
    if (!selectedCampaign) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/ai-marketing/campaigns/manage/${selectedCampaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          name: editName,
          subject: editSubject,
        }),
      });
      if (response.ok) {
        setEditMode(false);
        onRefresh?.();
        setShowPreviewDialog(false);
      }
    } catch (error) {
      console.error("Failed to save campaign:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mt-6 space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-zinc-500">Total Sent</p>
            <p className="mt-1 text-2xl font-bold">{(emailStats?.totalSent || 0).toLocaleString()}</p>
            <p className="text-xs text-zinc-500">All campaigns</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-zinc-500">Avg Open Rate</p>
            <p className="mt-1 text-2xl font-bold">{emailStats?.avgOpenRate || "0"}%</p>
            <p className="text-xs text-zinc-500">{(emailStats?.totalOpens || 0).toLocaleString()} total opens</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-zinc-500">Avg Click Rate</p>
            <p className="mt-1 text-2xl font-bold">{emailStats?.avgClickRate || "0"}%</p>
            <p className="text-xs text-zinc-500">{(emailStats?.totalClicks || 0).toLocaleString()} total clicks</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-zinc-500">Active Campaigns</p>
            <p className="mt-1 text-2xl font-bold">{emailCampaigns.length}</p>
            <p className="text-xs text-zinc-500">Total campaigns</p>
          </CardContent>
        </Card>
      </div>

      {/* Campaign Type Cards */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>AI-Powered Email Matching</CardTitle>
              <CardDescription>
                Match projects with users based on their interests and behavior
              </CardDescription>
            </div>
            <Button onClick={() => setShowCampaignDialog(true)}>
              <Sparkles className="mr-2 h-4 w-4" />
              Create Campaign
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-blue-100 p-2">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium">Subscriber Campaigns</p>
                  <p className="text-sm text-zinc-500">Target newsletter subscribers</p>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => onConfigureCampaignType?.("subscriber")}
                >
                  <ArrowRight className="mr-2 h-4 w-4" />
                  Configure
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={onImportCSV}
                  title="Import subscribers from CSV"
                >
                  <Upload className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-emerald-100 p-2">
                  <UserCheck className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="font-medium">Backer Campaigns</p>
                  <p className="text-sm text-zinc-500">Engage previous backers</p>
                </div>
              </div>
              <Button
                variant="outline"
                className="mt-4 w-full"
                onClick={() => onConfigureCampaignType?.("backer")}
              >
                <ArrowRight className="mr-2 h-4 w-4" />
                Configure
              </Button>
            </div>

            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-violet-100 p-2">
                  <Layers className="h-5 w-5 text-violet-600" />
                </div>
                <div>
                  <p className="font-medium">Creator Campaigns</p>
                  <p className="text-sm text-zinc-500">Notify project creators</p>
                </div>
              </div>
              <Button
                variant="outline"
                className="mt-4 w-full"
                onClick={() => onConfigureCampaignType?.("creator")}
              >
                <ArrowRight className="mr-2 h-4 w-4" />
                Configure
              </Button>
            </div>

            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-amber-100 p-2">
                  <Store className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-medium">Retailer Campaigns</p>
                  <p className="text-sm text-zinc-500">Reach retail partners</p>
                </div>
              </div>
              <Button
                variant="outline"
                className="mt-4 w-full"
                onClick={() => onConfigureCampaignType?.("retailer")}
              >
                <ArrowRight className="mr-2 h-4 w-4" />
                Configure
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Campaign Manager */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-violet-600" />
                Campaign Manager
              </CardTitle>
              <CardDescription>
                View and manage all email campaigns with AI insights
              </CardDescription>
            </div>
            {onRefresh && (
              <Button variant="outline" size="sm" onClick={onRefresh}>
                Refresh
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {emailCampaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-zinc-100 p-4 mb-4">
                <Send className="h-8 w-8 text-zinc-400" />
              </div>
              <p className="text-lg font-medium text-zinc-600">No campaigns yet</p>
              <p className="text-sm text-zinc-500 mt-1 max-w-md">
                Create your first campaign using the campaign type cards above.
                The AI will help you target the right audience with personalized content.
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Audience</TableHead>
                    <TableHead className="text-center">Recipients</TableHead>
                    <TableHead className="text-center">Opens</TableHead>
                    <TableHead className="text-center">Clicks</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-[70px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {emailCampaigns.map((campaign) => (
                    <TableRow key={campaign.id}>
                      <TableCell>
                        <div className="font-medium">{campaign.name}</div>
                      </TableCell>
                      <TableCell>
                        <CampaignStatusBadge status={campaign.status} />
                      </TableCell>
                      <TableCell>
                        <AudienceBadge name={campaign.name} />
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Users className="h-3.5 w-3.5 text-zinc-400" />
                          {campaign.recipients.toLocaleString()}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Eye className="h-3.5 w-3.5 text-blue-500" />
                          {campaign.opens.toLocaleString()}
                          {campaign.recipients > 0 && (
                            <span className="text-xs text-zinc-400">
                              ({Math.round((campaign.opens / campaign.recipients) * 100)}%)
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <MousePointer className="h-3.5 w-3.5 text-emerald-500" />
                          {campaign.clicks.toLocaleString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-zinc-500">
                          {campaign.sentAt
                            ? new Date(campaign.sentAt).toLocaleDateString()
                            : campaign.scheduledFor
                              ? `Scheduled: ${new Date(campaign.scheduledFor).toLocaleDateString()}`
                              : "Draft"
                          }
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              disabled={actionLoading === campaign.id}
                            >
                              {actionLoading === campaign.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <MoreHorizontal className="h-4 w-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => fetchCampaignDetails(campaign.id)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            {campaign.status.toUpperCase() === "DRAFT" && (
                              <>
                                <DropdownMenuItem onClick={() => {
                                  fetchCampaignDetails(campaign.id);
                                  setEditMode(true);
                                }}>
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => {
                                  setCampaignToSend(campaign);
                                  setIsResend(false);
                                  setShowSendDialog(true);
                                }}>
                                  <Send className="mr-2 h-4 w-4" />
                                  Send Now
                                </DropdownMenuItem>
                              </>
                            )}
                            {campaign.status.toUpperCase() === "SENT" && (
                              <DropdownMenuItem onClick={() => {
                                setCampaignToSend(campaign);
                                setIsResend(true);
                                setShowSendDialog(true);
                              }}>
                                <Send className="mr-2 h-4 w-4" />
                                Resend Campaign
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => handleDuplicateCampaign(campaign)}>
                              <Copy className="mr-2 h-4 w-4" />
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => {
                                setCampaignToDelete(campaign);
                                setShowDeleteDialog(true);
                              }}
                              disabled={campaign.status.toUpperCase() === "SENDING"}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* How AI Works */}
      <Card>
        <CardHeader>
          <CardTitle>How AI Email Matching Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex flex-1 flex-col items-center gap-2 p-4">
              <div className="rounded-full bg-violet-100 p-4">
                <Tag className="h-8 w-8 text-violet-600" />
              </div>
              <p className="text-center font-medium">Auto-Tag Projects</p>
              <p className="text-center text-sm text-zinc-500">AI analyzes content and generates tags</p>
            </div>
            <ArrowRight className="h-6 w-6 text-zinc-300" />
            <div className="flex flex-1 flex-col items-center gap-2 p-4">
              <div className="rounded-full bg-blue-100 p-4">
                <Users className="h-8 w-8 text-blue-600" />
              </div>
              <p className="text-center font-medium">Match User Interests</p>
              <p className="text-center text-sm text-zinc-500">Compare tags to user behavior</p>
            </div>
            <ArrowRight className="h-6 w-6 text-zinc-300" />
            <div className="flex flex-1 flex-col items-center gap-2 p-4">
              <div className="rounded-full bg-emerald-100 p-4">
                <Send className="h-8 w-8 text-emerald-600" />
              </div>
              <p className="text-center font-medium">Send Personalized Email</p>
              <p className="text-center text-sm text-zinc-500">Deliver relevant projects</p>
            </div>
            <ArrowRight className="h-6 w-6 text-zinc-300" />
            <div className="flex flex-1 flex-col items-center gap-2 p-4">
              <div className="rounded-full bg-amber-100 p-4">
                <ShoppingCart className="h-8 w-8 text-amber-600" />
              </div>
              <p className="text-center font-medium">Track Conversions</p>
              <p className="text-center text-sm text-zinc-500">Measure and optimize</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Campaign Preview/Edit Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={(open) => {
        setShowPreviewDialog(open);
        if (!open) {
          setEditMode(false);
          setSelectedCampaign(null);
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editMode ? (
                <>
                  <Pencil className="h-5 w-5" />
                  Edit Campaign
                </>
              ) : (
                <>
                  <Eye className="h-5 w-5" />
                  Campaign Details
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedCampaign && (
                <span className="flex items-center gap-2">
                  <CampaignStatusBadge status={selectedCampaign.status} />
                  <span className="text-zinc-400">|</span>
                  <span>{selectedCampaign.recipientCount.toLocaleString()} recipients</span>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedCampaign && (
            <div className="space-y-4">
              {editMode ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="edit-name">Campaign Name</Label>
                    <Input
                      id="edit-name"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-subject">Subject Line</Label>
                    <Input
                      id="edit-subject"
                      value={editSubject}
                      onChange={(e) => setEditSubject(e.target.value)}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-zinc-500">Name</p>
                      <p className="font-medium">{selectedCampaign.name}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-500">Subject</p>
                      <p>{selectedCampaign.subject}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-500">Audience</p>
                      <p className="capitalize">{selectedCampaign.targetAudience || "All"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-500">Created</p>
                      <p>{new Date(selectedCampaign.createdAt).toLocaleString()}</p>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-4 gap-4 p-4 bg-zinc-50 rounded-lg">
                    <div className="text-center">
                      <p className="text-2xl font-bold">{selectedCampaign.sentCount.toLocaleString()}</p>
                      <p className="text-sm text-zinc-500">Sent</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-600">{selectedCampaign.openCount.toLocaleString()}</p>
                      <p className="text-sm text-zinc-500">Opens</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-emerald-600">{selectedCampaign.clickCount.toLocaleString()}</p>
                      <p className="text-sm text-zinc-500">Clicks</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-red-600">{selectedCampaign.bounceCount.toLocaleString()}</p>
                      <p className="text-sm text-zinc-500">Bounces</p>
                    </div>
                  </div>

                  {/* Email Preview */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-zinc-500">Email Preview</p>
                    <div className="border rounded-lg p-4 bg-white max-h-[300px] overflow-y-auto">
                      <div dangerouslySetInnerHTML={{ __html: selectedCampaign.htmlContent }} />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter>
            {editMode ? (
              <>
                <Button variant="outline" onClick={() => setEditMode(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveEdit} disabled={isLoading}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save Changes
                </Button>
              </>
            ) : (
              <>
                {selectedCampaign?.status.toUpperCase() === "DRAFT" && (
                  <Button variant="outline" onClick={() => setEditMode(true)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                )}
                <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>
                  Close
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{campaignToDelete?.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCampaign}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Send Confirmation Dialog */}
      <AlertDialog open={showSendDialog} onOpenChange={setShowSendDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isResend ? "Resend Campaign" : "Send Campaign Now"}</AlertDialogTitle>
            <AlertDialogDescription>
              {isResend ? (
                <>
                  Are you sure you want to <strong>resend</strong> &quot;{campaignToSend?.name}&quot; to {campaignToSend?.recipients.toLocaleString()} recipients? This will send emails to all recipients again, including those who already received it.
                </>
              ) : (
                <>
                  Are you sure you want to send &quot;{campaignToSend?.name}&quot; to {campaignToSend?.recipients.toLocaleString()} recipients? This action cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSendCampaign}>
              <Send className="mr-2 h-4 w-4" />
              {isResend ? "Resend Now" : "Send Now"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Helper component for campaign status badges
function CampaignStatusBadge({ status }: { status: string }) {
  switch (status.toUpperCase()) {
    case "SENT":
      return (
        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
          <CheckCircle className="mr-1 h-3 w-3" />
          Sent
        </Badge>
      );
    case "SCHEDULED":
      return (
        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
          <Clock className="mr-1 h-3 w-3" />
          Scheduled
        </Badge>
      );
    case "SENDING":
      return (
        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
          <Play className="mr-1 h-3 w-3" />
          Sending
        </Badge>
      );
    case "DRAFT":
      return (
        <Badge variant="outline">
          <AlertCircle className="mr-1 h-3 w-3" />
          Draft
        </Badge>
      );
    case "FAILED":
      return (
        <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
          <AlertCircle className="mr-1 h-3 w-3" />
          Failed
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

// Helper component to show audience type based on campaign name
function AudienceBadge({ name }: { name: string }) {
  const nameLower = name.toLowerCase();

  if (nameLower.includes("subscriber") || nameLower.includes("newsletter")) {
    return (
      <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
        <Users className="mr-1 h-3 w-3" />
        Subscribers
      </Badge>
    );
  }
  if (nameLower.includes("backer")) {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
        <UserCheck className="mr-1 h-3 w-3" />
        Backers
      </Badge>
    );
  }
  if (nameLower.includes("creator")) {
    return (
      <Badge className="bg-violet-100 text-violet-700 hover:bg-violet-100">
        <Layers className="mr-1 h-3 w-3" />
        Creators
      </Badge>
    );
  }
  if (nameLower.includes("retailer")) {
    return (
      <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
        <Store className="mr-1 h-3 w-3" />
        Retailers
      </Badge>
    );
  }
  return (
    <Badge variant="outline">
      <Users className="mr-1 h-3 w-3" />
      General
    </Badge>
  );
}
