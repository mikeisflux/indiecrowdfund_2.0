import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function PrelaunchSlugRedirect({ params }: Props) {
  const { slug } = await params;

  const project = await db.project.findFirst({
    where: { slug },
    select: {
      slug: true,
      creator: {
        select: { vanityUrl: true },
      },
    },
  });

  if (!project || !project.creator.vanityUrl) {
    notFound();
  }

  redirect(`/projects/${project.creator.vanityUrl}/${slug}/prelaunch`);
}
