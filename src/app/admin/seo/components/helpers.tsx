"use client";

import { Badge } from "@/components/ui/badge";

// ─── Helper Components ───────────────────────────────────────────────

export function ScoreGauge({ score, size = 120 }: { score: number; size?: number }) {
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color =
    score >= 80
      ? "text-emerald-500"
      : score >= 60
        ? "text-yellow-500"
        : "text-red-500";
  const strokeColor =
    score >= 80
      ? "#10b981"
      : score >= 60
        ? "#eab308"
        : "#ef4444";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-muted/20"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`text-2xl font-bold ${color}`}>{score}</span>
        <span className="text-xs text-muted-foreground">/100</span>
      </div>
    </div>
  );
}

export function ScoreBadge({ score }: { score: number }) {
  if (score >= 80) {
    return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">{score}</Badge>;
  }
  if (score >= 60) {
    return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">{score}</Badge>;
  }
  return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">{score}</Badge>;
}

export function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "success":
    case "completed":
      return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">{status}</Badge>;
    case "partial":
    case "running":
      return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">{status}</Badge>;
    case "error":
    case "failed":
      return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">{status}</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function EmptyState({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-muted/50 p-4 mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium text-muted-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground/70 max-w-md">{description}</p>
    </div>
  );
}

// ─── Utility Functions ───────────────────────────────────────────────

export function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
