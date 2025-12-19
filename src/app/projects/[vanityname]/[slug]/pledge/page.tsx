"use client";

/**
 * Pledge page for both vanity URLs (/projects/[vanityname]/[slug]/pledge)
 * and legacy URLs (/projects/[slug]/pledge via middleware rewrite to /projects/_/[slug]/pledge)
 */

import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface ProjectData {
  id: string;
  title: string;
  slug: string;
  status: string;
  imageUrl: string;
  goalAmount: number;
  currentAmount: number;
}

interface RewardData {
  id: string;
  title: string;
  description: string;
  amount: number;
  type: string;
  quantityAvailable: number | null;
  quantityClaimed: number;
}

export default function PledgePage() {
  const params = useParams();
  const searchParams = useSearchParams();

  const vanityname = (params?.vanityname as string) || "";
  const slug = (params?.slug as string) || "";

  // Check if this is a legacy URL (vanityname = "_" from middleware rewrite)
  const isLegacyUrl = vanityname === "_";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [project, setProject] = useState<ProjectData | null>(null);
  const [rewards, setRewards] = useState<RewardData[]>([]);

  // Get query params
  const rewardId = searchParams?.get("reward");
  const amount = searchParams?.get("amount");

  // Build the project URL path - use slug-only format for legacy URLs
  const projectPath = isLegacyUrl ? `/projects/${slug}` : `/projects/${vanityname}/${slug}`;

  useEffect(() => {
    async function fetchProject() {
      if (!slug || !vanityname) return;

      try {
        setLoading(true);
        setError(null);

        // Use slug-only API for legacy URLs, vanity API for new URLs
        const apiUrl = isLegacyUrl
          ? `/api/projects/slug/${slug}`
          : `/api/projects/vanity/${vanityname}/${slug}`;

        const response = await fetch(apiUrl);

        if (!response.ok) {
          if (response.status === 404) {
            setError("Project not found");
          } else {
            setError("Failed to load project");
          }
          return;
        }

        const data = await response.json();
        setProject(data.project);
        setRewards(data.rewards || []);
      } catch (err) {
        console.error("Error fetching project:", err);
        setError("Failed to load project");
      } finally {
        setLoading(false);
      }
    }

    fetchProject();
  }, [slug, vanityname, isLegacyUrl]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading pledge page...</p>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
          <h1 className="text-2xl font-bold">{error || "Project not found"}</h1>
          <p className="text-muted-foreground">The project you&apos;re looking for could not be found.</p>
          <Link href="/discover">
            <Button>Browse Projects</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Find the selected reward if one was specified
  const selectedReward = rewardId ? rewards.find(r => r.id === rewardId) : null;
  const tiers = rewards.filter(r => r.type === "TIER");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background">
        <div className="container flex h-14 items-center justify-between">
          <Link href="/" className="text-xl font-bold text-primary">
            IndieCrowdfund
          </Link>
          <Link href={projectPath}>
            <Button variant="ghost">Back to project</Button>
          </Link>
        </div>
      </header>

      <div className="container py-8 max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Back this project</h1>
          <p className="text-muted-foreground">{project.title}</p>
        </div>

        {project.status !== "LIVE" && (
          <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
              <AlertTriangle className="h-5 w-5" />
              <span className="font-medium">This project is not currently accepting pledges.</span>
            </div>
          </div>
        )}

        <div className="bg-card rounded-lg border p-6">
          {selectedReward ? (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Selected Reward</h2>
              <div className="p-4 bg-muted rounded-lg">
                <h3 className="font-medium">{selectedReward.title}</h3>
                <p className="text-2xl font-bold text-primary mt-2">${selectedReward.amount}</p>
                <p className="text-sm text-muted-foreground mt-2">{selectedReward.description}</p>
              </div>
            </div>
          ) : amount ? (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Pledge Amount</h2>
              <p className="text-3xl font-bold text-primary">${amount}</p>
              <p className="text-sm text-muted-foreground">Pledge without a reward</p>
            </div>
          ) : (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Choose a Reward</h2>
              <div className="space-y-4">
                {tiers.map((reward) => (
                  <Link
                    key={reward.id}
                    href={`${projectPath}/pledge?reward=${reward.id}`}
                    className="block"
                  >
                    <div className="p-4 border rounded-lg hover:border-primary transition-colors cursor-pointer">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium">{reward.title}</h3>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{reward.description}</p>
                          {reward.quantityAvailable && (
                            <p className="text-xs text-muted-foreground mt-2">
                              {reward.quantityAvailable - reward.quantityClaimed} of {reward.quantityAvailable} left
                            </p>
                          )}
                        </div>
                        <span className="text-lg font-bold text-primary">${reward.amount}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {(selectedReward || amount) && project.status === "LIVE" && (
            <div className="mt-6 pt-6 border-t">
              <p className="text-sm text-muted-foreground mb-4">
                Pledge checkout functionality is loading...
              </p>
              <Link href={projectPath}>
                <Button variant="outline" className="w-full">
                  Return to Project
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
