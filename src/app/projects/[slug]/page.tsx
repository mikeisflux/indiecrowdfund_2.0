import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";

interface Props {
  params: Promise<{ slug: string }>;
}

// This page handles legacy URLs like /projects/batpool-1
// and redirects to the new format /projects/vanityname/slug
export default async function ProjectSlugRedirect({ params }: Props) {
  const { slug } = await params;

  // Look up the project by slug
  const project = await db.project.findFirst({
    where: { slug },
    select: {
      slug: true,
      creator: {
        select: {
          vanityUrl: true,
          id: true,
        },
      },
    },
  });

  if (!project) {
    notFound();
  }

  // Get the creator's vanity URL (required for the new URL format)
  const vanityUrl = project.creator.vanityUrl;

  if (!vanityUrl) {
    // Creator doesn't have a vanity URL set - this shouldn't happen
    // but handle gracefully by showing not found
    notFound();
  }

  // Redirect to the canonical URL
  redirect(`/projects/${vanityUrl}/${slug}`);
}
