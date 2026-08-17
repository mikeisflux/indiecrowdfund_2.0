/* eslint-disable react/no-unescaped-entities */

import Link from "next/link";

// Bump this whenever the Terms change in a way creators must re-accept.
//
// Acceptances are recorded against this exact string (see TermsAcceptance in
// the schema), which is what lets us answer "which version did this creator
// agree to, and when" — a promise section 16 now makes explicitly. Changing
// the text without bumping the version leaves that promise unbacked; bumping
// it re-prompts every creator on their next dashboard visit.
//
// Date-based so the ordering is obvious, with a counter for same-day edits.
export const TERMS_VERSION = "2026-08-16.1";
export const TERMS_LAST_UPDATED = "August 16, 2026";

export function TermsOfServiceContent() {
  return (
    <div className="prose prose-zinc dark:prose-invert max-w-none">
      <div className="rounded-lg border bg-white dark:bg-zinc-900 p-6 md:p-8">
        <h2 className="text-2xl font-bold mb-2">IndieCrowdfund — Terms of Service</h2>
        <p className="text-sm text-muted-foreground mb-8">
          <strong>Last Updated:</strong> {TERMS_LAST_UPDATED} &middot;{" "}
          <strong>Version:</strong> {TERMS_VERSION}
        </p>

        <p className="mb-6">
          Welcome to IndieCrowdfund.com, a crowdfunding and project-launch platform operated by IndieCrowdfund, a DBA of Divinity Comics Inc. ("IndieCrowdfund," "we," "our," or "us"). These Terms of Service ("Terms") govern your access to and use of IndieCrowdfund.com, our services, applications, and related tools (collectively, the "Services").
        </p>

        <p className="mb-8 font-medium">
          By accessing or using the Services, you agree to be bound by these Terms. If you do not agree, you may not use IndieCrowdfund.
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">1. What IndieCrowdfund Is</h3>
        <p className="mb-4">
          IndieCrowdfund is a DBA of Divinity Comics Inc., a 501(c)(3) nonprofit
          organization. Campaign funding on the platform is operated as the{" "}
          <strong>Divinity Comics Grant Program</strong> — a formal grantmaking program whose
          purpose is to promote western comics and art. Contributions made to campaigns are
          contributions to the Grant Program; funds are awarded to creators as grants to support
          the projects described in their campaigns. See our{" "}
          <Link href="/grant-program" className="underline">Grant Program</Link> page and the{" "}
          <Link href="/terms?tab=grant" className="underline">Grant Agreement</Link>.
        </p>
        <p className="mb-4">
          IndieCrowdfund is a platform where creators can publish projects, raise funding, offer rewards, and communicate with supporters ("Backers"). IndieCrowdfund facilitates these interactions but does not itself run or guarantee the success of any project.
        </p>
        <p className="mb-4">
          We are not a store, a bank, or an investment service. We provide tools; creators are responsible for their own projects and for fulfilling commitments made to backers, including any rewards they choose to offer.
        </p>
        <p className="mb-6">
          IndieCrowdfund supports the full spectrum of sequential art created by independent creators — from traditional Western comics and graphic novels to manga-style works, OEL (Original English Language) manga, manhwa, manhua, webcomics, and hybrid traditions blending Eastern and Western storytelling. We formally recognize anime-influenced and manga-style sequential art as a legitimate and established part of Western comics culture, and such campaigns are fully eligible to launch on the platform.
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">2. Eligibility</h3>
        <p className="mb-4">To use IndieCrowdfund, you must:</p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li>Be at least 18 years old</li>
          <li>Have the legal capacity to form a binding contract</li>
          <li>Not be barred from using the Services under applicable law</li>
        </ul>
        <p className="mb-6">
          Creators launching projects must also comply with our Creator Guidelines and local financial regulations.
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">3. User Accounts</h3>
        <p className="mb-4">To use certain features, you must create an account. You agree to:</p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li>Provide accurate and up-to-date information</li>
          <li>Maintain the security of your account</li>
          <li>Be responsible for all activity conducted under your credentials</li>
        </ul>
        <p className="mb-6">We may suspend or terminate accounts that violate these Terms.</p>

        <h3 className="text-xl font-semibold mt-8 mb-4">4. Launching Projects</h3>
        <p className="mb-4">Creators who launch a project on IndieCrowdfund agree to:</p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li>Provide truthful and complete information about their project</li>
          <li>Set accurate funding goals, deadlines, and reward tiers</li>
          <li>Fulfill all rewards if the project is successfully funded</li>
          <li>Communicate clearly and promptly with backers about progress</li>
        </ul>
        <p className="mb-4">Creators assume full legal responsibility for their commitments.</p>
        <p className="mb-6 font-medium">
          IndieCrowdfund does not guarantee reward delivery, shipping, timelines, or the quality of any product.
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">5. Backing Projects</h3>
        <p className="mb-4">When backers support a project:</p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li>Their contribution goes to IndieCrowdfund (a DBA of Divinity Comics Inc.) in support of the Grant Program; funds are awarded as grants to support projects aligned with our mission</li>
          <li>They are backing the creation of the project, not purchasing a product — rewards are offered by creators and are not guaranteed</li>
          <li>They understand that delays, changes, or cancellations are possible</li>
          <li>They may be entitled to refunds only at the creator's discretion unless required by law</li>
          <li>They agree to read the full project description and associated risks</li>
        </ul>
        <p className="mb-6">IndieCrowdfund is not responsible for disputes between creators and backers. Rewards, and their fulfillment, are solely the responsibility of the creator.</p>

        <h3 className="text-xl font-semibold mt-8 mb-4">5a. Chargebacks &mdash; Immediate Permanent Ban</h3>
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg p-4 mb-6">
          <p className="text-red-700 dark:text-red-300 text-sm mb-3">
            If you initiate a credit-card dispute or chargeback against
            IndieCrowdfund or any of our payment processors (Stripe / PayPal /
            Divinity Payments / Whop) on any pledge or marketplace purchase,
            your account is <strong>permanently banned</strong> the moment
            the dispute is filed, regardless of outcome. You lose access to
            every pledge, reward, and digital download tied to that account.
            Future accounts under the same email, payment method, IP, or
            device fingerprint are also banned. There is no appeal.
          </p>
          <p className="text-red-700 dark:text-red-300 text-sm mb-0">
            Rewards are not guaranteed, you back at your own risk, and a
            delayed or scaled-back campaign is <strong>not</strong> grounds
            for a chargeback. The carve-outs are actual unauthorized-use
            fraud (your card was used by someone else), regulator /
            law-enforcement directives, and any case where the law gives you
            a right to dispute that you cannot waive. See the full{" "}
            <Link href="/terms?tab=chargebacks" className="underline">
              Chargeback Handling Policy
            </Link>
            .
          </p>
        </div>
        <p className="mb-6">
          Nothing in this section restricts, waives, or asks you to give up any right you have under
          law to dispute a charge with your card issuer or bank — including your rights under the Fair
          Credit Billing Act and Regulation Z — or to complain to a regulator. Those rights are yours
          and we do not condition access to the Services on giving them up. This section describes the
          consequences under our own Terms of using the dispute process in place of contacting us
          first, in a program where contributions fund grants that have already been awarded and paid
          out. Where a dispute falls within a carve-out above, no ban applies. If you think a charge is
          wrong, email{" "}
          <a href="mailto:support@indiecrowdfund.com" className="text-emerald-600 hover:underline">
            support@indiecrowdfund.com
          </a>{" "}
          first — we would rather fix it than lose you.
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">6. Program Costs, Payments, and Campaign Types</h3>
        <p className="mb-4">
          IndieCrowdfund (a DBA of Divinity Comics Inc.) retains a portion of contributions to cover the
          reasonable administrative and facilitation costs of operating the Grant Program, along
          with payment-processing costs charged by our payment processors. These amounts are
          disclosed during project setup and may vary by region.
        </p>
        <p className="mb-4">
          Creators may choose between two campaign funding models:
        </p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li><strong>All or Nothing:</strong> Funds are only collected if the campaign reaches its stated funding goal by the deadline. If the goal is not reached, no money changes hands and backers are not charged.</li>
          <li><strong>Keep It All:</strong> The creator keeps all pledges regardless of whether the funding goal is reached. Backers are charged immediately at the time of their pledge.</li>
        </ul>
        <p className="mb-4">Creators authorize IndieCrowdfund and its payment processors to:</p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li>Collect contributions from backers on behalf of the Grant Program</li>
          <li>Deduct program administration and payment-processing costs</li>
          <li>Hold a rolling reserve where applicable (see below)</li>
          <li>Disburse the remaining funds to the creator as a grant, under the Grant Agreement</li>
        </ul>

        <p className="mb-6">
          Creators are responsible for all taxes, shipping costs, duties, and regulatory compliance.
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">6a. Tax Treatment of Contributions</h3>
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4">
          <p className="text-amber-800 dark:text-amber-200 font-medium mb-0">
            Contributions made through the Grant Program are not tax-deductible charitable donations.
          </p>
        </div>
        <p className="mb-4">
          Divinity Comics Inc. is a 501(c)(3) organization, but that status does not by itself make
          every payment to it deductible. Backers receive rewards, access, or other benefits in return
          for their contributions, and we do not represent any part of a contribution as a deductible
          charitable gift. We do not issue charitable contribution receipts or written acknowledgments
          under Internal Revenue Code sections 170(f)(8) or 6115 for pledges, and none should be
          inferred from a payment confirmation or receipt.
        </p>
        <p className="mb-6">
          If your circumstances differ — for example a genuine donation made without receiving anything
          in return — contact us before assuming any tax treatment. Nothing on this platform is tax
          advice; consult your own tax advisor. Creators receiving grants are separately responsible for
          the tax treatment of what they receive, as set out in the{" "}
          <Link href="/terms?tab=grant" className="underline">Grant Agreement</Link>.
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">7. Creator Verification & Due Diligence</h3>
        <p className="mb-4">
          IndieCrowdfund conducts thorough due diligence on all creators before approving campaigns, and continues to review creators and their campaigns while those campaigns are running. Our verification process includes:
        </p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li><strong>Identity Verification:</strong> New creators must provide a valid government-issued photo ID and a legitimate business filing from their state Secretary of State office. Returning creators with verified accounts may be exempt from re-submission.</li>
          <li><strong>Social Media & Online Presence Audit:</strong> We log and verify all social media accounts linked to the creator. Our team searches other crowdfunding platforms (Kickstarter, Indiegogo, GoFundMe, etc.) to review the creator&apos;s campaign history, including campaigns currently running as well as completed ones.</li>
          <li><strong>Fulfillment History Review:</strong> We review backer comments, reviews, and public feedback on all of a creator&apos;s campaigns across all platforms — completed campaigns, campaigns currently running, and campaigns running concurrently on other platforms. This review is ongoing and is not limited to the period before approval. We contact creators directly when discrepancies or concerns are identified. We reserve the right to contact any creator by any means we see fit, using any contact details you have given us or made public, and by consenting to these Terms you agree to be contacted at those details about your campaign, including by phone and text message where you have supplied a number. Failure to respond to any communication will be considered campaign abandonment and will be dealt with accordingly; before we treat a campaign as abandoned we will send a final written notice to the email address on your account and allow ten (10) days for a reply.</li>
          <li><strong>Internal Documentation:</strong> All verification findings, correspondence, and review decisions are documented internally and retained for compliance and audit purposes.</li>
          <li><strong>Payment Account Verification:</strong> Creators must add a valid PayPal payout email (for standard campaigns), complete bank account setup through Divinity Payments (for NSFW/adult content campaigns), or connect a Whop account (for Whop-processed campaigns) to receive payouts.</li>
        </ul>
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
          <p className="text-red-800 dark:text-red-200 font-medium mb-2">Automatic Disqualification</p>
          <p className="text-red-700 dark:text-red-300 text-sm">
            Creators are automatically disqualified from launching on IndieCrowdfund if:
          </p>
          <ul className="list-disc pl-6 mt-2 text-red-700 dark:text-red-300 text-sm space-y-1">
            <li>They have <strong>three or more unfulfilled campaigns</strong> on any crowdfunding platform</li>
            <li>They have <strong>any campaign that is more than one year past its stated delivery date</strong>, regardless of fulfillment status</li>
          </ul>
        </div>
        <p className="mb-6">
          IndieCrowdfund reserves the right to request additional documentation, deny applications, or revoke access at any time based on verification findings.
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">8. Content Standards &amp; Age Requirements</h3>
        <p className="mb-4">
          All campaigns on IndieCrowdfund are subject to our{" "}
          <Link href="/content-guidelines" className="text-emerald-600 hover:underline">
            Content Guidelines
          </Link>
          , which establish content standards, eligibility criteria, and prohibited
          content policies for sequential-art campaigns. These guidelines apply
          regardless of the work&apos;s format, genre, or country of creative origin —
          including manga, OEL manga, manhwa, manhua, and other anime-influenced
          works.
        </p>

        <h4 className="text-lg font-semibold mt-6 mb-3">8.1 Content Ratings</h4>
        <p className="mb-4">Every campaign must declare a content rating:</p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li>
            <strong>ALL AGES</strong> — no violence, language, or themes beyond
            what is appropriate for young children.
          </li>
          <li>
            <strong>TEEN (13+)</strong> — mild action violence, moderate themes,
            no sexual content.
          </li>
          <li>
            <strong>MATURE (17+)</strong> — strong themes, graphic violence, horror.
            Suggestive content permitted only with verified adult characters. No
            explicit sexual content.
          </li>
          <li>
            <strong>ADULT (18+)</strong> — explicit sexual content permitted ONLY
            where all depicted characters are verifiably 18 or older. Subject to
            all character age verification requirements below and in our{" "}
            <Link href="/content-guidelines" className="text-emerald-600 hover:underline">
              Content Guidelines
            </Link>
            .
          </li>
        </ul>

        <h4 className="text-lg font-semibold mt-6 mb-3">8.2 Character Age — Absolute Standard</h4>
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
          <p className="text-red-800 dark:text-red-200 font-medium mb-2">
            No character depicted in suggestive, romantic, or sexual content may
            be under the age of 18.
          </p>
          <p className="text-red-700 dark:text-red-300 text-sm">
            This applies universally — regardless of whether a character&apos;s
            age is explicitly stated, implied, or left ambiguous. When in doubt,
            the character must be treated as a minor and the content is not
            permitted.
          </p>
        </div>

        <h4 className="text-lg font-semibold mt-6 mb-3">8.3 Visual Standards — Skeletal Maturity</h4>
        <p className="mb-4">
          Written age labels alone are not sufficient. A character described as
          "18" but drawn with the skeletal proportions, facial structure, or body
          development of a child will be treated as a minor for the purposes of
          these Terms. Adult characters in suggestive or sexual content must
          demonstrate visual markers of skeletal and physiological maturity,
          including:
        </p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li>Facial bone structure consistent with a fully developed adult.</li>
          <li>
            Body proportions consistent with adult skeletal development —
            appropriate limb-to-torso ratios and the absence of prepubescent
            body markers.
          </li>
          <li>Character height and build that does not suggest childhood or early adolescence.</li>
          <li>
            Absence of infantilizing visual cues — including oversized heads
            disproportionate to adult anatomy, underdeveloped or absent
            secondary sexual characteristics paired with childlike facial
            features, or costumes and staging that evoke childhood.
          </li>
        </ul>
        <p className="mb-4">
          Heavily chibi, super-deformed, or simplified art styles that obscure
          these markers are not exempt. Full visual standards are detailed in our{" "}
          <Link href="/content-guidelines" className="text-emerald-600 hover:underline">
            Content Guidelines § 4
          </Link>
          .
        </p>

        <h4 className="text-lg font-semibold mt-6 mb-3">8.4 Ambiguous Age Policy</h4>
        <p className="mb-6">
          Where a character&apos;s age cannot be clearly established as 18 or
          older through both written documentation AND visual evidence of adult
          skeletal maturity, the character will be treated as a minor and the
          content will not be approved.
        </p>

        <h4 className="text-lg font-semibold mt-6 mb-3">8.5 Pre-Launch Review</h4>
        <p className="mb-4">
          All campaigns undergo content review before going live. Standard review
          takes 3–5 business days. Campaigns flagged for potential policy
          concerns may be held for extended review. For MATURE or ADULT-rated
          campaigns featuring suggestive content, creators may be asked to
          provide written in-universe documentation establishing character age,
          visual evidence that the character&apos;s depiction meets the skeletal
          maturity standards above, or revisions if the initial submission does
          not meet visual standards.
        </p>
        <p className="mb-6">
          Creators whose campaigns are rejected may submit a written appeal
          with supporting documentation within 14 days. Appeals are reviewed by
          a separate staff member from the original reviewer; appeal decisions
          are final.
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">9. Prohibited Activities</h3>
        <p className="mb-4">Users may not:</p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li>Break any laws while using the platform</li>
          <li>Launch fraudulent or misleading projects</li>
          <li>Abuse, harass, or impersonate others</li>
          <li>Use the platform to launder money or engage in financial misconduct</li>
          <li>Upload malware, attempt hacks, or disrupt platform operations</li>
          <li>Use IndieCrowdfund to fund prohibited items (weapons, hate material, adult services, etc.)</li>
        </ul>

        <p className="mb-4 font-medium">In addition, the following content is strictly prohibited:</p>

        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
          <p className="text-red-800 dark:text-red-200 font-medium mb-2">
            Zero-Tolerance: Sexualized Depictions of Minors
          </p>
          <p className="text-red-700 dark:text-red-300 text-sm mb-2">
            IndieCrowdfund maintains an absolute zero-tolerance policy toward any
            sexually suggestive or explicit depiction of a character who is,
            appears to be, or is contextually implied to be under 18 — regardless
            of stated fictional age, art style, or country of creative origin.
            This includes content commonly referred to as <em>lolicon</em>{" "}
            (sexualized depictions of minor-presenting female characters) and{" "}
            <em>shotacon</em> (sexualized depictions of minor-presenting male
            characters).
          </p>
          <p className="text-red-700 dark:text-red-300 text-sm">
            Pretextual adult-age claims (e.g., a character with unambiguous
            child anatomy labeled as &quot;actually 500 years old&quot;), swimsuit /
            lingerie / nude content featuring characters with minor-presenting
            anatomy, romantic or sexual framing between an adult character and
            a minor-presenting character, and use of artistic style to obscure
            intended age in sexual or suggestive contexts are all prohibited.
            Violations may be reported to appropriate authorities where legally
            required and will result in permanent account suspension.
          </p>
        </div>

        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li>
            <strong>Hate speech</strong> — comics whose
            primary purpose is to dehumanize, degrade, or incite violence
            against individuals or groups based on race, ethnicity, religion,
            gender, sexual orientation, disability, or national origin. Villains,
            dark themes, and historical depictions of racism and atrocity are not
            automatically prohibited; context and intent matter. Comics that
            explore these themes critically are eligible. Comics that celebrate
            or promote them are not.
          </li>
          <li>
            <strong>Real-person violations</strong> — sexual or sexually suggestive
            depictions of real, identifiable living individuals without
            documented consent, and defamatory content presented as factual that
            targets real individuals.
          </li>
          <li>
            <strong>Intellectual property violations</strong> — campaigns that
            reproduce substantial portions of copyrighted work without
            authorization, or that present unlicensed derivative works as
            official or authorized products. Parody, criticism, and commentary
            are recognized as protected uses; fan comics operating clearly
            within parody and non-commercial traditions will be evaluated
            individually.
          </li>
          <li>
            <strong>Other prohibited material</strong> — disinformation
            campaigns disguised as comics or sequential art; content designed
            to facilitate real-world violence, illegal activity, or
            exploitation; and campaigns that misrepresent the nature of the
            product, creator credentials, or use of funds.
          </li>
        </ul>
        <p className="mb-6 font-medium">Violations may result in account termination and, where required by law, referral to appropriate authorities.</p>

        <h3 className="text-xl font-semibold mt-8 mb-4">10. Intellectual Property</h3>
        <p className="mb-4">
          Creators retain ownership of their content but grant IndieCrowdfund a limited license to:
        </p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li>Host, display, and distribute project content</li>
          <li>Promote and market the project on-site or via social channels</li>
          <li>Archive project pages permanently after campaigns end</li>
        </ul>
        <p className="mb-4">
          That licence is non-exclusive, worldwide, royalty-free, and sublicensable only to the hosting,
          storage, content-delivery, and email providers we use to operate the Services. You keep
          ownership, and you may take your content down at any time. Because project pages are archived
          permanently as part of the public record of the Grant Program, the licence to host and display
          material already published on a campaign page survives the end of your campaign and the
          closure of your account; every other part of it ends when you remove the content. You confirm
          you have the rights needed to grant this licence for everything you upload.
        </p>
        <p className="mb-6">Users may not copy, steal, or misuse other creators' content.</p>

        <h3 className="text-xl font-semibold mt-8 mb-4">10a. Copyright Complaints and Repeat Infringers</h3>
        <p className="mb-4">
          We respond to notices of claimed copyright infringement under the Digital Millennium Copyright
          Act. Send notices, and counter-notices, to our designated copyright agent at{" "}
          <a href="mailto:dmca@indiecrowdfund.com" className="text-emerald-600 hover:underline">
            dmca@indiecrowdfund.com
          </a>
          . The procedure, and what a valid notice must contain, is set out in our{" "}
          <Link href="/terms?tab=dmca" className="underline">DMCA Policy</Link>.
        </p>
        <p className="mb-6">
          We have adopted and will reasonably implement a policy of terminating, in appropriate
          circumstances, the accounts of users who are repeat infringers of copyright. Campaigns and
          content removed following a valid notice count toward that assessment, and an account
          terminated under this section is subject to Section 6 of our{" "}
          <Link href="/terms?tab=data-deletion" className="underline">Data Deletion Policy</Link>.
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">11. Platform Rights</h3>
        <p className="mb-4">IndieCrowdfund may:</p>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li>Remove content that violates these Terms</li>
          <li>Suspend or terminate accounts</li>
          <li>Modify or update the Services</li>
          <li>Interrupt access for maintenance or system upgrades</li>
          <li>Refuse service at our discretion</li>
        </ul>

        <h3 className="text-xl font-semibold mt-8 mb-4">
          11a. Termination for Violation, Ban Evasion, and Retained Records
        </h3>
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
          <p className="text-red-800 dark:text-red-200 font-medium mb-0">
            If we terminate your account for violating these Terms, the ban applies to you as a person.
            You agree that we may keep the limited information needed to enforce it, that deleting your
            account will not remove that information, and that you will not create another account.
          </p>
        </div>
        <p className="mb-6">
          This section applies to any termination for breach of these Terms or our policies — including
          fraud, harassment, prohibited content, misuse of grant funds, misrepresentation, or repeat
          copyright infringement. It applies in addition to, and independently of, the chargeback ban in
          Section 5a, and it applies whether or not a chargeback is involved.
        </p>

        <h4 className="text-lg font-semibold mt-6 mb-3">11a.1 A Ban Attaches to the Person</h4>
        <p className="mb-6">
          A ban is not merely the closing of an account record. Where we terminate an account for a
          violation, you may not register, operate, or benefit from another account on IndieCrowdfund,
          and you may not ask or pay another person to hold one for you. Creating or using a further
          account after a ban is itself a breach of these Terms, and any such account may be terminated
          without notice, with pledges made through it cancelled. Ending the ban requires our written
          agreement.
        </p>

        <h4 className="text-lg font-semibold mt-6 mb-3">
          11a.2 Records We Keep, and Which Deletion Does Not Remove
        </h4>
        <p className="mb-4">
          A ban we cannot recognise is not a ban. You acknowledge and agree that, where your account has
          been terminated for a violation, we may retain the following, and that a request to delete your
          account or your personal data does not oblige us to erase it:
        </p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li>The name on the account, and any name given for shipping or verification</li>
          <li>The email address or addresses associated with the account</li>
          <li>Any phone number provided for verification</li>
          <li>The last known IP address or addresses used to access the account</li>
          <li>Device and browser signals recorded at sign-up or sign-in</li>
          <li>
            Payment identifiers connected with the violation — processor-side references, never full card
            numbers
          </li>
          <li>The enforcement record itself: the date, the reason, and who applied it</li>
        </ul>
        <p className="mb-4">
          We compare these against new and existing accounts to identify the same person returning. A
          name on its own is weak evidence and we do not act on one alone — it is used together with the
          other identifiers above, and a match is reviewed before any account is closed.
        </p>
        <p className="mb-4">
          We keep these for as long as the ban remains in force, which for a permanent ban means
          indefinitely. We keep nothing else for this purpose: everything outside this list is deleted or
          anonymised on the ordinary schedule set out in our{" "}
          <Link href="/terms?tab=data-deletion" className="underline">Data Deletion Policy</Link>, and
          Section 6 of that Policy governs how these records are handled.
        </p>
        <p className="mb-6">
          These records are held under restricted access and used only to detect and prevent ban evasion,
          to enforce the original decision, to protect other users and our payment processors from repeat
          abuse and fraud, and to establish, exercise, or defend legal claims. They are never used for
          marketing, advertising, personalisation, or profiling, are never included in creator-facing
          backer reports or exports, and are never sold or shared with third parties for their own
          purposes.
        </p>

        <h4 className="text-lg font-semibold mt-6 mb-3">11a.3 Why We May Refuse Erasure</h4>
        <p className="mb-6">
          The right to erasure is not absolute, and our basis for declining it as to the records above is
          our legitimate interest in the security and integrity of the platform and in preventing fraud
          and repeat abuse — a purpose expressly recognised by Article 6(1)(f) and Recital 47 of the GDPR
          — together with the exceptions in Article 17(3) covering legal obligations and the
          establishment, exercise, or defence of legal claims, and the exceptions in California Civil
          Code § 1798.105(d) covering the detection of security incidents and protection against
          malicious, deceptive, fraudulent, or illegal activity. Comparable provisions in other
          jurisdictions are applied the same way. Nothing in this section removes a right you hold that
          cannot be waived by agreement, and your other data-subject rights are unaffected.
        </p>

        <h4 className="text-lg font-semibold mt-6 mb-3">11a.4 Contesting a Ban</h4>
        <p className="mb-6">
          If you believe a termination was wrong, or that we no longer have reason to hold your
          identifiers, write to{" "}
          <a href="mailto:support@indiecrowdfund.com" className="text-emerald-600 hover:underline">
            support@indiecrowdfund.com
          </a>{" "}
          setting out why. We will review it and reply in writing. Where we agree, we lift the ban and
          delete the records held under 11a.2. Chargeback bans under Section 5a follow the appeal rule
          stated there.
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">12. Disclaimers</h3>
        <p className="mb-4 font-semibold uppercase">
          The Services are provided "as is" and "as available," without warranty of any kind. To the
          fullest extent permitted by law, IndieCrowdfund disclaims all warranties, express, implied, and
          statutory, including the implied warranties of merchantability, fitness for a particular
          purpose, title, and non-infringement, and any warranties arising from course of dealing or
          usage of trade.
        </p>
        <p className="mb-4">We do not guarantee:</p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li>Project success</li>
          <li>Creator performance</li>
          <li>Reward delivery</li>
          <li>Platform uptime, or that the Services will be uninterrupted, secure, or error-free</li>
          <li>Accuracy of user-submitted information</li>
        </ul>
        <p className="mb-4 font-medium">Use the platform at your own risk.</p>
        <p className="mb-6">
          Some jurisdictions do not allow the exclusion of implied warranties, so some of the above may
          not apply to you. Nothing in this section limits any warranty or right that cannot be excluded
          or limited under the law that applies to you.
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">13. Limitation of Liability</h3>
        <p className="mb-4 font-semibold uppercase">
          To the fullest extent permitted by law, IndieCrowdfund will not be liable for any indirect,
          incidental, special, consequential, exemplary, or punitive damages, or for lost profits,
          revenue, data, goodwill, or business opportunity, arising out of or relating to the Services,
          even if we have been advised of the possibility of those damages.
        </p>
        <p className="mb-4">Subject to the exceptions below, and to the fullest extent permitted by law:</p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li>
            IndieCrowdfund is not liable for losses related to project failures, disputes, delays, or
            unfulfilled rewards
          </li>
          <li>
            Our total aggregate liability for all claims arising out of or relating to the Services will
            not exceed the greater of (a) the total amount you paid to us in the twelve months before the
            event giving rise to the claim, or (b) one hundred US dollars (US$100)
          </li>
        </ul>
        <p className="mb-2 font-medium">What this section does not limit</p>
        <p className="mb-4">
          Nothing in these Terms excludes or limits our liability for fraud or fraudulent
          misrepresentation, for gross negligence or willful misconduct, for death or personal injury
          caused by our negligence, or for any other liability that cannot lawfully be excluded or
          limited. Where a limitation in this section is held unenforceable as to a particular claim, it
          continues to apply to every other claim.
        </p>
        <p className="mb-6">
          Some jurisdictions do not allow certain limitations; in such cases, the limitations apply to
          the maximum extent allowed, and your statutory rights as a consumer are unaffected.
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">13a. Indemnification</h3>
        <p className="mb-4">
          You agree to indemnify and hold harmless IndieCrowdfund, Divinity Comics Inc., and their
          officers, directors, employees, and agents from any third-party claim, demand, loss, or
          expense, including reasonable legal fees, arising out of:
        </p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li>Content you submit, publish, or distribute through the Services</li>
          <li>Your breach of these Terms or of any law</li>
          <li>Your infringement of anyone else's intellectual property or other rights</li>
          <li>
            For creators: your campaign, your use of grant funds, and your fulfillment of, or failure to
            fulfill, rewards you offered
          </li>
        </ul>
        <p className="mb-6">
          This does not apply to the extent the claim arises from our own gross negligence, willful
          misconduct, or breach of these Terms. We will notify you promptly of any claim, let you control
          the defense with counsel of your choosing, and cooperate at your expense; you may not settle a
          claim in a way that imposes any obligation or admission on us without our written consent, and
          we may participate at our own cost. Nothing here requires you to indemnify us for anything the
          law does not permit.
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">14. Dispute Resolution</h3>
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4">
          <p className="text-amber-800 dark:text-amber-200 font-semibold uppercase mb-0">
            This section requires most disputes to be resolved by individual binding arbitration rather
            than in court, and waives your right to a jury trial and to participate in a class action.
            You may opt out. Please read it.
          </p>
        </div>

        <h4 className="text-lg font-semibold mt-6 mb-3">14.1 Talk to Us First</h4>
        <p className="mb-6">
          Before starting an arbitration or a lawsuit, send a written Notice of Dispute to{" "}
          <a href="mailto:support@indiecrowdfund.com" className="text-emerald-600 hover:underline">
            support@indiecrowdfund.com
          </a>{" "}
          describing the dispute and the relief you want. We will do the same for any dispute we have
          with you. Both sides agree to try in good faith to resolve it for 60 days after the notice is
          sent. This step is a condition of starting arbitration, and the deadline to bring a claim
          pauses while it runs.
        </p>

        <h4 className="text-lg font-semibold mt-6 mb-3">14.2 Arbitration</h4>
        <p className="mb-4">
          If we cannot resolve it, the dispute will be settled by binding arbitration administered by the
          American Arbitration Association under its Consumer Arbitration Rules, before a single
          arbitrator, rather than in court. The Federal Arbitration Act governs this section. The
          arbitrator decides all issues except those reserved to a court in 14.4, including the scope and
          enforceability of this section.
        </p>
        <p className="mb-4">
          You may choose to have the arbitration conducted by telephone or videoconference, on written
          submissions, or in person in the county where you live. We will pay the arbitration filing,
          administration, and arbitrator fees that exceed what it would have cost you to file the same
          claim in court, except where the arbitrator finds your claim frivolous. Each side otherwise
          bears its own legal costs, unless the law or the arbitrator's award provides otherwise.
        </p>

        <h4 className="text-lg font-semibold mt-6 mb-3">14.3 No Class Actions</h4>
        <p className="mb-4">
          Disputes must be brought individually. Neither side may bring a claim as a plaintiff or class
          member in any class, collective, consolidated, or representative proceeding, and the arbitrator
          may not consolidate more than one person's claims or preside over any representative
          proceeding.
        </p>
        <p className="mb-6">
          If this paragraph 14.3 is found unenforceable as to a particular claim or request for relief,
          then that claim or request must be brought in court and is severed from arbitration; the rest
          of this Section 14 still applies to everything else. Nothing here waives a right to public
          injunctive relief where that right cannot be waived by law.
        </p>

        <h4 className="text-lg font-semibold mt-6 mb-3">14.4 What Stays Out of Arbitration</h4>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li>Claims that qualify for small-claims court, brought individually in that court</li>
          <li>
            Requests for temporary or preliminary injunctive relief to stop infringement or misuse of
            intellectual property, which either side may bring in a court of competent jurisdiction
          </li>
          <li>
            Any claim or remedy that applicable law says cannot be sent to arbitration, including
            complaints to a government agency, which you may always make
          </li>
        </ul>

        <h4 className="text-lg font-semibold mt-6 mb-3">14.5 Many Similar Claims</h4>
        <p className="mb-6">
          If 25 or more claims of a substantially similar kind are filed against us by or with help from
          the same lawyers or coordinated group, the claims will be arbitrated in staged batches of no
          more than 50, each batch before a single arbitrator, with the deadline to bring a claim paused
          for every claim awaiting its batch. This keeps the process workable for both sides and does not
          reduce anyone's right to have their own claim heard.
        </p>

        <h4 className="text-lg font-semibold mt-6 mb-3">14.6 How to Opt Out</h4>
        <p className="mb-6">
          You may reject this Section 14 by emailing{" "}
          <a href="mailto:support@indiecrowdfund.com" className="text-emerald-600 hover:underline">
            support@indiecrowdfund.com
          </a>{" "}
          with your name, the email address on your account, and a statement that you opt out of
          arbitration. Send it within 30 days of first accepting these Terms, or within 30 days of the
          date this section was added, whichever is later. Opting out affects nothing else in these
          Terms, and we will not treat it as a reason to close your account or refuse you service.
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">15. Governing Law and Venue</h3>
        <p className="mb-4">
          These Terms are governed by the laws of the State of Indiana, without regard to conflicts of
          law. For any dispute not subject to arbitration under Section 14, you and IndieCrowdfund agree
          to the exclusive jurisdiction and venue of the state and federal courts located in Indiana, and
          each side waives any objection to that venue.
        </p>
        <p className="mb-6">
          If you are a consumer resident in a jurisdiction whose law gives you rights that cannot be
          waived by agreement, nothing in this section deprives you of those rights or of the protection
          of the mandatory law of the place where you live.
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">16. Changes to These Terms</h3>
        <p className="mb-4">
          We may update these Terms from time to time — for example to reflect new features, a change of
          payment processor, or legal and regulatory requirements.
        </p>
        <p className="mb-2 font-medium">How changes take effect</p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li>
            <strong>Material changes:</strong> we will give at least 30 days&apos; notice, by email to the
            address on your account and by notice on the website. The change takes effect on the effective
            date stated in that notice.
          </li>
          <li>
            <strong>Non-material changes</strong> — clarifications, typographical corrections, and changes
            required by law or by a payment processor on shorter notice — take effect when posted.
          </li>
          <li>
            <strong>Changes apply going forward only.</strong> They do not alter the terms that governed a
            campaign already launched or a pledge already made before the effective date.
          </li>
        </ul>
        <p className="mb-2 font-medium">Your choices</p>
        <p className="mb-4">
          If you continue to use IndieCrowdfund as a creator or a backer on or after the effective date, you
          accept the updated Terms. If you do not agree, you may reject the change by written notice to
          support@indiecrowdfund.com before that date. If you do:
        </p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li>
            <strong>Creators:</strong> any campaign already live continues under the Terms in force when it
            launched, through fulfillment. You may not launch a new campaign without accepting the updated
            Terms.
          </li>
          <li>
            <strong>Backers:</strong> pledges already made continue under the Terms in force when they were
            made. You may not make new pledges without accepting the updated Terms.
          </li>
        </ul>
        <p className="mb-6">
          We keep dated copies of prior versions of these Terms and will provide the version that applied to
          your campaign or pledge on request.
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">16a. General Provisions</h3>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li>
            <strong>Severability.</strong> If any provision of these Terms is held invalid or
            unenforceable, that provision is limited or removed to the minimum extent necessary and the
            rest of these Terms stay in full force. Section 14.3 is the one exception, and is handled the
            way that paragraph describes.
          </li>
          <li>
            <strong>No waiver.</strong> If we do not enforce a provision, that is not a waiver of it, and
            it does not stop us enforcing it later.
          </li>
          <li>
            <strong>Assignment.</strong> You may not assign or transfer these Terms or your account
            without our written consent. We may assign them to an affiliate or in connection with a
            merger, acquisition, reorganization, or sale of assets, on notice to you.
          </li>
          <li>
            <strong>Entire agreement.</strong> These Terms, together with the policies they link to —
            including the Grant Agreement, Backer Agreement, Content Guidelines, Privacy Policy,
            Chargeback Handling Policy, and Data Deletion Policy — are the entire agreement between you
            and us about the Services, and replace any earlier understanding on the same subject. Where a
            campaign-specific agreement conflicts with these Terms, that agreement controls for that
            campaign.
          </li>
          <li>
            <strong>Survival.</strong> Sections 5a, 6a, 10, 10a, 11a, 12, 13, 13a, 14, 15, and this section
            survive the end of your account or of these Terms, along with anything else that by its
            nature should.
          </li>
          <li>
            <strong>Force majeure.</strong> Neither side is liable for a failure or delay caused by
            events beyond its reasonable control, including natural disaster, war, civil unrest, labor
            disputes, epidemic, failure of a payment processor or hosting provider, or government
            action. This does not excuse any obligation to pay money already owed.
          </li>
          <li>
            <strong>Notices and electronic communications.</strong> You consent to receive
            communications, agreements, notices, and disclosures from us electronically — by email to the
            address on your account, or by posting to the Services — and agree that these satisfy any
            legal requirement that they be in writing. Legal notices to us go to{" "}
            <a href="mailto:support@indiecrowdfund.com" className="text-emerald-600 hover:underline">
              support@indiecrowdfund.com
            </a>
            . Keep your email address current; a notice sent to the address on your account is
            effective when sent. You may withdraw consent to electronic delivery by writing to us, but
            we may then have to close your account, because the Services are delivered electronically.
          </li>
          <li>
            <strong>No third-party beneficiaries.</strong> These Terms do not give rights to anyone who
            is not a party to them, except that Divinity Comics Inc. and the people listed in Section 13a
            may enforce the provisions that benefit them.
          </li>
          <li>
            <strong>Relationship.</strong> Nothing in these Terms creates a partnership, joint venture,
            employment, or agency relationship between you and us. Creators are not our employees or
            agents, and we do not control their projects.
          </li>
        </ul>

        <h3 className="text-xl font-semibold mt-8 mb-4">17. Contact Information</h3>
        <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4">
          <p className="font-semibold mb-2">IndieCrowdfund — a DBA of Divinity Comics Inc.</p>
          <p className="mb-1">
            Email:{" "}
            <a href="mailto:support@indiecrowdfund.com" className="text-emerald-600 hover:underline">
              support@indiecrowdfund.com
            </a>
          </p>
          <p>
            Website:{" "}
            <a href="https://www.indiecrowdfund.com" className="text-emerald-600 hover:underline">
              https://www.indiecrowdfund.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
