"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/fetch-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AlertTriangle, Copy, KeyRound, Loader2, Plus, Trash2, BookOpen } from "lucide-react";
import { toast } from "sonner";

interface ApiKeyRow {
  id: string;
  name: string;
  key: string;
  maskedKey: string;
  secretPrefix: string | null;
  status: string;
  appName: string | null;
  appUrl: string | null;
  contactEmail: string | null;
  usageCount: number;
  lastUsedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

export default function ApiAccessPage() {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [limit, setLimit] = useState(3);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<ApiKeyRow | null>(null);
  const [revoking, setRevoking] = useState(false);

  const [form, setForm] = useState({ name: "", appName: "", appUrl: "", contactEmail: "" });

  // Held in state only until the user dismisses it. The secret is hashed
  // server-side and is genuinely unrecoverable after this, so it is never
  // written anywhere persistent on the client either.
  const [issued, setIssued] = useState<{ key: string; secret: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/account/api-keys");
      if (!res.ok) throw new Error("load failed");
      const data = await res.json();
      setKeys(data.keys || []);
      setLimit(data.limit ?? 3);
    } catch {
      toast.error("Failed to load your API keys");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error(`Couldn't copy — select the ${label.toLowerCase()} and copy manually`);
    }
  };

  const create = async () => {
    setCreating(true);
    try {
      const res = await apiFetch("/api/account/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to create key");
        return;
      }
      setIssued({ key: data.key, secret: data.secret });
      setShowForm(false);
      setForm({ name: "", appName: "", appUrl: "", contactEmail: "" });
      load();
    } catch {
      toast.error("Failed to create key");
    } finally {
      setCreating(false);
    }
  };

  const revoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      const res = await apiFetch(`/api/account/api-keys?id=${revokeTarget.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Key revoked");
        load();
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error || "Failed to revoke key");
      }
    } catch {
      toast.error("Failed to revoke key");
    } finally {
      setRevoking(false);
      setRevokeTarget(null);
    }
  };

  const activeCount = keys.filter((k) => k.status === "ACTIVE").length;
  const formValid =
    form.name.trim() && form.appName.trim() && form.appUrl.trim() && form.contactEmail.trim();

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <KeyRound className="h-6 w-6" />
            API Access
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Read-only credentials for the public Data API.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/api-docs">
            <BookOpen className="mr-2 h-4 w-4" />
            Read the docs
          </Link>
        </Button>
      </div>

      {issued && (
        <Card className="mb-6 border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-amber-900 dark:text-amber-100">
              <AlertTriangle className="h-4 w-4" />
              Copy your secret now — it won&apos;t be shown again
            </CardTitle>
            <CardDescription className="text-amber-800 dark:text-amber-200">
              We store only a hash of the secret. If you lose it, revoke this key and
              create a new one.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(
              [
                ["API key", issued.key],
                ["API secret", issued.secret],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <Label className="text-xs text-amber-900 dark:text-amber-100">{label}</Label>
                <div className="mt-1 flex gap-2">
                  <code className="flex-1 overflow-x-auto rounded border bg-white dark:bg-zinc-900 px-3 py-2 font-mono text-xs">
                    {value}
                  </code>
                  <Button size="sm" variant="outline" onClick={() => copy(value, label)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <Button size="sm" variant="secondary" onClick={() => setIssued(null)}>
              I&apos;ve saved them
            </Button>
          </CardContent>
        </Card>
      )}

      {showForm ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">New API key</CardTitle>
            <CardDescription>
              Tell us what you&apos;re building. The contact email is used only to reach
              you about this integration — before a breaking change, or if traffic looks
              like a runaway loop. It is never published.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="name">Key name</Label>
                <Input
                  id="name"
                  placeholder="Production"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="appName">Project or company</Label>
                <Input
                  id="appName"
                  placeholder="Crowdfund Tracker"
                  value={form.appName}
                  onChange={(e) => setForm({ ...form, appName: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="appUrl">Website</Label>
                <Input
                  id="appUrl"
                  type="url"
                  placeholder="https://example.com"
                  value={form.appUrl}
                  onChange={(e) => setForm({ ...form, appUrl: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="contactEmail">Contact email</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  placeholder="dev@example.com"
                  value={form.contactEmail}
                  onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={create} disabled={creating || !formValid}>
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create key
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button
          className="mb-6"
          onClick={() => setShowForm(true)}
          disabled={activeCount >= limit}
        >
          <Plus className="mr-2 h-4 w-4" />
          {activeCount >= limit ? `Limit reached (${limit} active keys)` : "Create API key"}
        </Button>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : keys.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <KeyRound className="mx-auto mb-3 h-8 w-8 opacity-40" />
            <p>No API keys yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {keys.map((k) => (
            <Card key={k.id}>
              <CardContent className="flex flex-wrap items-start justify-between gap-4 py-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{k.name}</span>
                    <Badge variant={k.status === "ACTIVE" ? "default" : "secondary"}>
                      {k.status}
                    </Badge>
                  </div>
                  <code className="mt-1 block font-mono text-xs text-muted-foreground break-all">
                    {k.maskedKey}
                  </code>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {k.appName}
                    {k.appUrl ? ` · ${k.appUrl}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {k.usageCount.toLocaleString()} requests ·{" "}
                    {k.lastUsedAt
                      ? `last used ${new Date(k.lastUsedAt).toLocaleDateString()}`
                      : "never used"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => copy(k.key, "API key")}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  {k.status === "ACTIVE" && (
                    <Button size="sm" variant="outline" onClick={() => setRevokeTarget(k)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!revokeTarget}
        onOpenChange={(o) => !o && setRevokeTarget(null)}
        title="Revoke this API key?"
        description={`Any integration using "${revokeTarget?.name ?? ""}" will start getting 401 responses immediately. This cannot be undone — you'd need to create a new key and update your integration.`}
        confirmText="Revoke key"
        variant="destructive"
        onConfirm={revoke}
        loading={revoking}
      />
    </div>
  );
}
