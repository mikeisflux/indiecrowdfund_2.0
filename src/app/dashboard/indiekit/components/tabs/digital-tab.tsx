"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Eye,
  Mail,
  FileText,
  Download,
  Send,
  Trash2,
  HelpCircle,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getCSRFHeaders } from "@/lib/csrf";
import type { DigitalFile, DistributionRule, FulfillmentStats } from "../../types";

interface DigitalTabProps {
  stats: FulfillmentStats | null;
  digitalFiles: DigitalFile[];
  distributionRules: DistributionRule[];
  onOpenUploadDialog: () => void;
  onOpenDistributionDialog: () => void;
  projectId?: string;
  onRefresh?: () => void;
}

export function DigitalTab({
  stats,
  digitalFiles,
  distributionRules,
  onOpenUploadDialog,
  onOpenDistributionDialog,
  projectId,
  onRefresh,
}: DigitalTabProps) {
  const [isBlastingEmails, setIsBlastingEmails] = useState(false);
  const [isStartingDistributions, setIsStartingDistributions] = useState(false);
  const [refreshingRuleId, setRefreshingRuleId] = useState<string | null>(null);
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);
  const [distributingFileId, setDistributingFileId] = useState<string | null>(null);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const [confirmDeleteRule, setConfirmDeleteRule] = useState<DistributionRule | null>(null);
  const [confirmDeleteFile, setConfirmDeleteFile] = useState<DigitalFile | null>(null);
  const [showViewDownloads, setShowViewDownloads] = useState(false);

  const handleBlastNotifications = async () => {
    if (!projectId) {
      toast.error("No project selected");
      return;
    }

    setIsBlastingEmails(true);
    try {
      const res = await fetch("/api/creator/indiekit/digital", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          projectId,
          action: "blast_notifications",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send notifications");
      }

      toast.success(`Sending ${data.count || stats?.digitalDownloads || 0} notification emails`);
      onRefresh?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send notifications");
    } finally {
      setIsBlastingEmails(false);
    }
  };

  const handleStartAllDistributions = async () => {
    if (!projectId) {
      toast.error("No project selected");
      return;
    }

    const pendingRules = distributionRules.filter(r => r.status === "not_started");
    if (pendingRules.length === 0) {
      toast.info("No distributions to start");
      return;
    }

    setIsStartingDistributions(true);
    try {
      const res = await fetch("/api/creator/indiekit/digital", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          projectId,
          action: "start_all_distributions",
          ruleIds: pendingRules.map(r => r.id),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to start distributions");
      }

      toast.success(`Started ${pendingRules.length} distribution${pendingRules.length !== 1 ? 's' : ''}`);
      onRefresh?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to start distributions");
    } finally {
      setIsStartingDistributions(false);
    }
  };

  const handleRefreshRule = async (ruleId: string) => {
    if (!projectId) return;

    setRefreshingRuleId(ruleId);
    try {
      const res = await fetch(`/api/creator/indiekit/digital?projectId=${projectId}&ruleId=${ruleId}`, {
        headers: getCSRFHeaders(),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to refresh status");
      }

      toast.success("Status refreshed");
      onRefresh?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to refresh status");
    } finally {
      setRefreshingRuleId(null);
    }
  };

  const handleDeleteRule = async (rule: DistributionRule) => {
    if (!projectId) return;

    setDeletingRuleId(rule.id);
    try {
      const res = await fetch(`/api/creator/indiekit/digital?projectId=${projectId}&ruleId=${rule.id}`, {
        method: "DELETE",
        headers: getCSRFHeaders(),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete rule");
      }

      toast.success(`Deleted rule "${rule.name}"`);
      setConfirmDeleteRule(null);
      onRefresh?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete rule");
    } finally {
      setDeletingRuleId(null);
    }
  };

  const handleDistributeFile = async (file: DigitalFile) => {
    if (!projectId) {
      toast.error("No project selected");
      return;
    }

    setDistributingFileId(file.id);
    try {
      const res = await fetch("/api/creator/indiekit/digital", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          projectId,
          action: "distribute_file",
          fileId: file.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to distribute file");
      }

      toast.success(`Distributing "${file.name}" to ${file.totalEligible - file.distributedTo} backers`);
      onRefresh?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to distribute file");
    } finally {
      setDistributingFileId(null);
    }
  };

  const handleDeleteFile = async (file: DigitalFile) => {
    if (!projectId) return;

    setDeletingFileId(file.id);
    try {
      const res = await fetch(`/api/creator/digital-files?fileId=${file.id}`, {
        method: "DELETE",
        headers: getCSRFHeaders(),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete file");
      }

      toast.success(`Deleted "${file.name}"`);
      setConfirmDeleteFile(null);
      onRefresh?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete file");
    } finally {
      setDeletingFileId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Download className="h-6 w-6 text-teal-600" />
          <div>
            <h3 className="text-lg font-semibold">Digital Downloads</h3>
            <p className="text-sm text-muted-foreground">Manage and distribute digital rewards</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => toast.info("Documentation for digital downloads is coming soon.")}>
            Learn More
          </Button>
          <Button variant="outline" onClick={() => setShowViewDownloads(true)}>
            <Eye className="h-4 w-4 mr-2" />
            View Downloads ({digitalFiles.length})
          </Button>
          <Button onClick={onOpenUploadDialog} className="bg-teal-600 hover:bg-teal-700">
            <Plus className="h-4 w-4 mr-2" />
            Create
          </Button>
        </div>
      </div>

      {/* Blast Notification Banner */}
      <Card className="bg-muted/50">
        <CardContent className="py-6 text-center">
          <p className="text-sm text-muted-foreground mb-4">
            Send email notifications to backers receiving digital downloads.
          </p>
          <Button
            className="bg-teal-600 hover:bg-teal-700"
            onClick={handleBlastNotifications}
            disabled={isBlastingEmails || (stats?.digitalDownloads || 0) === 0}
          >
            {isBlastingEmails ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Blast {stats?.digitalDownloads || 0} Notification Emails
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Distribution Rules */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Distribution Rules</CardTitle>
            <CardDescription>Configure automatic file distribution based on order contents</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" title="Distribution rules help you automatically send files to backers based on their order contents.">
              <HelpCircle className="h-4 w-4" />
            </Button>
            <Button onClick={onOpenDistributionDialog} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Create Rule
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Process Distribution Button - only show when there are pending rules */}
          {distributionRules.filter(r => r.status === "not_started").length > 0 && (
            <div className="mb-6 p-4 bg-teal-50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-teal-900 dark:text-teal-100">Ready to distribute</h4>
                  <p className="text-sm text-teal-700 dark:text-teal-300">
                    {distributionRules.filter(r => r.status === "not_started").length} distribution rule{distributionRules.filter(r => r.status === "not_started").length !== 1 ? 's' : ''} ready to process
                  </p>
                </div>
                <Button
                  className="bg-teal-600 hover:bg-teal-700"
                  disabled={isStartingDistributions}
                  onClick={handleStartAllDistributions}
                >
                  {isStartingDistributions ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Process Distribution
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60%]">Distribution Rule</TableHead>
                <TableHead>Distributed</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {distributionRules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{rule.name}</p>
                      <p className="text-sm text-muted-foreground">
                        If <Badge variant="secondary" className="mx-1">{rule.triggerProduct}</Badge>
                        is in the order, distribute {rule.distributeFile}.
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {rule.requiresPayment ? "Lockdown/Payment required." : "Lockdown/Payment is not required."}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {rule.distributedCount} files
                  </TableCell>
                  <TableCell>
                    <div>
                      <Badge className={cn(
                        rule.status === "started" && "bg-green-100 text-green-700",
                        rule.status === "not_started" && "bg-gray-100 text-gray-700",
                        rule.status === "completed" && "bg-blue-100 text-blue-700"
                      )}>
                        {rule.status === "started" ? "Started" : rule.status === "completed" ? "Completed" : "Not Started"}
                      </Badge>
                      {rule.startedAt && (
                        <p className="text-xs text-muted-foreground mt-1">{rule.startedAt}</p>
                      )}
                      {rule.status === "started" && (
                        <Button
                          variant="link"
                          size="sm"
                          className="text-teal-600 p-0 h-auto mt-1"
                          onClick={() => handleRefreshRule(rule.id)}
                          disabled={refreshingRuleId === rule.id}
                        >
                          {refreshingRuleId === rule.id ? "Refreshing..." : "Refresh"}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setConfirmDeleteRule(rule)}
                      disabled={deletingRuleId === rule.id}
                    >
                      {deletingRuleId === rule.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {distributionRules.length === 0 && (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold mb-2">No distribution rules</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create rules to automatically distribute files to eligible backers
              </p>
              <Button onClick={onOpenDistributionDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Create Distribution Rule
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Uploaded Files */}
      <Card>
        <CardHeader>
          <CardTitle>Uploaded Files</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {digitalFiles.map((file) => (
              <div key={file.id} className="flex items-start justify-between rounded-lg border p-4">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-lg bg-purple-100 flex items-center justify-center">
                    <FileText className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <h4 className="font-medium">{file.name}</h4>
                    <p className="text-sm text-muted-foreground">{file.size} · {file.type}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Uploaded {file.uploadedAt}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">
                    {file.distributedTo}/{file.totalEligible} distributed
                  </p>
                  <Progress
                    value={(file.distributedTo / file.totalEligible) * 100}
                    className="h-2 w-32 mt-2"
                  />
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDistributeFile(file)}
                      disabled={distributingFileId === file.id || file.distributedTo >= file.totalEligible}
                    >
                      {distributingFileId === file.id ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Distributing...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Distribute
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setConfirmDeleteFile(file)}
                      disabled={deletingFileId === file.id}
                    >
                      {deletingFileId === file.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ))}

            {digitalFiles.length === 0 && (
              <div className="text-center py-12">
                <Download className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold mb-2">No digital files yet</h3>
                <p className="text-sm text-muted-foreground">
                  Use the <span className="font-medium">Create</span> button above to upload files for distribution.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* View Downloads Dialog */}
      <Dialog open={showViewDownloads} onOpenChange={setShowViewDownloads}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Digital Downloads</DialogTitle>
            <DialogDescription>
              All uploaded digital files for distribution
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto space-y-3">
            {digitalFiles.map((file) => (
              <div key={file.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-purple-600" />
                  <div>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{file.size} · {file.type}</p>
                  </div>
                </div>
                <div className="text-right text-sm">
                  <p>{file.distributedTo}/{file.totalEligible} distributed</p>
                </div>
              </div>
            ))}
            {digitalFiles.length === 0 && (
              <p className="text-center text-muted-foreground py-8">No files uploaded yet</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowViewDownloads(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Rule Dialog */}
      <Dialog open={!!confirmDeleteRule} onOpenChange={(open) => !open && setConfirmDeleteRule(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Delete Distribution Rule?
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{confirmDeleteRule?.name}&quot;?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteRule(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmDeleteRule && handleDeleteRule(confirmDeleteRule)}
              disabled={deletingRuleId === confirmDeleteRule?.id}
            >
              {deletingRuleId === confirmDeleteRule?.id ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete File Dialog */}
      <Dialog open={!!confirmDeleteFile} onOpenChange={(open) => !open && setConfirmDeleteFile(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Delete File?
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{confirmDeleteFile?.name}&quot;?
              This will remove the file from all pending distributions.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteFile(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmDeleteFile && handleDeleteFile(confirmDeleteFile)}
              disabled={deletingFileId === confirmDeleteFile?.id}
            >
              {deletingFileId === confirmDeleteFile?.id ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
