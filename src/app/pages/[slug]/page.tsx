import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";

/**
 * Public renderer for Page Builder pages.
 *
 * The admin Page Builder saved CustomPage rows for months with nothing
 * to display them — its Preview link pointed at /{slug}, which 404s.
 * Published pages now render here at /pages/{slug}; drafts stay
 * invisible.
 */

export const dynamic = "force-dynamic";

interface PageComponent {
  id: string;
  type: string;
  content?: string;
  settings?: Record<string, unknown>;
  children?: PageComponent[];
}

async function getPage(slug: string) {
  try {
    return await db.customPage.findFirst({
      where: { slug, isPublished: true },
    });
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) return {};
  return {
    title: page.metaTitle || page.title,
    description: page.metaDescription || page.description || undefined,
    ...(page.ogImage ? { openGraph: { images: [page.ogImage] } } : {}),
  };
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v ? v : undefined;
}

function RenderComponent({ component }: { component: PageComponent }) {
  const settings = component.settings || {};
  const align = settings.align === "center" ? "text-center" : settings.align === "right" ? "text-right" : "";

  switch (component.type) {
    case "heading":
      return <h2 className={`text-3xl font-bold ${align}`}>{component.content}</h2>;
    case "text":
      return (
        <p className={`text-lg leading-relaxed ${align}`} style={{ color: str(settings.color) }}>
          {component.content}
        </p>
      );
    case "image": {
      const src = str(settings.src) || str(component.content);
      if (!src) return null;
      return (
        <Image
          src={src}
          alt={str(settings.alt) || ""}
          width={1200}
          height={675}
          unoptimized
          className="h-auto w-full rounded-lg"
        />
      );
    }
    case "button": {
      const href = str(settings.href) || "/";
      return (
        <div className={align}>
          <Link
            href={href}
            className="inline-block rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            {component.content || "Learn more"}
          </Link>
        </div>
      );
    }
    case "divider":
      return <hr className="border-border" />;
    case "spacer":
      return <div style={{ height: Number(settings.height) || 40 }} />;
    case "columns":
    case "grid":
      return (
        <div className="grid gap-6 md:grid-cols-2">
          {(component.children || []).map((child) => (
            <RenderComponent key={child.id} component={child} />
          ))}
        </div>
      );
    default:
      // Containers and unknown types render their children in a stack.
      if (component.children && component.children.length > 0) {
        return (
          <div className="space-y-6">
            {component.children.map((child) => (
              <RenderComponent key={child.id} component={child} />
            ))}
          </div>
        );
      }
      return component.content ? <p className={align}>{component.content}</p> : null;
  }
}

export default async function CustomPageView({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) notFound();

  const content = page.content as unknown as { blocks?: PageComponent[] } | null;
  const blocks = Array.isArray(content?.blocks) ? content.blocks : [];

  return (
    <main className="min-h-screen">
      {blocks.map((section) => (
        <section
          key={section.id}
          style={{
            padding: str(section.settings?.padding) || "60px 16px",
            backgroundColor: str(section.settings?.background) || undefined,
          }}
        >
          <div className="container mx-auto max-w-4xl space-y-6">
            {(section.children || []).map((child) => (
              <RenderComponent key={child.id} component={child} />
            ))}
          </div>
        </section>
      ))}
      {blocks.length === 0 && (
        <div className="container mx-auto max-w-4xl px-4 py-24 text-center text-muted-foreground">
          This page has no content yet.
        </div>
      )}
    </main>
  );
}
