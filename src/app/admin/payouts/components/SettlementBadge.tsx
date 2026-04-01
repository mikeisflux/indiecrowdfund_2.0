"use client";

import { Clock, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function getSettlementBadge(status: string) {
  switch (status) {
    case "pending":
      return (
        <Badge variant="outline" className="text-yellow-600 border-yellow-600">
          <Clock className="w-3 h-3 mr-1" />
          Pending Payout
        </Badge>
      );
    case "processing":
      return (
        <Badge variant="outline" className="text-blue-600 border-blue-600">
          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          Processing
        </Badge>
      );
    case "settled":
      return (
        <Badge variant="outline" className="text-emerald-600 border-emerald-600">
          <CheckCircle className="w-3 h-3 mr-1" />
          Settled
        </Badge>
      );
    case "overpaid":
      return (
        <Badge variant="outline" className="text-red-600 border-red-600">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Overpaid
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}
