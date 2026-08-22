"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/fetch-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { BookOpen, KeyRound, Loader2, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface AdminApiKey {
  id: string;
  name: string;
  key: string;
  prefix: string;
  secretPrefix: string | null;
  environment: string;
  status: string;
  scopes: string[];
  appName: string | null;
  appUrl: string | null;
  contactEmail: string | null;
  usageCount: number;
  lastUsedAt: string | null;
  lastUsedIp: string | null;
  createdAt: string;
  revokedAt: string | null;
  user: { id: string; name: string | null; email: string } | null;
  createdBy: { id?: string; name: string | null; email: string } | null;
}

export default function AdminApiPage() {
  const [keys, setKeys] = useState<AdminApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState<AdminApiKey | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/api-keys");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setKeys(data.apiKeys || data.keys || []);
    } catch {
      toast.error("Failed to load API keys");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async () => {
    if (!target) return;
    setDeleting(true);
    try {
      const res = await apiFetch(`/api/admin/api-keys?id=${target.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("API key deleted");
        load();
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error || "Failed to delete key");
      }
    } catch {
      toast.error("Failed to delete key");
    } finally {
      setDeleting(false);
      setTarget(null);
    }
  };

  const q = query.trim().toLowerCase();
  const filtered = q
    ? keys.filter((k) =>
        [k.name, k.appName, k.appUrl, k.contactEmail, k.user?.email, k.prefix]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      )
    : keys;

  const active = keys.filter((k) => k.status === "ACTIVE").length;
  const totalCalls = keys.reduce((s, k) => s + (k.usageCount || 0), 0);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <KeyRound className="h-6 w-6" />
            API Keys
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Every credential issued for the public Data API.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/api-docs">
            <BookOpen className="mr-2 h-4 w-4" />
            Public docs
          </Link>
        </Button>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {[
          ["Total keys", keys.length.toLocaleString()],
          ["Active", active.toLocaleString()],
          ["Requests served", totalCalls.toLocaleString()],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="py-4">
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-sm text-muted-foreground">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by owner, app, email or prefix…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {keys.length === 0 ? "No API keys have been issued." : "No keys match that search."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((k) => (
            <Card key={k.id}>
              <CardContent className="flex flex-wrap items-start justify-between gap-4 py-4">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{k.name}</span>
                    <Badge variant={k.status === "ACTIVE" ? "default" : "secondary"}>
                      {k.status}
                    </Badge>
                    <Badge variant="outline">{k.environment}</Badge>
                    {/* Keys minted before the public API have no owner. Flagged
                        rather than hidden — they still authenticate. */}
                    {!k.user && <Badge variant="outline">legacy · no owner</Badge>}
                  </div>
                  <code className="block font-mono text-xs text-muted-foreground break-all">
                    {k.prefix}…
                  </code>
                  {k.appName && (
                    <p className="text-xs text-muted-foreground">
                      {k.appName}
                      {k.appUrl ? ` · ${k.appUrl}` : ""}
                      {k.contactEmail ? ` · ${k.contactEmail}` : ""}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Owner: {k.user ? `${k.user.name || "—"} (${k.user.email})` : "none"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {k.usageCount.toLocaleString()} requests ·{" "}
                    {k.lastUsedAt
                      ? `last ${new Date(k.lastUsedAt).toLocaleString()}`
                      : "never used"}
                    {k.lastUsedIp ? ` · ${k.lastUsedIp}` : ""}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setTarget(k)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!target}
        onOpenChange={(o) => !o && setTarget(null)}
        title="Delete this API key?"
        description={`"${target?.name ?? ""}"${target?.user ? ` owned by ${target.user.email}` : ""} will stop authenticating immediately. Deleting also removes its usage history — if you only want to stop it working, that history is worth keeping, so consider asking the owner to revoke it instead.`}
        confirmText="Delete key"
        variant="destructive"
        onConfirm={remove}
        loading={deleting}
      />
    </div>
  );
}
