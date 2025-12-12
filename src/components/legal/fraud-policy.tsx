/* eslint-disable react/no-unescaped-entities */

export function FraudPolicyContent() {
  return (
    <div className="prose prose-zinc dark:prose-invert max-w-none">
      <div className="rounded-lg border bg-white dark:bg-zinc-900 p-6 md:p-8">
        <h2 className="text-2xl font-bold mb-2">Fraud & Misuse Enforcement Policy</h2>
        <p className="text-sm text-zinc-500 mb-8">
          <strong>Last Updated:</strong> November 27, 2025
        </p>

        <p className="mb-4">IndieCrowdfund may take action against:</p>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li>Fraudulent projects</li>
          <li>Misuse of funds</li>
          <li>Identity theft</li>
          <li>Fake accounts</li>
          <li>Harassment or threats</li>
          <li>Use of the platform for illegal activities</li>
          <li>Abuse of refunds or chargebacks</li>
        </ul>

        <p className="mb-4">Possible actions include:</p>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li>Suspension of accounts</li>
          <li>Removal of campaigns</li>
          <li>Freezing payouts</li>
          <li>Banning payment methods</li>
          <li>Reporting to law enforcement</li>
        </ul>

        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 mb-6">
          <p className="text-emerald-800 dark:text-emerald-200 font-medium">
            We take integrity seriously to protect backers and creators.
          </p>
        </div>

        <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4">
          <p className="font-semibold mb-2">Report suspicious activity:</p>
          <p>
            Contact us at{" "}
            <a href="mailto:trust@indiecrowdfund.com" className="text-emerald-600 hover:underline">
              trust@indiecrowdfund.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
