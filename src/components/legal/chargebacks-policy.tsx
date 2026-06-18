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
            Important: Filing a Chargeback Will Result in an Immediate Permanent Ban
          </p>
          <p className="text-sm text-red-700 dark:text-red-300">
            By pledging on IndieCrowdfund, you agree that crowdfunding is not a
            store. Rewards are not guaranteed and you back at your own risk. If
            you initiate a credit card dispute or chargeback against
            IndieCrowdfund or any of our payment processors instead of
            contacting our support team first, your account will be
            <strong> permanently banned</strong> and you will lose access to
            every project, pledge, and digital download tied to it &mdash; with
            no further refunds, exceptions, or appeals.
          </p>
        </div>

        <h3 className="text-xl font-semibold mt-8 mb-4">1. What Is a Chargeback?</h3>
        <p className="mb-6">
          A chargeback occurs when a backer disputes a pledge with their bank
          or card issuer instead of resolving it directly through
          IndieCrowdfund's support process. Chargebacks impose financial and
          reputational cost on the creator, our payment processors, and the
          platform.
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">2. You Back at Your Own Risk</h3>
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
          grounds for a chargeback. The proper recourse is the refund-request
          flow inside IndieCrowdfund or direct contact with the creator &mdash;
          not a dispute with your card issuer.
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">3. Mandatory Pre-Dispute Contact</h3>
        <p className="mb-4">
          Before disputing any pledge with your bank or card issuer, you{" "}
          <strong>must</strong> first contact{" "}
          <a href="mailto:support@indiecrowdfund.com" className="text-emerald-600 hover:underline">
            support@indiecrowdfund.com
          </a>{" "}
          and give us a reasonable opportunity to resolve the issue. Most
          complaints &mdash; missing rewards, shipping delays, address
          changes, refund requests during the campaign window &mdash; can be
          resolved by our support team within a few business days. Filing a
          chargeback without first contacting us is treated as bad-faith
          conduct.
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">4. Consequences of Filing a Chargeback</h3>
        <p className="mb-4">
          If you initiate a chargeback or credit card dispute against
          IndieCrowdfund or any of our payment processors (Stripe / PayPal /
          Divinity Payments / Whop) on a pledge or marketplace purchase,
          regardless of outcome:
        </p>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li>Your IndieCrowdfund account will be <strong>permanently banned</strong> immediately upon notification of the dispute</li>
          <li>You will lose access to all active pledges, completed pledges, digital downloads, and the backer dashboard tied to that account</li>
          <li>Any future accounts created under the same email, payment method, IP, or device fingerprint will also be banned</li>
          <li>Outstanding rewards under that account are forfeit &mdash; we will not ship a physical reward, deliver a digital file, or grant any access tied to a disputed pledge</li>
          <li>The creator of the disputed campaign will be supplied with our full evidence package (pledge timeline, address provided, communications, fulfillment records) and we will counter-dispute the chargeback on their behalf</li>
          <li>The ban applies even if the dispute is later withdrawn or won by the cardholder</li>
        </ul>
        <p className="mb-6">
          We pursue this policy aggressively because chargeback fraud
          materially harms creators, increases costs for honest backers, and
          jeopardizes our payment-processor relationships that the entire
          platform depends on.
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">5. Legitimate Dispute Cases</h3>
        <p className="mb-4">
          The ban policy in Section 4 does <strong>not</strong> apply where:
        </p>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li>You contacted{" "}
            <a href="mailto:support@indiecrowdfund.com" className="text-emerald-600 hover:underline">
              support@indiecrowdfund.com
            </a>{" "}
            in good faith first and we failed to respond within 14 days
          </li>
          <li>The pledge was actually fraudulent &mdash; your card was used without your authorization</li>
          <li>A regulator or law enforcement directs the dispute</li>
        </ul>
        <p className="mb-6">
          In all other cases, dispute through IndieCrowdfund first.
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">6. IndieCrowdfund's Role</h3>
        <p className="mb-4">When a chargeback is filed, IndieCrowdfund will:</p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li>Notify the creator within 24 hours</li>
          <li>Compile and submit the evidence package to the processor</li>
          <li>Enforce the ban described in Section 4</li>
          <li>Charge the chargeback fee and any lost funds back to the creator's vaulted chargeback card under their Creator Agreement</li>
        </ul>
        <p className="mb-6 font-medium">
          We cannot reverse a bank chargeback on the issuer's side &mdash; only
          the cardholder's bank can withdraw it. But we can and will defend
          creators against bad-faith disputes with the full record of the
          pledge.
        </p>

        <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4">
          <p className="font-semibold mb-2">Questions about chargebacks?</p>
          <p>
            Contact us at{" "}
            <a href="mailto:support@indiecrowdfund.com" className="text-emerald-600 hover:underline">
              support@indiecrowdfund.com
            </a>{" "}
            <strong>before</strong> filing any dispute with your bank.
          </p>
        </div>
      </div>
    </div>
  );
}
