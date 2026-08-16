 

export function CreatorAgreementContent() {
  return (
    <div className="prose prose-zinc dark:prose-invert max-w-none">
      <div className="rounded-lg border bg-white dark:bg-zinc-900 p-6 md:p-8">
        <h2 className="text-2xl font-bold mb-2">Creator Responsibility Agreement</h2>
        <p className="text-sm text-muted-foreground mb-8">
          <strong>Last Updated:</strong> August 16, 2026
        </p>

        <p className="mb-8 font-medium">
          Creators using IndieCrowdfund agree to the following responsibilities:
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">1. Accuracy & Transparency</h3>
        <p className="mb-4">Creators must:</p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li>Provide truthful and complete project descriptions</li>
          <li>Disclose risks, challenges, and realistic timelines</li>
          <li>Use funds only for the project described</li>
        </ul>
        <p className="mb-6 font-medium">Misleading or fraudulent campaigns are prohibited.</p>

        <h3 className="text-xl font-semibold mt-8 mb-4">2. Reward Fulfillment</h3>
        <p className="mb-4">If a campaign is successfully funded, creators must:</p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li>Produce and deliver rewards as described</li>
          <li>Communicate delays, design changes, or setbacks openly</li>
          <li>Provide updates until rewards are fully delivered</li>
        </ul>
        <p className="mb-6">
          Creators assume full responsibility for shipping costs, taxes, customs duties, and inventory management.
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">3. Use of Funds</h3>
        <p className="mb-4">Funds raised must be used exclusively for:</p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li>Development of the project</li>
          <li>Production and shipment of rewards</li>
          <li>Project-related costs disclosed to backers</li>
        </ul>
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-800 dark:text-red-200 font-medium">
            Misuse of funds can result in account suspension or legal referral.
          </p>
        </div>

        <h3 className="text-xl font-semibold mt-8 mb-4">4. Communication</h3>
        <p className="mb-4">Creators must maintain active communication by:</p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li>Posting meaningful updates</li>
          <li>Responding to backer messages</li>
          <li>Informing backers promptly if plans change</li>
          <li>Notifying IndieCrowdfund if a backer cannot be reached, so that we may attempt to contact them</li>
        </ul>
        <p className="mb-4 font-medium">Silence or abandonment of a campaign violates this agreement.</p>
        <p className="mb-6">
          We reserve the right to contact any creator by any means we see fit. Failure to respond to any
          communication will be considered campaign abandonment and will be dealt with accordingly.
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">5. Failure to Complete a Project</h3>
        <p className="mb-4">If a creator cannot complete a project, they must:</p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li>Explain what happened</li>
          <li>Provide a plan to remedy the situation</li>
          <li>Offer refunds or partial refunds when feasible</li>
          <li>Distribute any remaining assets or prototypes to backers where possible</li>
          <li>Demonstrate a good-faith attempt to fulfill obligations</li>
        </ul>
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-6">
          <p className="text-amber-800 dark:text-amber-200 font-medium">
            Creators who fail to act responsibly may be removed from the platform.
          </p>
        </div>

        <h3 className="text-xl font-semibold mt-8 mb-4">6. Legal Compliance</h3>
        <p className="mb-4">Creators are responsible for:</p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li>All taxes</li>
          <li>Business licenses</li>
          <li>Regulatory requirements for their product category</li>
          <li>Age restrictions, safety certifications, or other required disclosures</li>
        </ul>
        <p className="mb-6 font-medium">Creators must not use IndieCrowdfund to violate any law.</p>

        <h3 className="text-xl font-semibold mt-8 mb-4">7. Identity Verification & Due Diligence</h3>
        <p className="mb-4">Before launching a campaign, creators must complete our verification process. Review does not stop at approval — we continue to review creators and their campaigns while those campaigns are running:</p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li><strong>New Creators:</strong> Must provide a valid government-issued photo ID and a legitimate business filing from their state&apos;s Secretary of State office</li>
          <li><strong>Social Media Verification:</strong> All linked social media accounts are logged and verified by our team</li>
          <li><strong>Cross-Platform Audit:</strong> We search other crowdfunding platforms (Kickstarter, Indiegogo, GoFundMe, etc.) to review your campaign history — completed campaigns and any you are currently running, on this platform or elsewhere — including backer reviews, comments, and public feedback</li>
          <li><strong>Fulfillment History Validation:</strong> We contact creators directly when discrepancies or concerns are identified during our review, whether the campaign in question has ended or is still running. We reserve the right to contact any creator by any means we see fit. Failure to respond to any communication will be considered campaign abandonment and will be dealt with accordingly.</li>
          <li><strong>Payment Verification:</strong> Adding a valid PayPal payout email (standard campaigns), or completing Divinity Payments bank account setup (NSFW/adult campaigns), or connecting a Whop account (Whop-processed campaigns) to receive payouts.</li>
        </ul>
        <p className="mb-4 font-medium">All verification findings, correspondence, and review decisions are documented internally and retained for compliance purposes.</p>
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-800 dark:text-red-200 font-medium mb-2">Automatic Disqualification</p>
          <p className="text-red-700 dark:text-red-300 text-sm mb-2">
            Creators are automatically disqualified from launching on IndieCrowdfund if:
          </p>
          <ul className="list-disc pl-6 text-red-700 dark:text-red-300 text-sm space-y-1">
            <li>They have <strong>three or more unfulfilled campaigns</strong> on any crowdfunding platform</li>
            <li>They have <strong>any campaign that is more than one year past its stated delivery date</strong>, regardless of current fulfillment status</li>
          </ul>
        </div>

        <h3 className="text-xl font-semibold mt-8 mb-4">8. Campaign History</h3>
        <p className="mb-6">
          Your history on other crowdfunding sites will be thoroughly reviewed as part of our verification
          process. This includes campaigns you are running right now, on this platform or any other, as well
          as campaigns you have run in the past. We reserve the right to refuse service to anyone, at any
          time, for any reason.
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">9. Group Affiliations & Organized Harassment</h3>
        <p className="mb-4">
          IndieCrowdfund does not host creators who take part in organized campaigns of harassment against
          other creators, industry professionals, or members of the public. This is a rule about conduct —
          coordinated abuse, intimidation, threats, doxxing, and circulated blacklists — and not about a
          creator&apos;s politics, opinions about the industry, or criticism of any company or its work.
        </p>
        <p className="mb-4">
          As part of the verification described in Section 7, creators must disclose current affiliations
          with organized online groups, movements, or collectives operating in the comics space. We may also
          identify affiliations from public sources during that review.
        </p>
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
          <p className="text-red-800 dark:text-red-200 font-medium mb-2">
            Creators currently affiliated with the online group known as &quot;Comicsgate&quot; are not
            eligible to launch campaigns on IndieCrowdfund.
          </p>
          <p className="text-red-700 dark:text-red-300 text-sm mb-2">
            Comicsgate is an organized harassment campaign in the comics industry, documented as directing
            racist, sexist, and threatening abuse at creators and industry professionals and as circulating
            blacklists of people to target. Participation in it falls squarely within the conduct prohibited
            above, and we name it here so there is no ambiguity about where we stand.
          </p>
          <p className="text-red-700 dark:text-red-300 text-sm mb-0">
            For this purpose, affiliation means currently identifying yourself with the group in public,
            presenting a campaign, its rewards, or its branding under that banner, or acting as an organizer
            or promoter for it. Past association a creator has since left is not, on its own, a
            disqualification.
          </p>
        </div>
        <p className="mb-6">
          This section applies equally to any other group engaged in the same conduct, whether or not it is
          named here. Misrepresenting or concealing an affiliation covered by this section is grounds for
          removal from the platform under Section 7, in addition to our general right to refuse service
          described in Section 8.
        </p>

        <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4">
          <p className="font-semibold mb-2">Questions about creator responsibilities?</p>
          <p>
            Contact us at{" "}
            <a href="mailto:creators@indiecrowdfund.com" className="text-emerald-600 hover:underline">
              creators@indiecrowdfund.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
