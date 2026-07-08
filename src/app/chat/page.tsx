"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/components/providers/auth-provider";
import { ChatRoom } from "@/components/chat/chat-room";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  MessageCircle,
  Sparkles,
  Users,
  Shield,
  Heart,
  Zap,
  Loader2,
  LogIn,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";

export default function ChatPage() {
  const { data: session, status } = useSession();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Show loading state while checking auth
  if (status === "loading" || !isClient) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
        <div className="container py-12">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-muted-foreground">Loading...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Not logged in - show login prompt
  if (!session?.user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
        {/* Hero Section */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-purple-500/20 to-cyan-500/20 blur-3xl" />
          <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5" />

          <div className="container relative py-20">
            <div className="max-w-3xl mx-auto text-center space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium">
                <MessageCircle className="h-4 w-4" />
                Community Chat
                <Sparkles className="h-4 w-4" />
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-foreground via-primary to-purple-500 bg-clip-text text-transparent">
                Join the Conversation
              </h1>

              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Connect with fellow backers, creators, and indie enthusiasts in real-time.
                Share ideas, celebrate wins, and be part of our amazing community.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                <Link href="/login?callbackUrl=/chat">
                  <Button size="lg" className="gap-2 shadow-lg shadow-primary/25">
                    <LogIn className="h-5 w-5" />
                    Log in to Chat
                  </Button>
                </Link>
                <Link href="/register?callbackUrl=/chat">
                  <Button size="lg" variant="outline" className="gap-2">
                    Create Account
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div className="container py-16">
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mb-2">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <CardTitle>Real-time Community</CardTitle>
                <CardDescription>
                  Chat with backers and creators from around the world in real-time
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-2">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
                <CardTitle>Emoji & Stickers</CardTitle>
                <CardDescription>
                  Express yourself with full emoji support and fun sticker packs
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center mb-2">
                  <Shield className="h-6 w-6 text-white" />
                </div>
                <CardTitle>Safe & Friendly</CardTitle>
                <CardDescription>
                  A positive space for indie creators and supporters to connect
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="container pb-20">
          <Card className="bg-gradient-to-r from-primary/10 via-purple-500/10 to-cyan-500/10 border-primary/20">
            <CardContent className="py-12 text-center">
              <Heart className="h-12 w-12 mx-auto mb-4 text-primary" />
              <h3 className="text-2xl font-bold mb-2">Ready to join?</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Sign up for free and become part of the IndieCrowdfund community today.
              </p>
              <Link href="/register?callbackUrl=/chat">
                <Button size="lg" className="gap-2">
                  <Zap className="h-5 w-5" />
                  Get Started Free
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Logged in - show chat room
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      {/* Back Link */}
      <div className="container pt-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>
      </div>

      {/* Header */}
      <div className="relative overflow-hidden border-b">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-purple-500/10 to-cyan-500/10" />
        <div className="container relative py-8">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center">
              <MessageCircle className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Community Chat</h1>
              <p className="text-muted-foreground">
                Connect with the IndieCrowdfund community
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Room */}
      <div className="container py-6">
        <ChatRoom />
      </div>

      {/* Guidelines */}
      <div className="container pb-12">
        <Card className="bg-muted/30 border-border/50">
          <CardContent className="py-6">
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-pink-500" />
                <span>Be kind and respectful</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-green-500" />
                <span>No spam or self-promotion</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-500" />
                <span>Support fellow creators</span>
              </div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-yellow-500" />
                <span>Have fun!</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
