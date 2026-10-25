"use client";

import { apiFetch } from "@/lib/fetch-utils";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Loader2,
  AlertCircle,
  DollarSign,
  Users,
  Database,
  CreditCard,
  Wrench,
} from "lucide-react";
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface ReconciliationResult {
  projectId: string;
  projectTitle: string;
  paymentProcessor?: string;
  database: {
    currentAmount: number;
    backerCount: number;
    pledgeCount: number;
  };
  verified: {
    totalAmount: number;
    successfulPayments: number;
    pendingSetupIntents: number;
  };
  discrepancy: {
    amountDiff: number;
    backerDiff: number;
    hasIssues: boolean;
  };
  details: {
    missingInDb: string[];
    statusMismatch: string[];
    amountMismatch: string[];
    downgraded?: string[];
  };
}

interface ReconciliationSummary {
  totalProjects: number;
  projectsWithIssues: number;
  totalAmountDiscrepancy: number;
  totalBackerDiscrepancy: number;
  results: ReconciliationResult[];
  fixesApplied?: number;
}

export default function ReconcilePage() {
  const [recoverSession, setRecoverSession] = useState("");
  const [recoverPayment, setRecoverPayment] = useState("");
  const [recoverProject, setRecoverProject] = useState("");
  const [recoverEmail, setRecoverEmail] = useState("");
  const [recoverReward, setRecoverReward] = useState("");
  const [recovering, setRecovering] = useState(false);
  const [recoverResult, setRecoverResult] = useState<string | null>(null);

  const recoverDc = async () => {
    setRecovering(true);
    setRecoverResult(null);
    try {
      const res = await apiFetch("/api/admin/pledges/recover-dc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          recoverSession.trim()
            ? { sessionId: recoverSession.trim(), rewardId: recoverReward.trim() || undefined }
            : {
                paymentIntentId: recoverPayment.trim(),
                projectId: recoverProject.trim() || undefined,
                userEmail: recoverEmail.trim() || undefined,
                rewardId: recoverReward.trim() || undefined,
              }
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Recovery failed");
      const p = data.pledge;
      setRecoverResult(
        `Done — ${data.project}: pledge ${p?.id} is ${p?.status}${p?.backerNumber ? ` (backer #${p.backerNumber})` : ""}, $${Number(p?.amount || 0).toFixed(2)}, ${p?.user?.email ?? "?"}${p?.confirmationEmailSent ? ", confirmation emailed" : ""}.`
      );
    } catch (err) {
      setRecoverResult(err instanceof Error ? err.message : "Recovery failed");
    } finally {
      setRecovering(false);
    }
  };
  // Refund the second of two captured charges on one pledge.
  const [dupPledge, setDupPledge] = useState("");
  const [dupIntent, setDupIntent] = useState("");
  const [dupReason, setDupReason] = useState("");
  const [dupBusy, setDupBusy] = useState(false);
  const [dupResult, setDupResult] = useState<string | null>(null);

  const refundDuplicate = async () => {
    setDupBusy(true);
    setDupResult(null);
    try {
      const res = await apiFetch("/api/admin/pledges/refund-duplicate-dc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pledgeId: dupPledge.trim(), paymentIntentId: dupIntent.trim(), reason: dupReason.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Refund failed");
      setDupResult(
        `Done — ${data.project}: refunded $${Number(data.refunded).toFixed(2)} on ${data.refundedPayment} to ${data.backer}. Pledge stays paid via ${data.keptPayment}${data.emailed ? "; backer emailed" : "; backer NOT emailed (no address or send failed)"}.`
      );
    } catch (err) {
      setDupResult(err instanceof Error ? err.message : "Refund failed");
    } finally {
      setDupBusy(false);
    }
  };

  // Reverse a pledge that was committed without the money ever arriving.
  const [revPledge, setRevPledge] = useState("");
  const [revReason, setRevReason] = useState("");
  const [revChecked, setRevChecked] = useState(false);
  const [revForce, setRevForce] = useState(false);
  const [revBusy, setRevBusy] = useState(false);
  const [revResult, setRevResult] = useState<string | null>(null);
  const [revConfirmOpen, setRevConfirmOpen] = useState(false);

  const revertCommit = async () => {
    setRevBusy(true);
    setRevResult(null);
    try {
      const res = await apiFetch("/api/admin/pledges/revert-dc-commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pledgeId: revPledge.trim(), reason: revReason.trim(), confirmedUnpaidInStripe: revChecked, force: revForce }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Reversal failed");
      setRevResult(
        `Done — ${data.project}: $${Number(data.amount).toFixed(2)} pledge from ${data.backer} is now CANCELLED${data.previousBackerNumber ? ` (was backer #${data.previousBackerNumber})` : ""}. Counters ${data.countersReversed ? "reversed" : "were never counted"}, ${data.transactionsVoided} payment record${data.transactionsVoided === 1 ? "" : "s"} voided. DC records: ${data.dcLookupPaid === null ? "unreachable" : data.dcLookupPaid ? "PAID (forced)" : "unpaid"}; verify-payment said ${data.dcVerifyStatus ?? "n/a"}. ${data.emailed ? "Backer emailed" : "Backer NOT emailed"}${data.campaignOpen ? " with a link to pledge again." : "; campaign is closed."}`
      );
      setRevChecked(false);
      setRevForce(false);
    } catch (err) {
      setRevResult(err instanceof Error ? err.message : "Reversal failed");
    } finally {
      setRevBusy(false);
      setRevConfirmOpen(false);
    }
  };
  const [isLoading, setIsLoading] = useState(false);
  const [isApplyingFixes, setIsApplyingFixes] = useState(false);
  const [summary, setSummary] = useState<ReconciliationSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [projectIdFilter, setProjectIdFilter] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [projectToFix, setProjectToFix] = useState<string | null>(null);

  const runReconciliation = async (projectId?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const url = projectId
        ? `/api/admin/reconcile-pledges?projectId=${projectId}`
        : "/api/admin/reconcile-pledges";

      const response = await fetch(url);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to reconcile");
      }

      const data = await response.json();
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const applyFixes = async (projectId?: string) => {
    setIsApplyingFixes(true);
    setError(null);

    try {
      const response = await apiFetch("/api/admin/reconcile-pledges", {
        method: "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({
          projectId: projectId || undefined,
          applyFixes: true,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to apply fixes");
      }

      const data = await response.json();
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsApplyingFixes(false);
      setShowConfirmDialog(false);
      setProjectToFix(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const getDiscrepancyColor = (diff: number) => {
    if (Math.abs(diff) < 0.01) return "text-green-600";
    if (diff > 0) return "text-blue-600"; // Stripe has more
    return "text-red-600"; // DB has more
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-xl sm:text-3xl font-bold">Stripe Reconciliation</h1>
        <p className="text-muted-foreground mt-2">
          Compare pledge data between the database and Stripe to identify and fix discrepancies.
        </p>
      </div>

      {/* Controls */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Reconciliation Options</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="projectId">Project ID (optional)</Label>
              <Input
                id="projectId"
                placeholder="Leave empty to check all projects"
                value={projectIdFilter}
                onChange={(e) => setProjectIdFilter(e.target.value)}
              />
            </div>
            <div className="flex items-end gap-2">
              <Button
                onClick={() => runReconciliation(projectIdFilter || undefined)}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Run Reconciliation
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rebuild a pledge from DivinityCoin's own record. For the backer who
          paid, saw "Payment complete. Returning…" hang, and whose pledge row
          is missing or never committed. */}
      <Card className="mb-6 border-teal-200">
        <CardHeader>
          <CardTitle className="text-lg">Recover a DivinityCoin payment</CardTitle>
          <CardDescription>
            Paste the checkout session id (cs_…) from DivinityCoin, or a payment id (pi_…) with the project id and the backer&apos;s
            account email. The pledge is recreated under its original id and committed exactly as the webhook would have: counters,
            backer number and confirmation email.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Input value={recoverSession} onChange={(e) => setRecoverSession(e.target.value)} placeholder="Checkout session id (cs_…)" className="font-mono" />
            <Input value={recoverPayment} onChange={(e) => setRecoverPayment(e.target.value)} placeholder="or payment id (pi_…)" className="font-mono" />
            <Input value={recoverProject} onChange={(e) => setRecoverProject(e.target.value)} placeholder="Project id (payment-id path only)" className="font-mono" />
            <Input value={recoverEmail} onChange={(e) => setRecoverEmail(e.target.value)} placeholder="Backer account email (payment-id path only)" />
            <Input value={recoverReward} onChange={(e) => setRecoverReward(e.target.value)} placeholder="Reward id (optional)" className="font-mono" />
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={recoverDc} disabled={recovering || (!recoverSession.trim() && !recoverPayment.trim())} className="bg-teal-600 hover:bg-teal-700">
              {recovering ? "Recovering…" : "Verify with DivinityCoin & commit"}
            </Button>
            {recoverResult && <p className="text-sm">{recoverResult}</p>}
          </div>
        </CardContent>
      </Card>

      {/* One pledge, two captured charges: refund the stray one, keep the pledge. */}
      <Card className="mb-6 border-amber-200">
        <CardHeader>
          <CardTitle className="text-lg">Refund a duplicate DivinityCoin charge</CardTitle>
          <CardDescription>
            For a backer whose card was captured twice for one pledge (two checkout sessions). Paste the pledge id and the payment id
            (pi_…) of the <strong>extra</strong> charge, not the one stamped on the pledge. DivinityCoin refunds that charge, the pledge stays
            paid, and the backer gets an apology with the refund amount.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Input value={dupPledge} onChange={(e) => setDupPledge(e.target.value)} placeholder="Pledge id" className="font-mono" />
            <Input value={dupIntent} onChange={(e) => setDupIntent(e.target.value)} placeholder="Extra payment id to refund (pi_…)" className="font-mono" />
            <Input value={dupReason} onChange={(e) => setDupReason(e.target.value)} placeholder="Reason (optional, kept on the record)" className="sm:col-span-2" />
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={refundDuplicate} disabled={dupBusy || !dupPledge.trim() || !dupIntent.trim()} className="bg-amber-600 hover:bg-amber-700">
              {dupBusy ? "Refunding…" : "Verify with DivinityCoin & refund the extra charge"}
            </Button>
            {dupResult && <p className="text-sm">{dupResult}</p>}
          </div>
        </CardContent>
      </Card>

      {/* A pledge we marked paid that Stripe never captured. */}
      <Card className="mb-6 border-red-200">
        <CardHeader>
          <CardTitle className="text-lg">Reverse a pledge that was confirmed but never paid</CardTitle>
          <CardDescription>
            For a COMPLETED DivinityCoin pledge whose payment intent is <strong>not</strong> succeeded in Stripe. Sets it CANCELLED, takes it out
            of the campaign total and backer count, releases the reward and add-on slots, voids its payment record, and emails the backer that
            no money was taken (with a link to pledge again if the campaign is still live). No refund is issued. Refused if DivinityCoin&apos;s
            payment records say it was paid, unless you force it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Input value={revPledge} onChange={(e) => setRevPledge(e.target.value)} placeholder="Pledge id" className="font-mono" />
            <Input value={revReason} onChange={(e) => setRevReason(e.target.value)} placeholder="Reason (required) — e.g. Stripe shows pi_… incomplete" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={revChecked} onChange={(e) => setRevChecked(e.target.checked)} />
            I looked this payment intent up in Stripe and it is not succeeded.
          </label>
          <label className="flex items-center gap-2 text-sm text-red-700">
            <input type="checkbox" checked={revForce} onChange={(e) => setRevForce(e.target.checked)} />
            Force: reverse even if DivinityCoin&apos;s records claim it was paid (Stripe disagrees).
          </label>
          <div className="flex items-center gap-3">
            <Button variant="destructive" onClick={() => setRevConfirmOpen(true)} disabled={revBusy || !revPledge.trim() || !revReason.trim() || !revChecked}>
              {revBusy ? "Reversing…" : "Reverse this pledge"}
            </Button>
            {revResult && <p className="text-sm">{revResult}</p>}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={revConfirmOpen} onOpenChange={setRevConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reverse pledge {revPledge.trim()}?</AlertDialogTitle>
            <AlertDialogDescription>
              The pledge becomes CANCELLED, the campaign total and backer count drop, and the backer is emailed that their payment never
              went through. This is for a payment Stripe never captured. If money actually moved, use a refund instead.
              {revForce && <><br /><br /><strong className="text-red-700">Force is on: DivinityCoin&apos;s record of a successful charge will be overridden.</strong></>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={revertCommit} className="bg-red-600 hover:bg-red-700">
              Reverse
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Error Display */}
      {error && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      {summary && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Projects Checked</p>
                    <p className="text-2xl font-bold">{summary.totalProjects}</p>
                  </div>
                  <Database className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            <Card className={summary.projectsWithIssues > 0 ? "border-amber-200 bg-amber-50" : ""}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Projects with Issues</p>
                    <p className="text-2xl font-bold">{summary.projectsWithIssues}</p>
                  </div>
                  {summary.projectsWithIssues > 0 ? (
                    <AlertTriangle className="h-8 w-8 text-amber-500" />
                  ) : (
                    <CheckCircle2 className="h-8 w-8 text-green-500" />
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Amount Discrepancy</p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(summary.totalAmountDiscrepancy)}
                    </p>
                  </div>
                  <DollarSign className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Backer Discrepancy</p>
                    <p className="text-2xl font-bold">{summary.totalBackerDiscrepancy}</p>
                  </div>
                  <Users className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Fix All Button */}
          {summary.projectsWithIssues > 0 && (
            <Card className="mb-6 border-amber-200 bg-amber-50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Wrench className="h-6 w-6 text-amber-600" />
                    <div>
                      <p className="font-medium">
                        {summary.projectsWithIssues} project(s) have discrepancies
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Apply fixes to sync database with Stripe records
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setProjectToFix(null);
                      setShowConfirmDialog(true);
                    }}
                    disabled={isApplyingFixes}
                  >
                    {isApplyingFixes ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Applying...
                      </>
                    ) : (
                      "Fix All Issues"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Fixes Applied Message */}
          {summary.fixesApplied !== undefined && (
            <Card className="mb-6 border-green-200 bg-green-50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                  <div>
                    <p className="font-medium text-green-800">
                      Fixes applied to {summary.fixesApplied} project(s)
                    </p>
                    <p className="text-sm text-green-700">
                      Database has been updated to match Stripe records
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Detailed Results */}
          <Card>
            <CardHeader>
              <CardTitle>Detailed Results</CardTitle>
              <CardDescription>
                Click on a project to see detailed comparison
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="space-y-2">
                {summary.results.map((result) => (
                  <AccordionItem
                    key={result.projectId}
                    value={result.projectId}
                    className={`border rounded-lg px-4 ${
                      result.discrepancy.hasIssues ? "border-amber-200 bg-amber-50" : ""
                    }`}
                  >
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-4 flex-1 text-left">
                        {result.discrepancy.hasIssues ? (
                          <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
                        ) : (
                          <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{result.projectTitle}</p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {result.projectId}
                          </p>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <Badge variant={result.discrepancy.hasIssues ? "destructive" : "secondary"}>
                            {result.discrepancy.hasIssues ? "Needs Fix" : "OK"}
                          </Badge>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="pt-4 space-y-4">
                        {/* Comparison Grid */}
                        <div className="overflow-x-auto">
                        <div className="grid grid-cols-3 gap-4 text-sm min-w-[400px]">
                          <div className="font-medium text-muted-foreground">Metric</div>
                          <div className="font-medium flex items-center gap-1">
                            <Database className="h-4 w-4" /> Database
                          </div>
                          <div className="font-medium flex items-center gap-1">
                            <CreditCard className="h-4 w-4" /> {result.paymentProcessor === "DIVINITYCOIN" ? "Verified (DC)" : result.paymentProcessor === "PAYPAL" ? "PayPal" : result.paymentProcessor === "WHOP" ? "Whop" : "Stripe"}
                          </div>

                          <div>Current Amount</div>
                          <div>{formatCurrency(result.database.currentAmount)}</div>
                          <div className={getDiscrepancyColor(result.discrepancy.amountDiff)}>
                            {formatCurrency(result.verified.totalAmount)}
                            {result.discrepancy.amountDiff !== 0 && (
                              <span className="ml-2 text-xs">
                                ({result.discrepancy.amountDiff > 0 ? "+" : ""}
                                {formatCurrency(result.discrepancy.amountDiff)})
                              </span>
                            )}
                          </div>

                          <div>Backer Count</div>
                          <div>{result.database.backerCount}</div>
                          <div className={getDiscrepancyColor(result.discrepancy.backerDiff)}>
                            {result.verified.successfulPayments + result.verified.pendingSetupIntents}
                            {result.discrepancy.backerDiff !== 0 && (
                              <span className="ml-2 text-xs">
                                ({result.discrepancy.backerDiff > 0 ? "+" : ""}
                                {result.discrepancy.backerDiff})
                              </span>
                            )}
                          </div>

                          <div>Pledge Records</div>
                          <div>{result.database.pledgeCount}</div>
                          <div>
                            {result.verified.successfulPayments} paid + {result.verified.pendingSetupIntents} pending
                          </div>
                        </div>
                        </div>

                        {/* Issues Details */}
                        {(result.details.missingInDb.length > 0 ||
                          result.details.statusMismatch.length > 0 ||
                          result.details.amountMismatch.length > 0 ||
                          (result.details.downgraded?.length ?? 0) > 0) && (
                          <div className="border-t pt-4 space-y-3">
                            <p className="font-medium text-sm">Issues Found:</p>

                            {result.details.missingInDb.length > 0 && (
                              <div className="text-sm">
                                <p className="text-red-600 font-medium">
                                  Missing in Database ({result.details.missingInDb.length}):
                                </p>
                                <ul className="list-disc list-inside text-xs text-muted-foreground">
                                  {result.details.missingInDb.map((item, i) => (
                                    <li key={i}>{item}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {result.details.statusMismatch.length > 0 && (
                              <div className="text-sm">
                                <p className="text-amber-600 font-medium">
                                  Status Mismatch ({result.details.statusMismatch.length}):
                                </p>
                                <ul className="list-disc list-inside text-xs text-muted-foreground">
                                  {result.details.statusMismatch.map((item, i) => (
                                    <li key={i}>{item}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {result.details.amountMismatch.length > 0 && (
                              <div className="text-sm">
                                <p className="text-blue-600 font-medium">
                                  Amount Mismatch ({result.details.amountMismatch.length}):
                                </p>
                                <ul className="list-disc list-inside text-xs text-muted-foreground">
                                  {result.details.amountMismatch.map((item, i) => (
                                    <li key={i}>{item}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {result.details.downgraded && result.details.downgraded.length > 0 && (
                              <div className="text-sm">
                                <p className="text-red-600 font-medium">
                                  Downgraded — No Verified Payment ({result.details.downgraded.length}):
                                </p>
                                <ul className="list-disc list-inside text-xs text-muted-foreground">
                                  {result.details.downgraded.map((item: string, i: number) => (
                                    <li key={i}>{item}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Fix Button for individual project */}
                        {result.discrepancy.hasIssues && (
                          <div className="border-t pt-4">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setProjectToFix(result.projectId);
                                setShowConfirmDialog(true);
                              }}
                              disabled={isApplyingFixes}
                            >
                              <Wrench className="mr-2 h-4 w-4" />
                              Fix This Project
                            </Button>
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </>
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply Reconciliation Fixes?</AlertDialogTitle>
            <AlertDialogDescription>
              {projectToFix
                ? "This will update the database to match Stripe's records for this project."
                : "This will update the database to match Stripe's records for all projects with issues."}
              <br />
              <br />
              <strong>Changes that will be made:</strong>
              <ul className="list-disc list-inside mt-2 text-sm">
                <li>Update project currentAmount to match Stripe totals</li>
                <li>Update project backerCount to match Stripe records</li>
                <li>Mark pledges as COMPLETED if paid in Stripe</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => applyFixes(projectToFix || undefined)}
              className="bg-red-600 hover:bg-red-700"
            >
              Apply Fixes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
