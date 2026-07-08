-- PressRelease model — admin-managed dated press releases for /press.
-- build-and-swap.sh does NOT run prisma migrations, so this file is
-- intended to be applied manually on deploy (same pattern as
-- add_divinitycoin_setup_intent_fields.sql). Idempotent — safe to re-run.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'PressRelease'
  ) THEN
    CREATE TABLE "PressRelease" (
      "id"           TEXT PRIMARY KEY,
      "slug"         TEXT NOT NULL,
      "title"        TEXT NOT NULL,
      "excerpt"      TEXT,
      "content"      TEXT NOT NULL,
      "imageUrl"     TEXT,
      "authorName"   TEXT,
      "isPublished"  BOOLEAN NOT NULL DEFAULT false,
      "publishedAt"  TIMESTAMP(3),
      "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "deletedAt"    TIMESTAMP(3)
    );

    CREATE UNIQUE INDEX "PressRelease_slug_key" ON "PressRelease" ("slug");
    CREATE INDEX "PressRelease_isPublished_publishedAt_idx"
      ON "PressRelease" ("isPublished", "publishedAt");
  END IF;
END$$;

-- Seed: the first press release. INSERT is gated on the slug not
-- already existing, so re-running this migration is a no-op once the
-- row is in. PostgreSQL dollar-quoted strings ($$ ... $$) keep us out
-- of single-quote-escaping hell for the HTML body.
INSERT INTO "PressRelease" (
  "id", "slug", "title", "excerpt", "content", "imageUrl", "authorName",
  "isPublished", "publishedAt", "createdAt", "updatedAt", "deletedAt"
)
SELECT
  'pr_2026_05_15_kickstarter_mature_content',
  'indiecrowdfund-welcomes-mature-content-creators',
  'IndieCrowdfund Opens Its Doors to Mature Content Creators Displaced by New Kickstarter Restrictions',
  $$As Kickstarter rolls out sweeping new restrictions on mature content imagery, IndieCrowdfund is doubling down on our commitment to adult indie comics and "spicy" creative work — with a payment processor built for it and a platform that won't pull your campaign mid-launch.$$,
  $$<p><strong>May 15, 2026</strong> — IndieCrowdfund today reaffirmed its commitment as a home for indie comic and romance creators working in mature content, as Kickstarter rolls out new guidelines that sharply restrict what those creators can publish on its platform.</p>

<p>Kickstarter's revised Mature Content Guidelines, communicated platform-wide this month, frame the change as added clarity. In practice, they prohibit a wide range of imagery long associated with adult comics, "spicy" romance, and erotic illustration — the very work that has powered countless successful campaigns for independent artists and writers over the past decade.</p>

<p>The new rules specifically disallow:</p>

<ul>
  <li>Illustrations or photos of sex acts, including <em>implied</em> acts</li>
  <li>Nudity covering female nipples, areolas, genitalia, anuses, or buttocks</li>
  <li>Implied nudity via lingerie, fetish wear, or see-through clothing</li>
  <li>Sexual wellness products designed for insertion or penetration</li>
  <li>"Derogatory terminology" common to the adult romance genre, and explicitly violent themes (Kickstarter cites "rape fantasy" as an example)</li>
</ul>

<p>Kickstarter has been transparent that this policy is partly driven by its financial partners — the banks and payment processors that ultimately decide what kinds of transactions move through their networks. The platform's official email to creators acknowledges that "some projects have experienced challenges during review or after launch" because of these external constraints.</p>

<p>For mature content creators, the takeaway is clear: a successful campaign on Kickstarter is no longer a safe bet.</p>

<h2>A platform built to host the work, not avoid it</h2>

<p>IndieCrowdfund has always supported adult-oriented indie projects as a first-class category — not an exception to be tolerated until a partner bank objects. Romance graphic novels, spicy comics, art books, erotic illustration, mature manga: these projects launch on our platform under the same terms and tools as everything else.</p>

<p>The difference comes down to infrastructure. IndieCrowdfund is integrated with <strong>DivinityCoin</strong>, a payment processor built specifically for the creative work that mainstream card networks increasingly refuse. DivinityCoin's compliance and underwriting are designed around mature content as a core use case, not a special-cased risk. For creators, that translates to the same one-click checkout backers expect anywhere else — with none of the downstream risk of having a funded campaign frozen, restricted, or stripped of its imagery after the fact.</p>

<p>What that means for creators leaving Kickstarter:</p>

<ul>
  <li><strong>Your project won't be pulled or restricted mid-campaign</strong> because of a partner's policy change.</li>
  <li><strong>Your payments won't get dropped</strong> by a processor that "didn't realize" what your project was about.</li>
  <li><strong>You get IndieCrowdfund's full suite</strong> — IndieKit fulfillment, our digital marketplace, integrated email and backer messaging — all available to mature projects, no second-class treatment.</li>
</ul>

<h2>Migration help</h2>

<p>We know switching platforms — and rebuilding a backer audience — is hard. Over the coming weeks our team will be reaching out directly to creators whose Kickstarter campaigns were affected by the new guidelines. We'll help with onboarding, importing your backer email list, and positioning your relaunched project for our community.</p>

<p>If you're an indie comic, romance, or adult creator looking at the new Kickstarter rules and wondering where to go next: we'd like to talk. Email <a href="mailto:support@indiecrowdfund.com"><strong>support@indiecrowdfund.com</strong></a> or <a href="/projects/new">start a project today</a>.</p>

<p>The work matters. We're here to help you keep making it.</p>

<p>— The IndieCrowdfund Team</p>$$,
  NULL,
  'The IndieCrowdfund Team',
  true,
  '2026-05-15 00:00:00',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM "PressRelease"
  WHERE "slug" = 'indiecrowdfund-welcomes-mature-content-creators'
);
