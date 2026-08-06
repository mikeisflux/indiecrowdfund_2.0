import { BANK_COUNTRY_OPTIONS } from "@/lib/bank-countries";

// The Divinity Comics Grant Program agreement. Creators must accept this
// before launching a campaign (and before funds are disbursed for campaigns
// that ended without one on file). Bump GRANT_AGREEMENT_VERSION whenever the
// text changes materially — acceptances record the version they signed.
//
// Section 6's eligible-country list renders from BANK_COUNTRY_OPTIONS, the
// same constant that populates the Bank Country dropdown in every
// processor's payout form (DivinityCoin, PayPal, Whop). They must not be
// allowed to drift: a creator who can save a payout account in a country
// the Agreement doesn't cover has signed something that doesn't describe
// their situation. Adding a country to that constant updates this text
// automatically — but the version below still needs a manual bump, since
// the agreement's substance changed.
export const GRANT_AGREEMENT_VERSION = "2026-08-06.1";

export function GrantAgreementContent() {
  return (
    <div className="prose prose-zinc dark:prose-invert max-w-none">
      <div className="rounded-lg border bg-white dark:bg-zinc-900 p-6 md:p-8">
        <h2 className="text-2xl font-bold mb-2">Grant Agreement — Divinity Comics Grant Program</h2>
        <p className="text-sm text-muted-foreground mb-8">
          <strong>Version:</strong> {GRANT_AGREEMENT_VERSION}
        </p>

        <p className="mb-6">
          This Grant Agreement (the &ldquo;Agreement&rdquo;) is between the project creator
          (&ldquo;you,&rdquo; the &ldquo;Grantee&rdquo;) and IndieCrowdfund (a DBA of Divinity Comics Inc.), a
          501(c)(3) nonprofit organization (the &ldquo;Organization&rdquo;), in connection with the
          Divinity Comics Grant Program (the &ldquo;Grant Program&rdquo;), whose purpose is to
          promote western comics and art.
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">1. Nature of the Funds</h3>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li>
            Contributions made by backers through the platform&apos;s payment processors are
            contributions to the Organization in support of the Grant Program.
          </li>
          <li>
            Amounts disbursed to you are a <strong>grant</strong> from the Organization, awarded at
            the Organization&apos;s sole discretion, to support the project described in your
            campaign.
          </li>
          <li>
            The Organization retains a portion of contributions to cover the reasonable
            administrative and facilitation costs of operating the Grant Program, as disclosed
            during project setup.
          </li>
        </ul>

        <h3 className="text-xl font-semibold mt-8 mb-4">2. Use of Grant Funds</h3>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li>You must use grant funds for the project described in your campaign.</li>
          <li>
            Material changes to the project&apos;s scope or purpose must be communicated to your
            backers and to the Organization.
          </li>
        </ul>

        <h3 className="text-xl font-semibold mt-8 mb-4">3. Rewards &amp; Fulfillment Are Yours Alone</h3>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li>
            Any rewards, perks, or add-ons you choose to offer to backers are offered by
            <strong> you</strong>, not by the Organization. You are solely responsible for
            producing, fulfilling, and shipping them.
          </li>
          <li>
            The Organization is not a party to, and has no liability for, any reward commitment you
            make.
          </li>
          <li>
            Any tax consequences arising from the grant or from rewards you provide are solely your
            responsibility. Consult your own tax advisor.
          </li>
        </ul>

        <h3 className="text-xl font-semibold mt-8 mb-4">4. Organization Discretion</h3>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li>
            Grants are awarded at the Organization&apos;s discretion. Approval of a campaign for
            launch constitutes approval of the project for participation in the Grant Program;
            disbursement of funds constitutes the grant award.
          </li>
          <li>
            The Organization may decline, withhold, or claw back a grant where a campaign violates
            the platform&apos;s Terms of Service, Content Guidelines, or applicable law.
          </li>
        </ul>

        <h3 className="text-xl font-semibold mt-8 mb-4">5. Records</h3>
        <p className="mb-6">
          You agree to keep reasonable records of how grant funds were used for the stated project
          and to provide them to the Organization on reasonable request.
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">6. Eligible Grantee Locations</h3>
        <p className="mb-4">
          The Grant Program is open to Grantees who can receive funds at a bank account held in one
          of the following countries. These are the countries supported in the payout setup step of
          campaign creation, across all of the platform&apos;s payment processors:
        </p>
        <ul className="list-disc pl-6 mb-4 space-y-1">
          {BANK_COUNTRY_OPTIONS.map((c) => (
            <li key={c.value}>
              {c.label} ({c.value})
            </li>
          ))}
        </ul>
        <p className="mb-4">
          This Agreement applies in full to Grantees in every country listed above. The Organization
          may add or remove supported countries at any time; the list shown here is the list in
          effect for your campaign.
        </p>
        <p className="mb-6">
          You represent that the payout account you provide is held in your name (or in the name of
          the legal entity identified during campaign setup) at an institution in one of these
          countries, and that you are legally permitted to receive the grant there.
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">7. Cross-Border Grants, Currency &amp; Transfer Costs</h3>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li>
            The Organization is a United States nonprofit. Grants to Grantees outside the United
            States are international transfers and are made in accordance with U.S. law and the
            requirements of the Organization&apos;s payment processors and banking partners.
          </li>
          <li>
            Contributions are collected in the campaign&apos;s stated currency. Where the grant is
            paid into an account denominated in a different currency, conversion is performed by the
            payment processor or receiving bank at their prevailing rate. The Organization does not
            set, control, or guarantee that rate.
          </li>
          <li>
            Intermediary bank fees, correspondent-bank charges, and receiving-bank fees applied to
            an international transfer are borne by the Grantee and may reduce the amount that
            arrives in your account.
          </li>
          <li>
            Transfer timelines for international payouts are set by the banking system and may
            exceed those for domestic payouts.
          </li>
        </ul>

        <h3 className="text-xl font-semibold mt-8 mb-4">8. Taxes, Withholding &amp; Local Law</h3>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li>
            You are solely responsible for determining, reporting, and paying any tax arising from
            the grant under the laws of your own country and any other jurisdiction that applies to
            you. This includes income tax, value-added tax or goods-and-services tax, customs and
            import duties on rewards you ship, and any social or self-employment contributions.
          </li>
          <li>
            The Organization does not provide tax advice and makes no representation that a grant is
            tax-free, deductible, or exempt in your jurisdiction. Consult your own tax advisor.
          </li>
          <li>
            You agree to provide any tax documentation, identification, or certification the
            Organization is required to collect &mdash; including U.S. information-reporting and
            withholding forms applicable to non-U.S. persons. The Organization may withhold amounts
            required by law and may withhold a grant entirely until required documentation is
            provided.
          </li>
          <li>
            You are responsible for complying with the laws of your own country regarding
            crowdfunding, consumer protection, advertising, refunds, and the sale or shipment of the
            rewards you offer.
          </li>
        </ul>

        <h3 className="text-xl font-semibold mt-8 mb-4">9. Sanctions &amp; Compliance</h3>
        <p className="mb-6">
          You represent that you are not located in, ordinarily resident in, or organized under the
          laws of any country or territory subject to comprehensive sanctions administered by the
          U.S. Office of Foreign Assets Control (OFAC), and that you are not a person or entity on
          any U.S. restricted-party list. The Organization may decline, suspend, or reverse a grant
          where making it would violate applicable sanctions, anti-money-laundering, or
          counter-terrorism-financing law.
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">10. Governing Law</h3>
        <p className="mb-6">
          This Agreement is governed by the laws of the State of Indiana, United States, without
          regard to conflicts of law principles, regardless of the Grantee&apos;s country of
          residence. Nothing in this Agreement removes any non-waivable right you hold under the
          mandatory consumer or employment law of your own country.
        </p>

        <p className="mb-2 font-medium">
          By accepting this Agreement you acknowledge that funds you receive are a grant from
          IndieCrowdfund (a DBA of Divinity Comics Inc.) under the Grant Program, that you are solely
          responsible for any rewards and their fulfillment, that you will use the funds for the
          project described, and that you are solely responsible for any tax arising from the grant
          in your own country.
        </p>
      </div>
    </div>
  );
}
