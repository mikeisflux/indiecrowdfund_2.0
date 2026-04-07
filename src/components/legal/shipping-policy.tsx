 

export function ShippingPolicyContent() {
  return (
    <div className="prose prose-zinc dark:prose-invert max-w-none">
      <div className="rounded-lg border bg-white dark:bg-zinc-900 p-6 md:p-8">
        <h2 className="text-2xl font-bold mb-2">Shipping & Rewards Policy</h2>
        <p className="text-sm text-muted-foreground mb-8">
          <strong>Last Updated:</strong> November 27, 2025
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">1. Who Handles Shipping</h3>
        <p className="mb-4">Creators are solely responsible for:</p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li>Packaging</li>
          <li>Shipping</li>
          <li>Tracking</li>
          <li>Customs forms</li>
          <li>Lost package claims</li>
        </ul>
        <p className="mb-6 font-medium">IndieCrowdfund does not ship or handle rewards.</p>

        <h3 className="text-xl font-semibold mt-8 mb-4">2. Shipping Fees</h3>
        <p className="mb-4">
          Creators must list shipping fees clearly before campaign launch.
        </p>
        <p className="mb-6">
          If shipping costs increase, creators are responsible for covering the difference.
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">3. Digital Rewards</h3>
        <p className="mb-4">Creators must ensure digital rewards:</p>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li>Are delivered via secure links or downloads</li>
          <li>Remain accessible for a reasonable period</li>
          <li>Are not used to distribute harmful or infringing content</li>
        </ul>

        <h3 className="text-xl font-semibold mt-8 mb-4">4. Missing or Damaged Rewards</h3>
        <p className="mb-4">Creators must:</p>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li>Replace damaged items</li>
          <li>Re-ship missing rewards</li>
          <li>Provide reasonable solutions for international issues</li>
        </ul>

        <h3 className="text-xl font-semibold mt-8 mb-4">5. Address Collection</h3>
        <p className="mb-4">
          Backers must provide accurate shipping information.
        </p>
        <p className="mb-6">
          Creators may request updated addresses before shipment.
        </p>

        <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4">
          <p className="font-semibold mb-2">Questions about shipping or rewards?</p>
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
