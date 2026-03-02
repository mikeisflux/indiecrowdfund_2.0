import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Backer Handbook - How to Back Crowdfunding Projects",
  description:
    "The complete guide to backing projects on IndieCrowdfund. Learn how to find projects, make pledges, choose rewards, and support independent creators.",
  openGraph: {
    title: "Backer Handbook - IndieCrowdfund",
    description:
      "Everything you need to know about backing crowdfunding projects. Find, pledge, and support the creators you believe in.",
  },
};

export default function BackerHandbookLayout({ children }: { children: React.ReactNode }) {
  return children;
}
