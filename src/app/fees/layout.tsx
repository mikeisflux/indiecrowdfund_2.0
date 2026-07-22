import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Crowdfunding Fees & Pricing - Transparent Platform Costs",
  description:
    "IndieCrowdfund offers lower crowdfunding fees than Kickstarter. See our transparent pricing, grant administration fee, and payment processing costs. No hidden charges.",
  openGraph: {
    title: "IndieCrowdfund Fees - Lower Than Kickstarter",
    description:
      "Transparent crowdfunding pricing. Lower fees than Kickstarter with no hidden costs. See exactly what you'll pay.",
  },
};

export default function FeesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
