import type { Metadata } from "next";
import { db } from "@/lib/db";

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

  const imageUrl = book.coverImageUrl || `${baseUrl}/og-default.png`;

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

export default function BookDetailLayout({ children }: Props) {
  return children;
}
