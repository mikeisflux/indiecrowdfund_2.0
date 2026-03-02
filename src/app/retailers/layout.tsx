import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Retailer Program",
    template: "%s | IndieCrowdfund Retailers",
  },
  description:
    "Join the IndieCrowdfund retailer program. Local comic shops and retailers can stock indie creator products and grow their business.",
};

export default function RetailersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
