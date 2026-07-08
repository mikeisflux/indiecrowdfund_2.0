import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar } from "lucide-react";

export const dynamic = "force-dynamic";

async function getPressRelease(slug: string) {
  try {
    return await db.pressRelease.findFirst({
      where: { slug, isPublished: true, deletedAt: null },
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        content: true,
        imageUrl: true,
        authorName: true,
        publishedAt: true,
        createdAt: true,
      },
    });
  } catch (error) {
    console.error("Error fetching press release:", error);
    return null;
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const release = await getPressRelease(slug);
  if (!release) return { title: "Press - IndieCrowdfund" };
  return {
    title: `${release.title} - IndieCrowdfund`,
    description: release.excerpt || release.title,
    openGraph: {
      title: release.title,
      description: release.excerpt || undefined,
      images: release.imageUrl ? [{ url: release.imageUrl }] : undefined,
      type: "article",
      publishedTime: (release.publishedAt || release.createdAt).toISOString(),
    },
  };
}

export default async function PressDetailPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const release = await getPressRelease(slug);
  if (!release) notFound();

  const dateLabel = new Date(release.publishedAt || release.createdAt).toLocaleDateString(
    "en-US",
    { year: "numeric", month: "long", day: "numeric" }
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <article className="container relative max-w-3xl py-8 md:py-12">
        <Link href="/press">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            All press releases
          </Button>
        </Link>

        <header className="mb-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
            <Calendar className="h-4 w-4" />
            <span>{dateLabel}</span>
            {release.authorName ? (
              <>
                <span aria-hidden="true">·</span>
                <span>{release.authorName}</span>
              </>
            ) : null}
          </div>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight">
            {release.title}
          </h1>
          {release.excerpt ? (
            <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
              {release.excerpt}
            </p>
          ) : null}
        </header>

        {release.imageUrl ? (
          <div className="mb-10 aspect-[16/9] relative overflow-hidden rounded-2xl bg-muted">
            <Image
              src={release.imageUrl}
              alt={release.title}
              fill
              sizes="(max-width: 768px) 100vw, 800px"
              className="object-cover"
              priority
            />
          </div>
        ) : null}

        {/*
          Press release body is admin-authored HTML. The styling here
          replaces what a typography plugin (`prose`) would do — explicit
          Tailwind so the page renders correctly whether or not
          @tailwindcss/typography is present.
        */}
        <div
          className="
            text-foreground/90 leading-relaxed
            [&_p]:mb-4 [&_p]:text-base [&_p]:md:text-lg
            [&_h2]:text-2xl [&_h2]:md:text-3xl [&_h2]:font-bold [&_h2]:mt-10 [&_h2]:mb-4
            [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mt-8 [&_h3]:mb-3
            [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4 [&_ul]:space-y-2
            [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-4 [&_ol]:space-y-2
            [&_li]:leading-relaxed
            [&_strong]:font-semibold [&_strong]:text-foreground
            [&_em]:italic
            [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:no-underline
            [&_blockquote]:border-l-4 [&_blockquote]:border-primary/40 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:my-6
            [&_img]:rounded-lg [&_img]:my-6
          "
          dangerouslySetInnerHTML={{ __html: release.content }}
        />
      </article>
    </div>
  );
}
