import { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.indiecrowdfund.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
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
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
