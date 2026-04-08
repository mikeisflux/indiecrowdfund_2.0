import { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://indiecrowdfund.com";

const PRIVATE_PATHS = [
  "/admin/",
  "/dashboard/",
  "/api/",
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

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Explicit allow for major search engines
      {
        userAgent: "Googlebot",
        allow: "/",
        disallow: PRIVATE_PATHS,
      },
      {
        userAgent: "Googlebot-Image",
        allow: "/",
        disallow: PRIVATE_PATHS,
      },
      {
        userAgent: "Bingbot",
        allow: "/",
        disallow: PRIVATE_PATHS,
      },
      {
        userAgent: "Slurp", // Yahoo
        allow: "/",
        disallow: PRIVATE_PATHS,
      },
      {
        userAgent: "DuckDuckBot",
        allow: "/",
        disallow: PRIVATE_PATHS,
      },
      {
        userAgent: "Baiduspider",
        allow: "/",
        disallow: PRIVATE_PATHS,
      },
      {
        userAgent: "YandexBot",
        allow: "/",
        disallow: PRIVATE_PATHS,
      },
      {
        userAgent: "facebot",
        allow: "/",
        disallow: PRIVATE_PATHS,
      },
      {
        userAgent: "Twitterbot",
        allow: "/",
        disallow: PRIVATE_PATHS,
      },
      {
        userAgent: "LinkedInBot",
        allow: "/",
        disallow: PRIVATE_PATHS,
      },
      // Default rule for all other bots
      {
        userAgent: "*",
        allow: "/",
        disallow: PRIVATE_PATHS,
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
