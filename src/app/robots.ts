import { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://indiecrowdfund.com";

// Specific private /api/ subtrees instead of a broad `/api/` disallow.
// Twitter / Facebook / LinkedIn link unfurlers don't always honor the
// "longest-prefix wins" robots.txt rule — when they see both
//   Allow: /api/uploads/
//   Disallow: /api/
// some parsers pick the Disallow and refuse to fetch og:image / twitter:
// image URLs hosted at /api/uploads/. Listing the actually-private sub
// paths leaves /api/uploads/ + /api/og open without needing the parser
// to do the right thing.
const PRIVATE_API_PATHS = [
  "/api/admin/",
  "/api/auth/",
  "/api/backer/",
  "/api/billing/",
  "/api/chat/",
  "/api/checkout/",
  "/api/creator/",
  "/api/cron/",
  "/api/csrf/",
  "/api/divinitycoin/",
  "/api/email/",
  "/api/error-report",
  "/api/follow/",
  "/api/marketplace/",
  "/api/metrics",
  "/api/nmi/",
  "/api/notifications/",
  "/api/pay/",
  "/api/paypal/",
  "/api/pledges/",
  "/api/projects/",
  "/api/r2/",
  "/api/reports/",
  "/api/retailers/",
  "/api/stripe/",
  "/api/track",
  "/api/tracking",
  "/api/upload/",
  "/api/user/",
  "/api/webhooks/",
  "/api/whop/",
];

const PRIVATE_PATHS = [
  "/admin/",
  "/dashboard/",
  ...PRIVATE_API_PATHS,
  "/settings/",
  "/pay/",
  "/access-denied",
  "/verify-email",
  "/verification-complete",
  "/bug-report",
  "/collaborate/",
  "/survey/",
  "/chat/",
];

// Paths under /api/ that ARE public and MUST be crawlable. Without
// these, social media link unfurlers (Twitter, Facebook, LinkedIn,
// Slack, Discord, etc.) can't fetch og:image / twitter:image URLs
// because the whole /api/ tree is disallowed, and project images
// live under /api/uploads/. Surfaced by the Twitter Card Validator:
//   "WARN: The image URL ...api/uploads/... may be restricted by
//    the site's robots.txt file, which will prevent Twitter from
//    fetching it."
const PUBLIC_API_PATHS = [
  "/api/uploads/",  // project hero images + reward images served from disk
  "/api/og",        // dynamic OG image fallback generator
];

export default function robots(): MetadataRoute.Robots {
  // Every userAgent rule needs the same allow + disallow shape, so
  // build a helper that keeps the per-bot blocks consistent.
  const standardRule = (userAgent: string) => ({
    userAgent,
    allow: ["/", ...PUBLIC_API_PATHS],
    disallow: PRIVATE_PATHS,
  });

  return {
    rules: [
      // Explicit allow for major search engines
      standardRule("Googlebot"),
      standardRule("Googlebot-Image"),
      standardRule("Bingbot"),
      standardRule("Slurp"), // Yahoo
      standardRule("DuckDuckBot"),
      standardRule("Baiduspider"),
      standardRule("YandexBot"),
      // Social media link unfurlers — these specifically need access
      // to /api/uploads/ for og:image fetches
      standardRule("facebot"),
      standardRule("facebookexternalhit"),
      standardRule("meta-externalagent"),
      standardRule("meta-externalfetcher"),
      standardRule("Twitterbot"),
      standardRule("LinkedInBot"),
      standardRule("Slackbot"),
      standardRule("Discordbot"),
      standardRule("WhatsApp"),
      standardRule("TelegramBot"),
      standardRule("Pinterest"),
      // Default rule for all other bots
      standardRule("*"),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
