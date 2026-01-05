"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { getFaqItems } from "../constants";
import { ProjectData } from "../types";

interface FAQSectionProps {
  project: ProjectData;
}

export function FAQSection({ project }: FAQSectionProps) {
  const isFunded = Boolean(project && Number(project.currentAmount) >= Number(project.goalAmount));

  return (
    <div>
      <h3 className="font-medium mb-3">Frequently Asked Questions</h3>
      <Accordion type="single" collapsible>
        {getFaqItems(isFunded).map((item, idx) => (
          <AccordionItem key={idx} value={`faq-${idx}`} className="border-b">
            <AccordionTrigger className="py-3 text-sm hover:no-underline text-left">
              {item.question}
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground pb-3">
              {item.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
