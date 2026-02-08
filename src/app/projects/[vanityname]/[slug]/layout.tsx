import { Metadata } from "next";
import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";

interface Props {
  params: Promise<{ vanityname: string; slug: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { vanityname, slug } = await params;

  // Handle legacy URL (vanityname = "_" from middleware rewrite)
  const isLegacyUrl = vanityname === "_";

  let project;

  if (isLegacyUrl) {
    // For legacy URLs, look up project directly by slug
    project = await db.project.findUnique({
      where: { slug },
      select: {
        title: true,
        subtitle: true,
        description: true,
        imageUrl: true,
        creator: {
          select: { name: true, vanityUrl: true },
        },
      },
    });
  } else {
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

    project = await db.project.findFirst({
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
          select: { name: true, vanityUrl: true },
        },
      },
    });
  }

  if (!project) {
    return {
      title: "Project Not Found | IndieCrowdfund",
    };
  }

  // Strip HTML tags and decode HTML entities for clean plain text
  const stripHtmlAndEntities = (html: string) => {
    return html
      .replace(/<br\s*\/?>/gi, " ")           // Replace <br> with space
      .replace(/<\/(p|div|h[1-6]|li)>/gi, " ") // Add space after block elements
      .replace(/<[^>]*>/g, "")                 // Remove remaining HTML tags
      .replace(/&nbsp;/g, " ")                 // Replace non-breaking spaces
      .replace(/&amp;/g, "&")                  // Decode ampersand
      .replace(/&lt;/g, "<")                   // Decode less than
      .replace(/&gt;/g, ">")                   // Decode greater than
      .replace(/&quot;/g, '"')                 // Decode quotes
      .replace(/&#39;/g, "'")                  // Decode apostrophe
      .replace(/\s+/g, " ")                    // Collapse multiple whitespace
      .trim();
  };

  const plainDescription = project.description
    ? stripHtmlAndEntities(project.description).slice(0, 200)
    : project.subtitle || `Back ${project.title} on IndieCrowdfund`;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://indiecrowdfund.com";
  // Use creator's vanity URL for canonical URL (handles legacy URLs correctly)
  const creatorVanity = project.creator?.vanityUrl || vanityname;
  const projectUrl = `${baseUrl}/projects/${creatorVanity}/${slug}`;

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

  // Handle legacy URL (vanityname = "_" from middleware rewrite)
  const isLegacyUrl = vanityname === "_";

  let project;

  if (isLegacyUrl) {
    // For legacy URLs, look up project directly by slug
    project = await db.project.findUnique({
      where: { slug },
      select: { id: true },
    });
  } else {
    // Verify the vanityname matches the project creator
    const creator = await db.user.findUnique({
      where: { vanityUrl: vanityname },
      select: { id: true },
    });

    if (!creator) {
      notFound();
    }

    project = await db.project.findFirst({
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
    }
  }

  if (!project) {
    notFound();
  }

  return children;
}
