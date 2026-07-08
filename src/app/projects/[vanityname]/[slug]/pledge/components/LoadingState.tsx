"use client";

import { Loader2 } from "lucide-react";

interface LoadingStateProps {
  message: string;
  orbColor?: string;
}

export function LoadingState({ message, orbColor = "bg-primary/10" }: LoadingStateProps) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center relative">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className={`floating-orb absolute -top-40 -right-40 w-[500px] h-[500px] ${orbColor}`} />
        <div className="floating-orb absolute top-1/3 -left-40 w-[400px] h-[400px] bg-purple-500/10" style={{ animationDelay: '-5s' }} />
      </div>
      <div className="text-center relative">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl glass-card mb-6 relative">
          <div className="absolute inset-0 rounded-2xl bg-primary/20 animate-ping" />
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
        <p className="text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
