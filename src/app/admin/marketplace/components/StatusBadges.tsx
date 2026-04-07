import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, { label: string; className: string }> = {
    DRAFT: { label: "Draft", className: "bg-gray-100 text-gray-700 border-gray-200" },
    PENDING_REVIEW: { label: "Pending Review", className: "bg-amber-100 text-amber-700 border-amber-200" },
    APPROVED: { label: "Approved", className: "bg-blue-100 text-blue-700 border-blue-200" },
    LIVE: { label: "Live", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    REJECTED: { label: "Rejected", className: "bg-rose-100 text-rose-700 border-rose-200" },
    ARCHIVED: { label: "Archived", className: "bg-muted text-foreground border-border" },
  };

  const config = configs[status] || { label: status, className: "bg-gray-500/20 text-gray-400 border-gray-500/30" };

  return (
    <Badge className={cn("border", config.className)}>
      {config.label}
    </Badge>
  );
}

export function TransactionStatusBadge({ status }: { status: string }) {
  const configs: Record<string, { label: string; className: string }> = {
    PENDING: { label: "Pending", className: "bg-amber-100 text-amber-700 border-amber-200" },
    COMPLETED: { label: "Completed", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    FAILED: { label: "Failed", className: "bg-rose-100 text-rose-700 border-rose-200" },
    REFUNDED: { label: "Refunded", className: "bg-purple-100 text-purple-700 border-purple-200" },
  };

  const config = configs[status] || { label: status, className: "bg-gray-500/20 text-gray-400 border-gray-500/30" };

  return (
    <Badge className={cn("border", config.className)}>
      {config.label}
    </Badge>
  );
}
