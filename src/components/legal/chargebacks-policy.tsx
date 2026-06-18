/* eslint-disable react/no-unescaped-entities */

export function ChargebacksPolicyContent() {
  return (
    <div className="prose prose-zinc dark:prose-invert max-w-none">
      <div className="rounded-lg border bg-white dark:bg-zinc-900 p-6 md:p-8">
        <h2 className="text-2xl font-bold mb-2">Chargeback Handling Policy</h2>
        <p className="text-sm text-muted-foreground mb-8">
          <strong>Last Updated:</strong> June 18, 2026
        </p>

        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg p-4 mb-8">
          <p className="font-semibold text-red-700 dark:text-red-300 mb-2">
            Important: Filing a Chargeback = Immediate Permanent Ban
          </p>
          <p className="text-sm text-red-700 dark:text-red-300">
            By pledging on IndieCrowdfund, you agree that crowdfunding is not a
            store. Rewards are not guaranteed and you back at your own risk. If
            you initiate a credit card dispute or chargeback against
            IndieCrowdfund or any of our payment processors, your account will
            be <strong>permanently banned</strong> and you will lose access to
            every project, pledge, and digital download tied to it &mdash; with
            no further refunds, exceptions, or appeals.
          </p>
        </div>

        <h3 className="text-xl font-semibold mt-8 mb-4">1. You Back at Your Own Risk</h3>
        <p className="mb-4">
          IndieCrowdfund is a crowdfunding platform, not a retail store. Our
          Terms of Service make this explicit and you accepted them when you
          created your account:
        </p>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li>Rewards, items, and delivery dates are estimates and are <strong>not guaranteed</strong></li>
          <li>Campaigns may be delayed, scaled back, or fail to deliver entirely</li>
          <li>Your pledge funds a creator's project &mdash; it is not a purchase of a finished good</li>
          <li>The risk of a campaign not delivering as planned is borne by the backer</li>
        </ul>
        <p className="mb-6">
          A delayed, scaled-back, or cancelled campaign is <strong>not</strong>{" "}
          grounds for a chargeback. Period.
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">2. File a Chargeback, Get Banned</h3>
        <p className="mb-4">
          If you initiate a chargeback or credit card dispute against
          IndieCrowdfund or any of our payment processors (Stripe / PayPal /
          Divinity Payments / Whop) on any pledge or marketplace purchase,
          regardless of outcome:
        </p>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li>Your IndieCrowdfund account is <strong>permanently banned</strong> the moment the dispute is filed</li>
          <li>You lose access to all active pledges, completed pledges, digital downloads, and the backer dashboard tied to that account</li>
          <li>Any future accounts created under the same email, payment method, IP, or device fingerprint are also banned</li>
          <li>Outstanding rewards are forfeit &mdash; we will not ship a physical reward, deliver a digital file, or grant any access tied to a disputed account</li>
          <li>The creator gets our full evidence package (pledge timeline, address provided, communications, fulfillment records) and we counter-dispute the chargeback on their behalf</li>
          <li>The ban applies even if the dispute is later withdrawn or won by the cardholder</li>
          <li>There is no appeal process</li>
        </ul>
        <p className="mb-6 font-semibold">
          File = banned. No exceptions, no warnings, no second chances.
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">3. The Only Two Carve-Outs</h3>
        <p className="mb-4">
          The ban applies in every chargeback scenario except these two,
          which are legally required:
        </p>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li>The pledge was actually fraudulent &mdash; your card was used by someone else without your authorization</li>
          <li>A regulator or law enforcement agency directs the dispute</li>
        </ul>
        <p className="mb-6">
          "I changed my mind," "it's taking too long," "the reward looks
          different than the mock-up," "the creator stopped posting updates"
          &mdash; none of these are carve-outs. They are the risks you
          accepted when you pledged.
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">4. The Right Way to Resolve a Complaint</h3>
        <p className="mb-4">
          If something is wrong with your pledge, contact{" "}
          <a href="mailto:support@indiecrowdfund.com" className="text-emerald-600 hover:underline">
            support@indiecrowdfund.com
          </a>{" "}
          or use the in-platform refund-request flow. We can usually resolve
          missing rewards, shipping delays, address changes, and refund
          requests directly. What we cannot do is reverse a bank chargeback
          you have already filed &mdash; only your card issuer can do that,
          and by the time you have filed one, your account is already gone.
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">5. IndieCrowdfund's Role</h3>
        <p className="mb-4">When a chargeback is filed, IndieCrowdfund will:</p>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li>Permanently ban the disputing account within minutes of receiving the dispute notification</li>
          <li>Notify the creator within 24 hours</li>
          <li>Compile and submit the evidence package to the processor</li>
          <li>Counter-dispute the chargeback on the creator's behalf</li>
          <li>Charge the chargeback fee and any lost funds back to the creator's vaulted chargeback card under their Creator Agreement</li>
        </ul>

        <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4">
          <p className="font-semibold mb-2">Questions about a pledge?</p>
          <p>
            <a href="mailto:support@indiecrowdfund.com" className="text-emerald-600 hover:underline">
              support@indiecrowdfund.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
