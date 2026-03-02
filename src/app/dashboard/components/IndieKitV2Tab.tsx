"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import { InitialProjectIdContext } from "@/app/dashboard/indiekit-v2/constants";

// Lazy-load the full IndieKit V2 page component to keep the main dashboard bundle small
const IndieKitV2Page = dynamic(
  () => import("@/app/dashboard/indiekit-v2/page"),
  {
    loading: () => (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

interface IndieKitV2TabProps {
  projectId: string;
}

export function IndieKitV2Tab({ projectId }: IndieKitV2TabProps) {
  // Pass projectId via context so the embedded page uses the dashboard's
  // selected project instead of relying on URL params or localStorage.
  if (typeof window !== "undefined" && projectId) {
    localStorage.setItem("indiecrowdfund_selected_project", projectId);
  }

  return (
    <InitialProjectIdContext.Provider value={projectId}>
      <div className="indiekit-v2-embedded -mx-4 sm:-mx-6 lg:-mx-8">
        <style jsx>{`
          .indiekit-v2-embedded :global(header.sticky) {
            display: none !important;
          }
          .indiekit-v2-embedded :global(.floating-orb) {
            display: none !important;
          }
        `}</style>
        <IndieKitV2Page />
      </div>
    </InitialProjectIdContext.Provider>
  );
}
