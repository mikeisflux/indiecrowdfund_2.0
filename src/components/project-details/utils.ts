import { sanitizeHtml } from "@/lib/utils/sanitize";
import { StoryNavItem } from "./types";

// Helper function to generate a slug from heading text
export function generateHeadingId(text: string, index: number): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
  return `story-heading-${index}-${slug || "section"}`;
}

// Helper function to extract headings from HTML and add IDs
export function processStoryHtml(html: string): { processedHtml: string; navItems: StoryNavItem[] } {
  if (!html || typeof window === "undefined") {
    return { processedHtml: sanitizeHtml(html || ""), navItems: [] };
  }

  // Sanitize HTML to prevent XSS attacks
  const sanitizedHtml = sanitizeHtml(html);

  const parser = new DOMParser();
  const doc = parser.parseFromString(sanitizedHtml, "text/html");
  const headings = doc.querySelectorAll("h1, h2, h3, h4, h5, h6");
  const navItems: StoryNavItem[] = [];

  headings.forEach((heading, index) => {
    const text = heading.textContent?.trim() || "";
    if (text) {
      const id = generateHeadingId(text, index);
      heading.setAttribute("id", id);
      const level = parseInt(heading.tagName.charAt(1), 10);
      navItems.push({ id, text, level });
    }
  });

  return {
    processedHtml: doc.body.innerHTML,
    navItems,
  };
}

export const formatMoney = (amount: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatDate = (date: Date | string | null | undefined) => {
  if (!date) return "TBD";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

export const formatRelativeTime = (date: Date | string | null | undefined) => {
  if (!date) return "";
  const now = new Date();
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "1 day ago";
  return `${diffDays} days ago`;
};

export const formatDeliveryDate = (date: Date | string | null) => {
  if (!date) return "TBD";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
};
