import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const metadata: Metadata = {
  title: "Retailer FAQ - IndieCrowdfund",
  description:
    "Answers to common questions about the IndieCrowdfund certified retailer program: applying, wholesale pricing, ordering, and invoicing.",
};

// Answers here state what the platform actually does (application review,
// the 50% default wholesale discount, per-project minimums, invoicing) —
// keep them in sync with /retailers and the retailer order flow.
const FAQS: { q: string; a: string }[] = [
  {
    q: "Who can join the retailer program?",
    a: "Brick-and-mortar and online stores that resell comics and related merchandise. You'll need your business details and tax ID for the application; a state-issued resale certificate isn't required but may expedite approval.",
  },
  {
    q: "How long does application review take?",
    a: "Our team reviews applications within 2-3 business days. You'll get an email when you're approved, and can then sign in to the retailer portal to browse retailer-eligible campaigns.",
  },
  {
    q: "What discount do retailers get?",
    a: "Retailer-enabled campaigns offer wholesale pricing at a discount off the backer price — 50% is the standard, though each creator sets their campaign's exact rate. The discounted price is shown on every retailer-eligible reward before you order.",
  },
  {
    q: "Are there minimum or maximum order quantities?",
    a: "Each campaign sets its own minimum (and sometimes maximum) order quantity for retailer pledges. The limits are shown and enforced at checkout.",
  },
  {
    q: "Do all campaigns offer retailer pricing?",
    a: "No — creators opt each campaign into the retailer program. The portal only lists campaigns that have retailer access enabled.",
  },
  {
    q: "How do payment and invoicing work?",
    a: "Every retailer order generates an invoice you can view and download under Retailers → Invoices. Payment is collected through the campaign's payment processor like any pledge, and your order history lives under Retailers → Orders.",
  },
  {
    q: "When do orders ship?",
    a: "Retailer orders ship with campaign fulfillment — after the campaign funds and the creator completes production. Shipping for bulk orders is consolidated where possible; the creator's fulfillment timeline applies.",
  },
  {
    q: "Can I talk to creators directly?",
    a: "Yes. You can message a creator from their campaign page to ask about products, exclusive variants, or larger orders.",
  },
];

export default function RetailerFaqPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <h1 className="text-3xl font-bold sm:text-4xl">Retailer FAQ</h1>
      <p className="mt-3 text-muted-foreground">
        Common questions about the IndieCrowdfund certified retailer program.
      </p>

      <Accordion type="single" collapsible className="mt-8">
        {FAQS.map((item, i) => (
          <AccordionItem key={i} value={`faq-${i}`}>
            <AccordionTrigger className="text-left">{item.q}</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">{item.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <Button asChild>
          <Link href="/retailers/apply">Apply to the Program</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/contact">Contact Support</Link>
        </Button>
      </div>
    </div>
  );
}
