import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Us - Get in Touch with IndieCrowdfund",
  description:
    "Have questions about crowdfunding on IndieCrowdfund? Contact our support team for help with campaigns, backing, payments, or any other questions.",
  openGraph: {
    title: "Contact IndieCrowdfund Support",
    description:
      "Get help with your crowdfunding campaign or backing experience. Our team is here to support independent creators and backers.",
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
