"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronRight, ChevronDown, Search } from "lucide-react";
import { SimilarProject } from "../types";
import { SimilarProjectsGrid } from "../similar-projects-grid";

interface FaqTabProps {
  faqs: { question: string; answer: string }[];
  similarProjects: SimilarProject[];
  /**
   * Layout v2 gives the questions the full container and drops the "Ask a
   * question" rail below them. v1 keeps the 8/4 split it launched with — live
   * campaigns don't get relaid out under their backers.
   */
  fullWidth?: boolean;
}

export function FaqTab({ faqs, similarProjects, fullWidth = false }: FaqTabProps) {
  const [expandedFaqs, setExpandedFaqs] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredFaqs = useMemo(() => {
    if (!searchQuery.trim()) return faqs.map((faq, i) => ({ ...faq, originalIndex: i }));
    const q = searchQuery.toLowerCase();
    return faqs
      .map((faq, i) => ({ ...faq, originalIndex: i }))
      .filter(
        (faq) =>
          faq.question.toLowerCase().includes(q) ||
          faq.answer.toLowerCase().includes(q)
      );
  }, [faqs, searchQuery]);

  const toggleFaq = (index: number) => {
    setExpandedFaqs((prev) =>
      prev.includes(index)
        ? prev.filter((i) => i !== index)
        : [...prev, index]
    );
  };

  return (
    <div className="space-y-12">
      {/* FAQ Main Section */}
      <div className={fullWidth ? "space-y-8" : "grid gap-8 md:grid-cols-12"}>
        {/* Left - FAQ Questions */}
        <div className={fullWidth ? "" : "md:col-span-7 lg:col-span-8"}>
          <h2 className="text-2xl font-semibold mb-6">Frequently Asked Questions</h2>
          {faqs.length > 3 && (
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search FAQs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          )}
          {filteredFaqs.length === 0 && searchQuery && (
            <p className="text-muted-foreground py-4">No FAQs match your search.</p>
          )}
          <div className="divide-y">
            {filteredFaqs.map((faq) => (
              <div key={faq.originalIndex} className="py-4">
                <button
                  onClick={() => toggleFaq(faq.originalIndex)}
                  className="w-full flex items-center justify-between text-left group"
                >
                  <span className="font-medium group-hover:text-primary transition-colors">
                    {faq.question}
                  </span>
                  {expandedFaqs.includes(faq.originalIndex) ? (
                    <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  )}
                </button>
                {expandedFaqs.includes(faq.originalIndex) && (
                  <p className="mt-3 text-muted-foreground pl-0">{faq.answer}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right - Ask a Question */}
        <div className={fullWidth ? "" : "md:col-span-5 lg:col-span-4"}>
          <div
            className={
              fullWidth
                ? "flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4"
                : "sticky top-20"
            }
          >
            <p className={fullWidth ? "text-muted-foreground" : "text-muted-foreground mb-4"}>
              Don&apos;t see the answer to your question? Ask the project creator directly.
            </p>
            <Button variant="outline" className={fullWidth ? "sm:w-auto" : "w-full"}>
              Ask a question
            </Button>
          </div>
        </div>
      </div>

      <SimilarProjectsGrid projects={similarProjects} />
    </div>
  );
}
