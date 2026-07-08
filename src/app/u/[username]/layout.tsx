import type { Metadata } from "next";
import { db } from "@/lib/db";

interface Props {
  params: Promise<{ username: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;

  const user = await db.user.findFirst({
    where: {
      OR: [
        { vanityUrl: username },
        { id: username },
      ],
    },
    select: {
      name: true,
      bio: true,
      image: true,
    },
  });

  if (!user) {
    return { title: "Creator Not Found" };
  }

  const displayName = user.name || username;
  const description = user.bio
    ? user.bio.slice(0, 200)
    : `${displayName}'s creator profile on IndieCrowdfund. Browse their crowdfunding projects and campaigns.`;

  return {
    title: `${displayName} - Creator Profile`,
    description,
    openGraph: {
      title: `${displayName} on IndieCrowdfund`,
      description,
      ...(user.image && { images: [{ url: user.image, alt: displayName }] }),
    },
  };
}

export default function UserProfileLayout({ children }: Props) {
  return children;
}
