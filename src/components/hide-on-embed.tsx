"use client";

import { usePathname } from "next/navigation";

/**
 * Suppresses site chrome on /embed/* routes.
 *
 * The embed widget renders inside someone else's page, so our header,
 * announcement bar, consent banner, promo popup and support bubble must not
 * come along with it — a cookie banner appearing inside a campaign card on a
 * third-party blog is both broken-looking and, for consent, actively wrong:
 * the host site owns that relationship, not us.
 *
 * Route-prefix based rather than a prop threaded through the layout, so a new
 * chrome component only has to be wrapped once to be covered.
 */
export function HideOnEmbed({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname?.startsWith("/embed/")) return null;
  return <>{children}</>;
}
