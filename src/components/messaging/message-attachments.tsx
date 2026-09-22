"use client";

/**
 * Renders a message's attachment manifest, shared by every surface that
 * shows message bubbles (messages panel, IndieKit inbox, dashboard
 * messages). Images show as clickable thumbnails; everything else is a
 * download chip. Attachment URLs are same-origin (/api/uploads/...), and
 * next/image runs unoptimized here because these are user files served
 * verbatim, not responsive site imagery.
 */

import Image from "next/image";
import { Paperclip } from "lucide-react";

export interface MessageAttachmentItem {
  filename: string;
  contentType: string;
  size: number;
  url: string;
}

function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MessageAttachments({
  attachments,
}: {
  attachments?: MessageAttachmentItem[] | null;
}) {
  if (!attachments || attachments.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {attachments.map((att, i) =>
        att.contentType?.startsWith("image/") ? (
          <a
            key={`${att.url}-${i}`}
            href={att.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block overflow-hidden rounded-lg border border-border/60 transition-transform hover:scale-[1.02]"
            title={att.filename}
          >
            <Image
              src={att.url}
              alt={att.filename}
              width={220}
              height={160}
              unoptimized
              className="h-40 w-auto max-w-[220px] object-cover"
            />
          </a>
        ) : (
          <a
            key={`${att.url}-${i}`}
            href={att.url}
            target="_blank"
            rel="noopener noreferrer"
            download={att.filename}
            className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border/60 bg-muted/40 px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
          >
            <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{att.filename}</span>
            {formatSize(att.size) && (
              <span className="shrink-0 text-muted-foreground">{formatSize(att.size)}</span>
            )}
          </a>
        )
      )}
    </div>
  );
}
