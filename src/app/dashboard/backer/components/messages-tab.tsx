"use client";

import { useSession } from "@/components/providers/auth-provider";
import { MessagesPanel } from "@/components/messaging/messages-panel";
import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare, Loader2 } from "lucide-react";

export function MessagesTab() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardContent className="py-12 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!session?.user?.id) {
    return (
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardContent className="py-12 text-center">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">Please log in to view messages</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <MessagesPanel
      currentUserId={session.user.id}
      variant="full"
    />
  );
}
