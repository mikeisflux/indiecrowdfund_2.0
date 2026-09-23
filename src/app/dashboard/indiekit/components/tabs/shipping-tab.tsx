"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Shipping-carrier connections for IndieKit.
 *
 * This tab used to be a mock: a hardcoded service list POSTing to a
 * stub route that answered "success" and stored nothing, next to a
 * demo shipping-zones editor with no schema behind it. The real
 * credential store existed the whole time at
 * /api/creator/indiekit/shipping-providers/credentials (per-user,
 * encrypted at rest) — the same one the IndieKit Settings section
 * uses. This tab now drives that. The fake zones card is gone:
 * shipping charges are configured on rewards, where they're real.
 */

interface ProviderField {
  key: string;
  label: string;
  type: "text" | "password";
}

interface Provider {
  id: "shipstation" | "shippo" | "easypost" | "stamps";
  name: string;
  icon: string;
  fields: ProviderField[];
}

const PROVIDERS: Provider[] = [
  {
    id: "shipstation",
    name: "ShipStation",
    icon: "📦",
    fields: [
      { key: "apiKey", label: "API Key", type: "text" },
      { key: "apiSecret", label: "API Secret", type: "password" },
    ],
  },
  {
    id: "shippo",
    name: "Shippo",
    icon: "🚚",
    fields: [{ key: "apiToken", label: "API Token", type: "password" }],
  },
  {
    id: "easypost",
    name: "EasyPost",
    icon: "📬",
    fields: [{ key: "apiKey", label: "API Key", type: "password" }],
  },
  {
    id: "stamps",
    name: "Stamps.com",
    icon: "📮",
    fields: [
      { key: "integrationId", label: "Integration ID", type: "text" },
      { key: "username", label: "Username", type: "text" },
      { key: "password", label: "Password", type: "password" },
    ],
  },
];

interface ShippingTabProps {
  projectId?: string;
  onRefresh?: () => void;
}

export function ShippingTab({ onRefresh }: ShippingTabProps) {
  // provider id -> connected?
  const [connected, setConnected] = useState<Record<string, boolean>>({});
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [busyProvider, setBusyProvider] = useState<string | null>(null);
  const [connectDialog, setConnectDialog] = useState<Provider | null>(null);
  const [credentials, setCredentials] = useState<Record<string, string>>({});

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/creator/indiekit/shipping-providers/credentials");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setConnected({
        shipstation: !!data.shipstation?.hasCredentials,
        shippo: !!data.shippo?.hasCredentials,
        easypost: !!data.easypost?.hasCredentials,
        stamps: !!data.stamps?.hasCredentials,
      });
    } catch {
      toast.error("Could not load carrier connection status");
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleConnect = async () => {
    if (!connectDialog) return;
    const missing = connectDialog.fields.find((f) => !credentials[f.key]?.trim());
    if (missing) {
      toast.error(`Please enter the ${missing.label}`);
      return;
    }

    setBusyProvider(connectDialog.id);
    try {
      const res = await apiFetch("/api/creator/indiekit/shipping-providers/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: connectDialog.id, credentials }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to connect");
      toast.success(`Connected to ${connectDialog.name}`);
      setConnectDialog(null);
      setCredentials({});
      await loadStatus();
      onRefresh?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to connect");
    } finally {
      setBusyProvider(null);
    }
  };

  const handleDisconnect = async (provider: Provider) => {
    setBusyProvider(provider.id);
    try {
      const res = await apiFetch("/api/creator/indiekit/shipping-providers/credentials", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: provider.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to disconnect");
      toast.success(`Disconnected from ${provider.name}`);
      await loadStatus();
      onRefresh?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to disconnect");
    } finally {
      setBusyProvider(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Connected Services</CardTitle>
          <CardDescription>
            Connect a shipping platform to buy labels and sync tracking. Credentials are
            stored encrypted on your account and work across all your campaigns.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingStatus ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking connections…
            </div>
          ) : (
            PROVIDERS.map((provider) => (
              <div
                key={provider.id}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-2xl">
                    {provider.icon}
                  </div>
                  <div>
                    <p className="font-medium">{provider.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {connected[provider.id] ? "Credentials on file" : "Not connected"}
                    </p>
                  </div>
                </div>
                {connected[provider.id] ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-green-200 text-green-600">
                      <Check className="mr-1 h-3 w-3" />
                      Connected
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDisconnect(provider)}
                      disabled={busyProvider === provider.id}
                    >
                      {busyProvider === provider.id ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Disconnecting…
                        </>
                      ) : (
                        "Disconnect"
                      )}
                    </Button>
                  </div>
                ) : (
                  <Button
                    className="bg-teal-600 hover:bg-teal-700"
                    onClick={() => {
                      setCredentials({});
                      setConnectDialog(provider);
                    }}
                  >
                    <Link2 className="mr-2 h-4 w-4" />
                    Connect
                  </Button>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Shipping Charges</CardTitle>
          <CardDescription>
            What backers pay for shipping is set per reward (and per add-on) in the campaign
            builder — edit a reward&apos;s shipping settings there. Carrier connections above are
            for buying labels and tracking, not for charging backers.
          </CardDescription>
        </CardHeader>
      </Card>

      <Dialog open={!!connectDialog} onOpenChange={(open) => !open && setConnectDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect {connectDialog?.name}</DialogTitle>
            <DialogDescription>
              Paste the API credentials from your {connectDialog?.name} account. They&apos;re
              stored encrypted and never shown again in full.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {connectDialog?.fields.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={`cred-${field.key}`}>{field.label}</Label>
                <Input
                  id={`cred-${field.key}`}
                  type={field.type}
                  value={credentials[field.key] || ""}
                  onChange={(e) =>
                    setCredentials((c) => ({ ...c, [field.key]: e.target.value }))
                  }
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConnectDialog(null)}>
              Cancel
            </Button>
            <Button
              className="bg-teal-600 hover:bg-teal-700"
              onClick={handleConnect}
              disabled={busyProvider === connectDialog?.id}
            >
              {busyProvider === connectDialog?.id ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting…
                </>
              ) : (
                "Connect"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
