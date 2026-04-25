"use client";

import { ChatRoom } from "@/components/chat/chat-room";
import { Card, CardContent } from "@/components/ui/card";
import { MessageCircle } from "lucide-react";
import Link from "next/link";

export function CommunityTab() {
  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Community</h2>
        <Link
          href="/chat"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <MessageCircle className="h-4 w-4" />
          Open in full screen
        </Link>
      </div>

      <Card>
        <CardContent className="p-3 sm:p-4">
          <p className="text-sm text-muted-foreground mb-3">
            This is the IndieCrowdfund community chat — shared across every
            project on the site. Say hi to other backers, share what you&apos;re
            backing, and ask creators questions.
          </p>
          <div className="rounded-lg border border-border/40 overflow-hidden">
            <ChatRoom />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
