"use client";

import {
  AlertTriangle,
  AlertCircle,
  Bug,
  XCircle,
  Monitor,
  Server,
  Globe,
  Zap,
} from "lucide-react";

export function levelIcon(level: string) {
  switch (level) {
    case "FATAL":
      return <XCircle className="h-4 w-4 text-red-600" />;
    case "ERROR":
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    case "WARNING":
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    case "INFO":
      return <Bug className="h-4 w-4 text-blue-500" />;
    default:
      return <Bug className="h-4 w-4 text-muted-foreground" />;
  }
}

export function levelBadgeColor(level: string) {
  switch (level) {
    case "FATAL":
      return "bg-red-600 text-white";
    case "ERROR":
      return "bg-red-500/20 text-red-600 dark:text-red-400";
    case "WARNING":
      return "bg-amber-500/20 text-amber-600 dark:text-amber-400";
    case "INFO":
      return "bg-blue-500/20 text-blue-600 dark:text-blue-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function sourceIcon(source: string) {
  switch (source) {
    case "CLIENT":
      return <Monitor className="h-3 w-3" />;
    case "SERVER":
      return <Server className="h-3 w-3" />;
    case "API":
      return <Zap className="h-3 w-3" />;
    case "EDGE":
    case "MIDDLEWARE":
      return <Globe className="h-3 w-3" />;
    default:
      return <Server className="h-3 w-3" />;
  }
}

export function statusColor(status: string) {
  switch (status) {
    case "UNRESOLVED":
      return "bg-red-500/20 text-red-600 dark:text-red-400";
    case "IN_PROGRESS":
      return "bg-amber-500/20 text-amber-600 dark:text-amber-400";
    case "RESOLVED":
      return "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400";
    case "IGNORED":
      return "bg-zinc-500/20 text-muted-foreground dark:text-muted-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function timeAgo(dateStr: string) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
