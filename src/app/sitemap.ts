import { MetadataRoute } from "next";
import { db } from "@/lib/db";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://indiecrowdfund.com";

// Render per request, never at build time.
//
// Without this, Next prerenders sitemap.xml as a static file during `next
// build` — and lib/db returns a stub during the build phase (there's no
// database), so every query below threw and was swallowed by the catch
// blocks. The result was a sitemap containing only the hardcoded pages
// below: zero campaigns, zero prelaunch pages, zero creator profiles, for
// as long as that build was deployed. Crawlers were being handed a
// directory of the site with all the actual content missing.
//
// force-dynamic rather than revalidate: with ISR the first build still
// ships an empty sitemap and it only self-corrects after the window
// elapses. Crawlers hit this rarely, so querying per request is cheap.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    // NOTE: /discover used to be listed here, but no such route exists — we
    // were feeding Google a 404 as a priority-0.9 URL. The real browse page is
    // /crowdfunds, listed below.
    {
      url: `${SITE_URL}/about-us`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/how-we-stack-up`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/grant-program`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/crowdfunds`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/press`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/content-guidelines`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${SITE_URL}/bug-report`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/fees`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/faq`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/contact`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/help`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/success-stories`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/creator-handbook`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/backer-handbook`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/indiekit-handbook`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/retailers`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/trust-safety`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/changelog`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.4,
    },
    {
      url: `${SITE_URL}/what-is-divinitycoin`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/login`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/register`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.5,
    },
  ];

  // Dynamic project pages
  let projectPages: MetadataRoute.Sitemap = [];
  try {
    const projects = await db.project.findMany({
      where: {
        status: { in: ["LIVE", "FUNDED"] },
        deletedAt: null,
      },
      select: {
        slug: true,
        updatedAt: true,
        creator: {
          select: { vanityUrl: true },
        },
      },
    });

    projectPages = projects.map((project) => {
      const projectPath = project.creator.vanityUrl
        ? `/projects/${project.creator.vanityUrl}/${project.slug}`
        : `/projects/${project.slug}`;

      return {
        url: `${SITE_URL}${projectPath}`,
        lastModified: project.updatedAt,
        changeFrequency: "daily" as const,
        priority: 0.8,
      };
    });
  } catch (error) {
    console.error("Sitemap: Error fetching projects:", error);
  }

  // Prelaunch project pages
  let prelaunchPages: MetadataRoute.Sitemap = [];
  try {
    const prelaunchProjects = await db.project.findMany({
      where: {
        prelaunchActive: true,
        deletedAt: null,
        // Match the home page's "Projects in Prelaunch" section. The vanity
        // API honors prelaunchActive as a public-visibility bypass for
        // DRAFT/SUBMITTED, so these URLs render for anonymous visitors.
        status: { notIn: ["LIVE", "FUNDED", "FAILED", "CANCELLED"] },
      },
      select: {
        slug: true,
        updatedAt: true,
        creator: {
          select: { vanityUrl: true },
        },
      },
    });

    prelaunchPages = prelaunchProjects.map((project) => {
      const projectPath = project.creator.vanityUrl
        ? `/projects/${project.creator.vanityUrl}/${project.slug}/prelaunch`
        : `/projects/${project.slug}/prelaunch`;

      return {
        url: `${SITE_URL}${projectPath}`,
        lastModified: project.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      };
    });
  } catch (error) {
    console.error("Sitemap: Error fetching prelaunch projects:", error);
  }

  // Creator profile pages (users with a vanity URL).
  // Prisma 7 rejects `{ field: { not: null } }` on nullable string fields at
  // runtime — use `NOT: { field: null }` wrapper syntax instead.
  let creatorPages: MetadataRoute.Sitemap = [];
  try {
    const creators = await db.user.findMany({
      where: {
        NOT: { vanityUrl: null },
        role: { in: ["CREATOR", "ADMIN", "SUPER_ADMIN"] },
        deletedAt: null,
      },
      select: {
        vanityUrl: true,
        updatedAt: true,
      },
    });

    creatorPages = creators
      .filter((c): c is { vanityUrl: string; updatedAt: Date } => !!c.vanityUrl)
      .map((creator) => ({
        url: `${SITE_URL}/${creator.vanityUrl}`,
        lastModified: creator.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      }));
  } catch (error) {
    console.error("Sitemap: Error fetching creator profiles:", error);
  }

  return [...staticPages, ...projectPages, ...prelaunchPages, ...creatorPages];
}
