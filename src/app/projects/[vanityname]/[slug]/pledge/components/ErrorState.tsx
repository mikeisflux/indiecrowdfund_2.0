"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  error: string | null;
}

export function ErrorState({ error }: ErrorStateProps) {
  return (
    <div className="min-h-screen bg-background relative">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="floating-orb absolute -top-40 -right-40 w-[500px] h-[500px] bg-red-500/10" />
        <div className="floating-orb absolute top-1/3 -left-40 w-[400px] h-[400px] bg-orange-500/10" style={{ animationDelay: '-5s' }} />
      </div>
      <header className="sticky top-0 z-50 border-b border-border/50 glass-card">
        <div className="container flex h-14 items-center">
          <Link href="/" className="text-xl font-bold bg-gradient-to-r from-primary to-emerald-600 bg-clip-text text-transparent">
            IndieCrowdfund
          </Link>
        </div>
      </header>
      <div className="container py-16 relative">
        <div className="mx-auto max-w-lg text-center glass-card rounded-2xl p-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-900/30 mb-4">
            <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="mb-2 text-2xl font-bold">Unable to load project</h2>
          <p className="mb-8 text-muted-foreground">
            {error || "The project you're looking for could not be found."}
          </p>
          <Link href="/discover">
            <Button className="bg-gradient-to-r from-primary to-emerald-600 hover:from-primary/90 hover:to-emerald-600/90 shadow-lg shadow-primary/20">
              Discover Projects
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
