import { Metadata } from "next";
import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { JsonLd } from "@/components/json-ld";

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
    where: { slug, creatorId: creator.id },
    select: {
      title: true,
      subtitle: true,
      description: true,
      imageUrl: true,
      creator: { select: { name: true, vanityUrl: true } },
    },
  });

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
  // Append ?format=jpeg for webp images so social media crawlers can process them
  const rawImageUrl = project.imageUrl
    ? (project.imageUrl.startsWith("http") ? project.imageUrl : `${baseUrl}${project.imageUrl}`)
    : `${baseUrl}/api/og`;
  const imageUrl = rawImageUrl.endsWith(".webp") ? `${rawImageUrl}?format=jpeg` : rawImageUrl;

  return {
    title: `${project.title} - Crowdfunding Campaign`,
    description: plainDescription,
    alternates: {
      canonical: projectUrl,
    },
    openGraph: {
      title: `${project.title} - Back This Project on IndieCrowdfund`,
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
      title: `${project.title} - Back This Project on IndieCrowdfund`,
      description: plainDescription,
      images: [imageUrl],
    },
  };
}

const projectSelectForJsonLd = {
  id: true,
  title: true,
  subtitle: true,
  description: true,
  imageUrl: true,
  category: true,
  goalAmount: true,
  currentAmount: true,
  backerCount: true,
  endDate: true,
  status: true,
  creator: {
    select: { name: true, vanityUrl: true },
  },
} as const;

export default async function ProjectLayout({ params, children }: Props) {
  const { vanityname, slug } = await params;

  const creator = await db.user.findUnique({
    where: { vanityUrl: vanityname },
    select: { id: true },
  });

  if (!creator) {
    notFound();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const project: any = await db.project.findFirst({
    where: { slug, creatorId: creator.id },
    select: projectSelectForJsonLd,
  });

  if (!project) {
    // Slug may have moved to a different creator — redirect to correct URL
    const projectBySlug = await db.project.findUnique({
      where: { slug },
      select: { creator: { select: { vanityUrl: true } } },
    });
    if (projectBySlug?.creator?.vanityUrl) {
      redirect(`/projects/${projectBySlug.creator.vanityUrl}/${slug}`);
    }
  }

  if (!project) {
    notFound();
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.indiecrowdfund.com";
  const creatorVanity = project.creator?.vanityUrl || vanityname;
  const projectUrl = `${baseUrl}/projects/${creatorVanity}/${slug}`;
  const imageUrl = project.imageUrl
    ? (project.imageUrl.startsWith("http") ? project.imageUrl : `${baseUrl}${project.imageUrl}`)
    : `${baseUrl}/api/og`;

  const fundingPercentage = Number(project.goalAmount) > 0
    ? Math.round((Number(project.currentAmount) / Number(project.goalAmount)) * 100)
    : 0;

  const jsonLdData: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: project.title,
    description: project.subtitle || project.title,
    image: imageUrl,
    url: projectUrl,
    brand: {
      "@type": "Organization",
      name: "IndieCrowdfund",
    },
    offers: {
      "@type": "Offer",
      priceCurrency: "USD",
      price: "1.00",
      availability: project.status === "LIVE" ? "https://schema.org/InStock" : "https://schema.org/SoldOut",
      url: projectUrl,
    },
    aggregateRating: project.backerCount > 0 ? {
      "@type": "AggregateRating",
      ratingValue: Math.min(5, Math.round((fundingPercentage / 20) * 10) / 10),
      bestRating: 5,
      ratingCount: project.backerCount,
    } : undefined,
    additionalProperty: [
      { "@type": "PropertyValue", name: "Funding Goal", value: `$${Number(project.goalAmount).toLocaleString()}` },
      { "@type": "PropertyValue", name: "Amount Raised", value: `$${Number(project.currentAmount).toLocaleString()}` },
      { "@type": "PropertyValue", name: "Backers", value: String(project.backerCount) },
      { "@type": "PropertyValue", name: "Category", value: project.category },
    ],
  };

  const breadcrumbData: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: baseUrl },
      { "@type": "ListItem", position: 2, name: "Discover", item: `${baseUrl}/discover` },
      { "@type": "ListItem", position: 3, name: project.category, item: `${baseUrl}/discover?category=${encodeURIComponent(project.category.toLowerCase())}` },
      { "@type": "ListItem", position: 4, name: project.title, item: projectUrl },
    ],
  };

  return (
    <>
      <JsonLd data={jsonLdData} />
      <JsonLd data={breadcrumbData} />
      {children}
    </>
  );
}
