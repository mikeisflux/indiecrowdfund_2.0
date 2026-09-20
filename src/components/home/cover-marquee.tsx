import Image from "next/image";
import Link from "next/link";

/**
 * Infinite marquee of live campaign covers, straight under the hero.
 *
 * Comic covers are the best art this platform has, and until now the homepage
 * kept them locked inside card thumbnails. This is a film-strip of the actual
 * books funding right now — the first proof a new visitor sees that real work
 * is being made and backed here.
 *
 * Pure CSS motion (see .marquee-* in globals.css): the track is rendered
 * twice and slides -50%, so the loop is seamless at any width. Hover pauses
 * it; covers lift and sharpen individually. prefers-reduced-motion stops the
 * scroll entirely via the global media rule, leaving a static, scrollable
 * strip — content, not decoration, so it must remain reachable.
 *
 * Server component: no JS shipped for the effect itself.
 */

export interface MarqueeCover {
  id: string;
  title: string;
  imageUrl: string;
  href: string;
}

export function CoverMarquee({ covers }: { covers: MarqueeCover[] }) {
  // Below 6 covers the duplicated track's seam becomes obvious on wide
  // screens; better to show nothing than a stuttering loop.
  if (covers.length < 6) return null;

  const strip = (ariaHidden: boolean) => (
    <div
      className="marquee-track flex shrink-0 items-center gap-4 pr-4 md:gap-6 md:pr-6"
      aria-hidden={ariaHidden || undefined}
    >
      {covers.map((c) => (
        <Link
          key={`${ariaHidden ? "b" : "a"}-${c.id}`}
          href={c.href}
          tabIndex={ariaHidden ? -1 : undefined}
          className="marquee-item group relative block h-40 w-28 shrink-0 overflow-hidden rounded-xl border border-border/60 shadow-md md:h-56 md:w-40"
        >
          <Image
            src={c.imageUrl}
            alt={ariaHidden ? "" : c.title}
            fill
            sizes="(max-width: 768px) 112px, 160px"
            className="object-cover transition-transform duration-500 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <p className="absolute inset-x-0 bottom-0 line-clamp-2 p-2 text-xs font-semibold text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            {c.title}
          </p>
        </Link>
      ))}
    </div>
  );

  return (
    <section
      aria-label="Live campaigns"
      className="marquee relative overflow-hidden border-y border-border/50 py-6 md:py-8"
    >
      {strip(false)}
      {strip(true)}
    </section>
  );
}
