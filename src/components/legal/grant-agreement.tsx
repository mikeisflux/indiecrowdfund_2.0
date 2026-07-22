// The Divinity Comics Grant Program agreement. Creators must accept this
// before launching a campaign (and before funds are disbursed for campaigns
// that ended without one on file). Bump GRANT_AGREEMENT_VERSION whenever the
// text changes materially — acceptances record the version they signed.
export const GRANT_AGREEMENT_VERSION = "2026-07-22.2";

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

        <p className="mb-2 font-medium">
          By accepting this Agreement you acknowledge that funds you receive are a grant from
          IndieCrowdfund (a DBA of Divinity Comics Inc.) under the Grant Program, that you are solely
          responsible for any rewards and their fulfillment, and that you will use the funds for
          the project described.
        </p>
      </div>
    </div>
  );
}
