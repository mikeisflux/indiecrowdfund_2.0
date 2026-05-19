-- Second press release — response to Kickstarter's May 19, 2026
-- "Apology: Rethinking Our Mature Content Guidelines" post in which
-- the COO admitted the mature-content rule changes were driven by
-- their Stripe processor. We frame the structural argument
-- (Kickstarter's anti-establishment brand vs the actual establishment
-- machinery underneath — Stripe, Delaware PBC, unionized workforce,
-- apology-PR cadence) and contrast with IndieCrowdfund's processor
-- choice + own Content Guidelines.
--
-- Same idempotent pattern as add_press_release.sql: WHERE NOT EXISTS
-- guard on the slug so re-running is safe. Assumes the PressRelease
-- table already exists (created by add_press_release.sql) — this
-- migration is INSERT-only.

INSERT INTO "PressRelease" (
  "id", "slug", "title", "excerpt", "content", "imageUrl", "authorName",
  "isPublished", "publishedAt", "createdAt", "updatedAt", "deletedAt"
)
SELECT
  'pr_2026_05_19_kickstarter_apology_response',
  'what-kickstarters-apology-actually-tells-you',
  'What Kickstarter''s Apology Actually Tells You',
  $$Kickstarter's COO just admitted in a public apology that their mature-content rules are written by Stripe. Here's the structural reason IndieCrowdfund doesn't have that problem — and why we don't have to issue apology blog posts.$$,
  $$<p><strong>May 19, 2026</strong> — Today, Kickstarter's COO published a public apology walking back a set of mature-content restrictions the platform rolled out one week ago. Buried halfway through the post is the part of the story that matters:</p>

<blockquote>
  <p>"The updates to the rules were primarily driven by requirements from our payments processor, Stripe."</p>
</blockquote>

<p>That is a remarkable sentence to come out of a company whose self-described brand identity is, in their COO's own words this week, the <em>"counter-culture, f*ck the establishment spirit of Kickstarter."</em></p>

<p>It is worth being honest about what Kickstarter just admitted, and what it means for the people who rely on platforms like Kickstarter to fund their work.</p>

<h2>The layers Kickstarter quietly disclosed</h2>

<p>A platform that genuinely operates outside the establishment has to, at minimum, not be financially controlled by the establishment. Kickstarter is not that platform. By their own description this week, the constraints on what creators are allowed to make are set by:</p>

<ol>
  <li><strong>Stripe</strong>, their payment processor. Stripe's content rules in turn flow from the card networks (Visa, Mastercard) and the banks Stripe is itself regulated by. When Stripe decides a creator's project isn't allowed, Kickstarter has two choices: change the rules to match Stripe's, or accept that approved campaigns will be frozen mid-funding. They chose the former, apologized for it, and have now partially reversed — but the underlying constraint hasn't moved a millimeter.</li>
  <li><strong>Their corporate structure.</strong> Kickstarter is a Delaware Public Benefit Corporation. Public-benefit framing is real and we have no quarrel with it; it is also a registered corporate form chartered by a US state, governed by a board of directors, audited like any C-corp.</li>
  <li><strong>A unionized workforce.</strong> Kickstarter United, organized through OPEIU Local 153, was a genuine milestone for tech labor in 2020 and we mean that sincerely. But "we have a union shop affiliated with the AFL-CIO" and "we are anti-establishment" are not sentences that go together. A union is, by design, an institutional structure for organizing institutional labor.</li>
  <li><strong>A communications cadence built to issue apology blog posts</strong> when the institutional gears mesh badly with the creator-facing marketing. The post itself is the tell.</li>
</ol>

<p>None of these things are bad. A union is good. A COO is fine. A payment processor is necessary infrastructure. But describing the resulting platform as countercultural — that is the marketing fiction Kickstarter publicly conceded this week.</p>

<h2>The actual structural problem they described</h2>

<p>Kickstarter's apology laid the trap out with admirable clarity: their mature-content creators get suspended mid-campaign by Stripe regardless of whether Kickstarter's own moderation team approved the project. The platform's only available defense is to write internal rules that pre-emptively reject anything Stripe might object to — which is exactly what they tried, what generated the backlash, and what they just reverted.</p>

<p>What they did <em>not</em> do, and architecturally cannot do, is change processors. The business is built on top of Stripe's content rails. When Stripe says no, the answer is no, no matter how loudly the brand markets creative freedom.</p>

<h2>Why IndieCrowdfund was built differently</h2>

<p>We aren't writing this to dunk. We are writing it because the structural problem Kickstarter described is the exact problem we designed IndieCrowdfund to avoid.</p>

<ul>
  <li><strong>Mature-content campaigns on IndieCrowdfund are not processed through Stripe.</strong> They run through DivinityCoin, a white-label processor whose business model is specifically built to support adult and mature creative work that mainstream rails won't service. We made that choice before launch, deliberately, so we would never need to write a Kickstarter-style apology.</li>
  <li><strong>Our <a href="/content-guidelines">Content Guidelines</a> are explicit, dated, and not subject to outside revision.</strong> We published v1.0 last week. The lines we draw — zero tolerance for sexualized depictions of minors, no real-person violations without consent, no hate speech — are lines <em>we</em> set, not lines a payment processor sets for us. They will not change because a compliance email landed in our inbox.</li>
  <li><strong>We are smaller, lighter, and don't have institutional gears to grind against.</strong> That is a tradeoff. Kickstarter has resources, brand recognition, and a fifteen-year head start. We don't have any of that. What we have is a structure that doesn't force us to choose between honoring our creators and honoring our processor, because our processor was chosen with our creators in mind.</li>
</ul>

<p>We have nothing against Kickstarter. They have funded an enormous amount of important creative work and the union and PBC status are both genuine points of institutional integrity that we respect. But the part of their brand that markets them as renegades willing to fight for your work — that part is, by their own admission this week, not a description of the platform that actually exists.</p>

<p>If your project is mature, controversial, or operates outside what mainstream payment rails will quietly let through, IndieCrowdfund was built for you. Not because of a marketing post. Because we chose our processor accordingly.</p>

<p>— The IndieCrowdfund team</p>$$,
  NULL,
  'The IndieCrowdfund Team',
  true,
  '2026-05-19 00:00:00',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM "PressRelease"
  WHERE "slug" = 'what-kickstarters-apology-actually-tells-you'
);
