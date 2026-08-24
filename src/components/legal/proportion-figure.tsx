"use client";

import { useState } from "react";
import Image from "next/image";

/**
 * One proportion chart, which disappears rather than breaking if its file
 * isn't on the server.
 *
 * These charts are supplied as static assets under public/. When they were
 * missing, next/image's optimizer logged "The requested resource isn't a valid
 * image ... received null" on every render of two legal pages and showed the
 * reader a broken image on a document that is supposed to look authoritative.
 *
 * `unoptimized` keeps the optimizer out of the path entirely, so a missing
 * file is a plain 404 on a static asset instead of a server-side warning, and
 * onError hides the figure so the surrounding policy text still reads
 * correctly on its own. Drop the file in and it appears — no code change.
 */
export function ProportionFigure({
  src,
  alt,
  width,
  height,
  caption,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  caption: React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  return (
    <figure className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white p-4">
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        unoptimized
        onError={() => setFailed(true)}
        className="w-full h-auto"
      />
      <figcaption className="mt-3 text-sm text-muted-foreground">{caption}</figcaption>
    </figure>
  );
}
