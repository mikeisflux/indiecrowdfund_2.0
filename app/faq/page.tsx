'use client';

import { useState } from 'react';
import {
  Users,
  CreditCard,
  Store,
  Gift,
  BarChart3,
  Shield,
  Settings,
  ChevronDown,
} from 'lucide-react';

const categories = [
  { id: 'backers', label: 'For Backers', icon: Users },
  { id: 'payments', label: 'Payments & Fees', icon: CreditCard },
  { id: 'retailer', label: 'Retailer Program (LCS)', icon: Store },
  { id: 'rewards', label: 'Rewards & Fulfillment', icon: Gift },
  { id: 'analytics', label: 'Analytics & Tools', icon: BarChart3 },
  { id: 'security', label: 'Security & Trust', icon: Shield },
  { id: 'admin', label: 'Platform Administration', icon: Settings },
];

const faqData: Record<string, { question: string; answer: string }[]> = {
  backers: [
    { question: 'How do I back a project?', answer: 'Select a reward tier and complete the checkout process with your payment method.' },
    { question: 'Can I cancel my pledge?', answer: 'Yes, you can cancel your pledge anytime before the campaign ends.' },
    { question: 'How do I track my backed projects?', answer: 'Visit your dashboard to see all projects you\'ve backed and their status.' },
  ],
  payments: [
    { question: 'What are the platform fees?', answer: 'We charge a 5% platform fee on successfully funded projects, plus payment processing fees.' },
    { question: 'Which payment methods are accepted?', answer: 'We accept all major credit cards, debit cards, and select digital payment methods.' },
    { question: 'What is Stripe vs CCBill?', answer: 'Stripe is our standard payment processor with lower fees. CCBill is required for adult or high-risk content with specialized processing.' },
    { question: 'Is the platform NSFW-friendly?', answer: 'Yes, we support adult content creators through our CCBill integration with proper age verification.' },
    { question: 'When do creators receive their funds?', answer: 'Funds are transferred within 14 days after successful campaign completion.' },
    { question: 'Are pledges tax-deductible?', answer: 'No, pledges are not charitable donations and are not tax-deductible.' },
    { question: 'What currency is used?', answer: 'All transactions are processed in USD. International backers will see converted amounts.' },
  ],
  retailer: [
    { question: 'What is the Retailer Program?', answer: 'The LCS program allows local retailers to participate in crowdfunding campaigns.' },
    { question: 'How do I join as a retailer?', answer: 'Apply through our retailer portal with your business credentials.' },
  ],
  rewards: [
    { question: 'How do rewards work?', answer: 'Creators set reward tiers with specific pledge amounts and deliverables.' },
    { question: 'What are add-ons?', answer: 'Add-ons are optional extras you can add to your pledge beyond the main reward.' },
    { question: 'When will I receive my rewards?', answer: 'Estimated delivery dates are set by creators and shown on each reward tier.' },
  ],
  analytics: [
    { question: 'What analytics are available?', answer: 'Creators can track visitors, conversion rates, referrer sources, and more.' },
    { question: 'Can I integrate with Google Analytics?', answer: 'Yes, you can connect your Google Analytics and Meta Pixel accounts.' },
  ],
  security: [
    { question: 'How is my payment information protected?', answer: 'All payments are processed through PCI-compliant payment processors.' },
    { question: 'What is your refund policy?', answer: 'Refunds are handled on a case-by-case basis by project creators.' },
  ],
  admin: [
    { question: 'How do I contact support?', answer: 'Use the help button in your dashboard or email support@platform.com.' },
    { question: 'How do I report a project?', answer: 'Click the report button on any project page to flag concerns.' },
  ],
};

export default function FAQPage() {
  const [activeCategory, setActiveCategory] = useState('payments');
  const [openQuestions, setOpenQuestions] = useState<Set<string>>(new Set());

  const toggleQuestion = (question: string) => {
    const newOpen = new Set(openQuestions);
    if (newOpen.has(question)) {
      newOpen.delete(question);
    } else {
      newOpen.add(question);
    }
    setOpenQuestions(newOpen);
  };

  const activeData = faqData[activeCategory] || [];
  const activeCategoryInfo = categories.find((c) => c.id === activeCategory);

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-500 py-16 text-center text-white">
        <h1 className="text-4xl font-bold">Frequently Asked Questions</h1>
        <p className="mt-2 text-purple-100">54 answers across 9 categories</p>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 md:flex-row">
          {/* Vertical Tab Sidebar */}
          <div className="w-full md:w-64 flex-shrink-0">
            <nav className="space-y-1">
              {categories.map((category) => {
                const Icon = category.icon;
                const isActive = activeCategory === category.id;
                return (
                  <button
                    key={category.id}
                    onClick={() => setActiveCategory(category.id)}
                    className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-purple-600 text-white'
                        : 'bg-white text-zinc-700 hover:bg-zinc-100'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {category.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* FAQ Content */}
          <div className="flex-1">
            {activeCategoryInfo && (
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                  <activeCategoryInfo.icon className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-zinc-900">
                    {activeCategoryInfo.label}
                  </h2>
                  <p className="text-sm text-zinc-500">
                    Payment processing and platform fees
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {activeData.map((faq) => (
                <div
                  key={faq.question}
                  className="overflow-hidden rounded-lg border border-zinc-200 bg-white"
                >
                  <button
                    onClick={() => toggleQuestion(faq.question)}
                    className="flex w-full items-center justify-between px-6 py-4 text-left"
                  >
                    <span className="font-medium text-zinc-900">
                      {faq.question}
                    </span>
                    <ChevronDown
                      className={`h-5 w-5 text-zinc-400 transition-transform ${
                        openQuestions.has(faq.question) ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {openQuestions.has(faq.question) && (
                    <div className="border-t border-zinc-200 bg-zinc-50 px-6 py-4">
                      <p className="text-zinc-600">{faq.answer}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
