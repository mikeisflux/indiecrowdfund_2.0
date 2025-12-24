import { Metadata } from "next";
import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";

interface Props {
  params: Promise<{ vanityname: string; slug: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { vanityname, slug } = await params;

  // First, find the creator by vanity URL
  const creator = await db.user.findUnique({
    where: { vanityUrl: vanityname },
    select: { id: true },
  });

  if (!creator) {
    return {
      title: "Creator Not Found | IndieCrowdfund",
    };
  }

  const project = await db.project.findFirst({
    where: {
      slug,
      creatorId: creator.id,
    },
    select: {
      title: true,
      subtitle: true,
      description: true,
      imageUrl: true,
      creator: {
        select: { name: true },
      },
    },
  });

  if (!project) {
    return {
      title: "Project Not Found | IndieCrowdfund",
    };
  }

  // Strip HTML tags from description for meta
  const plainDescription = project.description
    ? project.description.replace(/<[^>]*>/g, "").slice(0, 200)
    : project.subtitle || `Back ${project.title} on IndieCrowdfund`;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://indiecrowdfund.com";
  const projectUrl = `${baseUrl}/projects/${vanityname}/${slug}`;

  // Use the project image or fall back to a default
  const imageUrl = project.imageUrl
    ? (project.imageUrl.startsWith("http") ? project.imageUrl : `${baseUrl}${project.imageUrl}`)
    : `${baseUrl}/og-default.png`;

  return {
    title: `${project.title} | IndieCrowdfund`,
    description: plainDescription,
    openGraph: {
      title: project.title,
      description: plainDescription,
      url: projectUrl,
      siteName: "IndieCrowdfund",
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: project.title,
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: project.title,
      description: plainDescription,
      images: [imageUrl],
    },
  };
}

export default async function ProjectLayout({ params, children }: Props) {
  const { vanityname, slug } = await params;

  // Verify the vanityname matches the project creator
  const creator = await db.user.findUnique({
    where: { vanityUrl: vanityname },
    select: { id: true },
  });

  if (!creator) {
    notFound();
  }

  const project = await db.project.findFirst({
    where: {
      slug,
      creatorId: creator.id,
    },
    select: { id: true },
  });

  if (!project) {
    // Check if project exists under a different creator - redirect to correct URL
    const projectBySlug = await db.project.findUnique({
      where: { slug },
      select: {
        creator: {
          select: { vanityUrl: true },
        },
      },
    });

    if (projectBySlug?.creator?.vanityUrl) {
      redirect(`/projects/${projectBySlug.creator.vanityUrl}/${slug}`);
    }

    notFound();
  }

  return children;
}
