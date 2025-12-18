"use client";

import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import type { FulfillmentStats } from "../../types";

interface PreOrdersTabProps {
  stats: FulfillmentStats | null;
  hasActiveCampaign?: boolean;
}

export function PreOrdersTab({ hasActiveCampaign = false }: PreOrdersTabProps) {
  if (!hasActiveCampaign) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Active Campaign</h3>
            <p className="text-muted-foreground">
              You must have an active campaign to see data here.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Pre-Orders Coming Soon</h3>
          <p className="text-muted-foreground">
            Pre-order features will be available here once your campaign ends.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
