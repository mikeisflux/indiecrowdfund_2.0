"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChevronRight, ChevronDown, Heart, Clock, Bookmark, Search } from "lucide-react";
import { SimilarProject } from "../types";
import { formatTimeRemaining } from "@/lib/utils";

interface FaqTabProps {
  faqs: { question: string; answer: string }[];
  similarProjects: SimilarProject[];
}

export function FaqTab({ faqs, similarProjects }: FaqTabProps) {
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
      <div className="grid gap-8 lg:grid-cols-12">
        {/* Left - FAQ Questions */}
        <div className="lg:col-span-8">
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
        <div className="lg:col-span-4">
          <div className="sticky top-20">
            <p className="text-muted-foreground mb-4">
              Don&apos;t see the answer to your question? Ask the project creator directly.
            </p>
            <Button variant="outline" className="w-full">
              Ask a question
            </Button>
          </div>
        </div>
      </div>

      {/* Similar Projects Section */}
      {similarProjects.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">Similar projects to check out</h3>
            <Button variant="outline" size="sm">
              See more
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {similarProjects.map((project) => (
              <Link key={project.id} href="#" className="group">
                <div className="aspect-[4/3] bg-muted rounded-lg overflow-hidden mb-3">
                  <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800" />
                </div>
                <div className="flex items-start gap-2">
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarFallback className="text-xs bg-muted">
                      {project.creator[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 mb-1">
                      {project.isProjectWeLove && (
                        <Heart className="h-3 w-3 fill-[#05ce78] text-[#05ce78]" />
                      )}
                      <h4 className="font-medium text-sm line-clamp-2 group-hover:text-primary transition-colors">
                        {project.title}
                      </h4>
                    </div>
                    <p className="text-xs text-muted-foreground">{project.creator}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <Clock className="h-3 w-3" />
                      <span>{project.endDate ? formatTimeRemaining(new Date(project.endDate)) : `${project.daysLeft} days left`}</span>
                      <span>•</span>
                      <span>{project.fundedPercent}% funded</span>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                    <Bookmark className="h-4 w-4" />
                  </Button>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
