"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { TabsContent } from "@/components/ui/tabs";
import { SecureKeyInput } from "@/components/ui/secure-key-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Printer, AlertTriangle, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/fetch-utils";

interface FulfillmentSettingsProps {
  settings: {
    printingComicsApiKey: string;
    printingComicsWebhookSecret: string;
    printingComicsEnvironment: string;
  };
  onSettingsChange: (settings: FulfillmentSettingsProps["settings"]) => void;
  onSave: () => void;
}

// Admin-side configuration for fulfillment integrations.
// Currently houses only the Printing Comics keys; layout is generic so
// future fulfillment integrations (ShipStation API key, EasyPost,
// Lulu Direct, etc.) drop in as additional cards.
//
// Provider docs at printingcomics.com/developers are not yet public,
// so the field set is best-effort. Add fields here as the spec lands.
type TestState =
  | { kind: "idle" }
  | { kind: "testing" }
  | { kind: "ok"; name: string | null; scopes: string[]; environment: string }
  | { kind: "err"; message: string };

export function FulfillmentSettings({
  settings,
  onSettingsChange,
  onSave,
}: FulfillmentSettingsProps) {
  const [test, setTest] = useState<TestState>({ kind: "idle" });

  const handleTest = async () => {
    setTest({ kind: "testing" });
    try {
      const r = await apiFetch("/api/admin/printingcomics/test-connection", { method: "POST" });
      const data = await r.json();
      if (!r.ok) {
        setTest({ kind: "err", message: data?.error || `HTTP ${r.status}` });
        return;
      }
      if (!data.ok) {
        setTest({ kind: "err", message: data.error || "Test failed" });
        return;
      }
      setTest({
        kind: "ok",
        name: data.name ?? null,
        scopes: Array.isArray(data.scopes) ? data.scopes : [],
        environment: data.environment || "production",
      });
    } catch (err) {
      setTest({ kind: "err", message: err instanceof Error ? err.message : "Network error" });
    }
  };

  return (
    <TabsContent value="fulfillment" className="mt-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Printer className="h-5 w-5" />
                Printing Comics
                <span className="text-[10px] uppercase tracking-wide font-semibold text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30">
                  Beta
                </span>
              </CardTitle>
              <CardDescription>
                Print-on-demand fulfillment provider. Once an API key is
                saved here, creators see the &ldquo;Submit print order&rdquo; flow
                under IndieKit → Fulfillment → Physical Delivery → Printing
                Comics. Provider docs:{" "}
                <a
                  href="https://printingcomics.com/developers"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground"
                >
                  printingcomics.com/developers
                </a>
                .
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div
            role="note"
            className="flex items-start gap-3 p-3 rounded-md border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20"
          >
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" aria-hidden="true" />
            <div className="text-xs text-amber-800 dark:text-amber-300">
              The Printing Comics API spec is still in draft — fields here
              follow the standard API-key + webhook-secret + environment
              shape and will be wired to actual order submission once
              their developer docs are published.
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>API Key</Label>
              <SecureKeyInput
                value={settings.printingComicsApiKey}
                onChange={(value) => onSettingsChange({ ...settings, printingComicsApiKey: value })}
                onSave={onSave}
                hasExistingValue={settings.printingComicsApiKey === "••••••••"}
                placeholder="pcdev_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              />
              <p className="text-xs text-muted-foreground">
                Server-side credential used to authenticate order
                submissions. Encrypted at rest.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Webhook Signing Secret</Label>
              <SecureKeyInput
                value={settings.printingComicsWebhookSecret}
                onChange={(value) => onSettingsChange({ ...settings, printingComicsWebhookSecret: value })}
                onSave={onSave}
                hasExistingValue={settings.printingComicsWebhookSecret === "••••••••"}
                placeholder="whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              />
              <p className="text-xs text-muted-foreground">
                Used to verify order-status callbacks from Printing Comics
                (when their webhook flow ships).
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Environment</Label>
              <Select
                value={settings.printingComicsEnvironment}
                onValueChange={(v) =>
                  onSettingsChange({ ...settings, printingComicsEnvironment: v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">Sandbox (test)</SelectItem>
                  <SelectItem value="production">Production</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Provider doesn&apos;t publish a separate sandbox host — the
                key prefix (pc_test_ vs pc_live_) determines test mode on
                their side. Toggle here is informational + gates whether
                we send real orders.
              </p>
            </div>
          </div>

          <div className="pt-2 border-t space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label>Connection test</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Calls Printing Comics&apos; <code className="text-[10px]">/me</code> with the saved key and shows the granted scopes. Save first, then test.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTest}
                disabled={test.kind === "testing"}
              >
                {test.kind === "testing" ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Testing…
                  </>
                ) : (
                  "Test connection"
                )}
              </Button>
            </div>

            {test.kind === "ok" && (
              <div className="flex items-start gap-2 p-3 rounded-md border border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20 text-sm">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="font-medium text-emerald-900 dark:text-emerald-200">
                    Connected{test.name ? ` — ${test.name}` : ""}
                  </p>
                  <p className="text-xs text-emerald-800 dark:text-emerald-300">
                    Environment: {test.environment} · Scopes: {test.scopes.length > 0 ? test.scopes.join(", ") : "(none reported)"}
                  </p>
                </div>
              </div>
            )}

            {test.kind === "err" && (
              <div className="flex items-start gap-2 p-3 rounded-md border border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20 text-sm">
                <XCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                <p className="text-red-800 dark:text-red-300">{test.message}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
