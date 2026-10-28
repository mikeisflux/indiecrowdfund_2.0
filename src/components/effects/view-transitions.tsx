"use client";

/**
 * Same-document View Transitions for App Router navigations, no dependency.
 *
 * The trick: document.startViewTransition() snapshots the page, runs its
 * callback, and animates to whatever the DOM looks like when the callback's
 * promise resolves. router.push() alone resolves nothing — the new route
 * renders later, so the transition would finish on an unchanged page and do
 * nothing visible. The provider closes that gap: TransitionLink parks a
 * resolver in module scope, and the provider resolves it when usePathname
 * reports the route actually changed. That handshake is the entire reason
 * libraries exist for this; it is small enough to own.
 *
 * Where an element on the old page and one on the new page share a
 * view-transition-name (the card cover and the campaign hero), the browser
 * morphs one into the other instead of cross-fading. Everything else gets a
 * quarter-second cross-fade.
 *
 * Fallbacks, all silent: no startViewTransition support (Safari < 18,
 * Firefox stable) or prefers-reduced-motion → plain Link navigation.
 * Modified clicks (new tab, middle click) are never intercepted.
 */

import { useEffect, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

let pendingResolve: (() => void) | null = null;

export function ViewTransitionsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    // Route committed — let the in-flight transition take its "new" snapshot.
    if (pendingResolve) {
      pendingResolve();
      pendingResolve = null;
    }
  }, [pathname]);

  return <>{children}</>;
}

type TransitionLinkProps = React.ComponentProps<typeof Link>;

export function TransitionLink({ href, onClick, children, ...props }: TransitionLinkProps) {
  const router = useRouter();
  const [, startReactTransition] = useTransition();

  return (
    <Link
      href={href}
      {...props}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        // Never steal modified clicks or non-primary buttons.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        if (
          !("startViewTransition" in document) ||
          window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
          // Admin kill switch (/admin/themes -> Effects).
          document.body.dataset.fxVt === "off"
        ) {
          return; // plain Link navigation
        }
        e.preventDefault();
        const target = typeof href === "string" ? href : href.toString();
        const transition = document.startViewTransition(
          () =>
            new Promise<void>((resolve) => {
              // Replace, never stack: if a second navigation starts before the
              // first commits, release the old transition immediately.
              pendingResolve?.();
              pendingResolve = resolve;
              // The browser gives the DOM update about four seconds before it
              // abandons the transition with "timeout in DOM update". A slow
              // phone on a slow connection can miss that while the new route
              // is still loading. Let the transition finish on its own after
              // three seconds; the navigation carries on without the morph.
              const giveUp = window.setTimeout(() => {
                if (pendingResolve === resolve) pendingResolve = null;
                resolve();
              }, 3000);
              pendingResolve = () => {
                window.clearTimeout(giveUp);
                resolve();
              };
              startReactTransition(() => {
                router.push(target);
              });
            })
        );
        // An abandoned or skipped transition rejects these three promises.
        // Nothing here needs them, and unhandled they surface as
        // "Unhandled Promise Rejection: Transition was aborted…" in the
        // error log on every slow phone.
        transition.ready.catch(() => {});
        transition.updateCallbackDone.catch(() => {});
        transition.finished.catch(() => {});
      }}
    >
      {children}
    </Link>
  );
}
