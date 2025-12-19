"use client";

/**
 * Pledge page for vanity URL format: /projects/[vanityname]/[slug]/pledge
 *
 * This page redirects to the standard slug-based pledge page since the pledge
 * flow uses project IDs internally and works the same regardless of URL format.
 *
 * The redirect preserves query parameters (reward, amount, etc.)
 */

import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

export default function VanityPledgePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const vanityname = (params?.vanityname as string) || "";
  const slug = (params?.slug as string) || "";

  useEffect(() => {
    async function verifyAndRedirect() {
      try {
        // Verify the project exists under this vanity URL
        const response = await fetch(`/api/projects/vanity/${vanityname}/${slug}`);

        if (!response.ok) {
          setError("Project not found");
          return;
        }

        // Build the redirect URL with all query parameters
        const queryString = searchParams?.toString() || "";
        const redirectUrl = `/projects/${slug}/pledge${queryString ? `?${queryString}` : ""}`;

        // Replace current history entry so back button works correctly
        router.replace(redirectUrl);
      } catch (err) {
        console.error("Error verifying project:", err);
        setError("Failed to load project");
      }
    }

    if (vanityname && slug) {
      verifyAndRedirect();
    }
  }, [vanityname, slug, searchParams, router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="text-muted-foreground">Loading pledge page...</p>
      </div>
    </div>
  );
}
