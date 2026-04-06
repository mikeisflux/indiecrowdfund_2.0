import { Metadata } from "next";
import { db } from "@/lib/db";

interface Props {
  params: Promise<{ vanityname: string; slug: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { vanityname, slug } = await params;

  const creator = await db.user.findUnique({
    where: { vanityUrl: vanityname },
    select: { id: true },
  });

  if (!creator) {
    return { title: "Creator Not Found | IndieCrowdfund" };
  }

  const project = await db.project.findFirst({
    where: { slug, creatorId: creator.id, deletedAt: null },
    select: {
      title: true,
      subtitle: true,
      prelaunchDescription: true,
      imageUrl: true,
      creator: { select: { name: true, vanityUrl: true } },
    },
  });

  if (!project) {
    return {
      title: "Project Not Found | IndieCrowdfund",
    };
  }

  // Use prelaunch description if available, otherwise subtitle
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

  const plainDescription = project.prelaunchDescription
    ? stripHtmlAndEntities(project.prelaunchDescription).slice(0, 200)
    : project.subtitle || `${project.title} is coming soon to IndieCrowdfund`;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://indiecrowdfund.com";
  // Use creator's vanity URL for canonical URL (handles legacy URLs correctly)
  const creatorVanity = project.creator?.vanityUrl || vanityname;
  const projectUrl = `${baseUrl}/projects/${creatorVanity}/${slug}/prelaunch`;

  // Use the project image or fall back to a default
  // Append ?format=jpeg for webp images so social media crawlers can process them
  const rawImageUrl = project.imageUrl
    ? (project.imageUrl.startsWith("http") ? project.imageUrl : `${baseUrl}${project.imageUrl}`)
    : `${baseUrl}/api/og`;
  const imageUrl = rawImageUrl.endsWith(".webp") ? `${rawImageUrl}?format=jpeg` : rawImageUrl;

  return {
    title: `${project.title} - Coming Soon | IndieCrowdfund`,
    description: plainDescription,
    openGraph: {
      title: `${project.title} - Coming Soon`,
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
      title: `${project.title} - Coming Soon`,
      description: plainDescription,
      images: [imageUrl],
    },
  };
}

export default function PrelaunchLayout({ children }: Props) {
  return children;
}
