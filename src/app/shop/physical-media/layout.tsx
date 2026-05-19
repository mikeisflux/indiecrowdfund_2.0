import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Physical Media Marketplace",
  description:
    "Shop physical media from independent creators on IndieCrowdfund. Find unique prints, merchandise, and collectibles.",
};

export default function PhysicalMediaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
