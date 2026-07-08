import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service & Legal Policies",
  description:
    "IndieCrowdfund terms of service, privacy policy, refund policy, and other legal agreements for our crowdfunding platform.",
};

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
