"use client";

import { useCallback, useEffect, useState } from "react";
import { ScrollText, LogIn, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

interface AuditRow {
  id: string;
  action: string;
  actorId: string;
  actorEmail: string | null;
  targetId: string | null;
  targetType: string | null;
  details: Record<string, unknown> | null;
  changes: Record<string, { from: string; to: string }> | null;
  createdAt: string;
}
interface LoginRow {
  id: string;
  userId: string | null;
  email: string;
  ip: string | null;
  userAgent: string | null;
  success: boolean;
  reason: string | null;
  createdAt: string;
}

// Who did what, and who signed in from where. The durable record the FBI's
// ARTEX FLASH asks for first: authentication logs with IPs, user agents and
// timestamps, and the admin actions around them.
export default function AuditLogPage() {
  const [view, setView] = useState<"audit" | "logins">("audit");
  const [days, setDays] = useState("30");
  const [action, setAction] = useState("");
  const [actor, setActor] = useState("");
  const [email, setEmail] = useState("");
  const [ip, setIp] = useState("");
  const [failedOnly, setFailedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [logins, setLogins] = useState<LoginRow[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ view, days, page: String(page) });
      if (view === "audit") {
        if (action) params.set("action", action);
        if (actor) params.set("actor", actor);
      } else {
        if (email) params.set("email", email);
        if (ip) params.set("ip", ip);
        if (failedOnly) params.set("failed", "1");
      }
      const res = await fetch(`/api/admin/audit-log?${params}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) return;
      setTotal(data.total || 0);
      if (view === "audit") {
        setAudit(data.rows || []);
        setActions(data.actions || []);
      } else {
        setLogins(data.rows || []);
      }
    } finally {
      setLoading(false);
    }
  }, [view, days, page, action, actor, email, ip, failedOnly]);

  useEffect(() => {
    load();
  }, [load]);

  const pages = Math.max(1, Math.ceil(total / 100));

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold sm:text-3xl">
            <ScrollText className="h-7 w-7" />
            Audit Log
          </h1>
          <p className="mt-1 text-muted-foreground">Admin actions and sign-in events, kept in the database.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant={view === "audit" ? "default" : "outline"} size="sm" onClick={() => { setView("audit"); setPage(1); }}>
            <ScrollText className="mr-1 h-4 w-4" /> Actions
          </Button>
          <Button variant={view === "logins" ? "default" : "outline"} size="sm" onClick={() => { setView("logins"); setPage(1); }}>
            <LogIn className="mr-1 h-4 w-4" /> Sign-ins
          </Button>
          <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={days} onValueChange={(v) => { setDays(v); setPage(1); }}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Last 24 hours</SelectItem>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="365">Last year</SelectItem>
          </SelectContent>
        </Select>
        {view === "audit" ? (
          <>
            <Select value={action || "all"} onValueChange={(v) => { setAction(v === "all" ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-64"><SelectValue placeholder="All actions" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {actions.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input placeholder="Actor email or id" value={actor} onChange={(e) => { setActor(e.target.value); setPage(1); }} className="w-56" />
          </>
        ) : (
          <>
            <Input placeholder="Email contains" value={email} onChange={(e) => { setEmail(e.target.value); setPage(1); }} className="w-56" />
            <Input placeholder="IP address" value={ip} onChange={(e) => { setIp(e.target.value); setPage(1); }} className="w-44" />
            <Button variant={failedOnly ? "default" : "outline"} size="sm" onClick={() => { setFailedOnly(!failedOnly); setPage(1); }}>
              Failed only
            </Button>
          </>
        )}
        <span className="text-sm text-muted-foreground">{total.toLocaleString()} rows</span>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        {view === "audit" ? (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-2">When</th>
                <th className="p-2">Action</th>
                <th className="p-2">Actor</th>
                <th className="p-2">Target</th>
                <th className="p-2">Details</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((r) => (
                <tr key={r.id} className="border-t align-top">
                  <td className="whitespace-nowrap p-2 text-muted-foreground">{format(new Date(r.createdAt), "MMM d, HH:mm:ss")}</td>
                  <td className="p-2"><Badge variant="outline">{r.action}</Badge></td>
                  <td className="p-2">{r.actorEmail || r.actorId}</td>
                  <td className="p-2 font-mono text-xs">{r.targetType ? `${r.targetType}:` : ""}{r.targetId || ""}</td>
                  <td className="max-w-xl p-2 text-xs">
                    {r.changes && Object.keys(r.changes).length > 0 && (
                      <div className="mb-1">
                        {Object.entries(r.changes).map(([k, v]) => (
                          <div key={k}><span className="font-medium">{k}</span>: {v.from} → {v.to}</div>
                        ))}
                      </div>
                    )}
                    {r.details && <pre className="whitespace-pre-wrap break-all text-muted-foreground">{JSON.stringify(r.details)}</pre>}
                  </td>
                </tr>
              ))}
              {!loading && audit.length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Nothing in this range.</td></tr>
              )}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-2">When</th>
                <th className="p-2">Email</th>
                <th className="p-2">Result</th>
                <th className="p-2">IP</th>
                <th className="p-2">Browser</th>
              </tr>
            </thead>
            <tbody>
              {logins.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="whitespace-nowrap p-2 text-muted-foreground">{format(new Date(r.createdAt), "MMM d, HH:mm:ss")}</td>
                  <td className="p-2">{r.email}</td>
                  <td className="p-2">
                    <Badge variant={r.success ? "default" : "destructive"} className={r.success ? "bg-emerald-600" : ""}>
                      {r.success ? "ok" : "failed"}{r.reason ? ` · ${r.reason}` : ""}
                    </Badge>
                  </td>
                  <td className="p-2 font-mono text-xs">{r.ip || ""}</td>
                  <td className="max-w-md truncate p-2 text-xs text-muted-foreground" title={r.userAgent || ""}>{r.userAgent || ""}</td>
                </tr>
              ))}
              {!loading && logins.length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Nothing in this range.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <span>Page {page} of {pages}</span>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}
      {loading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
    </div>
  );
}
