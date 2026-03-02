"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// Lazy-load the full IndieKit page component
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
  if (typeof window !== "undefined" && projectId) {
    localStorage.setItem("indiecrowdfund_selected_project", projectId);
  }

  return (
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
  );
}
