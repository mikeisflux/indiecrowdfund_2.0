import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function PledgeSlugRedirect({ params, searchParams }: Props) {
  const { slug } = await params;
  const search = await searchParams;

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

  // Preserve query params
  const queryString = new URLSearchParams(
    Object.entries(search).reduce((acc, [key, value]) => {
      if (typeof value === "string") acc[key] = value;
      return acc;
    }, {} as Record<string, string>)
  ).toString();

  const redirectUrl = `/projects/${project.creator.vanityUrl}/${slug}/pledge${queryString ? `?${queryString}` : ""}`;
  redirect(redirectUrl);
}
