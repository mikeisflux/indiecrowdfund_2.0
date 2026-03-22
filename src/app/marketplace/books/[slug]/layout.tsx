import type { Metadata } from "next";
import { db } from "@/lib/db";
import { JsonLd } from "@/components/json-ld";

interface Props {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;

  const book = await db.marketplaceBook.findFirst({
    where: { slug, status: { in: ["LIVE", "APPROVED"] }, deletedAt: null },
    select: {
      title: true,
      description: true,
      coverImageUrl: true,
      creator: {
        select: { name: true },
      },
    },
  });

  if (!book) {
    return { title: "Book Not Found" };
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.indiecrowdfund.com";
  const description = book.description
    ? book.description.replace(/<[^>]*>/g, "").slice(0, 200)
    : `${book.title} by ${book.creator?.name || "an indie creator"} on IndieCrowdfund Marketplace`;

  const imageUrl = book.coverImageUrl || `${baseUrl}/api/og`;

  return {
    title: `${book.title} - Marketplace`,
    description,
    openGraph: {
      title: `${book.title} - IndieCrowdfund Marketplace`,
      description,
      images: [{ url: imageUrl, width: 600, height: 900, alt: book.title }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: book.title,
      description,
      images: [imageUrl],
    },
  };
}

export default async function BookDetailLayout({ params, children }: Props) {
  const { slug } = await params;

  const book = await db.marketplaceBook.findFirst({
    where: { slug, status: { in: ["LIVE", "APPROVED"] }, deletedAt: null },
    select: {
      title: true,
      description: true,
      coverImageUrl: true,
      price: true,
      creator: {
        select: { name: true },
      },
    },
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.indiecrowdfund.com";

  if (book) {
    const description = book.description
      ? book.description.replace(/<[^>]*>/g, "").slice(0, 200)
      : `${book.title} by ${book.creator?.name || "an indie creator"}`;

    const imageUrl = book.coverImageUrl || `${baseUrl}/api/og`;
    const bookUrl = `${baseUrl}/marketplace/books/${slug}`;

    const bookJsonLd: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "Book",
      name: book.title,
      description,
      image: imageUrl,
      url: bookUrl,
      author: {
        "@type": "Person",
        name: book.creator?.name || "Independent Creator",
      },
      publisher: {
        "@type": "Organization",
        name: "IndieCrowdfund Marketplace",
      },
      offers: book.price ? {
        "@type": "Offer",
        priceCurrency: "USD",
        price: Number(book.price).toFixed(2),
        availability: "https://schema.org/InStock",
        url: bookUrl,
      } : undefined,
    };

    const breadcrumbData: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: baseUrl },
        { "@type": "ListItem", position: 2, name: "Marketplace", item: `${baseUrl}/marketplace` },
        { "@type": "ListItem", position: 3, name: "Books", item: `${baseUrl}/marketplace/books` },
        { "@type": "ListItem", position: 4, name: book.title, item: bookUrl },
      ],
    };

    return (
      <>
        <JsonLd data={bookJsonLd} />
        <JsonLd data={breadcrumbData} />
        {children}
      </>
    );
  }

  return children;
}
