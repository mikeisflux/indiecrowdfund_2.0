import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "IndieKit Handbook - Creator Fulfillment Tools",
  description:
    "Learn how to use IndieKit, IndieCrowdfund's powerful creator toolkit for managing pledges, fulfillment, surveys, and backer communication.",
  openGraph: {
    title: "IndieKit Handbook - Creator Tools",
    description:
      "Master IndieKit to manage your crowdfunding campaign fulfillment, surveys, and backer communication.",
  },
};

export default function IndiekitHandbookLayout({ children }: { children: React.ReactNode }) {
  return children;
}
