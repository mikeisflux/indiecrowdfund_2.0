import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, KeyRound, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiDocsMarkdown } from "@/lib/api/docs-content";
import { CopyForLLM } from "./copy-for-llm";
import { MarkdownView } from "./markdown-view";

export const metadata: Metadata = {
  title: "Developer API — IndieCrowdfund",
  description:
    "Read-only public API for IndieCrowdfund campaign and platform data. Built for crowdfunding tracker sites, researchers, and journalists. No personal data.",
};

export default function ApiDocsPage() {
  return (
    <div className="relative min-h-screen bg-background overflow-hidden">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="floating-orb absolute -top-40 -right-40 w-[500px] h-[500px] bg-primary/10" />
        <div className="floating-orb absolute top-1/2 -left-40 w-[400px] h-[400px] bg-purple-500/8" style={{ animationDelay: "-7s" }} />
      </div>

      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link
            href="/"
            className="text-xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent"
          >
            IndieCrowdfund
          </Link>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to site
            </Link>
          </Button>
        </div>
      </header>

      <main className="relative container mx-auto px-4 py-10 max-w-4xl">
        <div className="rounded-lg border bg-white dark:bg-zinc-900 p-6 md:p-8">
          <h1 className="text-3xl font-bold mb-2">Developer API</h1>
          <p className="text-muted-foreground mb-6">
            Read-only access to public campaign and platform data.
          </p>

          {/* The privacy claim is the first thing a tracker's legal review
              looks for, so it leads rather than sitting in a footnote. */}
          <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/30">
            <div className="flex gap-3">
              <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div className="text-sm text-emerald-900 dark:text-emerald-100">
                <p className="font-semibold mb-1">No personal data, by construction</p>
                <p>
                  Every endpoint returns an explicit allowlist of fields that are
                  already visible to anonymous visitors. There is no endpoint for
                  backers, pledges, addresses, emails, or payout details, and no
                  parameter that will surface them. Unlaunched campaigns are never
                  returned.
                </p>
              </div>
            </div>
          </div>

          <div className="mb-8 flex flex-wrap items-center gap-3">
            <Button asChild>
              <Link href="/dashboard/api">
                <KeyRound className="mr-2 h-4 w-4" />
                Get API keys
              </Link>
            </Button>
            <span className="text-sm text-muted-foreground">
              Free — requires an IndieCrowdfund account.
            </span>
          </div>

          <div className="mb-8 rounded-lg border bg-muted/30 p-4">
            <CopyForLLM markdown={apiDocsMarkdown} />
          </div>

          <MarkdownView markdown={apiDocsMarkdown} />
        </div>
      </main>
    </div>
  );
}
