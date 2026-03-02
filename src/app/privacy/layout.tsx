import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "IndieCrowdfund privacy policy. Learn how we collect, use, and protect your personal data on our crowdfunding platform.",
};

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
