/* eslint-disable react/no-unescaped-entities */

import Link from "next/link";

export function TermsOfServiceContent() {
  return (
    <div className="prose prose-zinc dark:prose-invert max-w-none">
      <div className="rounded-lg border bg-white dark:bg-zinc-900 p-6 md:p-8">
        <h2 className="text-2xl font-bold mb-2">IndieCrowdfund — Terms of Service</h2>
        <p className="text-sm text-muted-foreground mb-8">
          <strong>Last Updated:</strong> May 17, 2026
        </p>

        <p className="mb-6">
          Welcome to IndieCrowdfund.com, a crowdfunding and project-launch platform operated by IndieCrowdfund, Inc. ("IndieCrowdfund," "we," "our," or "us"). These Terms of Service ("Terms") govern your access to and use of IndieCrowdfund.com, our services, applications, and related tools (collectively, the "Services").
        </p>

        <p className="mb-8 font-medium">
          By accessing or using the Services, you agree to be bound by these Terms. If you do not agree, you may not use IndieCrowdfund.
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">1. What IndieCrowdfund Is</h3>
        <p className="mb-4">
          IndieCrowdfund is a platform where creators can publish projects, raise funding, offer rewards, and communicate with supporters ("Backers"). IndieCrowdfund facilitates these interactions but does not itself run or guarantee the success of any project.
        </p>
        <p className="mb-4">
          We are not a store, a bank, or an investment service. We provide tools; creators are responsible for their own projects and for fulfilling commitments made to backers.
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
          <li>They are funding a creative process—not purchasing a guaranteed product</li>
          <li>They understand that delays, changes, or cancellations are possible</li>
          <li>They may be entitled to refunds only at the creator's discretion unless required by law</li>
          <li>They agree to read the full project description and associated risks</li>
        </ul>
        <p className="mb-6">IndieCrowdfund is not responsible for disputes between creators and backers.</p>

        <h3 className="text-xl font-semibold mt-8 mb-4">5a. Chargebacks &mdash; Immediate Permanent Ban</h3>
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg p-4 mb-6">
          <p className="text-red-700 dark:text-red-300 font-semibold mb-2">
            File a chargeback = banned. No appeals.
          </p>
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
            for a chargeback. The only carve-outs are actual unauthorized-use
            fraud (your card was used by someone else) and regulator /
            law-enforcement directives. See the full{" "}
            <a href="/terms?tab=chargebacks" className="underline">
              Chargeback Handling Policy
            </a>
            .
          </p>
        </div>

        <h3 className="text-xl font-semibold mt-8 mb-4">6. Fees, Payments, and Campaign Types</h3>
        <p className="mb-4">
          IndieCrowdfund charges platform and processing fees for funded projects. Fees are disclosed during project setup and may vary by region.
        </p>
        <p className="mb-4">
          Creators may choose between two campaign funding models:
        </p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li><strong>All or Nothing:</strong> Funds are only collected if the campaign reaches its stated funding goal by the deadline. If the goal is not reached, no money changes hands and backers are not charged.</li>
          <li><strong>Keep It All:</strong> The creator keeps all pledges regardless of whether the funding goal is reached. Backers are charged immediately at the time of their pledge.</li>
        </ul>
        <p className="mb-4">Creators authorize IndieCrowdfund and its payment partners to:</p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li>Collect funds from backers</li>
          <li>Deduct platform and processing fees</li>
          <li>Hold a rolling reserve where applicable (see below)</li>
          <li>Transfer net funds to the creator</li>
        </ul>

        <p className="mb-6">
          Creators are responsible for all taxes, shipping costs, duties, and regulatory compliance.
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">7. Creator Verification & Due Diligence</h3>
        <p className="mb-4">
          IndieCrowdfund conducts thorough due diligence on all creators before approving campaigns. Our verification process includes:
        </p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li><strong>Identity Verification:</strong> New creators must provide a valid government-issued photo ID and a legitimate business filing from their state Secretary of State office. Returning creators with verified accounts may be exempt from re-submission.</li>
          <li><strong>Social Media & Online Presence Audit:</strong> We log and verify all social media accounts linked to the creator. Our team searches other crowdfunding platforms (Kickstarter, Indiegogo, GoFundMe, etc.) to review the creator&apos;s previous campaign history.</li>
          <li><strong>Fulfillment History Review:</strong> We review backer comments, reviews, and public feedback on all prior campaigns across all platforms. We contact creators directly when discrepancies or concerns are identified.</li>
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
        <p className="mb-6">Users may not copy, steal, or misuse other creators' content.</p>

        <h3 className="text-xl font-semibold mt-8 mb-4">11. Platform Rights</h3>
        <p className="mb-4">IndieCrowdfund may:</p>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li>Remove content that violates these Terms</li>
          <li>Suspend or terminate accounts</li>
          <li>Modify or update the Services</li>
          <li>Interrupt access for maintenance or system upgrades</li>
          <li>Refuse service at our discretion</li>
        </ul>

        <h3 className="text-xl font-semibold mt-8 mb-4">12. Disclaimers</h3>
        <p className="mb-4 font-medium">IndieCrowdfund is provided "as is" without warranties.</p>
        <p className="mb-4">We do not guarantee:</p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li>Project success</li>
          <li>Creator performance</li>
          <li>Reward delivery</li>
          <li>Platform uptime</li>
          <li>Accuracy of user-submitted information</li>
        </ul>
        <p className="mb-6 font-medium">Use the platform at your own risk.</p>

        <h3 className="text-xl font-semibold mt-8 mb-4">13. Limitation of Liability</h3>
        <p className="mb-4">To the fullest extent permitted by law:</p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li>IndieCrowdfund is not liable for losses related to project failures, disputes, delays, or unfulfilled rewards</li>
          <li>Our total aggregate liability shall not exceed the fees paid to IndieCrowdfund in the prior 12 months</li>
        </ul>
        <p className="mb-6">
          Some jurisdictions do not allow certain limitations; in such cases, the limitations apply to the maximum extent allowed.
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">14. Dispute Resolution</h3>
        <p className="mb-4">
          You agree to resolve disputes through binding arbitration, not in court. Class actions are waived. Local consumer rights may apply based on your jurisdiction.
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">15. Governing Law</h3>
        <p className="mb-6">
          These Terms are governed by the laws of the State of Indiana, without regard to conflicts of law.
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">16. Changes to These Terms</h3>
        <p className="mb-6">
          We may update these Terms at any time. We will notify users by email or website notice. Continued use after changes means you accept the updated Terms.
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">17. Contact Information</h3>
        <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4">
          <p className="font-semibold mb-2">IndieCrowdfund, Inc.</p>
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
