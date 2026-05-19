"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// Lazy-load the full Marketplace page component
const MarketplacePage = dynamic(
  () => import("@/app/dashboard/shop/page"),
  {
    loading: () => (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

interface MarketplaceTabProps {
  projectId: string;
}

export function MarketplaceTab({ projectId }: MarketplaceTabProps) {
  if (typeof window !== "undefined" && projectId) {
    localStorage.setItem("indiecrowdfund_selected_project", projectId);
  }

  return (
    <div className="marketplace-embedded -mx-4 sm:-mx-6 lg:-mx-8">
      <style jsx>{`
        .marketplace-embedded :global(header.sticky) {
          display: none !important;
        }
        .marketplace-embedded :global(.floating-orb) {
          display: none !important;
        }
      `}</style>
      <MarketplacePage />
    </div>
  );
}
