// Shared HTML template for AI-generated marketing campaign emails.
//
// Every AI campaign path renders through renderCampaignEmailHtml so the
// look stays consistent: the automated cron campaigns (lib/ai/automation.ts)
// and the admin-triggered campaigns (api/admin/ai-marketing/campaigns/*).
// The template is table-based with inline styles for broad email-client
// support (Outlook/Gmail), uses ABSOLUTE image URLs, and shows each
// project's campaign image.
//
// Placeholders resolved at send time by the caller:
//   {{USER_NAME}}       recipient first name
//   {{SITE_URL}}        base URL (also used to absolutize relative images)
//   {{UNSUBSCRIBE_URL}} signed opt-out link

export interface CampaignEmailContent {
  subject: string;
  preheader: string;
  personalizedIntro: string;
  projectRecommendations: Array<{
    projectTitle: string;
    recommendationReason: string;
    callToAction: string;
  }>;
  footer: string;
}

export interface CampaignEmailProject {
  title: string;
  // Site-relative path, e.g. "/projects/vanity/slug". The renderer
  // prefixes {{SITE_URL}}; do NOT include the origin here.
  url: string;
  imageUrl: string | null;
  category: string | null;
}

// Sort projects IN PLACE so those with a publicly-servable cover image come
// first, so every marketing email the AI sends leads with real imagery
// instead of the gradient placeholder. Stable, so the newest-first order is
// preserved within the imaged / non-imaged groups. The /api/r2/serve route is
// auth-gated (won't load in an email client) and data: URIs are stripped, so
// neither counts as an emailable image. Returns the same array for chaining.
export function preferProjectsWithEmailableImage<T extends { imageUrl: string | null }>(
  projects: T[]
): T[] {
  const ok = (u: string | null) => !!u && !u.startsWith("/api/r2/serve") && !u.startsWith("data:");
  return projects.sort((a, b) => (ok(a.imageUrl) ? 0 : 1) - (ok(b.imageUrl) ? 0 : 1));
}

// Local HTML-escape — keep this module self-contained so every call site
// gets escaping for free (one of the older admin generators didn't escape
// at all, which this replaces).
function esc(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Emails need ABSOLUTE image URLs. imageUrl is stored either as an
// absolute http(s) URL or a site-relative path ("/..."); prefix the
// latter with {{SITE_URL}} (resolved to the base URL at send time).
// Never inline base64 into sent mail.
function resolveImage(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith("data:")) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `{{SITE_URL}}${trimmed.startsWith("/") ? "" : "/"}${trimmed}`;
}

export function renderProjectCard(project: CampaignEmailProject, reason: string, cta: string): string {
  const href = `{{SITE_URL}}${project.url}`;
  const img = resolveImage(project.imageUrl);
  const category = project.category && project.category !== "General" ? project.category : "";

  // Cover image sits on top of the card and is itself a link. Fixed
  // height + object-fit keeps ragged aspect ratios tidy; a branded
  // gradient stands in when a project has no image.
  const imageBlock = img
    ? `
        <a href="${href}" style="text-decoration: none;">
          <img src="${esc(img)}" alt="${esc(project.title)}" width="560"
               style="display: block; width: 100%; max-width: 560px; height: 240px; object-fit: cover; border: 0; border-radius: 12px 12px 0 0;" />
        </a>`
    : `
        <a href="${href}" style="text-decoration: none;">
          <div style="width: 100%; height: 120px; border-radius: 12px 12px 0 0; background: linear-gradient(135deg, #10b981 0%, #059669 100%);"></div>
        </a>`;

  const categoryChip = category
    ? `<span style="display: inline-block; margin-bottom: 10px; padding: 3px 10px; background: #d1fae5; color: #047857; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; border-radius: 999px;">${esc(category)}</span><br />`
    : "";

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; background: #ffffff;">
      <tr><td style="padding: 0;">${imageBlock}</td></tr>
      <tr>
        <td style="padding: 20px;">
          ${categoryChip}
          <h3 style="margin: 0 0 8px 0; color: #111827; font-size: 19px; font-weight: 700;">
            <a href="${href}" style="color: #111827; text-decoration: none;">${esc(project.title)}</a>
          </h3>
          <p style="margin: 0 0 18px 0; color: #6b7280; font-size: 14px; line-height: 1.6;">${esc(reason)}</p>
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="border-radius: 8px; background: #10b981;">
                <a href="${href}"
                   style="display: inline-block; padding: 12px 24px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px; border-radius: 8px;">
                  ${esc(cta)} &rarr;
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

// Render the full HTML email. `projects` is the pool used to resolve each
// recommendation to a project (matched by title, else positionally).
export function renderCampaignEmailHtml(
  aiContent: CampaignEmailContent,
  projects: CampaignEmailProject[],
  opts?: { includeProjectRecommendations?: boolean }
): string {
  const includeProjects = opts?.includeProjectRecommendations !== false;

  let projectCards = "";
  if (includeProjects) {
    // Render one card PER PROJECT (not per AI recommendation) so every
    // campaign in the list always shows — with its image — even if the AI
    // returned fewer recommendations than there are projects. We order by
    // the (personalized) recommendation order first, then append any
    // projects the AI didn't explicitly mention.
    const recs = aiContent.projectRecommendations || [];
    const ordered: { project: CampaignEmailProject; rec?: (typeof recs)[number] }[] = [];
    const used = new Set<string>();
    for (const rec of recs) {
      const project = projects.find((p) => p.title === rec.projectTitle);
      if (project && !used.has(project.title)) {
        ordered.push({ project, rec });
        used.add(project.title);
      }
    }
    for (const project of projects) {
      if (!used.has(project.title)) {
        ordered.push({ project });
        used.add(project.title);
      }
    }
    projectCards = ordered
      .map(({ project, rec }) => {
        const reason =
          rec?.recommendationReason ||
          `A ${project.category && project.category !== "General" ? project.category.toLowerCase() : "creative"} project we think you'll love.`;
        const cta = rec?.callToAction || "Check it out";
        return renderProjectCard(project, reason, cta);
      })
      .join("");
  }

  const projectSection = includeProjects && projectCards
    ? `
              <tr>
                <td style="padding: 24px 24px 8px 24px;">
                  ${projectCards}
                </td>
              </tr>`
    : "";

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${esc(aiContent.subject)}</title>
    </head>
    <body style="margin: 0; padding: 0; background: #f4f4f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151;">
      <div style="display: none; max-height: 0; overflow: hidden;">
        ${esc(aiContent.preheader)}
      </div>

      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background: #f4f4f7;">
        <tr>
          <td align="center" style="padding: 24px 12px;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; width: 100%; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
              <!-- Header -->
              <tr>
                <td align="center" style="padding: 28px 24px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); background-color: #10b981;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 800; letter-spacing: -0.02em;">IndieCrowdfund</h1>
                  <p style="margin: 6px 0 0 0; color: rgba(255,255,255,0.9); font-size: 13px;">Fund the comics and creators you love</p>
                </td>
              </tr>

              <!-- Intro -->
              <tr>
                <td style="padding: 32px 24px 8px 24px;">
                  <p style="margin: 0 0 12px 0; font-size: 16px; color: #111827; font-weight: 600;">Hi {{USER_NAME}},</p>
                  <p style="margin: 0; font-size: 16px; color: #374151;">${esc(aiContent.personalizedIntro)}</p>
                </td>
              </tr>
${projectSection}
              <!-- Footer -->
              <tr>
                <td style="padding: 16px 24px 32px 24px; border-top: 1px solid #e5e7eb; text-align: center;">
                  <p style="color: #6b7280; font-size: 14px; margin: 16px 0 0 0;">${esc(aiContent.footer)}</p>
                  <p style="color: #9ca3af; font-size: 12px; margin-top: 16px;">
                    <a href="{{UNSUBSCRIBE_URL}}" style="color: #9ca3af;">Unsubscribe</a> &nbsp;|&nbsp;
                    <a href="{{SITE_URL}}" style="color: #9ca3af;">Visit IndieCrowdfund</a>
                  </p>
                  <p style="color: #d1d5db; font-size: 10px; margin-top: 8px;">
                    This email was curated by AI based on your interests.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

// ---- Creator newsletter ("what's new") ----
export interface CreatorNewsletterContent {
  subject: string;
  preheader: string;
  intro: string;
  features: { title: string; body: string }[];
  footer: string;
  // Optional call-to-action button.
  ctaLabel?: string;
  ctaUrl?: string; // site-relative, prefixed with {{SITE_URL}}
}

// Render the creator "what's new" newsletter: a branded header, a warm intro,
// a stack of feature blurbs, and a CTA — same look as the campaign emails but
// feature-driven rather than project-driven. Placeholders {{USER_NAME}},
// {{SITE_URL}}, {{UNSUBSCRIBE_URL}} are resolved by the caller at send time.
export function renderCreatorNewsletterHtml(content: CreatorNewsletterContent): string {
  const featureBlocks = content.features
    .map(
      (f) => `
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 18px; border: 1px solid #e5e7eb; border-radius: 12px; background: #ffffff;">
          <tr>
            <td style="padding: 18px 20px;">
              <div style="display: inline-block; width: 34px; height: 4px; border-radius: 999px; background: linear-gradient(90deg, #10b981 0%, #06b6d4 100%); margin-bottom: 12px;"></div>
              <h3 style="margin: 0 0 6px 0; color: #111827; font-size: 18px; font-weight: 700;">${esc(f.title)}</h3>
              <p style="margin: 0; color: #4b5563; font-size: 14px; line-height: 1.6;">${esc(f.body)}</p>
            </td>
          </tr>
        </table>`
    )
    .join("");

  const cta =
    content.ctaLabel && content.ctaUrl
      ? `
              <tr>
                <td align="center" style="padding: 8px 24px 24px 24px;">
                  <table role="presentation" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="border-radius: 8px; background: #10b981;">
                        <a href="{{SITE_URL}}${esc(content.ctaUrl)}" style="display: inline-block; padding: 12px 26px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px; border-radius: 8px;">${esc(content.ctaLabel)} &rarr;</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>`
      : "";

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${esc(content.subject)}</title>
    </head>
    <body style="margin: 0; padding: 0; background: #f4f4f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151;">
      <div style="display: none; max-height: 0; overflow: hidden;">${esc(content.preheader)}</div>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background: #f4f4f7;">
        <tr>
          <td align="center" style="padding: 24px 12px;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; width: 100%; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
              <tr>
                <td align="center" style="padding: 28px 24px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); background-color: #10b981;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 800; letter-spacing: -0.02em;">IndieCrowdfund</h1>
                  <p style="margin: 6px 0 0 0; color: rgba(255,255,255,0.9); font-size: 13px;">What's new for creators</p>
                </td>
              </tr>
              <tr>
                <td style="padding: 32px 24px 8px 24px;">
                  <p style="margin: 0 0 12px 0; font-size: 16px; color: #111827; font-weight: 600;">Hi {{USER_NAME}},</p>
                  <p style="margin: 0; font-size: 16px; color: #374151;">${esc(content.intro)}</p>
                </td>
              </tr>
              <tr>
                <td style="padding: 20px 24px 4px 24px;">
                  ${featureBlocks}
                </td>
              </tr>
${cta}
              <tr>
                <td style="padding: 8px 24px 32px 24px; border-top: 1px solid #e5e7eb; text-align: center;">
                  <p style="color: #6b7280; font-size: 14px; margin: 16px 0 0 0;">${esc(content.footer)}</p>
                  <p style="color: #9ca3af; font-size: 12px; margin-top: 16px;">
                    <a href="{{UNSUBSCRIBE_URL}}" style="color: #9ca3af;">Unsubscribe</a> &nbsp;|&nbsp;
                    <a href="{{SITE_URL}}" style="color: #9ca3af;">Visit IndieCrowdfund</a>
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

// ---- Manual composition: wrap hand-written content in the branded shell ----

/**
 * Wrap arbitrary body HTML in the same chrome the AI campaigns use.
 *
 * The editor on the campaign tab produces bare blocks — paragraphs, headings,
 * lists, images. Sent as-is they arrive as unstyled black-on-white text with no
 * header, no footer and no width limit, which on a phone is a single column of
 * full-bleed prose. This is the "Format as email" button behind the scenes:
 * same header, same 600px card, same footer as renderCampaignEmailHtml.
 *
 * The body is NOT escaped — it is HTML the operator authored in the editor,
 * which is the whole point. It is written by admins only, and the editor's own
 * schema constrains what can be produced.
 *
 * Placeholders {{SITE_URL}} and {{UNSUBSCRIBE_URL}} are resolved by the caller
 * at send time, exactly as they are for the AI templates.
 */
export function wrapInEmailShell(
  bodyHtml: string,
  opts: { subject?: string; preheader?: string; footerNote?: string } = {}
): string {
  const { subject = "", preheader = "", footerNote } = opts;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${esc(subject)}</title>
    </head>
    <body style="margin: 0; padding: 0; background: #f4f4f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151;">
      <div style="display: none; max-height: 0; overflow: hidden;">${esc(preheader)}</div>

      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background: #f4f4f7;">
        <tr>
          <td align="center" style="padding: 24px 12px;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; width: 100%; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
              <tr>
                <td align="center" style="padding: 28px 24px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); background-color: #10b981;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 800; letter-spacing: -0.02em;">IndieCrowdfund</h1>
                  <p style="margin: 6px 0 0 0; color: rgba(255,255,255,0.9); font-size: 13px;">Fund the comics and creators you love</p>
                </td>
              </tr>

              <tr>
                <!-- text-align: left so the operator's own alignment wins. The
                     cell above centres its contents with align="center", which
                     email clients cascade onto descendant text. -->
                <td style="padding: 32px 24px; font-size: 16px; color: #374151; text-align: left;">
                  ${bodyHtml}
                </td>
              </tr>

              <tr>
                <td style="padding: 16px 24px 32px 24px; border-top: 1px solid #e5e7eb; text-align: center;">
                  <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                    ${esc(footerNote || "You are receiving this because you have an IndieCrowdfund account.")}
                  </p>
                  <p style="color: #9ca3af; font-size: 12px; margin: 8px 0 0 0;">
                    <a href="{{UNSUBSCRIBE_URL}}" style="color: #9ca3af;">Unsubscribe</a>
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

/** True when this HTML has already been through wrapInEmailShell (or the AI
 *  templates), so the button can format rather than nest one shell in another. */
export function looksLikeFullEmail(html: string): boolean {
  return /<!DOCTYPE html>|<body[\s>]/i.test(html);
}

// ---- Campaign placeholders in hand-written emails ----

// Operators drop [[campaign:slug]] into the editor and it becomes the same
// project card the AI emails use.
//
// A token rather than the card markup itself, because the card is a table and
// the campaign editor has no table support — pasting one in would be flattened
// to loose paragraphs the moment the editor parsed it. The token is plain text,
// so it survives every edit, and is expanded once on the way out.
export const CAMPAIGN_TOKEN = /\[\[campaign:([a-z0-9-]+)\]\]/gi;

/** Every campaign slug referenced by a body, in order, without duplicates. */
export function findCampaignTokens(html: string): string[] {
  const slugs = new Set<string>();
  for (const match of html.matchAll(CAMPAIGN_TOKEN)) {
    slugs.add(match[1].toLowerCase());
  }
  return Array.from(slugs);
}

/**
 * Replace each [[campaign:slug]] with its rendered card.
 *
 * A token whose slug no longer resolves — campaign deleted, slug changed — is
 * removed rather than left in the email. Shipping "[[campaign:foo]]" to
 * subscribers is worse than shipping one fewer card.
 */
export function expandCampaignTokens(
  html: string,
  cards: Map<string, { project: CampaignEmailProject; blurb: string }>
): string {
  return html.replace(CAMPAIGN_TOKEN, (_match, slug: string) => {
    const entry = cards.get(String(slug).toLowerCase());
    if (!entry) return "";
    return renderProjectCard(entry.project, entry.blurb, "View campaign");
  });
}
