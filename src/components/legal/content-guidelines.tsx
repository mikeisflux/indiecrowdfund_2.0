/* eslint-disable react/no-unescaped-entities */

import { ProperProportions } from "./proper-proportions";

export function ContentGuidelinesContent() {
  return (
    <div className="prose prose-zinc dark:prose-invert max-w-none">
      <div className="rounded-lg border bg-white dark:bg-zinc-900 p-6 md:p-8">
        <h2 className="text-2xl font-bold mb-2">
          IndieCrowdfund Content Guidelines &amp; Creator Standards
        </h2>
        <p className="text-sm text-muted-foreground mb-2">
          Comics &amp; Sequential Art Platform
        </p>
        <p className="text-sm text-muted-foreground mb-8">
          <strong>Version 1.1</strong> · Effective upon publication ·{" "}
          <strong>Last Updated:</strong> August 21, 2026
        </p>

        <p className="mb-8">
          This document establishes the content standards, eligibility criteria,
          and prohibited-content policies for all crowdfunding campaigns hosted
          on IndieCrowdfund&apos;s comics and sequential art platform. These
          guidelines apply to all campaign creators, collaborators, and
          submitted materials regardless of format, genre, or country of origin.
        </p>

        {/* Responsive 16:9 wrapper so the iframe scales cleanly on
            every viewport instead of using YouTube's fixed 560x315.
            frame-src for youtube.com is already in src/proxy.ts CSP. */}
        <div className="mb-8 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800">
          <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
            <iframe
              src="https://www.youtube.com/embed/UEXdGmjfgsE?si=0hocr5jhP2pYMVa4"
              title="IndieCrowdfund Content Guidelines overview"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
              style={{ border: 0 }}
            />
          </div>
        </div>

        {/* Section 4.2 asks for "body proportions consistent with adult
            skeletal development" and warns against "oversized heads
            disproportionate to adult anatomy" — criteria a creator can't apply
            without knowing what the ratios actually are. Placed up here rather
            than inside Section 4 so it's seen before the rules that depend on
            it. Shared with the NSFW Policy so the two can't drift. */}
        <ProperProportions
          policyNote={
            <>
              Use these as the reference when applying the visual maturity
              criteria in <strong>Section 4.2</strong>. A figure that does not
              reach adult proportions will be treated as a minor under{" "}
              <strong>Section 4.3</strong>, regardless of stated age.
            </>
          }
        />

        <h3 className="text-xl font-semibold mt-8 mb-4">1. Platform Mission &amp; Scope</h3>
        <p className="mb-4">
          IndieCrowdfund&apos;s comics platform exists to support the full
          spectrum of sequential art created by independent creators — from
          traditional American superhero comics and graphic novels to
          manga-influenced titles, OEL (Original English Language) manga,
          webcomics, and hybrid works that blend Eastern and Western
          storytelling traditions.
        </p>
        <p className="mb-6">
          We operate as a non-profit-aligned platform. Our goal is not to favor
          any single tradition of comics-making, but to reflect the actual
          landscape of sequential art as it exists today — a landscape in which
          the influence of anime and manga on Western comics is not peripheral,
          but foundational.
        </p>

        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-6 mb-6">
          <h4 className="text-lg font-semibold mb-3 text-emerald-900 dark:text-emerald-100">
            A Note on Anime &amp; Manga as Western Comics
          </h4>
          <p className="mb-3 text-emerald-900 dark:text-emerald-100">
            For over two decades, Japanese manga and anime have been
            substantively integrated into Western comics culture. As of 2025,
            manga accounts for 56.9% of all graphic novel sales in the U.S., all
            ten of the top-selling graphic novels are manga titles, and North
            America hosts over 130 dedicated anime conventions annually —
            including Anime Expo, which drew 410,000+ attendees in 2025 alone.
          </p>
          <p className="mb-3 text-emerald-900 dark:text-emerald-100">
            Anime clubs are standard in American high schools. Manga-influenced
            aesthetics, panel pacing, and narrative structures are present
            throughout independent and mainstream Western publishing. Harvard
            University offers a General Education course on anime as global
            popular culture.
          </p>
          <p className="text-emerald-900 dark:text-emerald-100 font-medium mb-0">
            IndieCrowdfund formally recognizes anime-influenced and manga-style
            sequential art as a legitimate and established part of Western
            comics culture. Campaigns in this category are fully eligible and
            welcome on this platform.
          </p>
        </div>

        <h3 className="text-xl font-semibold mt-8 mb-4">2. Eligible Content Categories</h3>
        <p className="mb-4">
          The following types of sequential art projects are eligible to
          campaign on IndieCrowdfund:
        </p>

        <h4 className="text-lg font-semibold mt-6 mb-3">2.1 Western Comics &amp; Graphic Novels</h4>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li>
            Superhero, action, adventure, crime, horror, sci-fi, fantasy,
            slice-of-life, literary, and all other genre comics produced in
            the Western tradition
          </li>
          <li>
            Single-issue series, graphic novel collections, anthologies, and
            one-shots
          </li>
          <li>Webcomic print editions and archival collections</li>
          <li>Zines and small-press independent comics</li>
        </ul>

        <h4 className="text-lg font-semibold mt-6 mb-3">2.2 Manga-Style &amp; Anime-Influenced Comics</h4>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li>
            OEL (Original English Language) manga — manga-format comics created
            by non-Japanese creators
          </li>
          <li>
            Hybrid works blending manga visual grammar with Western storytelling
            traditions
          </li>
          <li>
            Comics directly influenced by anime aesthetics, panel pacing, or
            narrative structure
          </li>
          <li>
            Fan-original (not fan-derived) comics inspired by anime and manga
            genres: shonen, shojo, seinen, josei, isekai, slice-of-life, and
            others
          </li>
          <li>
            Manhwa (Korean), manhua (Chinese), and other East Asian sequential
            art traditions
          </li>
        </ul>

        <h4 className="text-lg font-semibold mt-6 mb-3">2.3 Educational &amp; Non-Fiction Sequential Art</h4>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li>Journalistic comics, documentary graphic novels, memoir</li>
          <li>Educational comics for all age groups</li>
          <li>
            Sequential art designed for STEM, history, social studies, or
            literacy outreach
          </li>
        </ul>

        <h3 className="text-xl font-semibold mt-8 mb-4">3. Content Standards &amp; Age Ratings</h3>
        <p className="mb-4">
          All campaigns must clearly identify their content rating.
          IndieCrowdfund uses the following classifications:
        </p>

        <div className="overflow-x-auto mb-6">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-zinc-100 dark:bg-zinc-800">
                <th className="text-left p-3 border border-zinc-200 dark:border-zinc-700">Rating</th>
                <th className="text-left p-3 border border-zinc-200 dark:border-zinc-700">Audience</th>
                <th className="text-left p-3 border border-zinc-200 dark:border-zinc-700">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-3 border border-zinc-200 dark:border-zinc-700 font-semibold">ALL AGES</td>
                <td className="p-3 border border-zinc-200 dark:border-zinc-700">All readers</td>
                <td className="p-3 border border-zinc-200 dark:border-zinc-700">
                  No violence, language, or themes beyond what is appropriate
                  for young children.
                </td>
              </tr>
              <tr>
                <td className="p-3 border border-zinc-200 dark:border-zinc-700 font-semibold">TEEN (13+)</td>
                <td className="p-3 border border-zinc-200 dark:border-zinc-700">13 and older</td>
                <td className="p-3 border border-zinc-200 dark:border-zinc-700">
                  Mild action violence, moderate themes, no sexual content.
                </td>
              </tr>
              <tr>
                <td className="p-3 border border-zinc-200 dark:border-zinc-700 font-semibold">MATURE (17+)</td>
                <td className="p-3 border border-zinc-200 dark:border-zinc-700">17 and older</td>
                <td className="p-3 border border-zinc-200 dark:border-zinc-700">
                  Strong themes, graphic violence, horror. Suggestive content
                  permitted only with verified adult characters. No explicit
                  sexual content.
                </td>
              </tr>
              <tr>
                <td className="p-3 border border-zinc-200 dark:border-zinc-700 font-semibold">ADULT (18+)</td>
                <td className="p-3 border border-zinc-200 dark:border-zinc-700">18 and older only</td>
                <td className="p-3 border border-zinc-200 dark:border-zinc-700">
                  Explicit sexual content permitted ONLY where all depicted
                  characters are verifiably 18 or older. Subject to all
                  character age verification requirements in Section 4.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3 className="text-xl font-semibold mt-8 mb-4">
          4. Character Age Standards in Suggestive &amp; Adult Content
        </h3>
        <p className="mb-6">
          Any campaign rated MATURE (17+) or ADULT (18+) that includes
          suggestive, romantic, or sexual content is subject to the following
          mandatory standards. These apply regardless of the comic&apos;s
          country of creative origin, genre, or artistic tradition — including
          manga, OEL manga, and anime-influenced works.
        </p>

        <h4 className="text-lg font-semibold mt-6 mb-3">4.1 The 18+ Rule</h4>
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-800 dark:text-red-200 font-medium mb-2">Absolute Standard</p>
          <p className="text-red-700 dark:text-red-300">
            No character depicted in suggestive, romantic, or sexual content
            may be under the age of 18. This applies universally — regardless
            of whether a character&apos;s age is explicitly stated, implied, or
            left ambiguous. When in doubt, the character must be treated as a
            minor and the content is not permitted.
          </p>
        </div>

        <h4 className="text-lg font-semibold mt-6 mb-3">4.2 Skeletal Maturity &amp; Visual Age Standards</h4>
        <p className="mb-4">
          Written age labels alone are not sufficient. A character described as
          "18" but drawn with the skeletal proportions, facial structure, or
          body development of a child will be treated as a minor for the
          purposes of these guidelines.
        </p>
        <p className="mb-4">
          IndieCrowdfund requires that adult characters in suggestive or sexual
          content demonstrate visual markers of skeletal and physiological
          maturity. These include:
        </p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li>
            Facial bone structure consistent with a fully developed adult —
            including defined jaw line, mature brow ridge, and proportionate
            facial features. Chibi-style or heavily simplified art styles that
            obscure these markers are not exempt.
          </li>
          <li>
            Body proportions consistent with adult skeletal development —
            including appropriate limb-to-torso ratios, developed musculature
            or body composition, and the absence of prepubescent body markers.
          </li>
          <li>
            Character height and build that does not suggest childhood or
            early adolescence.
          </li>
          <li>
            Absence of infantilizing visual cues — including but not limited
            to oversized heads disproportionate to adult anatomy,
            underdeveloped or absent secondary sexual characteristics paired
            with childlike facial features, or costumes and staging that evoke
            childhood.
          </li>
        </ul>
        <p className="mb-6">
          These visual standards reflect practices that have been adopted by
          responsible publishers and platforms across the industry as the most
          reliable method of distinguishing adult from minor characters in
          illustrated media.
        </p>

        <h4 className="text-lg font-semibold mt-6 mb-3">4.3 Ambiguous Age Policy</h4>
        <p className="mb-6">
          Where a character&apos;s age cannot be clearly established as 18 or
          older through both written documentation AND visual evidence of
          adult skeletal maturity, the character will be treated as a minor.
          The campaign will be required to revise the content or remove it
          from the submission before approval.
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">5. Prohibited Content</h3>
        <p className="mb-6">
          The following content is strictly prohibited on IndieCrowdfund.
          Campaigns containing prohibited content will be removed, and repeat
          or egregious violations may result in permanent account suspension
          and referral to appropriate authorities where legally required.
        </p>

        <h4 className="text-lg font-semibold mt-6 mb-3">
          5.1 Child Sexual Abuse Material &amp; Lolicon / Shotacon
        </h4>
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
          <p className="text-red-800 dark:text-red-200 font-medium mb-2">Zero-Tolerance Policy</p>
          <p className="text-red-700 dark:text-red-300">
            IndieCrowdfund maintains an absolute zero-tolerance policy toward
            any sexually suggestive or explicit depictions of minors. This
            includes content commonly referred to as <em>lolicon</em>{" "}
            (sexualized depictions of minor-presenting female characters) and{" "}
            <em>shotacon</em> (sexualized depictions of minor-presenting male
            characters), regardless of how the content is labeled or what age
            is claimed for the characters.
          </p>
        </div>
        <p className="mb-4">This prohibition exists because:</p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li>
            Lolicon and shotacon content normalizes the sexualization of
            children regardless of whether real children were involved in its
            production.
          </li>
          <li>
            The "fictional" framing does not mitigate harm — research and
            legal consensus in multiple jurisdictions recognize illustrated
            child sexual abuse material as harmful and, in many countries and
            U.S. states, illegal.
          </li>
          <li>
            The history of this content within certain corners of anime and
            manga culture represents one of the most significant reputational
            and ethical failures of those communities — one that responsible
            publishers, conventions, and platforms have worked actively to
            address and reject.
          </li>
          <li>
            Platforms that permit such content, even under claimed fictional
            exemptions, contribute to an environment in which real children
            are at greater risk.
          </li>
        </ul>
        <p className="mb-4">Content that will be rejected under this policy includes:</p>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li>
            Any sexually explicit or suggestive depiction of a character who
            is, appears to be, or is contextually implied to be under 18 —
            regardless of stated fictional age.
          </li>
          <li>
            Content in which adult age claims are clearly pretextual (e.g., a
            character with unambiguous child anatomy, proportions, and
            features labeled as "actually 500 years old" or similar).
          </li>
          <li>
            Swimsuit, lingerie, or nude content featuring characters with
            minor-presenting anatomy or visual markers.
          </li>
          <li>
            Romantic or sexual framing between an adult character and a
            minor-presenting character.
          </li>
          <li>
            Content that uses artistic style (e.g., heavy chibi or
            super-deformed conventions) to obscure the intended age of a
            character in sexual or suggestive context.
          </li>
        </ul>

        <h4 className="text-lg font-semibold mt-6 mb-3">5.2 Hate Speech</h4>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li>
            Comics whose primary purpose is to dehumanize, degrade, or incite
            violence against individuals or groups based on race, ethnicity,
            religion, gender, sexual orientation, disability, or national
            origin.
          </li>
        </ul>
        <p className="mb-6 italic">
          Note: Villains, dark themes, and historical depictions of racism and
          atrocity are not automatically prohibited — context and intent
          matter. Comics that explore these themes critically are eligible;
          comics that celebrate or promote them are not.
        </p>

        <h4 className="text-lg font-semibold mt-6 mb-3">5.3 Real-Person Violations</h4>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li>
            Sexual or sexually suggestive depictions of real, identifiable
            living individuals without documented consent.
          </li>
          <li>
            Defamatory content presented as factual that targets real
            individuals.
          </li>
        </ul>

        <h4 className="text-lg font-semibold mt-6 mb-3">5.4 Intellectual Property Violations</h4>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li>
            Campaigns that reproduce substantial portions of copyrighted work
            without authorization.
          </li>
          <li>
            Campaigns that present unlicensed derivative works as official or
            authorized products.
          </li>
        </ul>
        <p className="mb-6 italic">
          Note: Parody, criticism, and commentary are recognized as protected
          uses. Fan comics operating clearly within parody and non-commercial
          traditions will be evaluated individually.
        </p>

        <h4 className="text-lg font-semibold mt-6 mb-3">5.5 Other Prohibited Content</h4>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li>Disinformation campaigns disguised as comics or sequential art.</li>
          <li>
            Content designed to facilitate real-world violence, illegal
            activity, or exploitation.
          </li>
          <li>
            Campaigns that misrepresent the nature of the product, creator
            credentials, or use of funds.
          </li>
        </ul>

        <h3 className="text-xl font-semibold mt-8 mb-4">6. Review &amp; Enforcement</h3>

        <h4 className="text-lg font-semibold mt-6 mb-3">6.1 Pre-Launch Review</h4>
        <p className="mb-6">
          All campaigns undergo content review before going live. Creators
          should expect a review period of 3–5 business days. Campaigns
          flagged for potential policy concerns may be held for extended
          review or requested to provide additional documentation.
        </p>

        <h4 className="text-lg font-semibold mt-6 mb-3">6.2 Character Age Documentation</h4>
        <p className="mb-4">
          For MATURE or ADULT rated campaigns featuring suggestive content,
          creators may be asked to provide:
        </p>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li>
            Written in-universe documentation establishing character age (e.g.,
            character bible, script pages, creator statement)
          </li>
          <li>
            Visual evidence that the character&apos;s depiction meets the
            skeletal maturity standards outlined in Section 4.2
          </li>
          <li>
            Revision samples if initial submission does not meet visual
            standards
          </li>
        </ul>

        <h4 className="text-lg font-semibold mt-6 mb-3">6.3 Community Reporting</h4>
        <p className="mb-6">
          Backed campaigns remain subject to ongoing community reporting.
          Reports are reviewed by platform staff. Campaigns found to be in
          violation after launch may be suspended, and backers may be eligible
          for refunds at platform discretion.
        </p>

        <h4 className="text-lg font-semibold mt-6 mb-3">6.4 Appeals</h4>
        <p className="mb-6">
          Creators whose campaigns are rejected may submit a written appeal
          with supporting documentation within 14 days of the rejection notice.
          Appeals are reviewed by a separate staff member from the original
          reviewer. Appeal decisions are final.
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">7. Creator Commitments</h3>
        <p className="mb-4">
          By launching a campaign on IndieCrowdfund, creators affirm that:
        </p>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li>
            All submitted content complies with these guidelines and applicable
            law.
          </li>
          <li>
            All characters depicted in suggestive or adult content are 18 years
            of age or older, both as documented and as visually represented.
          </li>
          <li>
            The campaign accurately represents the nature of the project and
            the intended use of funds.
          </li>
          <li>
            The creator holds appropriate rights to all submitted content or
            has documented authorization from rights holders.
          </li>
          <li>
            The creator will respond to review requests and documentation
            requirements within the timeframes specified.
          </li>
        </ul>

        <h3 className="text-xl font-semibold mt-8 mb-4">8. Community Standards</h3>
        <p className="mb-4">
          Beyond campaign content, all users on IndieCrowdfund are expected to
          interact respectfully. Users may not:
        </p>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li>Harass, bully, or threaten others</li>
          <li>Discriminate or promote hate</li>
          <li>
            Post sexually explicit content (except within platform-allowed
            categories with appropriate age-gating)
          </li>
          <li>Promote violence, weapons, or harmful activities</li>
          <li>Misrepresent identity</li>
          <li>Spam or solicit unrelated products / services</li>
          <li>Post copyrighted content without permission</li>
        </ul>

        <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-6 mt-8">
          <h4 className="font-semibold mb-3">Questions &amp; Contact</h4>
          <p className="mb-3">
            For questions about these guidelines, content classification, or
            the review process, contact the IndieCrowdfund Creator Support
            team before submitting your campaign. We would rather work with
            you to ensure compliance than reject a campaign that could have
            been approved with minor revisions.
          </p>
          <p className="mb-1">
            Creator support:{" "}
            <a href="mailto:support@indiecrowdfund.com" className="text-emerald-600 hover:underline">
              support@indiecrowdfund.com
            </a>
          </p>
          <p>
            Report community violations:{" "}
            <a href="mailto:trust@indiecrowdfund.com" className="text-emerald-600 hover:underline">
              trust@indiecrowdfund.com
            </a>
          </p>
        </div>

        <p className="text-sm text-muted-foreground mt-8 italic">
          IndieCrowdfund Content Guidelines — v1.0. This document may be
          updated periodically. Creators will be notified of material changes.
          The most current version governs all active campaigns.
        </p>
      </div>
    </div>
  );
}
