"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  RefreshCw,
  Search,
  CheckCircle,
  Clock,
  XCircle,
  Loader2,
  Eye,
  Mail,
} from "lucide-react";
import { sanitizeEmailHtml } from "@/lib/utils/sanitize";
import { formatDistanceToNow } from "date-fns";

interface QueueEmail {
  id: string;
  toEmail: string;
  subject: string;
  fromEmail: string | null;
  fromName: string | null;
  status: "PENDING" | "PROCESSING" | "SENT" | "FAILED";
  priority: number;
  attempts: number;
  maxAttempts: number;
  error: string | null;
  createdAt: string;
  processedAt: string | null;
  sentAt: string | null;
}

interface DetailEmail extends QueueEmail {
  replyTo: string | null;
  bodyHtml: string;
  bodyText: string | null;
}

const STATUS_FILTERS: Array<{ value: "all" | "PENDING" | "PROCESSING" | "SENT" | "FAILED"; label: string }> = [
  { value: "all", label: "All" },
  { value: "SENT", label: "Sent" },
  { value: "PENDING", label: "Pending" },
  { value: "PROCESSING", label: "Processing" },
  { value: "FAILED", label: "Failed" },
];

function StatusBadge({ status }: { status: QueueEmail["status"] }) {
  if (status === "SENT") {
    return (
      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
        <CheckCircle className="h-3 w-3 mr-1" /> Sent
      </Badge>
    );
  }
  if (status === "PENDING") {
    return (
      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
        <Clock className="h-3 w-3 mr-1" /> Pending
      </Badge>
    );
  }
  if (status === "PROCESSING") {
    return (
      <Badge className="bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300">
        <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Processing
      </Badge>
    );
  }
  return (
    <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
      <XCircle className="h-3 w-3 mr-1" /> Failed
    </Badge>
  );
}

export default function CreatorSentEmailsPage() {
  const [emails, setEmails] = useState<QueueEmail[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [status, setStatus] = useState<typeof STATUS_FILTERS[number]["value"]>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<DetailEmail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Debounce search input — avoid hammering the API while typing.
  useEffect(() => {
    const h = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(h);
  }, [search]);

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    else setRefreshing(true);
    try {
      const params = new URLSearchParams({
        status,
        page: String(page),
        limit: "50",
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      const r = await apiFetch(`/api/admin/email/creator-sent?${params}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "Failed to load");
      setEmails(data.items || []);
      setCounts(data.countByStatus || {});
      setTotalPages(data.pagination?.totalPages || 1);
      setTotal(data.pagination?.total || 0);
    } catch {
      // Soft-fail: a stale list is better than an error banner that
      // fights the auto-refresh below.
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [status, page, debouncedSearch]);

  useEffect(() => {
    load(true);
  }, [load]);

  // Auto-refresh every 30s so the monitor stays current as new sends
  // queue up. Pause while a detail dialog is open so the row swap
  // doesn't yank the open email out from under the admin.
  useEffect(() => {
    if (selected) return;
    const h = setInterval(() => load(false), 30_000);
    return () => clearInterval(h);
  }, [selected, load]);

  const openDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const r = await apiFetch(`/api/admin/email/creator-sent/${encodeURIComponent(id)}`);
      const data = await r.json();
      if (r.ok && data.email) {
        setSelected(data.email);
      }
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const sanitizedBody = useMemo(() => {
    if (!selected) return "";
    return sanitizeEmailHtml(selected.bodyHtml);
  }, [selected]);

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/admin/email" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Back to Email Center
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Mail className="h-6 w-6" /> IndieKit Outbound
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every email that left the platform on behalf of a creator — campaigns,
          inbox replies, scheduled sends. Use this to monitor what creators are
          actually sending to backers / subscribers.
        </p>
      </div>

      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            {STATUS_FILTERS.map((f) => (
              <Button
                key={f.value}
                variant={status === f.value ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setStatus(f.value);
                  setPage(1);
                }}
              >
                {f.label}
                <span className="ml-2 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-muted text-xs">
                  {counts[f.value] ?? 0}
                </span>
              </Button>
            ))}
            <div className="ml-auto flex items-center gap-2 flex-1 min-w-[260px]">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search recipient, subject, sender…"
                  className="pl-8"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <Button variant="outline" size="sm" onClick={() => load(false)} disabled={refreshing}>
                <RefreshCw className={`h-4 w-4 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {total === 0 ? "No emails" : `${total.toLocaleString()} email${total === 1 ? "" : "s"}`}
            {debouncedSearch && ` matching "${debouncedSearch}"`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : emails.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">
              No creator-sent emails match these filters.
            </p>
          ) : (
            <div className="border rounded-md divide-y">
              {emails.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => openDetail(e.id)}
                  className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium truncate">{e.subject}</p>
                        <StatusBadge status={e.status} />
                        {e.attempts > 1 && (
                          <Badge variant="outline" className="text-xs">
                            {e.attempts}/{e.maxAttempts} attempts
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        From <span className="font-medium">{e.fromName || e.fromEmail || "—"}</span>{" "}
                        {e.fromEmail && <span className="font-mono">&lt;{e.fromEmail}&gt;</span>}
                        {" "}→ <span className="font-mono">{e.toEmail}</span>
                      </p>
                      {e.error && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1 truncate">
                          Error: {e.error}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-muted-foreground">
                        {e.sentAt
                          ? `sent ${formatDistanceToNow(new Date(e.sentAt), { addSuffix: true })}`
                          : `queued ${formatDistanceToNow(new Date(e.createdAt), { addSuffix: true })}`}
                      </p>
                      <Eye className="h-4 w-4 inline-block mt-1 text-muted-foreground" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-xs text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="break-words">{selected?.subject}</DialogTitle>
            <DialogDescription className="space-y-1">
              <span className="block">
                <strong>From:</strong> {selected?.fromName || "—"}
                {selected?.fromEmail && <span className="font-mono"> &lt;{selected.fromEmail}&gt;</span>}
              </span>
              <span className="block">
                <strong>To:</strong> <span className="font-mono">{selected?.toEmail}</span>
              </span>
              {selected?.replyTo && (
                <span className="block">
                  <strong>Reply-To:</strong> <span className="font-mono">{selected.replyTo}</span>
                </span>
              )}
              <span className="block">
                <strong>Status:</strong> {selected && <StatusBadge status={selected.status} />}
                {selected?.sentAt && (
                  <span className="ml-2 text-muted-foreground">
                    sent {new Date(selected.sentAt).toLocaleString()}
                  </span>
                )}
              </span>
              {selected?.error && (
                <span className="block text-red-600 dark:text-red-400">
                  <strong>Error:</strong> {selected.error}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="border rounded-md bg-white dark:bg-zinc-50">
              {/* Render the sanitized body in an isolated iframe-like
                  container so the email's CSS doesn't bleed into the
                  admin app's chrome. sanitizeEmailHtml strips scripts /
                  event handlers / dangerous attributes — we don't trust
                  the body even for admin viewing, since it could contain
                  XSS payloads from a hostile creator account. */}
              <div
                className="p-4 text-zinc-900"
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: sanitizedBody }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
