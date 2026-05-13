"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, MessageSquare, ChevronDown, ChevronUp } from "lucide-react";
import { formatRelativeTime } from "./utils";

interface UpdateCommentReply {
  id: string;
  userId: string;
  author: string;
  avatarUrl?: string | null;
  content: string;
  createdAt: string;
  parentId: string | null;
}

interface UpdateComment extends UpdateCommentReply {
  replies: UpdateCommentReply[];
}

interface UpdateCommentsProps {
  updateId: string;
  // Same gating as the project Comments tab — committed backer,
  // follower, creator, or accepted collaborator. The page already
  // computes these; we just pass them through.
  canComment: boolean;
  currentUserName?: string;
  currentUserAvatar?: string;
}

/**
 * Inline per-update comment thread, rendered inside each Update card
 * on the Updates tab. Backers were asking for it because comments on
 * the project as a whole get cluttered fast — per-update threads let
 * discussion stay attached to the post it's about (e.g. shipping
 * delay update, milestone announcement).
 *
 * Posts to /api/updates/[updateId]/comments which keeps update threads
 * cleanly separated from the project's main Comments tab.
 */
export function UpdateComments({
  updateId,
  canComment,
  currentUserName,
  currentUserAvatar,
}: UpdateCommentsProps) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [comments, setComments] = useState<UpdateComment[]>([]);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalCount = comments.reduce((sum, c) => sum + 1 + c.replies.length, 0);

  useEffect(() => {
    if (!open || loaded) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/updates/${updateId}/comments`)
      .then((r) => (r.ok ? r.json() : { comments: [] }))
      .then((data) => {
        if (cancelled) return;
        setComments(data.comments || []);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load comments.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, loaded, updateId]);

  const handleSubmit = async () => {
    if (!draft.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await apiFetch(`/api/updates/${updateId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: draft.trim() }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || "Failed to post comment");
      // Append the new top-level comment locally (no refetch).
      setComments((prev) => [
        ...prev,
        {
          ...data,
          replies: [],
        },
      ]);
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post comment");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-6 border-t border-border pt-4">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        className="text-muted-foreground hover:text-foreground -ml-2"
      >
        <MessageSquare className="h-4 w-4 mr-2" />
        {totalCount > 0
          ? `${totalCount} comment${totalCount === 1 ? "" : "s"}`
          : "Comments"}
        {open ? (
          <ChevronUp className="h-4 w-4 ml-1" />
        ) : (
          <ChevronDown className="h-4 w-4 ml-1" />
        )}
      </Button>

      {open && (
        <div className="mt-3 space-y-4">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          )}

          {!loading && comments.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No comments yet. {canComment ? "Be the first." : ""}
            </p>
          )}

          {comments.map((c) => (
            <div key={c.id} className="flex gap-3">
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarImage src={c.avatarUrl || undefined} />
                <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                  {c.author?.[0] || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium">{c.author}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeTime(c.createdAt)}
                  </span>
                </div>
                {c.content.split("\n").map((p, i) => (
                  <p key={i} className="text-sm mt-1 whitespace-pre-wrap break-words">
                    {p}
                  </p>
                ))}
                {c.replies.length > 0 && (
                  <div className="mt-3 space-y-2 border-l-2 border-muted pl-3">
                    {c.replies.map((r) => (
                      <div key={r.id} className="flex gap-2">
                        <Avatar className="h-6 w-6 flex-shrink-0">
                          <AvatarImage src={r.avatarUrl || undefined} />
                          <AvatarFallback className="bg-muted text-muted-foreground text-[10px]">
                            {r.author?.[0] || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className="text-xs font-medium">{r.author}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {formatRelativeTime(r.createdAt)}
                            </span>
                          </div>
                          {r.content.split("\n").map((p, i) => (
                            <p key={i} className="text-xs mt-0.5 whitespace-pre-wrap break-words text-muted-foreground">
                              {p}
                            </p>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {canComment ? (
            <div className="flex gap-3 pt-2">
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarImage src={currentUserAvatar} />
                <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                  {currentUserName?.[0] || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-2">
                <Textarea
                  placeholder="Write a comment…"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="min-h-[70px] resize-none text-sm"
                  disabled={submitting}
                />
                {error && <p className="text-sm text-destructive">{error}</p>}
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={handleSubmit}
                    disabled={!draft.trim() || submitting}
                    className="bg-[#05ce78] hover:bg-[#04b86a]"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Posting…
                      </>
                    ) : (
                      "Post"
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              Back or follow this project to comment on updates.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
