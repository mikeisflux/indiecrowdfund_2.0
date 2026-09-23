"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Shield, Trash2, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/fetch-utils";
import { UserSettings } from "./types";

interface PrivacyCardProps {
  settings: UserSettings;
  onChangePassword: () => void;
  onDeleteAccount: () => void;
}

export function PrivacyCard({ settings, onChangePassword, onDeleteAccount }: PrivacyCardProps) {
  // GDPR data export + CCPA opt-out. Both endpoints existed with no UI
  // in front of them — users could not reach their own legal rights.
  const [isExporting, setIsExporting] = useState(false);
  const [ccpaOptedOut, setCcpaOptedOut] = useState<boolean | null>(null);
  const [ccpaBusy, setCcpaBusy] = useState(false);

  useEffect(() => {
    fetch("/api/privacy/ccpa-opt-out")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCcpaOptedOut(!!d?.optedOut))
      .catch(() => setCcpaOptedOut(false));
  }, []);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await apiFetch("/api/user/data-export", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Export failed");
      const blob = new Blob([JSON.stringify(data.data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "my-indiecrowdfund-data.json";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Your data export has downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  const handleCcpaToggle = async (optOut: boolean) => {
    setCcpaBusy(true);
    try {
      const res = await apiFetch("/api/privacy/ccpa-opt-out", {
        method: optOut ? "POST" : "DELETE",
        ...(optOut
          ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ optOutType: "all" }) }
          : {}),
      });
      if (!res.ok) throw new Error();
      setCcpaOptedOut(optOut);
      toast.success(optOut ? "Opted out of data sharing" : "Opt-out removed");
    } catch {
      toast.error("Could not update your preference");
    } finally {
      setCcpaBusy(false);
    }
  };

  return (
    <Card className="glass-card border shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: '300ms' }}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-green-500" />
          Privacy & Security
        </CardTitle>
        <CardDescription>
          Manage your privacy settings and account security
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <p className="font-medium">Connected accounts</p>
            <p className="text-sm text-muted-foreground">
              Manage your connected social accounts
            </p>
          </div>
          <div className="flex gap-2">
            {settings.connectedAccounts.length > 0 ? (
              settings.connectedAccounts.map((provider) => (
                <Badge key={provider} variant="outline" className="capitalize">
                  {provider}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">No accounts connected</span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <p className="font-medium">Change password</p>
            <p className="text-sm text-muted-foreground">
              Update your account password
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onChangePassword}>
            Change
          </Button>
        </div>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <p className="font-medium">Download my data</p>
            <p className="text-sm text-muted-foreground">
              Get a copy of all personal data we hold about you (GDPR export, JSON)
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Export
          </Button>
        </div>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <p className="font-medium">Do not sell or share my data</p>
            <p className="text-sm text-muted-foreground">
              CCPA opt-out from data sharing for advertising or analytics partners
            </p>
          </div>
          <Switch
            checked={!!ccpaOptedOut}
            disabled={ccpaOptedOut === null || ccpaBusy}
            onCheckedChange={handleCcpaToggle}
          />
        </div>

        {/* Self-serve deletion, backed by /api/user/delete-account. Both
            the FAQ and the Data Deletion Policy tell users this lives in
            Settings, so it has to be here — support was fielding requests
            for a button that didn't exist. */}
        <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <div>
            <p className="font-medium text-destructive">Delete my account</p>
            <p className="text-sm text-muted-foreground">
              Permanently delete your account and personal data. This cannot be
              undone and forfeits any rewards you are owed. Creators who have run
              a campaign need admin approval and must finish fulfillment first.
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            className="shrink-0"
            onClick={onDeleteAccount}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
