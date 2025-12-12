/* eslint-disable react/no-unescaped-entities */

export function ChargebacksPolicyContent() {
  return (
    <div className="prose prose-zinc dark:prose-invert max-w-none">
      <div className="rounded-lg border bg-white dark:bg-zinc-900 p-6 md:p-8">
        <h2 className="text-2xl font-bold mb-2">Chargeback Handling Policy</h2>
        <p className="text-sm text-zinc-500 mb-8">
          <strong>Last Updated:</strong> November 27, 2025
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">1. What Is a Chargeback?</h3>
        <p className="mb-6">
          A chargeback occurs when a backer disputes a pledge with their bank or card issuer.
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">2. Consequences of Chargebacks</h3>
        <p className="mb-4">When a backer files a chargeback:</p>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li>Funds are withdrawn from the creator</li>
          <li>The creator must dispute the chargeback</li>
          <li>Excessive chargebacks may freeze a project</li>
          <li>Backers who abuse chargebacks may have accounts restricted</li>
        </ul>

        <h3 className="text-xl font-semibold mt-8 mb-4">3. When Chargebacks Are Appropriate</h3>
        <p className="mb-4">Chargebacks should only be filed if:</p>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li>Fraud is suspected</li>
          <li>Unauthorized transactions occurred</li>
          <li>The creator engaged in clear misconduct</li>
        </ul>

        <h3 className="text-xl font-semibold mt-8 mb-4">4. IndieCrowdfund's Role</h3>
        <p className="mb-4">IndieCrowdfund:</p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li>Cannot reverse bank chargebacks</li>
          <li>Provides documentation to payment processors</li>
          <li>May suspend campaigns with excessive disputes</li>
        </ul>
        <p className="mb-6 font-medium">
          Creators should respond promptly to dispute notifications.
        </p>

        <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4">
          <p className="font-semibold mb-2">Questions about chargebacks?</p>
          <p>
            Contact us at{" "}
            <a href="mailto:support@indiecrowdfund.com" className="text-emerald-600 hover:underline">
              support@indiecrowdfund.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
