import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Us - Meet the Team Behind IndieCrowdfund",
  description:
    "Learn about IndieCrowdfund, the best Kickstarter alternative built by creators for creators. Our mission is to empower independent projects with lower fees and better crowdfunding tools.",
  openGraph: {
    title: "About IndieCrowdfund - The Kickstarter Alternative Built for Creators",
    description:
      "Discover why IndieCrowdfund is the best crowdfunding platform for independent creators. Learn about our mission, team, and what makes us different.",
  },
};

export default function AboutUsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
