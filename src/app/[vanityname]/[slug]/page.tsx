import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";

interface Props {
  params: Promise<{ vanityname: string; slug: string }>;
}

// Short vanity URL redirect: /[vanityname]/[slug] → /projects/[vanityname]/[slug]
// Validates that the vanity URL actually exists before redirecting to prevent
// arbitrary paths from routing through here.
export default async function VanityUrlRedirect({ params }: Props) {
  const { vanityname, slug } = await params;

  const project = await db.project.findFirst({
    where: {
      slug,
      deletedAt: null,
      creator: { vanityUrl: vanityname },
    },
    select: { id: true },
  });

  if (!project) {
    notFound();
  }

  redirect(`/projects/${vanityname}/${slug}`);
}
