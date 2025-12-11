"use client";

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
  database: {
    currentAmount: number;
    backerCount: number;
    pledgeCount: number;
  };
  stripe: {
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
      const response = await fetch("/api/admin/reconcile-pledges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        <h1 className="text-3xl font-bold">Stripe Reconciliation</h1>
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div className="font-medium text-muted-foreground">Metric</div>
                          <div className="font-medium flex items-center gap-1">
                            <Database className="h-4 w-4" /> Database
                          </div>
                          <div className="font-medium flex items-center gap-1">
                            <CreditCard className="h-4 w-4" /> Stripe
                          </div>

                          <div>Current Amount</div>
                          <div>{formatCurrency(result.database.currentAmount)}</div>
                          <div className={getDiscrepancyColor(result.discrepancy.amountDiff)}>
                            {formatCurrency(result.stripe.totalAmount)}
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
                            {result.stripe.successfulPayments + result.stripe.pendingSetupIntents}
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
                            {result.stripe.successfulPayments} paid + {result.stripe.pendingSetupIntents} pending
                          </div>
                        </div>

                        {/* Issues Details */}
                        {(result.details.missingInDb.length > 0 ||
                          result.details.statusMismatch.length > 0 ||
                          result.details.amountMismatch.length > 0) && (
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
