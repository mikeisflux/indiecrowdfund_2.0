import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Creator Handbook - Launch a Successful Crowdfunding Campaign",
  description:
    "The ultimate guide to launching a crowdfunding campaign on IndieCrowdfund. Learn how to create your project, set goals, design rewards, and promote your campaign. Better than Kickstarter for creators.",
  openGraph: {
    title: "Creator Handbook - Launch Your Campaign on IndieCrowdfund",
    description:
      "Step-by-step guide to creating a successful crowdfunding campaign. Tips, strategies, and tools for independent creators.",
  },
};

export default function CreatorHandbookLayout({ children }: { children: React.ReactNode }) {
  return children;
}
