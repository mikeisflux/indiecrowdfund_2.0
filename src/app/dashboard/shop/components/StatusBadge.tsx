"use client";

import { Badge } from "@/components/ui/badge";
import {
  Edit,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MarketplaceBook } from "./types";

export function StatusBadge({ status }: { status: MarketplaceBook["status"] }) {
  const statusConfig = {
    DRAFT: { label: "Draft", icon: Edit, className: "bg-gray-500/20 text-gray-600 dark:text-gray-400 border-gray-500/30" },
    PENDING_REVIEW: { label: "Pending Review", icon: Clock, className: "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30" },
    APPROVED: { label: "Approved", icon: CheckCircle, className: "bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30" },
    LIVE: { label: "Live", icon: CheckCircle, className: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
    REJECTED: { label: "Rejected", icon: XCircle, className: "bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/30" },
    ARCHIVED: { label: "Archived", icon: AlertCircle, className: "bg-zinc-500/20 text-zinc-600 dark:text-muted-foreground border-zinc-500/30" },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge className={cn("border", config.className)}>
      <Icon className="w-3 h-3 mr-1" />
      {config.label}
    </Badge>
  );
}
