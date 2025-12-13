import { Metadata } from "next";
import { db } from "@/lib/db";

interface Props {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;

  const project = await db.project.findUnique({
    where: { slug },
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
  const projectUrl = `${baseUrl}/projects/${slug}`;

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

export default function ProjectLayout({ children }: Props) {
  return children;
}
