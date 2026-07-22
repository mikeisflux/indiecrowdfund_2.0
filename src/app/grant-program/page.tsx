import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/footer";
import {
  HeartHandshake,
  ArrowRight,
  Landmark,
  PenTool,
  Wallet,
  FileCheck,
  Package,
  ShieldCheck,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Grant Program",
  description:
    "The Divinity Comics Grant Program — how contributions on IndieCrowdfund fund grants that support the creation and promotion of western comics and art.",
};

const STEPS = [
  {
    icon: Wallet,
    title: "You contribute",
    text: "Backers contribute to a project through our payment processors. Contributions go to IndieCrowdfund (a DBA of Divinity Comics Inc.) in support of the Grant Program.",
  },
  {
    icon: Landmark,
    title: "The program receives it",
    text: "Your contribution is treated as a contribution to the Grant Program, whose purpose is to promote western comics and art.",
  },
  {
    icon: FileCheck,
    title: "Costs are covered",
    text: "A small percentage is retained to cover the reasonable administrative and facilitation costs of operating the program — reviewing projects, processing contributions, and running the platform.",
  },
  {
    icon: PenTool,
    title: "The grant is awarded",
    text: "The remaining funds are awarded to the creator as a grant under a signed grant agreement, to make the project described in their campaign.",
  },
  {
    icon: Package,
    title: "Creators take it from there",
    text: "After the grant is made, the creator is responsible for the project — including producing and fulfilling any rewards they chose to offer.",
  },
];

export default function GrantProgramPage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="border-b border-border/50 bg-gradient-to-b from-primary/5 to-transparent">
        <div className="container py-14 md:py-20 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary mb-6">
            <HeartHandshake className="h-4 w-4" />
            Divinity Comics Grant Program
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            Support Comic Projects <span className="gradient-text-brand">Through Our Grants</span>
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            IndieCrowdfund is a DBA of Divinity Comics Inc., a 501(c)(3) nonprofit.
            When you back a project here, you&apos;re contributing to our Grant Program — a
            grantmaking program whose mission is to promote western comics and art.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="container py-12 md:py-16">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">How the Grant Program works</h2>
        <div className="mx-auto grid max-w-4xl gap-4">
          {STEPS.map((step, i) => (
            <div
              key={step.title}
              className="flex items-start gap-4 rounded-2xl border border-border/60 bg-card/50 p-5"
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-cyan-500">
                <step.icon className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold">
                  <span className="mr-2 text-muted-foreground">{i + 1}.</span>
                  {step.title}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">{step.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* The important stuff */}
      <section className="border-t border-border/50 bg-muted/20">
        <div className="container py-12 md:py-16">
          <div className="mx-auto max-w-4xl grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-border/60 bg-card/50 p-6">
              <h3 className="flex items-center gap-2 font-semibold">
                <ShieldCheck className="h-5 w-5 text-primary" />
                What backing means here
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground list-disc pl-5">
                <li>
                  You are backing the creation of a project through our Grant Program — not
                  purchasing a product.
                </li>
                <li>Rewards are offered by creators and are not guaranteed.</li>
                <li>
                  Funds are awarded as grants by IndieCrowdfund (a DBA of Divinity Comics Inc.) to support
                  projects aligned with our mission.
                </li>
              </ul>
            </div>
            <div className="rounded-2xl border border-border/60 bg-card/50 p-6">
              <h3 className="flex items-center gap-2 font-semibold">
                <FileCheck className="h-5 w-5 text-primary" />
                Eligibility &amp; selection
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground list-disc pl-5">
                <li>
                  Projects must align with the program&apos;s mission of promoting western comics
                  and art, and comply with our Terms of Service and Content Guidelines.
                </li>
                <li>
                  Every campaign is reviewed before launch. Grants are awarded at the
                  organization&apos;s sole discretion.
                </li>
                <li>
                  Creators sign a grant agreement before receiving funds and are responsible for
                  using them for the project described.
                </li>
              </ul>
            </div>
          </div>

          <p className="mx-auto mt-8 max-w-4xl text-xs text-muted-foreground">
            The Grant Program applies to crowdfunding campaigns on IndieCrowdfund. For full
            terms, see the{" "}
            <Link href="/terms" className="underline underline-offset-2">Terms of Service</Link>{" "}
            and the{" "}
            <Link href="/terms?tab=grant" className="underline underline-offset-2">Grant Agreement</Link>.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="container py-12 md:py-16">
        <div className="mx-auto max-w-3xl rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-cyan-500/5 p-8 text-center">
          <h2 className="text-2xl font-bold">Back a project. Fund the mission.</h2>
          <p className="mt-2 text-muted-foreground">
            Every contribution supports independent comics — and the program that helps them get
            made.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/crowdfunds">
                Explore Projects
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/projects/new">Apply With a Project</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
