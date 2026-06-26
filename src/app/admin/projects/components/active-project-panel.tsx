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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  Star,
  Trash2,
  ArrowRightLeft,
} from "lucide-react";
import { Project } from "./types";
import { formatDuration } from "./utils";
import { SetVanityUrlDialog, AdjustEndDateDialog } from "./dialogs";

// Tooltip-wrapped button. Keeps the JSX in the buttons section
// readable without dozens of nested <TooltipProvider> wrappers.
function ToolButton({
  tooltip,
  children,
  ...rest
}: React.ComponentProps<typeof Button> & { tooltip: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button {...rest}>{children}</Button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs leading-relaxed">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

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
  const [isBackfillingWhopIds, setIsBackfillingWhopIds] = useState(false);
  const [whopBackfillMessage, setWhopBackfillMessage] = useState<string | null>(null);
  const [isRequestingRatings, setIsRequestingRatings] = useState(false);
  const [ratingsMessage, setRatingsMessage] = useState<string | null>(null);
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

  // Dispatch reconciliation to the right backend based on the
  // project's payment processor. Each processor has different
  // failure modes and different APIs for cross-referencing
  // payments back to our DB; the route the button hits is picked
  // automatically.
  const handleReconcilePledges = async () => {
    if (!project) return;

    setIsReconciling(true);
    setReconcileMessage(null);
    const processor = String(project.paymentProcessor || "STRIPE");

    try {
      if (processor === "WHOP") {
        // Whop: list payments via SDK, find ones with no matching
        // Pledge row (orphans). Surfaces email + amount + checkout
        // id so we can manually reconcile each.
        const response = await apiFetch(`/api/admin/reconcile-whop-pledges`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: project.id }),
        });
        const data = await response.json();
        if (!response.ok) {
          setReconcileMessage(`Error: ${data.error || "Failed to reconcile"}`);
          return;
        }
        if (data.orphanCount === 0) {
          setReconcileMessage(
            `Clean: ${data.whopPaidCount} Whop payments match ${data.ourPledgeCount} pledges. No orphans.`
          );
        } else {
          const sample = data.orphans
            .slice(0, 3)
            .map((o: { email?: string; amount?: number }) => `${o.email || "?"} ($${o.amount || 0})`)
            .join(", ");
          setReconcileMessage(
            `${data.orphanCount} orphan${data.orphanCount === 1 ? "" : "s"} ($${data.orphanTotalAmount} total). Sample: ${sample}. Full list in JSON response — check Network tab.`
          );
        }
        return;
      }

      if (processor === "DIVINITYCOIN") {
        // DC: re-runs the verify path (queries DC's API per pledge,
        // marks succeeded ones COMPLETED, deletes abandoned carts).
        const response = await apiFetch(
          `/api/admin/projects/${project.id}/process-pledges`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "verify" }),
          }
        );
        const data = await response.json();
        if (!response.ok) {
          setReconcileMessage(`Error: ${data.error || "Failed to reconcile"}`);
          return;
        }
        const r = data.results;
        if (r.total === 0) {
          setReconcileMessage("All Divinity Payments pledges already settled");
        } else {
          setReconcileMessage(
            `Verified ${r.verified}/${r.total}: ${r.alreadySucceeded} completed, ${r.abandoned} abandoned`
          );
          if (r.alreadySucceeded > 0) handleSyncStats();
        }
        return;
      }

      // STRIPE (legacy) -- cross-references Stripe API against our DB
      const response = await apiFetch(`/api/admin/reconcile-pledges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, applyFixes: true }),
      });
      const data = await response.json();
      if (!response.ok) {
        setReconcileMessage(`Error: ${data.error || "Failed to reconcile"}`);
        return;
      }
      const result = data.results?.[0];
      if (!result) {
        setReconcileMessage("No pledges found for this project");
      } else if (!result.discrepancy.hasIssues) {
        setReconcileMessage(`All ${processor} pledges are in sync`);
      } else {
        const issues = [];
        if (result.details.statusMismatch.length > 0) {
          issues.push(`${result.details.statusMismatch.length} status fixes`);
        }
        if (result.details.missingInDb.length > 0) {
          issues.push(`${result.details.missingInDb.length} missing pledges`);
        }
        setReconcileMessage(`Reconciled: ${issues.join(", ") || "fixes applied"}`);
        handleSyncStats();
      }
    } catch {
      setReconcileMessage("Error: Network request failed");
    } finally {
      setIsReconciling(false);
    }
  };

  // Whop-only: stamp whopPaymentId onto historical pledges that
  // missed it because of the pre-fix webhook race (browser-confirm
  // marked COMPLETED before the webhook stamped the id). First
  // click runs a dry-run preview; second click within the same
  // session (with a confirm prompt) commits.
  // Send the "rate your creator" nudge to this project's already-
  // fulfilled backers who never rated. First click is a dry-run
  // preview; second click commits. Scoped to this project so rollout
  // can go campaign-by-campaign. Idempotent — ratingRequestSentAt
  // dedupes, so re-running only picks up un-emailed backers.
  const handleRequestRatings = async (commit: boolean) => {
    if (!project) return;
    if (commit) {
      const ok = window.confirm(
        `Email a "rate your creator" request to every DELIVERED backer on "${project.title}" who hasn't rated yet?\n\nUnsubscribed backers are skipped automatically. Idempotent — re-running only emails backers who haven't been emailed yet.`
      );
      if (!ok) return;
    }
    setIsRequestingRatings(true);
    setRatingsMessage(null);
    try {
      const response = await apiFetch(`/api/admin/send-rating-request-backlog`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, dryRun: !commit, deliveredOnly: true }),
      });
      const data = await response.json();
      if (!response.ok) {
        setRatingsMessage(`Error: ${data.error || "Failed"}`);
        return;
      }
      if (!commit) {
        setRatingsMessage(
          data.totalOutstanding === 0
            ? "No DELIVERED backers awaiting a rating request — all caught up."
            : `Dry run: ${data.totalOutstanding} DELIVERED backers haven't been asked to rate. Press again to send (batched up to ${data.limit}/run).`
        );
      } else {
        setRatingsMessage(
          `Sent ${data.sent} rating requests (${data.skipped} skipped — unsubscribed / already rated). Re-run for the rest if more remain.`
        );
      }
    } catch {
      setRatingsMessage("Error: Network request failed");
    } finally {
      setIsRequestingRatings(false);
    }
  };

  const handleBackfillWhopIds = async (commit: boolean) => {
    if (!project) return;
    if (commit) {
      const ok = window.confirm(
        `Stamp the Whop payment id onto every pledge on "${project.title}" that's missing one?\n\nThis fixes refund/dispute lookup for existing pledges. Idempotent — safe to re-run.`
      );
      if (!ok) return;
    }
    setIsBackfillingWhopIds(true);
    setWhopBackfillMessage(null);
    try {
      const response = await apiFetch(`/api/admin/backfill-whop-payment-ids`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, dryRun: !commit }),
      });
      const data = await response.json();
      if (!response.ok) {
        setWhopBackfillMessage(`Error: ${data.error || "Backfill failed"}`);
        return;
      }
      if (data.pledgesScanned === 0) {
        setWhopBackfillMessage("No Whop pledges are missing a payment id — already clean.");
        return;
      }
      if (commit) {
        setWhopBackfillMessage(
          `Stamped payment ids on ${data.updated}/${data.pledgesScanned} pledges. ${data.notFound} not found in Whop, ${data.errored} errored.`
        );
      } else {
        setWhopBackfillMessage(
          `Dry run: ${data.pledgesScanned} pledges missing payment id, ${data.pledgesScanned - data.notFound} have a Whop match (would update), ${data.notFound} have no match. Press again to commit.`
        );
      }
    } catch {
      setWhopBackfillMessage("Error: Network request failed");
    } finally {
      setIsBackfillingWhopIds(false);
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
        <TooltipProvider delayDuration={250}>
        <div className="p-4 border-t bg-muted/50 dark:bg-zinc-800/50 space-y-5">

          {/* Processor Badge — every tool below is automatically
              dispatched to the right backend based on this. */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Payment processor:</span>
            <Badge variant="outline" className="font-mono">
              {String(project.paymentProcessor || "STRIPE")}
            </Badge>
          </div>

          {/* ─────────────────────────────────────────────────────────
              Section 1: Campaign Management
              Tools that aren't tied to a specific processor.
          ──────────────────────────────────────────────────────────*/}
          <div>
            <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide mb-2">
              Campaign Management
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <ToolButton
                variant="outline"
                asChild
                tooltip={
                  <>
                    <p className="font-semibold mb-1">View Campaign</p>
                    <p>Opens the public-facing project page in a new tab — what a backer sees.</p>
                  </>
                }
              >
                <a
                  href={project.creator.vanityUrl ? `/projects/${project.creator.vanityUrl}/${project.slug}` : `/projects/${project.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Eye className="mr-2 h-4 w-4" />
                  View Campaign
                </a>
              </ToolButton>

              <ToolButton
                variant="outline"
                onClick={handleSyncStats}
                disabled={isSyncing}
                tooltip={
                  <>
                    <p className="font-semibold mb-1">Sync Stats</p>
                    <p>Recalculates the project&apos;s <code>currentAmount</code> and <code>backerCount</code> directly from the Pledge table. Use after manual SQL fixes, after Reconcile, or whenever the campaign page numbers look off.</p>
                  </>
                }
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                {isSyncing ? "Syncing..." : "Sync Stats"}
              </ToolButton>

              <ToolButton
                variant="outline"
                onClick={() => setShowEndDateDialog(true)}
                tooltip={
                  <>
                    <p className="font-semibold mb-1">Adjust End Date</p>
                    <p>Shift the campaign&apos;s end date forward or back. Useful for extending a campaign that&apos;s about to close, or shortening one that&apos;s stuck open.</p>
                  </>
                }
              >
                <CalendarClock className="mr-2 h-4 w-4" />
                Adjust End Date
              </ToolButton>

              <ToolButton
                variant="outline"
                onClick={handleBackfillBackerNumbers}
                disabled={isBackfilling}
                tooltip={
                  <>
                    <p className="font-semibold mb-1">Assign Backer #s</p>
                    <p>Assigns sequential backer numbers (#1, #2, …) to every COMPLETED pledge that doesn&apos;t have one yet, in chronological order by pledge date. Idempotent — safe to re-run.</p>
                  </>
                }
              >
                {isBackfilling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Hash className="mr-2 h-4 w-4" />}
                {isBackfilling ? "Assigning..." : "Assign Backer #s"}
              </ToolButton>

              <ToolButton
                variant="outline"
                onClick={() => handleRequestRatings(false)}
                disabled={isRequestingRatings}
                tooltip={
                  <>
                    <p className="font-semibold mb-1">Request Ratings (Dry Run)</p>
                    <p>Previews how many DELIVERED backers on this campaign haven&apos;t been asked to rate the creator yet. Sends nothing.</p>
                  </>
                }
              >
                {isRequestingRatings ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSearch className="mr-2 h-4 w-4" />}
                Request Ratings: Preview
              </ToolButton>

              <ToolButton
                variant="default"
                onClick={() => handleRequestRatings(true)}
                disabled={isRequestingRatings}
                className="bg-amber-500 hover:bg-amber-600"
                tooltip={
                  <>
                    <p className="font-semibold mb-1">Send Rating Requests</p>
                    <p>Emails a deep-linked &quot;rate your creator&quot; nudge to every DELIVERED backer on this campaign who hasn&apos;t rated yet. Skips unsubscribed backers. Idempotent (batched up to 200/run) — re-run for the rest. Confirms first.</p>
                  </>
                }
              >
                {isRequestingRatings ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Star className="mr-2 h-4 w-4" />}
                Request Ratings: Send
              </ToolButton>

              <ToolButton
                variant="outline"
                onClick={() => setShowVanityUrlDialog(true)}
                className="col-span-2"
                tooltip={
                  <>
                    <p className="font-semibold mb-1">{currentVanityUrl ? "Edit Vanity URL" : "Set Vanity URL"}</p>
                    <p>The creator&apos;s vanity URL appears in their project link (e.g. <code>/projects/&lt;vanity&gt;/&lt;slug&gt;</code>). Required before launch — set it here if a creator launched before the field was enforced.</p>
                  </>
                }
              >
                <Link2 className="mr-2 h-4 w-4" />
                {currentVanityUrl ? "Edit Vanity URL" : "Set Vanity URL"}
              </ToolButton>
            </div>
            {currentVanityUrl && (
              <p className="text-xs text-muted-foreground mt-2">
                Vanity URL: <code className="bg-muted dark:bg-zinc-800 px-1 rounded">{currentVanityUrl}</code>
              </p>
            )}
            {syncMessage && (
              <p className={`text-sm mt-2 ${syncMessage.startsWith("Error") ? "text-red-600" : "text-emerald-600"}`}>{syncMessage}</p>
            )}
            {backfillMessage && (
              <p className={`text-sm mt-1 ${backfillMessage.startsWith("Error") ? "text-red-600" : "text-emerald-600"}`}>{backfillMessage}</p>
            )}
            {ratingsMessage && (
              <p className={`text-sm mt-1 ${ratingsMessage.startsWith("Error") ? "text-red-600" : "text-emerald-600"}`}>{ratingsMessage}</p>
            )}
          </div>

          {/* ─────────────────────────────────────────────────────────
              Section 2: Payments & Reconciliation
              All processor-aware -- the tool routes to the right
              backend based on project.paymentProcessor automatically.
          ──────────────────────────────────────────────────────────*/}
          <div>
            <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide mb-2">
              Payments &amp; Reconciliation
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <ToolButton
                variant="outline"
                asChild
                tooltip={
                  <>
                    <p className="font-semibold mb-1">Diagnose</p>
                    <p>Opens a JSON dump of every pledge on this project plus its raw status from the payment processor — DC PaymentIntent state, PayPal capture state, Whop payment state, Stripe charge state. Read-only; nothing is modified.</p>
                  </>
                }
              >
                <a href={`/api/admin/projects/${project.id}/process-pledges`} target="_blank" rel="noopener noreferrer">
                  <FileSearch className="mr-2 h-4 w-4" />
                  Diagnose
                </a>
              </ToolButton>

              <ToolButton
                variant="outline"
                onClick={handleVerifyPayments}
                disabled={isVerifying}
                tooltip={
                  <>
                    <p className="font-semibold mb-1">Verify Payments</p>
                    <p>For every PENDING immediate-charge pledge: queries the processor for the actual status. If the payment succeeded but the webhook never ran, the pledge gets flipped to COMPLETED. If it failed/was abandoned, it&apos;s marked accordingly.</p>
                    <p className="mt-1 opacity-75">Runs against <strong>{String(project.paymentProcessor)}</strong>.</p>
                  </>
                }
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isVerifying ? "animate-spin" : ""}`} />
                {isVerifying ? "Verifying..." : "Verify Payments"}
              </ToolButton>

              <ToolButton
                variant="outline"
                onClick={handleReconcilePledges}
                disabled={isReconciling}
                className="col-span-2"
                tooltip={
                  <>
                    <p className="font-semibold mb-1">Reconcile Pledges</p>
                    <p>Cross-references the processor&apos;s payment list against our Pledge table. Finds:</p>
                    <ul className="list-disc list-inside mt-1 space-y-0.5">
                      <li>Pledges marked PENDING that actually succeeded on the processor</li>
                      <li>Pledges marked COMPLETED that don&apos;t actually exist on the processor</li>
                      <li>Processor payments with no matching Pledge row (orphans)</li>
                    </ul>
                    <p className="mt-1 opacity-75">Dispatch by processor — Whop hits the orphan finder, DC re-runs the verify path, Stripe runs full cross-reference.</p>
                  </>
                }
              >
                {isReconciling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                {isReconciling ? "Reconciling..." : `Reconcile Pledges (${String(project.paymentProcessor)})`}
              </ToolButton>
            </div>
            {verifyMessage && (
              <p className={`text-sm mt-2 ${verifyMessage.startsWith("Error") ? "text-red-600" : "text-emerald-600"}`}>{verifyMessage}</p>
            )}
            {reconcileMessage && (
              <p className={`text-sm mt-1 ${reconcileMessage.startsWith("Error") ? "text-red-600" : "text-emerald-600"}`}>{reconcileMessage}</p>
            )}

            {/* Process Pending Pledges -- only relevant once the
                campaign has hit its goal. Same button name, different
                semantics per processor (DC reconciles intent states,
                Stripe captures authorized cards). */}
            {Number(project.currentAmount) >= Number(project.goalAmount) && (
              <ToolButton
                variant="default"
                onClick={handleProcessPledges}
                disabled={isProcessingPledges}
                className="w-full mt-3 bg-blue-600 hover:bg-blue-700"
                tooltip={
                  <>
                    <p className="font-semibold mb-1">Process Pending Pledges</p>
                    <p>Runs the all-pledges settlement pass for this funded campaign:</p>
                    <ul className="list-disc list-inside mt-1 space-y-0.5">
                      <li><strong>Divinity Payments</strong>: re-queries every PENDING PaymentIntent and reconciles to COMPLETED / failed / abandoned.</li>
                      <li><strong>PayPal</strong>: captures every AUTHORIZE pledge that&apos;s still PENDING.</li>
                      <li><strong>Stripe</strong>: captures every authorized card.</li>
                      <li><strong>Whop</strong>: charges happen immediately at checkout, so this just runs the verify path.</li>
                    </ul>
                    <p className="mt-1 opacity-75">Only available once the campaign has hit its goal.</p>
                  </>
                }
              >
                {isProcessingPledges ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
                {isProcessingPledges
                  ? "Processing..."
                  : String(project.paymentProcessor) === "DIVINITYCOIN"
                    ? "Reconcile Pending DC Pledges"
                    : "Process Pending Pledges"}
              </ToolButton>
            )}
            {processMessage && (
              <p className={`text-sm mt-2 ${processMessage.startsWith("Error") ? "text-red-600" : "text-emerald-600"}`}>{processMessage}</p>
            )}

            {/* Whop-specific: backfill historical whopPaymentId
                values. Only shows for WHOP projects since other
                processors don't have this gap. */}
            {String(project.paymentProcessor) === "WHOP" && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <ToolButton
                  variant="outline"
                  onClick={() => handleBackfillWhopIds(false)}
                  disabled={isBackfillingWhopIds}
                  tooltip={
                    <>
                      <p className="font-semibold mb-1">Backfill: Dry Run</p>
                      <p>Preview only. Walks Whop&apos;s payments list and reports how many existing pledges are missing <code>whopPaymentId</code> and how many would get stamped. Writes nothing.</p>
                    </>
                  }
                >
                  {isBackfillingWhopIds ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSearch className="mr-2 h-4 w-4" />}
                  Backfill: Dry Run
                </ToolButton>
                <ToolButton
                  variant="default"
                  onClick={() => handleBackfillWhopIds(true)}
                  disabled={isBackfillingWhopIds}
                  className="bg-blue-600 hover:bg-blue-700"
                  tooltip={
                    <>
                      <p className="font-semibold mb-1">Backfill Whop Payment IDs</p>
                      <p>Stamps the correct <code>whopPaymentId</code> onto every Whop pledge on this project that&apos;s missing one. Fixes refund / dispute / reconciliation lookups that were broken by the pre-fix webhook race. Confirms first. Idempotent.</p>
                    </>
                  }
                >
                  {isBackfillingWhopIds ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  Backfill Payment IDs
                </ToolButton>
              </div>
            )}
            {whopBackfillMessage && (
              <p className={`text-sm mt-2 ${whopBackfillMessage.startsWith("Error") ? "text-red-600" : "text-emerald-600"}`}>{whopBackfillMessage}</p>
            )}
          </div>

          {/* ─────────────────────────────────────────────────────────
              Section 3: Legacy Migration (NMI -> DC)
              Only renders for projects that touched Mentom Payments.
          ──────────────────────────────────────────────────────────*/}
          {(String(project.paymentProcessor) === "NMI" || String(project.paymentProcessor) === "DIVINITYCOIN") && (
            <div className="rounded-lg border border-amber-300 bg-amber-50/60 dark:bg-amber-950/30 dark:border-amber-800 p-3">
              <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200 mb-1">
                {String(project.paymentProcessor) === "NMI"
                  ? "On Mentom Payments — needs migration"
                  : "Migrate leftover Mentom (NMI) pledges"}
              </h4>
              <p className="text-xs text-amber-800 dark:text-amber-300 mb-3">
                PaymentCloud (NMI) was decommissioned. Even &quot;COMPLETED&quot; NMI charges were reversed back to the backer. Re-stages every NMI pledge on Divinity Payments and emails each backer a link to re-enter their card. Always Dry Run first.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <ToolButton
                  variant="outline"
                  onClick={() => handleMigrateToDc(true)}
                  disabled={isMigratingToDc}
                  tooltip={
                    <>
                      <p className="font-semibold mb-1">Dry Run</p>
                      <p>Previews what the migration would do — counts pledges, lists emails, reports whether the project record itself would flip processors. Writes nothing.</p>
                    </>
                  }
                >
                  {isMigratingToDc ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSearch className="mr-2 h-4 w-4" />}
                  Dry Run
                </ToolButton>
                <ToolButton
                  onClick={() => handleMigrateToDc(false)}
                  disabled={isMigratingToDc}
                  className="bg-amber-600 hover:bg-amber-700"
                  tooltip={
                    <>
                      <p className="font-semibold mb-1">Migrate to Divinity Payments</p>
                      <p>Idempotent commit. Flips every NMI pledge&apos;s processor + status, clears NMI fields, preserves campaign totals, emails each backer. Confirms via dialog before running.</p>
                    </>
                  }
                >
                  {isMigratingToDc ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRightLeft className="mr-2 h-4 w-4" />}
                  Migrate to DC
                </ToolButton>
              </div>
              {migrateDcMessage && (
                <p className={`text-sm mt-2 ${migrateDcMessage.startsWith("Error") ? "text-red-600" : "text-emerald-700 dark:text-emerald-400"}`}>
                  {migrateDcMessage}
                </p>
              )}
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────
              Section 4: Danger Zone
              Destructive actions kept visually separate.
          ──────────────────────────────────────────────────────────*/}
          <div className="rounded-lg border border-red-300 dark:border-red-900 bg-red-50/40 dark:bg-red-950/20 p-3">
            <h4 className="text-xs font-semibold uppercase text-red-700 dark:text-red-400 tracking-wide mb-2">
              Danger Zone
            </h4>
            <div className="space-y-2">
              <ToolButton
                variant="destructive"
                onClick={handleDeleteAbandonedCarts}
                disabled={isDeletingAbandoned}
                className="w-full"
                tooltip={
                  <>
                    <p className="font-semibold mb-1">Delete Abandoned Carts</p>
                    <p>Permanently deletes every PENDING pledge on this project that has no evidence of payment activity (no <code>stripePaymentIntentId</code> / <code>divinityCoinPaymentId</code> / <code>paypalOrderId</code> / <code>whopCheckoutId</code>). Confirms first.</p>
                    <p className="mt-1 opacity-75">Use after a campaign closes to clean out unfunded carts that backers walked away from. Cannot be undone.</p>
                  </>
                }
              >
                {isDeletingAbandoned ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                {isDeletingAbandoned ? "Deleting..." : "Delete Abandoned Carts"}
              </ToolButton>
              {deleteAbandonedMessage && (
                <p className={`text-sm ${deleteAbandonedMessage.startsWith("Error") ? "text-red-600" : "text-emerald-600"}`}>{deleteAbandonedMessage}</p>
              )}

              {(project.status === "LIVE" || project.status === "APPROVED") && (
                project.status === "APPROVED" ? (
                  <ToolButton
                    onClick={onMakeLive}
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                    tooltip={
                      <>
                        <p className="font-semibold mb-1">Make Live</p>
                        <p>Flips an APPROVED project to LIVE status. Starts the campaign clock and opens it to backers.</p>
                      </>
                    }
                  >
                    <Zap className="mr-2 h-4 w-4" />
                    Make Live
                  </ToolButton>
                ) : (
                  <ToolButton
                    variant="destructive"
                    onClick={onDeactivate}
                    className="w-full"
                    tooltip={
                      <>
                        <p className="font-semibold mb-1">Deactivate</p>
                        <p>Takes a LIVE campaign offline. Pledges are paused, the public page becomes inaccessible. Reversible by an admin.</p>
                      </>
                    }
                  >
                    <Power className="mr-2 h-4 w-4" />
                    Deactivate
                  </ToolButton>
                )
              )}
            </div>
          </div>
        </div>
        </TooltipProvider>
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
