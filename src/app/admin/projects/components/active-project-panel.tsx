"use client";

import { apiFetch } from "@/lib/fetch-utils";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  CheckCircle,
  Eye,
  Zap,
  AlertCircle,
  Power,
  RefreshCw,
  CreditCard,
  Loader2,
  FileSearch,
  Hash,
  Link2,
  CalendarClock,
  Trash2,
  ArrowRightLeft,
} from "lucide-react";
import { Project } from "./types";
import { formatDuration } from "./utils";
import { SetVanityUrlDialog, AdjustEndDateDialog } from "./dialogs";

interface ActiveProjectPanelProps {
  project: Project | null;
  onMakeLive: () => void;
  onDeactivate: () => void;
  onStatsUpdated?: (newStats: { currentAmount: number; backerCount: number }) => void;
}

export function ActiveProjectPanel({
  project,
  onMakeLive,
  onDeactivate,
  onStatsUpdated,
}: ActiveProjectPanelProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [isProcessingPledges, setIsProcessingPledges] = useState(false);
  const [processMessage, setProcessMessage] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [backfillMessage, setBackfillMessage] = useState<string | null>(null);
  const [isReconciling, setIsReconciling] = useState(false);
  const [reconcileMessage, setReconcileMessage] = useState<string | null>(null);
  const [isDeletingAbandoned, setIsDeletingAbandoned] = useState(false);
  const [deleteAbandonedMessage, setDeleteAbandonedMessage] = useState<string | null>(null);
  const [isMigratingToDc, setIsMigratingToDc] = useState(false);
  const [migrateDcMessage, setMigrateDcMessage] = useState<string | null>(null);
  const [showVanityUrlDialog, setShowVanityUrlDialog] = useState(false);
  const [showEndDateDialog, setShowEndDateDialog] = useState(false);
  const [currentVanityUrl, setCurrentVanityUrl] = useState<string | null>(null);
  const [currentEndDate, setCurrentEndDate] = useState<string | null>(null);

  // Clear messages and update vanity URL when project changes
  useEffect(() => {
    setSyncMessage(null);
    setProcessMessage(null);
    setVerifyMessage(null);
    setBackfillMessage(null);
    setReconcileMessage(null);
    setDeleteAbandonedMessage(null);
    setMigrateDcMessage(null);
    setCurrentVanityUrl(project?.creator?.vanityUrl || null);
    setCurrentEndDate(project?.endDate || null);
  }, [project?.id, project?.creator?.vanityUrl, project?.endDate]);

  const handleMigrateToDc = async (dryRun: boolean) => {
    if (!project) return;
    if (!dryRun) {
      const ok = window.confirm(
        `Permanently migrate "${project.title}" from Mentom Payments to Divinity Payments?\n\n` +
          `• Flips Project.paymentProcessor to DIVINITYCOIN (if not already)\n` +
          `• Flips every PENDING / FAILED / COMPLETED NMI pledge to DIVINITYCOIN + status PENDING\n` +
          `• Clears NMI-specific fields on those pledges\n` +
          `• Marks already-counted pledges so the DC webhook doesn't re-bump backerCount, currentAmount, or reward slots\n` +
          `• Emails each backer a link to re-enter their card on DC\n\n` +
          `Note: COMPLETED NMI pledges are included because PaymentCloud was decommissioned — those charges were reversed back to the backer's card even though our DB marked them COMPLETED.\n\n` +
          `Campaign totals stay where they are — no double-count, no down-count. Idempotent. Continue?`
      );
      if (!ok) return;
    }
    setIsMigratingToDc(true);
    setMigrateDcMessage(null);
    try {
      const url = `/api/admin/projects/${project.id}/migrate-to-dc${dryRun ? "?dryRun=true" : ""}`;
      const response = await apiFetch(url, { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        setMigrateDcMessage(`Error: ${data.error || "Migration failed"}`);
        return;
      }
      if (dryRun) {
        const alreadyInTotals = data.alreadyInTotals ?? 0;
        const notYetInTotals = data.notYetInTotals ?? 0;
        const alreadyMigratedNeedingEmail = data.alreadyMigratedNeedingEmail ?? 0;
        setMigrateDcMessage(
          `Dry run — would migrate ${data.pledgesToMigrate} pledges` +
            (data.projectWillFlip ? " and flip the project to DC" : " (project already DC)") +
            `. ${alreadyInTotals} already counted in campaign totals (no change on DC payment), ` +
            `${notYetInTotals} not yet counted (will add to totals when paid). ` +
            (alreadyMigratedNeedingEmail > 0
              ? `${alreadyMigratedNeedingEmail} previously-migrated pledge${alreadyMigratedNeedingEmail === 1 ? "" : "s"} would be re-emailed. `
              : "") +
            `Emails would go to ${data.emails?.length || 0} backers.`
        );
      } else {
        const alreadyInTotals = data.alreadyInTotals ?? 0;
        const notYetInTotals = data.notYetInTotals ?? 0;
        const alreadyMigratedEmailed = data.alreadyMigratedEmailed ?? 0;
        setMigrateDcMessage(
          `Migrated ${data.pledgesMigrated} pledges` +
            (data.projectFlipped ? ", flipped project to DC" : "") +
            `. ${alreadyInTotals} preserved in campaign totals, ${notYetInTotals} will join totals when paid. ` +
            (alreadyMigratedEmailed > 0
              ? `${alreadyMigratedEmailed} previously-migrated pledge${alreadyMigratedEmailed === 1 ? "" : "s"} re-emailed. `
              : "") +
            `Emails sent: ${data.emailResults?.sent || 0}, failed: ${data.emailResults?.failed || 0}.`
        );
      }
    } catch (e) {
      setMigrateDcMessage(`Error: ${e instanceof Error ? e.message : "Migration request failed"}`);
    } finally {
      setIsMigratingToDc(false);
    }
  };

  const handleProcessPledges = async () => {
    if (!project) return;

    setIsProcessingPledges(true);
    setProcessMessage(null);

    try {
      const response = await apiFetch(`/api/admin/projects/${project.id}/process-pledges`, {
        method: "POST",
        
      });

      const data = await response.json();

      if (response.ok) {
        if (data.results.total === 0) {
          setProcessMessage("No pending pledges to process");
        } else if (data.results.reconciled !== undefined) {
          // DivinityCoin response format
          setProcessMessage(`Processed ${data.results.total} pledges: ${data.results.reconciled} reconciled to COMPLETED, ${data.results.abandoned} abandoned carts`);
        } else {
          setProcessMessage(`Processed ${data.results.successful}/${data.results.total} pledges successfully`);
        }
      } else {
        setProcessMessage(`Error: ${data.error || "Failed to process pledges"}`);
      }
    } catch {
      setProcessMessage("Error: Network request failed");
    } finally {
      setIsProcessingPledges(false);
    }
  };

  const handleSyncStats = async () => {
    if (!project) return;

    setIsSyncing(true);
    setSyncMessage(null);

    try {
      const response = await apiFetch(`/api/projects/${project.id}/sync-stats`, {
        method: "POST",
        
      });

      const data = await response.json();

      if (response.ok) {
        setSyncMessage(`Synced: $${Number(data.currentAmount).toLocaleString()} from ${data.backerCount} backers`);
        onStatsUpdated?.({ currentAmount: data.currentAmount, backerCount: data.backerCount });
      } else {
        setSyncMessage(`Error: ${data.error || "Failed to sync"}`);
      }
    } catch {
      setSyncMessage("Error: Network request failed");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleVerifyPayments = async () => {
    if (!project) return;

    setIsVerifying(true);
    setVerifyMessage(null);

    try {
      const response = await apiFetch(`/api/admin/projects/${project.id}/process-pledges`, {
        method: "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({ action: "verify" }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.results.total === 0) {
          setVerifyMessage("No pending immediate-charge pledges to verify");
        } else if (data.results.abandoned !== undefined) {
          // DivinityCoin response format
          setVerifyMessage(
            `Verified ${data.results.verified}/${data.results.total}: ${data.results.alreadySucceeded} completed, ${data.results.abandoned} abandoned carts`
          );
          if (data.results.alreadySucceeded > 0) {
            handleSyncStats();
          }
        } else {
          setVerifyMessage(
            `Verified ${data.results.verified}/${data.results.total}: ${data.results.alreadySucceeded} completed, ${data.results.failed} failed`
          );
          // Refresh stats if any pledges were updated
          if (data.results.alreadySucceeded > 0) {
            handleSyncStats();
          }
        }
      } else {
        setVerifyMessage(`Error: ${data.error || "Failed to verify payments"}`);
      }
    } catch {
      setVerifyMessage("Error: Network request failed");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleBackfillBackerNumbers = async () => {
    if (!project) return;

    setIsBackfilling(true);
    setBackfillMessage(null);

    try {
      const response = await apiFetch(`/api/admin/projects/${project.id}/backfill-backer-numbers`, {
        method: "POST",
        
      });

      const data = await response.json();

      if (response.ok) {
        setBackfillMessage(
          data.updated > 0
            ? `Assigned backer #s to ${data.updated} pledges (${data.alreadyHad} already had)`
            : "All pledges already have backer numbers"
        );
      } else {
        setBackfillMessage(`Error: ${data.error || "Failed to backfill"}`);
      }
    } catch {
      setBackfillMessage("Error: Network request failed");
    } finally {
      setIsBackfilling(false);
    }
  };

  const handleReconcilePledges = async () => {
    if (!project) return;

    setIsReconciling(true);
    setReconcileMessage(null);

    try {
      const response = await apiFetch(`/api/admin/reconcile-pledges`, {
        method: "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({ projectId: project.id, applyFixes: true }),
      });

      const data = await response.json();

      if (response.ok) {
        const result = data.results?.[0];
        if (!result) {
          setReconcileMessage("No pledges found for this project");
        } else if (!result.discrepancy.hasIssues) {
          setReconcileMessage("All pledges are in sync with Stripe");
        } else {
          const issues = [];
          if (result.details.statusMismatch.length > 0) {
            issues.push(`${result.details.statusMismatch.length} status fixes`);
          }
          if (result.details.missingInDb.length > 0) {
            issues.push(`${result.details.missingInDb.length} missing pledges`);
          }
          setReconcileMessage(`Reconciled: ${issues.join(", ") || "fixes applied"}`);
          // Refresh stats after reconciliation
          handleSyncStats();
        }
      } else {
        setReconcileMessage(`Error: ${data.error || "Failed to reconcile"}`);
      }
    } catch {
      setReconcileMessage("Error: Network request failed");
    } finally {
      setIsReconciling(false);
    }
  };

  const handleDeleteAbandonedCarts = async () => {
    if (!project) return;

    if (!confirm(`Are you sure you want to permanently delete all abandoned cart pledges for "${project.title}"? This cannot be undone.`)) {
      return;
    }

    setIsDeletingAbandoned(true);
    setDeleteAbandonedMessage(null);

    try {
      const response = await apiFetch(`/api/admin/projects/${project.id}/process-pledges`, {
        method: "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({ action: "delete-abandoned" }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.results.total === 0) {
          setDeleteAbandonedMessage("No pending pledges found to clean up");
        } else {
          setDeleteAbandonedMessage(
            `Permanently deleted ${data.results.deleted} abandoned carts${data.results.skipped > 0 ? `, skipped ${data.results.skipped} with payment evidence` : ""}`
          );
        }
      } else {
        setDeleteAbandonedMessage(`Error: ${data.error || "Failed to delete abandoned carts"}`);
      }
    } catch {
      setDeleteAbandonedMessage("Error: Network request failed");
    } finally {
      setIsDeletingAbandoned(false);
    }
  };

  if (!project) {
    return (
      <Card className="h-[400px] flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <Zap className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
          <p className="font-medium">Select a campaign to manage</p>
          <p className="text-sm">Click on a campaign to see details and actions</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="h-fit sticky top-6">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle>{project.title}</CardTitle>
              <Badge className={
                project.status === "LIVE" ? "bg-emerald-600" :
                project.status === "FUNDED" ? "bg-blue-600" :
                project.status === "FAILED" ? "bg-red-600" :
                "bg-amber-600"
              }>
                {project.status}
              </Badge>
            </div>
            <CardDescription>{project.subtitle || "No subtitle"}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Accordion type="multiple" defaultValue={["overview", "funding"]} className="w-full">
          {/* Overview */}
          <AccordionItem value="overview">
            <AccordionTrigger className="px-4">Campaign Overview</AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Goal</p>
                  <p className="font-semibold">${Number(project.goalAmount).toLocaleString()} {project.currency}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Raised</p>
                  <p className="font-semibold text-emerald-600">${Number(project.currentAmount).toLocaleString()}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Backers</p>
                  <p className="font-semibold">{project.backerCount}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Duration</p>
                  <p className="font-semibold">{formatDuration(project)}</p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Creator Info */}
          <AccordionItem value="creator">
            <AccordionTrigger className="px-4">Creator Information</AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground">
                  {(project.creator.name || project.creator.email).charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{project.creator.name || "No name"}</p>
                    {project.creator.emailVerified ? (
                      <Badge className="bg-blue-100 text-blue-700">
                        <CheckCircle className="mr-1 h-3 w-3" /> Verified
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <AlertCircle className="mr-1 h-3 w-3" /> Unverified
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{project.creator.email}</p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Action Buttons for Active Campaigns */}
        <div className="p-4 border-t bg-muted/50 dark:bg-zinc-800/50">
          <div className="flex items-center gap-2 mb-2">
            <Button variant="outline" className="flex-1" asChild>
              <a href={project.creator.vanityUrl ? `/projects/${project.creator.vanityUrl}/${project.slug}` : `/projects/${project.slug}`} target="_blank" rel="noopener noreferrer">
                <Eye className="mr-2 h-4 w-4" />
                View Campaign
              </a>
            </Button>
            <Button
              variant="outline"
              onClick={handleSyncStats}
              disabled={isSyncing}
              className="flex-1"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
              {isSyncing ? "Syncing..." : "Sync Stats"}
            </Button>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <Button variant="outline" className="flex-1" asChild>
              <a href={`/api/admin/projects/${project.id}/process-pledges`} target="_blank" rel="noopener noreferrer">
                <FileSearch className="mr-2 h-4 w-4" />
                Diagnose
              </a>
            </Button>
            <Button
              variant="outline"
              onClick={handleVerifyPayments}
              disabled={isVerifying}
              className="flex-1"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isVerifying ? "animate-spin" : ""}`} />
              {isVerifying ? "Verifying..." : "Verify Payments"}
            </Button>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <Button
              variant="outline"
              onClick={handleReconcilePledges}
              disabled={isReconciling}
              className="flex-1"
            >
              {isReconciling ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {isReconciling ? "Reconciling..." : "Reconcile Pledges"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowEndDateDialog(true)}
              className="flex-1"
            >
              <CalendarClock className="mr-2 h-4 w-4" />
              Adjust End Date
            </Button>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <Button
              variant="outline"
              onClick={handleBackfillBackerNumbers}
              disabled={isBackfilling}
              className="flex-1"
            >
              {isBackfilling ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Hash className="mr-2 h-4 w-4" />
              )}
              {isBackfilling ? "Assigning..." : "Assign Backer #s"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowVanityUrlDialog(true)}
              className="flex-1"
            >
              <Link2 className="mr-2 h-4 w-4" />
              {currentVanityUrl ? "Edit Vanity URL" : "Set Vanity URL"}
            </Button>
          </div>
          {currentVanityUrl && (
            <p className="text-xs text-muted-foreground mb-2">
              Vanity URL: <code className="bg-muted dark:bg-zinc-800 px-1 rounded">{currentVanityUrl}</code>
            </p>
          )}
          {backfillMessage && (
            <p className={`text-sm mb-2 ${backfillMessage.startsWith("Error") ? "text-red-600" : "text-emerald-600"}`}>
              {backfillMessage}
            </p>
          )}
          {verifyMessage && (
            <p className={`text-sm mb-2 ${verifyMessage.startsWith("Error") ? "text-red-600" : "text-emerald-600"}`}>
              {verifyMessage}
            </p>
          )}
          {reconcileMessage && (
            <p className={`text-sm mb-2 ${reconcileMessage.startsWith("Error") ? "text-red-600" : "text-emerald-600"}`}>
              {reconcileMessage}
            </p>
          )}
          {syncMessage && (
            <p className={`text-sm mb-4 ${syncMessage.startsWith("Error") ? "text-red-600" : "text-emerald-600"}`}>
              {syncMessage}
            </p>
          )}

          {/* Process Pledges Button - shows for funded projects */}
          {Number(project.currentAmount) >= Number(project.goalAmount) && (
            <div className="mb-4">
              <Button
                variant="default"
                onClick={handleProcessPledges}
                disabled={isProcessingPledges}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {isProcessingPledges ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CreditCard className="mr-2 h-4 w-4" />
                )}
                {isProcessingPledges
                  ? "Processing..."
                  : project.paymentProcessor === "DIVINITYCOIN"
                    ? "Reconcile Pending DC Pledges"
                    : "Process Pending Pledges"}
              </Button>
              {processMessage && (
                <p className={`text-sm mt-2 ${processMessage.startsWith("Error") ? "text-red-600" : "text-emerald-600"}`}>
                  {processMessage}
                </p>
              )}
            </div>
          )}

          {/* Migrate to DivinityCoin — shows for projects on Mentom
              (NMI, primary case) AND for projects already flipped to
              DC (so leftover NMI pledges can still be migrated after
              the project record itself has moved). Idempotent; the
              dry-run path makes it safe to surface broadly — if there
              are no NMI pledges left, it just reports 0 migrated.
              String-cast the enum check so the local Project type can
              drop NMI from its union (Prisma still has it for legacy
              DB rows). */}
          {(String(project.paymentProcessor) === "NMI" || String(project.paymentProcessor) === "DIVINITYCOIN") && (
            <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50/60 dark:bg-amber-950/30 dark:border-amber-800 p-3">
              <p className="text-sm font-medium text-amber-900 dark:text-amber-200 mb-1">
                {String(project.paymentProcessor) === "NMI"
                  ? "On Mentom Payments — needs migration"
                  : "Migrate leftover Mentom (NMI) pledges"}
              </p>
              <p className="text-xs text-amber-800 dark:text-amber-300 mb-3">
                Re-stages every NMI pledge (PENDING / FAILED / COMPLETED) on DivinityCoin and emails each backer a link to re-enter their card. PaymentCloud was decommissioned, so even &quot;COMPLETED&quot; NMI charges were reversed back to the backer. Always test with Dry Run first.
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleMigrateToDc(true)}
                  disabled={isMigratingToDc}
                  className="flex-1"
                >
                  {isMigratingToDc ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileSearch className="mr-2 h-4 w-4" />
                  )}
                  Dry Run
                </Button>
                <Button
                  onClick={() => handleMigrateToDc(false)}
                  disabled={isMigratingToDc}
                  className="flex-1 bg-amber-600 hover:bg-amber-700"
                >
                  {isMigratingToDc ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRightLeft className="mr-2 h-4 w-4" />
                  )}
                  Migrate to DivinityCoin
                </Button>
              </div>
              {migrateDcMessage && (
                <p className={`text-sm mt-2 ${migrateDcMessage.startsWith("Error") ? "text-red-600" : "text-emerald-700 dark:text-emerald-400"}`}>
                  {migrateDcMessage}
                </p>
              )}
            </div>
          )}

          {/* Delete Abandoned Carts Button */}
          <div className="mb-4">
            <Button
              variant="destructive"
              onClick={handleDeleteAbandonedCarts}
              disabled={isDeletingAbandoned}
              className="w-full"
            >
              {isDeletingAbandoned ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              {isDeletingAbandoned ? "Deleting..." : "Delete Abandoned Carts"}
            </Button>
            {deleteAbandonedMessage && (
              <p className={`text-sm mt-2 ${deleteAbandonedMessage.startsWith("Error") ? "text-red-600" : "text-emerald-600"}`}>
                {deleteAbandonedMessage}
              </p>
            )}
          </div>

          {(project.status === "LIVE" || project.status === "APPROVED") && (
            <div className="flex items-center gap-2">
              {project.status === "APPROVED" ? (
                <Button
                  onClick={onMakeLive}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                >
                  <Zap className="mr-2 h-4 w-4" />
                  Make Live
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  onClick={onDeactivate}
                  className="flex-1"
                >
                  <Power className="mr-2 h-4 w-4" />
                  Deactivate
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>

      {/* Set Vanity URL Dialog */}
      <SetVanityUrlDialog
        open={showVanityUrlDialog}
        onOpenChange={setShowVanityUrlDialog}
        creatorId={project.creator.id}
        creatorName={project.creator.name}
        currentVanityUrl={currentVanityUrl}
        projectSlug={project.slug}
        projectTitle={project.title}
        onSuccess={(newVanityUrl) => setCurrentVanityUrl(newVanityUrl)}
      />

      {/* Adjust End Date Dialog */}
      <AdjustEndDateDialog
        open={showEndDateDialog}
        onOpenChange={setShowEndDateDialog}
        projectId={project.id}
        projectTitle={project.title}
        currentEndDate={currentEndDate}
        onSuccess={(newEndDate) => setCurrentEndDate(newEndDate)}
      />
    </Card>
  );
}
