import { API_RATE_LIMIT_PER_MINUTE } from "./respond";

/**
 * The API reference, authored once as Markdown.
 *
 * The docs page renders from this and the "Copy for LLM" button copies it
 * verbatim. Keeping one source means the text an assistant is handed can
 * never drift from the text a human reads — which is the whole point of the
 * button, and the failure mode of shipping a hand-maintained second copy.
 */

export const API_BASE_URL = "https://indiecrowdfund.com/api/v1";

export const apiDocsMarkdown = `# IndieCrowdfund Public Data API v1

Read-only access to public campaign and platform data on IndieCrowdfund
(a DBA of Divinity Comics Inc.). Built for crowdfunding tracker sites,
researchers, and journalists.

Base URL: \`${API_BASE_URL}\`

## What this API does and does not contain

It exposes only what an anonymous visitor can already see on the website:
campaign listings, funding totals, reward tiers, and platform-wide
aggregates.

It contains **no personal information**. There is no endpoint for backers,
pledges, addresses, emails, survey answers, or payout details, and no
parameter that will surface them. Individual backers are never identifiable.
Campaign funding figures are aggregates only.

Unlaunched campaigns (draft, submitted, approved-but-not-live) are never
returned — only \`LIVE\`, \`FUNDED\`, \`FAILED\` and \`CANCELLED\`.

## Getting credentials

1. Create a free IndieCrowdfund account.
2. Go to **Dashboard → API Access**.
3. Register your integration with its name, URL, and a contact email.
4. You get a **key** (\`ick_live_...\`) and a **secret** (\`icsk_live_...\`).

The secret is shown **once** and stored only as a hash. If you lose it,
revoke the key and issue a new one. Up to 3 active keys per account.

The contact email is used only to reach you about the integration — for
example before a breaking change, or if your traffic looks like a runaway
loop. It is not published.

## Authentication

Send both halves as headers:

\`\`\`
X-API-Key: ick_live_xxxxxxxx
X-API-Secret: icsk_live_xxxxxxxx
\`\`\`

Or as a single bearer token, \`key:secret\`:

\`\`\`
Authorization: Bearer ick_live_xxxxxxxx:icsk_live_xxxxxxxx
\`\`\`

Never put credentials in the query string — they end up in access logs,
proxy caches, and Referer headers.

## Rate limits

${API_RATE_LIMIT_PER_MINUTE} requests per minute per key. Every response carries:

\`\`\`
X-RateLimit-Limit
X-RateLimit-Remaining
X-RateLimit-Reset      (unix seconds)
\`\`\`

Over the limit returns \`429\`. Responses are cached for 60 seconds
(300 for \`/stats\`), so polling faster than that returns the same data.

## Endpoints

### GET /projects

Paginated list of public campaigns.

| Parameter | Type | Default | Notes |
|---|---|---|---|
| \`limit\` | int | 50 | Max 100 |
| \`offset\` | int | 0 | |
| \`status\` | string | all public | \`LIVE\`, \`FUNDED\`, \`FAILED\`, \`CANCELLED\` |
| \`category\` | string | all | Exact match |
| \`sort\` | string | \`newest\` | \`newest\`, \`ending_soon\`, \`most_funded\`, \`most_backed\` |
| \`updated_since\` | ISO 8601 | — | Only campaigns changed since then |

Use \`updated_since\` to poll incrementally instead of re-walking the whole
catalogue on every run.

\`\`\`bash
curl -s "${API_BASE_URL}/projects?status=LIVE&sort=ending_soon&limit=25" \\
  -H "X-API-Key: $ICF_KEY" \\
  -H "X-API-Secret: $ICF_SECRET"
\`\`\`

\`\`\`json
{
  "data": [
    {
      "id": "clx...",
      "slug": "titan-mouse-of-might",
      "url": "https://indiecrowdfund.com/projects/garyshipmanart/titan-mouse-of-might",
      "title": "Titan: Mouse of Might",
      "subtitle": "An all-ages fantasy adventure",
      "category": "Comics",
      "subcategory": "Graphic Novels",
      "location": "Ohio, USA",
      "image_url": "https://...",
      "currency": "USD",
      "goal_amount": 5000,
      "pledged_amount": 7345.5,
      "percent_funded": 146.9,
      "backer_count": 213,
      "follower_count": 44,
      "status": "LIVE",
      "campaign_type": "ALL_OR_NOTHING",
      "project_type": "COMIC",
      "is_staff_pick": true,
      "has_adult_content": false,
      "uses_ai": false,
      "tags": ["fantasy", "all-ages"],
      "launch_date": "2026-07-01T00:00:00.000Z",
      "end_date": "2026-08-30T17:13:00.000Z",
      "days_remaining": 9,
      "created_at": "2026-06-18T12:00:00.000Z",
      "creator": {
        "name": "Gary Shipman",
        "profile_url": "https://indiecrowdfund.com/garyshipmanart",
        "avatar_url": "https://..."
      }
    }
  ],
  "pagination": { "total": 184, "limit": 25, "offset": 0, "has_more": true }
}
\`\`\`

### GET /projects/{slug}

One campaign, plus its full description, risks statement, and reward tiers.

Reward objects include \`quantity_available\`, \`quantity_claimed\` and
\`quantity_remaining\` — the same "N left" figure shown publicly. No backer
is identifiable from them.

Returns \`404\` for a slug that does not exist **or** is not public, so
unlaunched campaigns cannot be discovered by guessing slugs.

### GET /stats

Platform-wide aggregates.

\`\`\`json
{
  "data": {
    "currency": "USD",
    "total_raised": 1284320.45,
    "total_pledges": 18402,
    "total_backers": 12044,
    "total_creators": 388,
    "projects_total": 512,
    "projects_live": 41,
    "projects_funded": 305,
    "success_rate": 59.6,
    "average_pledge": 69.79,
    "categories": [{ "category": "Comics", "project_count": 310 }],
    "generated_at": "2026-08-22T04:00:00.000Z"
  }
}
\`\`\`

## Errors

\`\`\`json
{ "error": { "code": "rate_limited", "message": "Rate limit exceeded. Try again shortly." } }
\`\`\`

| Status | Code | Meaning |
|---|---|---|
| 400 | \`invalid_parameter\` | A query parameter was malformed |
| 401 | \`unauthorized\` | Missing, unknown, revoked or mismatched credentials |
| 403 | \`forbidden\` | Key lacks the \`read:public\` scope |
| 404 | \`not_found\` | No such public resource |
| 429 | \`rate_limited\` | Over the per-minute limit |
| 500 | \`internal_error\` | Our fault; retry with backoff |

\`401\` is deliberately identical for unknown, revoked and mismatched
credentials so the endpoint cannot be used to probe which keys exist.

## Conventions

- All money is a JSON number in the currency named by \`currency\`.
- All timestamps are ISO 8601 UTC.
- Field names are \`snake_case\`.
- CORS is open (\`*\`); \`GET\` and \`OPTIONS\` only.
- New fields may be added without notice. Removals or renames get a new
  version at \`/api/v2\` and an email to the address on your key.

## Attribution

Please credit **IndieCrowdfund** and link to the campaign \`url\` when you
publish figures from this API.

## Support

Questions, a higher rate limit, or a field you need that isn't here:
contact support through the website. Include your key prefix
(\`ick_live_...\`, first 16 characters) — never the secret.
`;
