import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Newspaper, Calendar, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Press - IndieCrowdfund",
  description:
    "Press releases and announcements from IndieCrowdfund, the Kickstarter alternative built for independent creators.",
};

export const dynamic = "force-dynamic";

interface PressRow {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  imageUrl: string | null;
  authorName: string | null;
  publishedAt: Date | null;
  createdAt: Date;
}

async function getPressReleases(): Promise<PressRow[]> {
  try {
    return await db.pressRelease.findMany({
      where: { isPublished: true, deletedAt: null },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        imageUrl: true,
        authorName: true,
        publishedAt: true,
        createdAt: true,
      },
    });
  } catch (error) {
    // Table not migrated yet (or any other failure) — render empty
    // state instead of taking the page down.
    console.error("Error fetching press releases:", error);
    return [];
  }
}

function formatDate(value: Date | null | undefined, fallback: Date): string {
  return new Date(value || fallback).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function PressPage() {
  const releases = await getPressReleases();

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="container relative max-w-4xl py-8 md:py-12">
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </Link>

        <div className="mb-10 flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-primary/20">
            <Newspaper className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-bold">Press</h1>
            <p className="text-muted-foreground">
              Announcements and news from IndieCrowdfund
            </p>
          </div>
        </div>

        {releases.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <Newspaper className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
              <h3 className="text-lg font-semibold mb-2">No press releases yet</h3>
              <p className="text-muted-foreground">Check back soon.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {releases.map((release) => (
              <Link
                key={release.id}
                href={`/press/${release.slug}`}
                className="block group"
              >
                <Card className="overflow-hidden hover:shadow-md transition-shadow">
                  {release.imageUrl ? (
                    <div className="aspect-[3/1] bg-muted relative overflow-hidden">
                      <Image
                        src={release.imageUrl}
                        alt={release.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 800px"
                        className="object-cover group-hover:scale-[1.02] transition-transform"
                      />
                    </div>
                  ) : null}
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{formatDate(release.publishedAt, release.createdAt)}</span>
                      {release.authorName ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{release.authorName}</span>
                        </>
                      ) : null}
                    </div>
                    <h2 className="text-xl md:text-2xl font-bold mb-2 group-hover:text-primary transition-colors">
                      {release.title}
                    </h2>
                    {release.excerpt ? (
                      <p className="text-muted-foreground line-clamp-3">
                        {release.excerpt}
                      </p>
                    ) : null}
                    <div className="mt-4 flex items-center gap-1 text-sm font-medium text-primary">
                      Read more
                      <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
