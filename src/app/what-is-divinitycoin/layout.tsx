import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "What is DivinityCoin? - Platform Rewards Currency",
  description:
    "Learn about DivinityCoin, IndieCrowdfund's rewards currency. Earn and redeem DivinityCoins for discounts, exclusive perks, and more on the crowdfunding platform.",
  openGraph: {
    title: "DivinityCoin Explained - IndieCrowdfund",
    description:
      "Everything you need to know about DivinityCoin, the rewards currency on IndieCrowdfund.",
  },
};

export default function DivinityCoinLayout({ children }: { children: React.ReactNode }) {
  return children;
}
