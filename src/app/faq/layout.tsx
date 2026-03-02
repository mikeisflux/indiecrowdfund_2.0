import type { Metadata } from "next";
import { JsonLd } from "@/components/json-ld";

export const metadata: Metadata = {
  title: "FAQ - Frequently Asked Questions About Crowdfunding",
  description:
    "Find answers to common questions about crowdfunding on IndieCrowdfund. Learn about backing projects, creating campaigns, fees, payments, rewards, and more.",
  openGraph: {
    title: "IndieCrowdfund FAQ - Crowdfunding Questions Answered",
    description:
      "Everything you need to know about crowdfunding on IndieCrowdfund. Get answers about campaigns, backing, fees, and more.",
  },
};

export default function FaqLayout({ children }: { children: React.ReactNode }) {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What is IndieCrowdfund?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "IndieCrowdfund is a crowdfunding platform and Kickstarter alternative designed for independent creators to launch campaigns and fund creative projects with lower fees and better tools.",
        },
      },
      {
        "@type": "Question",
        name: "How does crowdfunding work on IndieCrowdfund?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Creators set up a project with a funding goal and reward tiers. Backers pledge money to support the project. If the project reaches its goal, the creator receives the funds to bring their project to life.",
        },
      },
      {
        "@type": "Question",
        name: "What are the fees on IndieCrowdfund?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "IndieCrowdfund charges a platform fee only when your project is successfully funded, plus standard payment processing fees. Visit our fees page for detailed pricing.",
        },
      },
      {
        "@type": "Question",
        name: "Is IndieCrowdfund better than Kickstarter?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "IndieCrowdfund offers lower fees, more flexible campaign options, a dedicated backer community, and better creator tools compared to Kickstarter. It's the best Kickstarter alternative for independent creators.",
        },
      },
    ],
  };

  return (
    <>
      <JsonLd data={faqSchema} />
      {children}
    </>
  );
}
