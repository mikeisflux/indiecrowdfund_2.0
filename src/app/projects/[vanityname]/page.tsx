import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";

interface Props {
  params: Promise<{ vanityname: string }>;
}

/**
 * Catches legacy single-segment project URLs like /projects/my-project-slug
 * (missing the vanity URL segment) and redirects them to the proper
 * /projects/<creator-vanity>/<project-slug> URL.
 *
 * Old share links, email templates, bookmarks, and Google results may
 * still point at the old URL format — this handler translates them to
 * the current route instead of 404ing. If no matching project is found,
 * returns a 404 gracefully.
 *
 * The dynamic param is named `vanityname` only because that's the
 * parent directory — at this route depth we treat its value as a
 * possible project slug.
 */
export default async function LegacyProjectRedirect({ params }: Props) {
  const { vanityname } = await params;

  // Look up project by slug (the segment in the URL is actually the slug
  // from the legacy single-segment URL format)
  const project = await db.project.findFirst({
    where: { slug: vanityname, deletedAt: null },
    select: {
      slug: true,
      creator: { select: { vanityUrl: true } },
    },
  });

  if (project?.creator?.vanityUrl) {
    redirect(`/projects/${project.creator.vanityUrl}/${project.slug}`);
  }

  // No project with that slug, or the creator has no vanity URL —
  // show the standard 404 page.
  notFound();
}
