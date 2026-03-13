/* eslint-disable react/no-unescaped-entities */

export function TermsOfServiceContent() {
  return (
    <div className="prose prose-zinc dark:prose-invert max-w-none">
      <div className="rounded-lg border bg-white dark:bg-zinc-900 p-6 md:p-8">
        <h2 className="text-2xl font-bold mb-2">IndieCrowdfund — Terms of Service</h2>
        <p className="text-sm text-zinc-500 mb-8">
          <strong>Last Updated:</strong> March 13, 2026
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
        <p className="mb-6">
          We are not a store, a bank, or an investment service. We provide tools; creators are responsible for their own projects and for fulfilling commitments made to backers.
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

        <h3 className="text-xl font-semibold mt-8 mb-4">6. Fees and Payments</h3>
        <p className="mb-4">
          IndieCrowdfund charges platform and processing fees for funded projects. Fees are disclosed during project setup and may vary by region.
        </p>
        <p className="mb-4">Creators authorize IndieCrowdfund and its payment partners to:</p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li>Collect funds from backers</li>
          <li>Deduct platform and processing fees</li>
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
          <li><strong>Payment Account Verification:</strong> Creators must complete Stripe Connect Express onboarding (US-based identity verification, SSN/Tax ID, and US bank account) or equivalent verification through our alternative payment processor.</li>
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

        <h3 className="text-xl font-semibold mt-8 mb-4">8. Prohibited Activities</h3>
        <p className="mb-4">Users may not:</p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li>Break any laws while using the platform</li>
          <li>Launch fraudulent or misleading projects</li>
          <li>Abuse, harass, or impersonate others</li>
          <li>Use the platform to launder money or engage in financial misconduct</li>
          <li>Upload malware, attempt hacks, or disrupt platform operations</li>
          <li>Use IndieCrowdfund to fund prohibited items (weapons, hate material, adult services, etc.)</li>
        </ul>
        <p className="mb-6 font-medium">Violations may result in account termination.</p>

        <h3 className="text-xl font-semibold mt-8 mb-4">9. Intellectual Property</h3>
        <p className="mb-4">
          Creators retain ownership of their content but grant IndieCrowdfund a limited license to:
        </p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li>Host, display, and distribute project content</li>
          <li>Promote and market the project on-site or via social channels</li>
          <li>Archive project pages permanently after campaigns end</li>
        </ul>
        <p className="mb-6">Users may not copy, steal, or misuse other creators' content.</p>

        <h3 className="text-xl font-semibold mt-8 mb-4">10. Platform Rights</h3>
        <p className="mb-4">IndieCrowdfund may:</p>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li>Remove content that violates these Terms</li>
          <li>Suspend or terminate accounts</li>
          <li>Modify or update the Services</li>
          <li>Interrupt access for maintenance or system upgrades</li>
          <li>Refuse service at our discretion</li>
        </ul>

        <h3 className="text-xl font-semibold mt-8 mb-4">11. Disclaimers</h3>
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

        <h3 className="text-xl font-semibold mt-8 mb-4">12. Limitation of Liability</h3>
        <p className="mb-4">To the fullest extent permitted by law:</p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li>IndieCrowdfund is not liable for losses related to project failures, disputes, delays, or unfulfilled rewards</li>
          <li>Our total aggregate liability shall not exceed the fees paid to IndieCrowdfund in the prior 12 months</li>
        </ul>
        <p className="mb-6">
          Some jurisdictions do not allow certain limitations; in such cases, the limitations apply to the maximum extent allowed.
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">13. Dispute Resolution</h3>
        <p className="mb-4">
          You agree to resolve disputes through binding arbitration, not in court. Class actions are waived. Local consumer rights may apply based on your jurisdiction.
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">14. Governing Law</h3>
        <p className="mb-6">
          These Terms are governed by the laws of the State of Indiana, without regard to conflicts of law.
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">15. Changes to These Terms</h3>
        <p className="mb-6">
          We may update these Terms at any time. We will notify users by email or website notice. Continued use after changes means you accept the updated Terms.
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">16. Contact Information</h3>
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
