import type { Metadata } from "next";
import { db } from "@/lib/db";

interface Props {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;

  const company = await db.companyProfile.findUnique({
    where: { slug },
    select: {
      name: true,
      about: true,
      logoUrl: true,
    },
  });

  if (!company) {
    return { title: "Company Not Found" };
  }

  const description = company.about
    ? company.about.replace(/<[^>]*>/g, "").slice(0, 200)
    : `${company.name} on IndieCrowdfund Marketplace - Browse their catalog of indie creator products.`;

  return {
    title: `${company.name} - Marketplace`,
    description,
    openGraph: {
      title: `${company.name} - IndieCrowdfund Marketplace`,
      description,
    },
  };
}

export default function CompanyDetailLayout({ children }: Props) {
  return children;
}
