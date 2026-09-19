"use client";

/**
 * Retired: the standalone survey builder.
 *
 * There were two builders over the same tables — this page and the one in
 * IndieKit (Surveys → Survey Builder). Same Survey, SurveyBackerQuestion and
 * SurveyItemQuestion rows, two different editors, each with settings the other
 * did not show. A creator could set something here and never see it there.
 *
 * IndieKit won because that is where the rest of fulfillment lives: sending,
 * responses, add-ons, locking and the backer list are all on adjacent tabs,
 * and this page had no inbound link from anywhere in the app — it was
 * reachable only by typing the URL. Its one unique capability, editing the
 * survey intro, moved into the IndieKit builder.
 *
 * Kept as a redirect rather than deleted so a bookmarked URL still lands
 * somewhere useful instead of a 404.
 */

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function RetiredSurveyBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = (params?.id as string) || "";

  useEffect(() => {
    router.replace(
      `/dashboard/indiekit?project=${encodeURIComponent(projectId)}&phase=surveys`
    );
  }, [projectId, router]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary motion-reduce:animate-none" />
      <p className="text-sm text-muted-foreground">
        The survey builder now lives in IndieKit. Taking you there…
      </p>
    </div>
  );
}
