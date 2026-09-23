"use client";

/**
 * AI Publicist — the approval queue for AI-written social posts.
 *
 * The publicist (src/lib/social/publicist.ts) watches for campaign
 * launches, funding milestones, ending-soon windows and the Sunday
 * roundup, writes a post for each, and queues it here. With "Require
 * Post Approval" on (Admin Settings > Social) posts wait for a human;
 * off, the hourly cron posts them itself. Either way this page is the
 * record of everything the platform has said publicly.
 */

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import {
  Megaphone,
  Sparkles,
  Check,
  X,
  Send,
  Trash2,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, fetchWithRetry } from "@/lib/fetch-utils";

interface SocialPostRow {
  id: string;
  platform: string;
  postType: string;
  projectId: string | null;
  content: string;
  imageUrl: string | null;
  status: string;
  error: string | null;
  externalId: string | null;
  postedAt: string | null;
  createdAt: string;
  project: { title: string; url: string } | null;
}

const POST_TYPE_LABEL: Record<string, string> = {
  launch: "Campaign Launch",
  milestone_50: "50% Funded",
  milestone_100: "Fully Funded",
  ending_soon: "Ending Soon",
  weekly_roundup: "Weekly Roundup",
};

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  APPROVED: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  POSTED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  REJECTED: "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400",
  FAILED: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

const FILTERS = ["ALL", "PENDING", "APPROVED", "POSTED", "FAILED", "REJECTED"] as const;

export default function SocialPublicistPage() {
  const [posts, setPosts] = useState<SocialPostRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("ALL");
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const qs = filter === "ALL" ? "" : `?status=${filter}`;
      const res = await fetchWithRetry(`/api/admin/social-posts${qs}`);
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setPosts(data.posts);
      setCounts(data.counts || {});
    } catch {
      toast.error("Could not load the post queue");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const scanNow = async () => {
    setScanning(true);
    try {
      const res = await apiFetch("/api/admin/social-posts/generate", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scan failed");
      const conn = data.connection?.ok
        ? `X connected as @${data.connection.username}`
        : `X not connected: ${data.connection?.error || "credentials missing"}`;
      toast.success(`Queued ${data.queued} new post(s) · ${conn}`);
      if (data.notes?.length) data.notes.forEach((n: string) => toast.info(n));
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  };

  const update = async (id: string, body: { content?: string; status?: string }) => {
    setBusyId(id);
    try {
      const res = await apiFetch(`/api/admin/social-posts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      setDrafts((d) => {
        const next = { ...d };
        delete next[id];
        return next;
      });
      await load();
      toast.success("Saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  };

  const publishNow = async (id: string) => {
    setBusyId(id);
    try {
      const res = await apiFetch(`/api/admin/social-posts/${id}/publish`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Publish failed");
      toast.success("Posted to X");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    setBusyId(id);
    try {
      const res = await apiFetch(`/api/admin/social-posts/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      toast.success("Deleted");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Megaphone className="h-6 w-6 text-emerald-600" />
            AI Publicist
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            The AI watches for launches, funding milestones, and ending-soon campaigns, writes
            the post, and publishes to the platform&apos;s X account. Master switch and approval
            mode live in{" "}
            <Link href="/admin/settings" className="text-emerald-600 hover:underline">
              Settings → Social
            </Link>
            .
          </p>
        </div>
        <Button onClick={scanNow} disabled={scanning}>
          {scanning ? (
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          Scan for moments now
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              filter === f
                ? "bg-emerald-600 text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
          >
            {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
            {f !== "ALL" && counts[f] ? ` (${counts[f]})` : ""}
          </button>
        ))}
      </div>

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" /> Loading queue…
          </CardContent>
        </Card>
      ) : posts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nothing here yet. Hit <span className="font-semibold">Scan for moments now</span> to
            have the AI look for postable campaigns, or wait for the hourly cron.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => {
            const editable = post.status === "PENDING" || post.status === "APPROVED" || post.status === "FAILED";
            const draft = drafts[post.id] ?? post.content;
            const dirty = draft !== post.content;
            const busy = busyId === post.id;
            return (
              <Card key={post.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={STATUS_STYLE[post.status] || ""}>{post.status}</Badge>
                    <Badge variant="outline">{POST_TYPE_LABEL[post.postType] || post.postType}</Badge>
                    {post.project && (
                      <Link
                        href={post.project.url}
                        target="_blank"
                        className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                      >
                        {post.project.title}
                      </Link>
                    )}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {new Date(post.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    {post.imageUrl && (
                      <Image
                        src={post.imageUrl}
                        alt="Post image"
                        width={160}
                        height={120}
                        unoptimized
                        className="h-28 w-40 shrink-0 rounded-lg border object-cover"
                      />
                    )}
                    <div className="min-w-0 flex-1 space-y-2">
                      {editable ? (
                        <>
                          <Textarea
                            value={draft}
                            maxLength={280}
                            rows={3}
                            onChange={(e) =>
                              setDrafts((d) => ({ ...d, [post.id]: e.target.value }))
                            }
                          />
                          <div className="text-right text-xs text-muted-foreground">
                            {draft.length}/280
                          </div>
                        </>
                      ) : (
                        <p className="whitespace-pre-wrap text-sm">{post.content}</p>
                      )}

                      {post.status === "FAILED" && post.error && (
                        <p className="flex items-start gap-1.5 rounded-md bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          {post.error}
                        </p>
                      )}
                      {post.status === "POSTED" && post.externalId && (
                        <a
                          href={`https://x.com/i/status/${post.externalId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-sky-600 hover:underline"
                        >
                          View on X <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>

                  {editable && (
                    <div className="flex flex-wrap gap-2 border-t pt-3">
                      {dirty && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy || draft.trim().length === 0}
                          onClick={() => update(post.id, { content: draft })}
                        >
                          Save edit
                        </Button>
                      )}
                      {post.status === "PENDING" && (
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            update(post.id, {
                              status: "APPROVED",
                              ...(dirty ? { content: draft } : {}),
                            })
                          }
                        >
                          <Check className="mr-1 h-3.5 w-3.5" /> Approve
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy || dirty}
                        onClick={() => publishNow(post.id)}
                        title={dirty ? "Save your edit first" : "Post to X immediately"}
                      >
                        <Send className="mr-1 h-3.5 w-3.5" /> Post now
                      </Button>
                      {post.status !== "FAILED" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => update(post.id, { status: "REJECTED" })}
                        >
                          <X className="mr-1 h-3.5 w-3.5" /> Reject
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        className="ml-auto text-red-600 hover:text-red-700"
                        onClick={() => remove(post.id)}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                      </Button>
                    </div>
                  )}
                  {post.status === "REJECTED" && (
                    <div className="flex gap-2 border-t pt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => update(post.id, { status: "PENDING" })}
                      >
                        Restore to pending
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        className="ml-auto text-red-600 hover:text-red-700"
                        onClick={() => remove(post.id)}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
