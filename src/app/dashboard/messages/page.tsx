"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "@/components/providers/auth-provider";
import { MessagesPanel } from "@/components/messaging/messages-panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Bell,
  Settings,
  MessageSquare,
  ArrowLeft,
} from "lucide-react";

export default function MessagesPage() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") || undefined;
  const recipientId = searchParams.get("recipientId") || undefined;

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/20" />
          <div className="h-4 w-32 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        <p>Please log in to view messages.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Floating orbs background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="floating-orb absolute -top-40 -right-40 w-[500px] h-[500px] bg-primary/10" />
        <div className="floating-orb absolute top-1/2 -left-40 w-[400px] h-[400px] bg-purple-500/10" style={{ animationDelay: '-5s' }} />
        <div className="floating-orb absolute -bottom-40 right-1/3 w-[350px] h-[350px] bg-blue-500/8" style={{ animationDelay: '-10s' }} />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/" className="text-lg sm:text-xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
              IndieCrowdfund
            </Link>
            <Badge variant="outline" className="border-primary/30 text-primary hidden sm:flex">
              <MessageSquare className="w-3 h-3 mr-1" />
              Messages
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="relative hidden sm:flex">
              <Bell className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="hidden sm:flex">
              <Settings className="h-5 w-5" />
            </Button>
            <Avatar className="ring-2 ring-primary/20 h-8 w-8 sm:h-10 sm:w-10">
              <AvatarImage src={session.user.image || undefined} />
              <AvatarFallback className="bg-gradient-to-br from-primary to-purple-500 text-white text-sm sm:text-base">
                {session.user.name?.[0]?.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      <div className="container relative py-6">
        {/* Back button */}
        <div className="mb-6">
          <Link href="/dashboard/backer" className="hidden sm:inline-block">
            <Button variant="ghost" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
          <Link href="/dashboard/backer" className="sm:hidden">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        {/* Messages Panel */}
        <MessagesPanel
          currentUserId={session.user.id}
          projectId={projectId}
          recipientId={recipientId}
        />
      </div>
    </div>
  );
}
