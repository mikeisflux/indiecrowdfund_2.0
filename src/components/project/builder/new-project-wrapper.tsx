"use client";

import { useEffect, useState } from "react";
import { useProjectStore } from "@/lib/stores/project-store";
import { ProjectBuilder } from "./project-builder";
import { Loader2 } from "lucide-react";

export function NewProjectWrapper() {
  const [ready, setReady] = useState(false);
  const { reset } = useProjectStore();

  useEffect(() => {
    // Reset the store to clear any previous project data
    reset();
    setReady(true);
  }, [reset]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Preparing project builder...</p>
        </div>
      </div>
    );
  }

  return <ProjectBuilder />;
}
