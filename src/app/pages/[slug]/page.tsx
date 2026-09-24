import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import DOMPurify from "isomorphic-dompurify";
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

/** youtube / vimeo URLs become privacy-friendly embed URLs; others null. */
function videoEmbedUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtube.com" || host === "m.youtube.com") {
      const id = url.searchParams.get("v");
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (host === "youtu.be") {
      const id = url.pathname.slice(1).split("/")[0];
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (host === "vimeo.com") {
      const id = url.pathname.slice(1).split("/")[0];
      return /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : null;
    }
    return null;
  } catch {
    return null;
  }
}

function RenderComponent({ component }: { component: PageComponent }) {
  const settings = component.settings || {};
  const align = settings.align === "center" ? "text-center" : settings.align === "right" ? "text-right" : "";

  switch (component.type) {
    case "heading": {
      const size = str(settings.size) || "h2";
      const cls =
        size === "h1"
          ? `text-4xl sm:text-5xl font-bold ${align}`
          : size === "h3"
            ? `text-2xl font-semibold ${align}`
            : `text-3xl font-bold ${align}`;
      if (size === "h1") return <h1 className={cls}>{component.content}</h1>;
      if (size === "h3") return <h3 className={cls}>{component.content}</h3>;
      return <h2 className={cls}>{component.content}</h2>;
    }
    case "list": {
      const items = (component.content || "")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      if (items.length === 0) return null;
      const numbered = settings.listStyle === "number";
      const listCls = `space-y-2 text-lg ${numbered ? "list-decimal" : "list-disc"} pl-6 ${align}`;
      return numbered ? (
        <ol className={listCls}>{items.map((item, i) => <li key={i}>{item}</li>)}</ol>
      ) : (
        <ul className={listCls}>{items.map((item, i) => <li key={i}>{item}</li>)}</ul>
      );
    }
    case "video": {
      const embed = videoEmbedUrl(str(settings.src) || str(component.content));
      if (!embed) return null;
      return (
        <div className="aspect-video w-full overflow-hidden rounded-lg">
          <iframe
            src={embed}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title="Embedded video"
          />
        </div>
      );
    }
    case "embed": {
      const src = str(settings.src) || str(component.content);
      if (!src || !/^https:\/\//.test(src)) return null;
      return (
        <iframe
          src={src}
          className="min-h-[400px] w-full rounded-lg border"
          sandbox="allow-scripts allow-same-origin allow-popups"
          title="Embedded content"
        />
      );
    }
    case "html": {
      if (!component.content) return null;
      // Admin-authored, but sanitize anyway — an XSS here would run on
      // every visitor of a public page.
      const clean = DOMPurify.sanitize(component.content);
      return <div className="prose max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: clean }} />;
    }
    case "stats-counter": {
      const stats = Array.isArray(settings.stats)
        ? (settings.stats as Array<{ value?: string; label?: string }>)
        : [];
      if (stats.length === 0) return null;
      return (
        <div className="grid grid-cols-2 gap-8 text-center sm:grid-cols-3">
          {stats.map((stat, i) => (
            <div key={i}>
              <p className="text-4xl font-bold text-primary">{stat.value}</p>
              <p className="mt-1 opacity-70">{stat.label}</p>
            </div>
          ))}
        </div>
      );
    }
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
      {blocks.map((section) => {
        // A section with an explicit background must pin its own text
        // color: theme tokens follow light/dark mode and made white
        // sections unreadable for dark-mode visitors.
        const background = str(section.settings?.background);
        let sectionText: string | undefined;
        if (background && /^#([0-9a-f]{6})$/i.test(background)) {
          const r = parseInt(background.slice(1, 3), 16);
          const g = parseInt(background.slice(3, 5), 16);
          const b = parseInt(background.slice(5, 7), 16);
          const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
          sectionText = luminance > 0.6 ? "#18181b" : "#fafafa";
        }
        return (
        <section
          key={section.id}
          style={{
            padding: str(section.settings?.padding) || "60px 16px",
            backgroundColor: background || undefined,
            color: sectionText,
          }}
        >
          <div className="container mx-auto max-w-4xl space-y-6">
            {(section.children || []).map((child) => (
              <RenderComponent key={child.id} component={child} />
            ))}
          </div>
        </section>
        );
      })}
      {blocks.length === 0 && (
        <div className="container mx-auto max-w-4xl px-4 py-24 text-center text-muted-foreground">
          This page has no content yet.
        </div>
      )}
    </main>
  );
}
