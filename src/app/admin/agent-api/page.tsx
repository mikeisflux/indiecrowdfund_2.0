"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, fetchWithRetry } from "@/lib/fetch-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Bot, Copy, KeyRound, Loader2, RefreshCw, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Agent API: keys for the NAS-hosted MCP server, the live tool catalog, and
 * the call log. Credentials are shown exactly once at issue time.
 */

interface AgentKeyRow {
  id: string;
  name: string;
  prefix: string;
  secretPrefix: string | null;
  scopes: string[];
  status: string;
  lastUsedAt: string | null;
  lastUsedIp: string | null;
  usageCount: number;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  createdBy: { name: string | null; email: string } | null;
  _count: { agentCalls: number };
}

interface CallRow {
  id: string;
  tool: string;
  args: Record<string, unknown> | null;
  ok: boolean;
  statusCode: number;
  durationMs: number;
  error: string | null;
  resultSize: number | null;
  ip: string | null;
  createdAt: string;
  apiKey: { name: string } | null;
}

interface ToolRow {
  name: string;
  description: string;
  scope: string;
  mutating: boolean;
}

export default function AgentApiPage() {
  const [keys, setKeys] = useState<AgentKeyRow[]>([]);
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [tools, setTools] = useState<ToolRow[]>([]);
  const [stats, setStats] = useState<{ last24h: number; failed24h: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [allowWrite, setAllowWrite] = useState(false);
  const [issued, setIssued] = useState<{ name: string; apiKey: string; apiSecret: string } | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<AgentKeyRow | null>(null);
  const [revoking, setRevoking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [k, c] = await Promise.all([
        fetchWithRetry("/api/admin/agent-api/keys").then((r) => r.json()),
        fetchWithRetry("/api/admin/agent-api/calls?limit=100").then((r) => r.json()),
      ]);
      if (k.error) throw new Error(k.error);
      if (c.error) throw new Error(c.error);
      setKeys(k.keys);
      setCalls(c.calls);
      setTools(c.tools);
      setStats(c.stats);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createKey = async () => {
    if (newName.trim().length < 2) {
      toast.error("Give the key a name (where it will live, e.g. NAS MCP server)");
      return;
    }
    setCreating(true);
    try {
      const res = await apiFetch("/api/admin/agent-api/keys", { method: "POST", json: { name: newName.trim(), allowWrite } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create key");
      setIssued({ name: data.key.name, apiKey: data.credentials.apiKey, apiSecret: data.credentials.apiSecret });
      setNewName("");
      setAllowWrite(false);
      toast.success("Key issued. Copy the secret now; it is not shown again.");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create key");
    } finally {
      setCreating(false);
    }
  };

  const revoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      const res = await apiFetch(`/api/admin/agent-api/keys?id=${encodeURIComponent(revokeTarget.id)}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to revoke");
      toast.success(`Revoked "${revokeTarget.name}"`);
      setRevokeTarget(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to revoke");
    } finally {
      setRevoking(false);
    }
  };

  const copy = (label: string, value: string) => {
    navigator.clipboard.writeText(value).then(
      () => toast.success(`${label} copied`),
      () => toast.error("Clipboard blocked; select and copy by hand")
    );
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "https://indiecrowdfund.com";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Bot className="h-6 w-6" /> Agent API
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Credentials and audit log for the MCP server that gives Claude access to platform data. Read keys can look at everything;
            write keys can also run the guarded changes listed below, each of which requires an explicit confirmation from the model.
            The integration spec is in the repo at <code className="rounded bg-muted px-1">docs/AGENT-API-MCP-SPEC.md</code>.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
      </div>

      {issued && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-2 font-semibold">
              <ShieldAlert className="h-5 w-5 text-amber-600" /> Credentials for &ldquo;{issued.name}&rdquo; — shown once
            </div>
            <p className="text-sm text-muted-foreground">
              Put these in the MCP server&rsquo;s environment as <code>ICF_API_KEY</code> and <code>ICF_API_SECRET</code>, with{" "}
              <code>ICF_API_URL={origin}</code>. Only a hash of the secret is stored here; if it is lost, revoke and issue a new key.
            </p>
            <CredentialRow label="ICF_API_KEY" value={issued.apiKey} onCopy={copy} />
            <CredentialRow label="ICF_API_SECRET" value={issued.apiSecret} onCopy={copy} />
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => copy("Env block", `ICF_API_URL=${origin}\nICF_API_KEY=${issued.apiKey}\nICF_API_SECRET=${issued.apiSecret}`)}>
                <Copy className="mr-2 h-4 w-4" /> Copy as .env lines
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setIssued(null)}>
                I&rsquo;ve saved them
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-4 p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <KeyRound className="h-4 w-4" /> Issue a key
          </h2>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[240px] flex-1">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Name (where it will live)</label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="NAS MCP server" maxLength={80} />
            </div>
            <label className="flex items-center gap-2 pb-2 text-sm">
              <Checkbox checked={allowWrite} onCheckedChange={(v) => setAllowWrite(v === true)} />
              Allow guarded writes (extend campaign, set goal, add newsletter subscribers, draft email campaign)
            </label>
            <Button onClick={createKey} disabled={creating}>
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
              Issue key
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="border-b px-5 py-3 font-semibold">Keys</div>
          {keys.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">No agent keys yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-5 py-2">Name</th>
                    <th className="px-3 py-2">Key</th>
                    <th className="px-3 py-2">Scopes</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Calls</th>
                    <th className="px-3 py-2">Last used</th>
                    <th className="px-3 py-2">Issued</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {keys.map((k) => (
                    <tr key={k.id} className="border-t">
                      <td className="px-5 py-2 font-medium">{k.name}</td>
                      <td className="px-3 py-2 font-mono text-xs">{k.prefix}…</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {k.scopes.map((s) => (
                            <Badge key={s} variant={s.endsWith("write") ? "destructive" : "secondary"}>{s}</Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={k.status === "ACTIVE" ? "default" : "outline"}>{k.status.toLowerCase()}</Badge>
                      </td>
                      <td className="px-3 py-2 tabular-nums">{k._count.agentCalls}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : "Never"}
                        {k.lastUsedIp && <div className="font-mono">{k.lastUsedIp}</div>}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {new Date(k.createdAt).toLocaleDateString()}
                        <div>{k.createdBy?.name || k.createdBy?.email || ""}</div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {k.status === "ACTIVE" && (
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setRevokeTarget(k)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b px-5 py-3">
            <span className="font-semibold">Recent calls</span>
            {stats && (
              <span className="text-xs text-muted-foreground">
                {stats.last24h} in the last 24h · {stats.failed24h} failed
              </span>
            )}
          </div>
          {calls.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">No calls yet. Once the MCP server is connected, every tool call shows here.</p>
          ) : (
            <div className="max-h-[520px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/80 text-left text-xs uppercase text-muted-foreground backdrop-blur">
                  <tr>
                    <th className="px-5 py-2">When</th>
                    <th className="px-3 py-2">Key</th>
                    <th className="px-3 py-2">Tool</th>
                    <th className="px-3 py-2">Args</th>
                    <th className="px-3 py-2">Result</th>
                    <th className="px-3 py-2">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {calls.map((c) => (
                    <tr key={c.id} className="border-t align-top">
                      <td className="whitespace-nowrap px-5 py-2 text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleString()}</td>
                      <td className="px-3 py-2 text-xs">{c.apiKey?.name ?? "—"}</td>
                      <td className="px-3 py-2 font-mono text-xs">{c.tool}</td>
                      <td className="max-w-[320px] truncate px-3 py-2 font-mono text-[11px] text-muted-foreground" title={JSON.stringify(c.args)}>
                        {c.args && Object.keys(c.args).length > 0 ? JSON.stringify(c.args) : ""}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {c.ok ? (
                          <Badge variant="secondary">ok{c.resultSize ? ` · ${Math.round(c.resultSize / 1024)} KB` : ""}</Badge>
                        ) : (
                          <span className="text-destructive" title={c.error ?? ""}>
                            {c.statusCode} {c.error ? `· ${c.error.slice(0, 80)}` : ""}
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs tabular-nums text-muted-foreground">{c.durationMs} ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="border-b px-5 py-3 font-semibold">Tools ({tools.length})</div>
          <div className="divide-y">
            {tools.map((t) => (
              <div key={t.name} className="flex flex-wrap items-start gap-3 px-5 py-3">
                <code className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs">{t.name}</code>
                <Badge variant={t.mutating ? "destructive" : "secondary"} className="shrink-0">
                  {t.mutating ? "write · confirm required" : "read"}
                </Badge>
                <p className="min-w-[240px] flex-1 text-sm text-muted-foreground">{t.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!revokeTarget}
        onOpenChange={(o) => !o && setRevokeTarget(null)}
        title="Revoke this key?"
        description={`"${revokeTarget?.name ?? ""}" will stop working immediately. The MCP server using it will get 401s until it gets a new key. Its call history is kept.`}
        confirmText="Revoke"
        variant="destructive"
        onConfirm={revoke}
        loading={revoking}
      />
    </div>
  );
}

function CredentialRow({ label, value, onCopy }: { label: string; value: string; onCopy: (label: string, value: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-36 shrink-0 font-mono text-xs text-muted-foreground">{label}</span>
      <code className="flex-1 overflow-x-auto rounded bg-background px-2 py-1 font-mono text-xs">{value}</code>
      <Button size="sm" variant="outline" onClick={() => onCopy(label, value)}>
        <Copy className="h-4 w-4" />
      </Button>
    </div>
  );
}
