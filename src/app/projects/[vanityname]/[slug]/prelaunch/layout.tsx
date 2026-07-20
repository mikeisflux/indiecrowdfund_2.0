import { Metadata } from "next";
import { db } from "@/lib/db";
import { getOgImageInfo } from "@/lib/og-image-dimensions";

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

  // Sanitize project.imageUrl — reject data URIs and concatenated junk that
  // would otherwise produce a Frankenstein og:image URL and break FB/X/LinkedIn
  // scraping. See src/app/projects/[vanityname]/[slug]/layout.tsx for details.
  function sanitizeImageUrl(raw: string | null | undefined): string {
    if (!raw || typeof raw !== "string") return `${baseUrl}/api/og`;
    const trimmed = raw.trim();
    if (trimmed.startsWith("data:")) return `${baseUrl}/api/og`;
    if (trimmed.slice(1).includes("data:")) return `${baseUrl}/api/og`;
    if (trimmed.slice(8).includes("http")) return `${baseUrl}/api/og`;
    if (/^https?:\/\//i.test(trimmed)) {
      if (trimmed.length < 10) return `${baseUrl}/api/og`;
      return trimmed;
    }
    if (/^\/[a-zA-Z0-9_\-]/.test(trimmed)) {
      return `${baseUrl}${trimmed}`;
    }
    return `${baseUrl}/api/og`;
  }

  // Swap .webp → .jpg in the og:image URL + append ?v=<mtime> cache-buster
  // so Facebook treats each regeneration as a distinct URL and bypasses
  // their image CDN cache.
  const rawImageUrl = sanitizeImageUrl(project.imageUrl);
  const baseImageUrl = rawImageUrl.toLowerCase().endsWith(".webp")
    ? rawImageUrl.replace(/\.webp$/i, ".jpg")
    : rawImageUrl;
  const imageInfo = await getOgImageInfo(baseImageUrl);
  // Force JPEG for our own uploads. WebP og:images render as a BLANK card on
  // X/Facebook, and the .jpg-swapped path only serves a real JPEG if a
  // pre-generated companion exists OR the crawler UA is recognized — both
  // unreliable for brand-new projects. Appending ?format=jpeg makes the uploads
  // route convert on the fly for every request, so every project's card
  // resolves to a JPEG derived from its campaign graphic by default.
  const isOwnUpload =
    baseImageUrl.startsWith(baseUrl) && !baseImageUrl.startsWith(`${baseUrl}/api/og`);
  const ogParams = new URLSearchParams();
  if (isOwnUpload) ogParams.set("format", "jpeg");
  if (imageInfo.version) ogParams.set("v", imageInfo.version);
  const ogQs = ogParams.toString();
  const imageUrl = ogQs
    ? `${baseImageUrl}${baseImageUrl.includes("?") ? "&" : "?"}${ogQs}`
    : baseImageUrl;
  const imageDimensions = { width: imageInfo.width, height: imageInfo.height };

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
          width: imageDimensions.width,
          height: imageDimensions.height,
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
