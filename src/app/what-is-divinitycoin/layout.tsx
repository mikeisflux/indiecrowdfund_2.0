import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "What is Divinity Payments? - Alternative Payment Processor",
  description:
    "Learn about Divinity Payments, an alternative payment sub-processor on IndieCrowdfund. Pay with your credit or debit card on projects and marketplace listings — no crypto, no wallet, no setup required.",
  openGraph: {
    title: "Divinity Payments Explained - IndieCrowdfund",
    description:
      "Everything you need to know about Divinity Payments, the alternative payment processor available on IndieCrowdfund.",
  },
};

export default function DivinityCoinLayout({ children }: { children: React.ReactNode }) {
  return children;
}
