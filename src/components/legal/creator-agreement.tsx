/* eslint-disable react/no-unescaped-entities */

export function CreatorAgreementContent() {
  return (
    <div className="prose prose-zinc dark:prose-invert max-w-none">
      <div className="rounded-lg border bg-white dark:bg-zinc-900 p-6 md:p-8">
        <h2 className="text-2xl font-bold mb-2">Creator Responsibility Agreement</h2>
        <p className="text-sm text-zinc-500 mb-8">
          <strong>Last Updated:</strong> November 27, 2025
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
        </ul>
        <p className="mb-6 font-medium">Silence or abandonment of a campaign violates this agreement.</p>

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

        <h3 className="text-xl font-semibold mt-8 mb-4">7. Previous History</h3>
        <p className="mb-6">
          Your previous history on other crowdfunding sites may be taken into account. We reserve the right to refuse service to anyone, at any time, for any reason.
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
