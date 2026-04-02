"use client";

import { Badge } from "@/components/ui/badge";
import {
  CreditCard,
  Coins,
} from "lucide-react";

export const getTypeBadge = (type: string) => {
  const config: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    PLEDGE: { label: "Pledge", variant: "default" },
    MARKETPLACE: { label: "Marketplace", variant: "secondary" },
    DC_TRANSACTION: { label: "DC Transaction", variant: "outline" },
    DC_REDEMPTION: { label: "DC Redemption", variant: "outline" },
    PAYOUT: { label: "Payout", variant: "secondary" },
    SETTLEMENT: { label: "Settlement", variant: "secondary" },
    INDIEKIT_AFTERSALE: { label: "IndieKit", variant: "default" },
  };
  const c = config[type] || { label: type, variant: "outline" as const };
  return <Badge variant={c.variant}>{c.label}</Badge>;
};

export const getStatusBadge = (status: string) => {
  const config: Record<string, { className: string }> = {
    COMPLETED: { className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
    PENDING: { className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
    FAILED: { className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
    REFUNDED: { className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
    CANCELLED: { className: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400" },
    CHARGEBACK: { className: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400" },
    PROCESSING: { className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
    INITIATED: { className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  };
  const c = config[status] || { className: "bg-gray-100 text-gray-800" };
  return <Badge className={c.className}>{status}</Badge>;
};

export const getProcessorBadge = (processor: string | null) => {
  if (!processor) return <span className="text-muted-foreground text-xs">N/A</span>;
  if (processor === "STRIPE") {
    return (
      <Badge variant="outline" className="gap-1">
        <CreditCard className="h-3 w-3" />
        Stripe
      </Badge>
    );
  }
  if (processor === "PAYPAL") {
    return (
      <Badge variant="outline" className="gap-1">
        <CreditCard className="h-3 w-3" />
        PayPal
      </Badge>
    );
  }
  if (processor === "WHOP") {
    return (
      <Badge variant="outline" className="gap-1">
        <CreditCard className="h-3 w-3" />
        Whop
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1">
      <Coins className="h-3 w-3" />
      DC
    </Badge>
  );
};
