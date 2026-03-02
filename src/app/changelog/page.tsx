import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Sparkles,
  Bug,
  Zap,
  Shield,
  Gauge,
  Palette,
  Code,
  FileText,
  Package,
  Calendar,
  GitCommit,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Changelog - Platform Updates & New Features",
  description:
    "Stay up to date with the latest IndieCrowdfund platform updates, new features, bug fixes, and improvements.",
};

export const dynamic = "force-dynamic";

interface ChangelogEntry {
  id: string;
  title: string;
  description: string;
  category: string;
  version: string | null;
  commitHash: string | null;
  publishedAt: Date | null;
  createdAt: Date;
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  FEATURE: { label: "New Feature", icon: Sparkles, color: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
  BUGFIX: { label: "Bug Fix", icon: Bug, color: "bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30" },
  IMPROVEMENT: { label: "Improvement", icon: Zap, color: "bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30" },
  SECURITY: { label: "Security", icon: Shield, color: "bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30" },
  PERFORMANCE: { label: "Performance", icon: Gauge, color: "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30" },
  UI_UX: { label: "UI/UX", icon: Palette, color: "bg-pink-500/20 text-pink-600 dark:text-pink-400 border-pink-500/30" },
  API: { label: "API", icon: Code, color: "bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border-cyan-500/30" },
  DOCUMENTATION: { label: "Documentation", icon: FileText, color: "bg-gray-500/20 text-gray-600 dark:text-gray-400 border-gray-500/30" },
  OTHER: { label: "Other", icon: Package, color: "bg-slate-500/20 text-slate-600 dark:text-slate-400 border-slate-500/30" },
};

async function getChangelogEntries() {
  try {
    const entries = await db.changelogEntry.findMany({
      where: {
        isPublished: true,
      },
      orderBy: {
        publishedAt: "desc",
      },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        version: true,
        commitHash: true,
        publishedAt: true,
        createdAt: true,
      },
    });

    return entries;
  } catch (error) {
    console.error("Error fetching changelog:", error);
    return [];
  }
}

// Group entries by month/year
function groupEntriesByDate(entries: Awaited<ReturnType<typeof getChangelogEntries>>) {
  const groups: Record<string, typeof entries> = {};

  for (const entry of entries) {
    const date = entry.publishedAt || entry.createdAt;
    const key = new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "long" });
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(entry);
  }

  return groups;
}

export default async function ChangelogPage() {
  const entries = await getChangelogEntries();
  const groupedEntries = groupEntriesByDate(entries);
  const months = Object.keys(groupedEntries);

  return (
    <div className="min-h-screen bg-background">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="container relative max-w-4xl py-8 md:py-12">
        {/* Header */}
        <div className="mb-10">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>

          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 rounded-2xl bg-primary/20">
              <FileText className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold">Change Log</h1>
              <p className="text-muted-foreground">
                Track all updates, fixes, and improvements to IndieCrowdfund
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-4 mt-6">
            <div className="px-4 py-2 rounded-lg bg-muted/50 border">
              <span className="text-2xl font-bold text-primary">{entries.length}</span>
              <span className="text-sm text-muted-foreground ml-2">Total Updates</span>
            </div>
            <div className="px-4 py-2 rounded-lg bg-muted/50 border">
              <span className="text-2xl font-bold text-emerald-500">
                {entries.filter((e: ChangelogEntry) => e.category === "FEATURE").length}
              </span>
              <span className="text-sm text-muted-foreground ml-2">New Features</span>
            </div>
            <div className="px-4 py-2 rounded-lg bg-muted/50 border">
              <span className="text-2xl font-bold text-red-500">
                {entries.filter((e: ChangelogEntry) => e.category === "BUGFIX").length}
              </span>
              <span className="text-sm text-muted-foreground ml-2">Bug Fixes</span>
            </div>
          </div>
        </div>

        {/* Changelog entries */}
        {entries.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
              <h3 className="text-lg font-semibold mb-2">No changelog entries yet</h3>
              <p className="text-muted-foreground">
                Check back soon for updates on new features and improvements.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-12">
            {months.map((month) => (
              <div key={month}>
                {/* Month header */}
                <div className="flex items-center gap-3 mb-6">
                  <Calendar className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-bold">{month}</h2>
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-sm text-muted-foreground">
                    {groupedEntries[month].length} update{groupedEntries[month].length !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Entries for this month */}
                <div className="space-y-4 ml-2 border-l-2 border-border pl-6">
                  {groupedEntries[month].map((entry: ChangelogEntry) => {
                    const config = CATEGORY_CONFIG[entry.category] || CATEGORY_CONFIG.OTHER;
                    const Icon = config.icon;

                    return (
                      <Card key={entry.id} className="overflow-hidden hover:shadow-md transition-shadow">
                        <CardContent className="p-5">
                          <div className="flex items-start gap-4">
                            <div className={`p-2 rounded-lg ${config.color}`}>
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-2">
                                <Badge variant="outline" className={config.color}>
                                  {config.label}
                                </Badge>
                                {entry.version && (
                                  <Badge variant="secondary" className="font-mono text-xs">
                                    v{entry.version}
                                  </Badge>
                                )}
                                {entry.commitHash && (
                                  <span className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                                    <GitCommit className="h-3 w-3" />
                                    {entry.commitHash.substring(0, 7)}
                                  </span>
                                )}
                              </div>
                              <h3 className="font-semibold text-lg mb-2">{entry.title}</h3>
                              <p className="text-muted-foreground text-sm whitespace-pre-wrap">
                                {entry.description}
                              </p>
                              <p className="text-xs text-muted-foreground mt-3">
                                {new Date(entry.publishedAt || entry.createdAt).toLocaleDateString("en-US", {
                                  weekday: "long",
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                                })}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer CTA */}
        <div className="mt-16 p-8 rounded-2xl bg-gradient-to-r from-primary/10 to-purple-500/10 border text-center">
          <h3 className="text-xl font-bold mb-2">Found a bug or have feedback?</h3>
          <p className="text-muted-foreground mb-4">
            Help us improve IndieCrowdfund by submitting bug reports and feature suggestions.
          </p>
          <Link href="/bug-report">
            <Button>
              <Bug className="h-4 w-4 mr-2" />
              Submit Bug Report
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
