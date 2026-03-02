import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trust & Safety - Secure Crowdfunding",
  description:
    "Learn about IndieCrowdfund's trust and safety measures. We protect creators and backers with secure payments, fraud prevention, and community guidelines.",
  openGraph: {
    title: "Trust & Safety at IndieCrowdfund",
    description:
      "Safe and secure crowdfunding. Learn how IndieCrowdfund protects creators and backers.",
  },
};

export default function TrustSafetyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
