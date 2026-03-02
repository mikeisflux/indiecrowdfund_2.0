import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Collaborate on Projects",
  description:
    "Collaborate with other creators on IndieCrowdfund. Work together on crowdfunding campaigns and bring bigger ideas to life.",
};

export default function CollaborateLayout({ children }: { children: React.ReactNode }) {
  return children;
}
