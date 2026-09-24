"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { SocialHubTab } from "../components/SocialHubTab";

/**
 * Standalone Social Hub page (also lives as a tab on /dashboard).
 * Loads the creator's campaigns so the composer and AI drafts can pick
 * one, then renders the same real posting UI.
 */
export default function SocialHubPage() {
  const [projects, setProjects] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/creator/dashboard")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && Array.isArray(data?.projects)) {
          setProjects(data.projects.map((p: { id: string; title: string }) => ({ id: p.id, title: p.title })));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Dashboard
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Social Hub</h1>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <SocialHubTab projects={projects} />
      )}
    </div>
  );
}
