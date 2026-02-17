"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  CheckCircle,
  Loader2,
  AlertTriangle,
  CreditCard,
  Copy,
} from "lucide-react";
import type { StripeLookupResult } from "./types";
import { copyToClipboard } from "./utils";

interface StripeLookupDialogProps {
  showStripeLookup: boolean;
  setShowStripeLookup: (value: boolean) => void;
  stripeLookupId: string;
  setStripeLookupId: (value: string) => void;
  stripeLookupResult: StripeLookupResult | null;
  isLoadingStripeLookup: boolean;
  doStripeLookup: () => void;
}

export function StripeLookupDialog({
  showStripeLookup,
  setShowStripeLookup,
  stripeLookupId,
  setStripeLookupId,
  stripeLookupResult,
  isLoadingStripeLookup,
  doStripeLookup,
}: StripeLookupDialogProps) {
  return (
    <Dialog open={showStripeLookup} onOpenChange={setShowStripeLookup}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Stripe Lookup Tool
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter Stripe ID (pi_xxx, seti_xxx, cs_xxx, or any ID)"
              value={stripeLookupId}
              onChange={(e) => setStripeLookupId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doStripeLookup()}
              className="font-mono text-sm"
            />
            <Button
              onClick={doStripeLookup}
              disabled={isLoadingStripeLookup || !stripeLookupId.trim()}
            >
              {isLoadingStripeLookup ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Supported prefixes: <code>pi_</code> (Payment Intent), <code>seti_</code> (Setup Intent), <code>cs_</code> (Checkout Session), or any database/external ID
          </p>

          {stripeLookupResult && (
            <div className="space-y-4">
              {/* Diagnostics Summary */}
              {stripeLookupResult.diagnostics && (
                <Card className={stripeLookupResult.diagnostics.statusMismatch || stripeLookupResult.diagnostics.noDBRecord || stripeLookupResult.diagnostics.hasError ? "border-red-200 dark:border-red-800" : "border-green-200 dark:border-green-800"}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      {stripeLookupResult.diagnostics.statusMismatch || stripeLookupResult.diagnostics.noDBRecord || stripeLookupResult.diagnostics.hasError ? (
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                      ) : (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      )}
                      Diagnostic Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      {Object.entries(stripeLookupResult.diagnostics).map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <span className="text-muted-foreground">{key}:</span>
                          <span className={
                            key === "statusMismatch" && value === true ? "text-red-600 font-medium" :
                            key === "noDBRecord" && value === true ? "text-red-600 font-medium" :
                            key === "hasError" && value === true ? "text-red-600 font-medium" :
                            key === "isFullyPaid" && value === true ? "text-green-600 font-medium" :
                            ""
                          }>
                            {typeof value === "boolean" ? (value ? "Yes" : "No") : String(value ?? "N/A")}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Stripe Data */}
              {stripeLookupResult.stripe && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      Stripe Response ({stripeLookupResult.lookupType})
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-2 text-xs"
                        onClick={() => copyToClipboard(JSON.stringify(stripeLookupResult.stripe, null, 2))}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-xs bg-muted/50 rounded-lg p-3 overflow-x-auto max-h-80 overflow-y-auto">
                      {JSON.stringify(stripeLookupResult.stripe, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              )}

              {/* DB Match */}
              {stripeLookupResult.databaseMatch && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Database Match</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-xs bg-muted/50 rounded-lg p-3 overflow-x-auto">
                      {JSON.stringify(stripeLookupResult.databaseMatch, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
