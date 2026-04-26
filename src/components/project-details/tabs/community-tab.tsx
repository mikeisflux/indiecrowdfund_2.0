"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChatRoom } from "@/components/chat/chat-room";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageCircle } from "lucide-react";

interface CommunityTabProps {
  creatorId?: string | null;
  creatorName?: string | null;
}

interface ResolvedRoom {
  id: string;
  name: string;
  slug: string;
}

export function CommunityTab({ creatorId, creatorName }: CommunityTabProps = {}) {
  const [room, setRoom] = useState<ResolvedRoom | null>(null);
  const [loading, setLoading] = useState<boolean>(!!creatorId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!creatorId) {
      setRoom(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/chat/rooms/resolve?creatorId=${encodeURIComponent(creatorId)}`, {
      credentials: "include",
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = await res.json();
        if (!cancelled) setRoom(data.room || null);
      })
      .catch((err) => {
        if (!cancelled) setError(String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [creatorId]);

  const fallbackBrand =
    creatorName?.trim() ? `${creatorName.trim()}'s Chat` : null;
  const headerBrand = room?.name || fallbackBrand || "Community";
  const fullScreenHref = room?.slug ? `/chat/${room.slug}` : "/chat";

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">{headerBrand}</h2>
        <Link
          href={fullScreenHref}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <MessageCircle className="h-4 w-4" />
          Open in full screen
        </Link>
      </div>

      <Card>
        <CardContent className="p-3 sm:p-4">
          {creatorId ? (
            <p className="text-sm text-muted-foreground mb-3">
              This chat belongs to{" "}
              <span className="font-medium text-foreground">
                {creatorName || "the creator"}
              </span>{" "}
              and follows them across every project they launch. Hop in to ask
              questions, hang out with other backers, or catch a live launch
              party stream.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground mb-3">
              The IndieCrowdfund community chat — say hi to other backers and
              creators.
            </p>
          )}

          <div className="rounded-lg border border-border/40 overflow-hidden">
            {loading ? (
              <div className="p-6">
                <Skeleton className="h-[420px] w-full rounded-md" />
              </div>
            ) : error ? (
              <div className="p-6 text-sm text-muted-foreground">
                Couldn&apos;t load the chat. Please refresh.
              </div>
            ) : (
              <ChatRoom
                roomId={room?.id ?? null}
                brandName={room?.name ?? null}
              />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
