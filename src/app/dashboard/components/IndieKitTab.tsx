"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import { InitialProjectIdContext } from "@/app/dashboard/indiekit/constants";

// Lazy-load the full IndieKit page to keep the main dashboard bundle small.
const IndieKitPage = dynamic(
  () => import("@/app/dashboard/indiekit/page"),
  {
    loading: () => (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

interface IndieKitTabProps {
  projectId: string;
}

export function IndieKitTab({ projectId }: IndieKitTabProps) {
  // Pass projectId via context so the embedded page uses the dashboard's
  // selected project instead of relying on URL params or localStorage.
  if (typeof window !== "undefined" && projectId) {
    localStorage.setItem("indiecrowdfund_selected_project", projectId);
  }

  return (
    <InitialProjectIdContext.Provider value={projectId}>
      <div className="indiekit-embedded -mx-4 sm:-mx-6 lg:-mx-8">
        <style jsx>{`
          .indiekit-embedded :global(header.sticky) {
            display: none !important;
          }
          .indiekit-embedded :global(.floating-orb) {
            display: none !important;
          }
        `}</style>
        <IndieKitPage />
      </div>
    </InitialProjectIdContext.Provider>
  );
}
