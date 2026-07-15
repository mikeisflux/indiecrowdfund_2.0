import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import { Check, Minus, X, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/footer";
import { GROUPS, PLATFORM, type Support } from "./data";

export const metadata: Metadata = {
  title: "How We Stack Up | IndieCrowdfund",
  description:
    "See how IndieCrowdfund compares to Kickstarter, Indiegogo, and Fund My Comic — crowdfunding, built-in fulfillment, an ongoing store, and more, side by side.",
};

function Cell({ value }: { value: Support }) {
  if (value === "yes") {
    return (
      <span className="inline-flex items-center justify-center" aria-label="Included">
        <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" strokeWidth={3} />
      </span>
    );
  }
  if (value === "partial") {
    return (
      <span className="inline-flex items-center justify-center" aria-label="Limited or third-party">
        <Minus className="h-5 w-5 text-amber-500" strokeWidth={3} />
      </span>
    );
  }
  if (value === "unknown") {
    return (
      <span
        className="inline-flex items-center justify-center text-sm font-bold text-muted-foreground/50"
        aria-label="Not launched yet"
      >
        ?
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center" aria-label="Not available">
      <X className="h-4 w-4 text-muted-foreground/40" strokeWidth={2.5} />
    </span>
  );
}

function LegendItem({ children, icon }: { children: React.ReactNode; icon: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
      {icon}
      {children}
    </span>
  );
}

export default function HowWeStackUpPage() {
  const totalYes = GROUPS.reduce(
    (acc, g) => {
      for (const r of g.rows) {
        if (r.ic === "yes") acc.ic++;
        if (r.ks === "yes") acc.ks++;
        if (r.ig === "yes") acc.ig++;
        if (r.fmc === "yes") acc.fmc++;
      }
      return acc;
    },
    { ic: 0, ks: 0, ig: 0, fmc: 0 }
  );
  const totalRows = GROUPS.reduce((n, g) => n + g.rows.length, 0);

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="border-b border-border/50 bg-gradient-to-b from-primary/5 to-transparent">
        <div className="container py-14 md:py-20 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary mb-6">
            <Sparkles className="h-4 w-4" />
            Feature comparison
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            How We <span className="gradient-text-brand">Stack Up</span>
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            IndieCrowdfund bundles the campaign, the pledge manager, the print run, and an
            ongoing store into one platform. Here&apos;s how that compares to running your
            project on Kickstarter, Indiegogo, or Fund My Comic.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            <LegendItem icon={<Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" strokeWidth={3} />}>
              Included
            </LegendItem>
            <LegendItem icon={<Minus className="h-4 w-4 text-amber-500" strokeWidth={3} />}>
              Limited / third-party
            </LegendItem>
            <LegendItem icon={<X className="h-4 w-4 text-muted-foreground/40" strokeWidth={2.5} />}>
              Not available
            </LegendItem>
            <LegendItem icon={<span className="text-sm font-bold text-muted-foreground/50">?</span>}>
              Not launched yet
            </LegendItem>
          </div>
        </div>
      </section>

      {/* Comparison table */}
      <section className="container py-10 md:py-14">
        <div className="mx-auto max-w-4xl overflow-x-auto rounded-2xl border border-border shadow-sm">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border">
                <th className="sticky left-0 z-10 bg-background px-4 py-4 text-sm font-semibold" scope="col">
                  Feature
                </th>
                <th className="px-3 py-4 text-center" scope="col">
                  <div className="flex flex-col items-center gap-1">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-cyan-500">
                      <Sparkles className="h-4 w-4 text-white" />
                    </span>
                    <span className="text-sm font-bold gradient-text-brand whitespace-nowrap">IndieCrowdfund</span>
                  </div>
                </th>
                <th className="px-3 py-4 text-center text-sm font-semibold text-muted-foreground" scope="col">
                  Kickstarter
                </th>
                <th className="px-3 py-4 text-center text-sm font-semibold text-muted-foreground" scope="col">
                  Indiegogo
                </th>
                <th className="px-3 py-4 text-center text-sm font-semibold text-muted-foreground whitespace-nowrap" scope="col">
                  Fund My Comic
                </th>
                <th className="px-3 py-4 text-center text-sm font-semibold text-muted-foreground" scope="col">
                  Backmebro
                </th>
              </tr>
            </thead>
            <tbody>
              {GROUPS.map((group) => (
                <Fragment key={group.title}>
                  <tr className="bg-muted/40">
                    <td
                      colSpan={6}
                      className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      {group.title}
                    </td>
                  </tr>
                  {group.rows.map((row) => (
                    <tr key={row.label} className="border-t border-border/60 hover:bg-muted/20">
                      <th
                        scope="row"
                        className="sticky left-0 z-10 bg-background px-4 py-3 text-sm font-normal text-foreground"
                      >
                        {row.label}
                      </th>
                      <td className="bg-primary/[0.04] px-3 py-3 text-center">
                        <Cell value={row.ic} />
                      </td>
                      <td className="px-3 py-3 text-center">
                        <Cell value={row.ks} />
                      </td>
                      <td className="px-3 py-3 text-center">
                        <Cell value={row.ig} />
                      </td>
                      <td className="px-3 py-3 text-center">
                        <Cell value={row.fmc} />
                      </td>
                      <td className="px-3 py-3 text-center">
                        <Cell value={row.bmb} />
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
              {/* Totals */}
              <tr className="border-t-2 border-border bg-muted/30">
                <th scope="row" className="sticky left-0 z-10 bg-muted/30 px-4 py-3 text-sm font-semibold">
                  Features included ({totalRows} compared)
                </th>
                <td className="bg-primary/[0.06] px-3 py-3 text-center text-sm font-bold text-primary">
                  {totalYes.ic}
                </td>
                <td className="px-3 py-3 text-center text-sm font-semibold text-muted-foreground">{totalYes.ks}</td>
                <td className="px-3 py-3 text-center text-sm font-semibold text-muted-foreground">{totalYes.ig}</td>
                <td className="px-3 py-3 text-center text-sm font-semibold text-muted-foreground">{totalYes.fmc}</td>
                <td className="px-3 py-3 text-center text-sm font-semibold text-muted-foreground/50">&mdash;</td>
              </tr>
              {/* Platform / technology — facts only */}
              <tr className="border-t border-border/60 bg-muted/10">
                <th scope="row" className="sticky left-0 z-10 bg-background px-4 py-3 text-sm font-normal text-foreground">
                  Platform &amp; frontend technology
                </th>
                <td className="bg-primary/[0.04] px-3 py-3 text-center text-xs font-medium">{PLATFORM.ic}</td>
                <td className="px-3 py-3 text-center text-xs text-muted-foreground">{PLATFORM.ks}</td>
                <td className="px-3 py-3 text-center text-xs text-muted-foreground">{PLATFORM.ig}</td>
                <td className="px-3 py-3 text-center text-xs text-muted-foreground">{PLATFORM.fmc}</td>
                <td className="px-3 py-3 text-center text-xs text-muted-foreground">{PLATFORM.bmb}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="mx-auto mt-4 max-w-4xl text-xs text-muted-foreground">
          Comparison based on publicly available information about each platform, last reviewed
          July&nbsp;2026, and may not reflect more recent changes. &ldquo;Limited /
          third-party&rdquo; means the capability is restricted or typically requires a separate
          paid add-on or partner service. Product names and trademarks are the property of their
          respective owners and are used here only to identify each platform for comparison.
        </p>

        {/* CTA */}
        <div className="mx-auto mt-12 max-w-3xl rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-cyan-500/5 p-8 text-center">
          <h2 className="text-2xl font-bold">Everything your project needs, in one place</h2>
          <p className="mt-2 text-muted-foreground">
            Launch a campaign, survey and charge your backers, run your print, and keep selling
            afterward — without stitching together five different tools.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/projects/new">
                Start a Project
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/crowdfunds">Explore Crowdfunds</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
