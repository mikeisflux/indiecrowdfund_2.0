"use client";

import { useEffect } from "react";

/**
 * Tells the host page how tall this widget is.
 *
 * A cross-origin iframe cannot size itself and the parent cannot measure it,
 * so without this every embed is a fixed height with either dead space or a
 * scrollbar through the middle of the card. The snippet we hand out listens
 * for these messages; a host that ignores them still gets a working widget at
 * whatever height they set, so this degrades rather than breaks.
 *
 * targetOrigin is "*" on purpose: the whole point is that we do not know which
 * site is framing us. That is safe here because the payload is a number that
 * is already public — the rendered height of a public campaign card — and this
 * component only ever posts, never acts on what it receives.
 */
export function EmbedAutoHeight() {
  useEffect(() => {
    if (window.parent === window) return;

    const post = () => {
      const height = Math.ceil(document.documentElement.scrollHeight);
      window.parent.postMessage({ type: "icf-embed-height", height }, "*");
    };

    post();

    // Images load after first paint and change the height, so observe rather
    // than measuring once.
    const observer = new ResizeObserver(post);
    observer.observe(document.documentElement);
    window.addEventListener("load", post);

    return () => {
      observer.disconnect();
      window.removeEventListener("load", post);
    };
  }, []);

  return null;
}
