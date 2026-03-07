 

export function BackerAgreementContent() {
  return (
    <div className="prose prose-zinc dark:prose-invert max-w-none">
      <div className="rounded-lg border bg-white dark:bg-zinc-900 p-6 md:p-8">
        <h2 className="text-2xl font-bold mb-2">Backer Risk Disclosure</h2>
        <p className="text-sm text-zinc-500 mb-8">
          <strong>Last Updated:</strong> November 27, 2025
        </p>

        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-6 mb-8">
          <p className="text-amber-800 dark:text-amber-200 font-medium text-lg mb-0">
            Backing a project on IndieCrowdfund is not a purchase — it is support for a creative process with inherent risks.
          </p>
        </div>

        <p className="mb-6 font-medium text-lg">By backing a project, you acknowledge:</p>

        <h3 className="text-xl font-semibold mt-8 mb-4">A. Final products may differ from early concepts</h3>
        <p className="mb-6">
          Design changes, material substitutions, or process changes may occur.
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">B. Timelines are estimates, not guarantees</h3>
        <p className="mb-4">Delays may occur due to:</p>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li>Manufacturing issues</li>
          <li>Shipping or logistics problems</li>
          <li>Cost increases</li>
          <li>Creative revisions</li>
        </ul>

        <h3 className="text-xl font-semibold mt-8 mb-4">C. Rewards are not guaranteed</h3>
        <p className="mb-6">
          Creators are responsible for fulfilling rewards. IndieCrowdfund is not liable for unfulfilled commitments.
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">D. You may not receive a refund</h3>
        <p className="mb-6">
          Refunds are solely the responsibility of the creator.
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">E. Project failure is possible</h3>
        <p className="mb-6">
          Some projects may not be completed despite good-faith efforts.
        </p>

        <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-6 mt-8">
          <p className="font-semibold text-lg mb-0">
            By pledging, you agree you understand these risks.
          </p>
        </div>
      </div>
    </div>
  );
}
