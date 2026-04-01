"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings } from "lucide-react";

export function LoadingState() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="floating-orb absolute -top-40 -right-40 w-[500px] h-[500px] bg-primary/10" />
        <div className="floating-orb absolute top-1/2 -left-40 w-[400px] h-[400px] bg-purple-500/10" style={{ animationDelay: '-5s' }} />
        <div className="floating-orb absolute -bottom-40 right-1/4 w-[350px] h-[350px] bg-cyan-500/8" style={{ animationDelay: '-10s' }} />
      </div>

      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center">
          <Link href="/" className="text-xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
            IndieCrowdfund
          </Link>
          <Badge variant="outline" className="ml-4 border-primary/30 text-primary">
            <Settings className="w-3 h-3 mr-1" />
            Settings
          </Badge>
        </div>
      </header>

      <div className="container py-8 max-w-4xl">
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="bg-card/50 backdrop-blur">
              <CardHeader>
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-64" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
