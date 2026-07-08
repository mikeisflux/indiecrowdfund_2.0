/* eslint-disable react/no-unescaped-entities */

export function GdprCcpaPolicyContent() {
  return (
    <div className="prose prose-zinc dark:prose-invert max-w-none">
      <div className="rounded-lg border bg-white dark:bg-zinc-900 p-6 md:p-8">
        <h2 className="text-2xl font-bold mb-2">GDPR + CCPA Addendum</h2>
        <p className="text-sm text-muted-foreground mb-8">
          <strong>Last Updated:</strong> November 28, 2025
        </p>

        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-6 mb-8">
          <p className="text-blue-800 dark:text-blue-200 font-medium text-lg mb-0">
            If you are located in the European Union (GDPR) or California (CCPA), you have specific rights regarding your personal data.
          </p>
        </div>

        <h3 className="text-xl font-semibold mt-8 mb-4">GDPR Rights (EU Users)</h3>
        <p className="mb-4">
          Under the General Data Protection Regulation, EU residents have the following rights:
        </p>
        <ul className="list-disc pl-6 mb-6 space-y-3">
          <li>
            <strong>Access your personal data</strong> — Request a copy of all personal data we hold about you
          </li>
          <li>
            <strong>Request corrections</strong> — Have inaccurate or incomplete data corrected
          </li>
          <li>
            <strong>Request deletion ("right to be forgotten")</strong> — Request that we delete your personal data, subject to legal retention requirements
          </li>
          <li>
            <strong>Restrict processing</strong> — Limit how we use your data in certain circumstances
          </li>
          <li>
            <strong>Download your data (portability)</strong> — Receive your data in a structured, commonly used, machine-readable format
          </li>
          <li>
            <strong>Object to certain uses</strong> — Object to processing based on legitimate interests or for direct marketing purposes
          </li>
        </ul>

        <h3 className="text-xl font-semibold mt-8 mb-4">CCPA Rights (California Users)</h3>
        <p className="mb-4">
          Under the California Consumer Privacy Act, California residents have the following rights:
        </p>
        <ul className="list-disc pl-6 mb-6 space-y-3">
          <li>
            <strong>Know what categories of data we collect</strong> — Request disclosure of the categories and specific pieces of personal information collected
          </li>
          <li>
            <strong>Request deletion</strong> — Request that we delete your personal information, subject to certain exceptions
          </li>
          <li>
            <strong>Know what third parties receive your data</strong> — Request information about categories of third parties with whom we share your data
          </li>
          <li>
            <strong>Opt out of "selling" personal information</strong> — We do not sell user data, but you may submit an opt-out request at any time
          </li>
        </ul>

        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 mb-6">
          <p className="text-emerald-800 dark:text-emerald-200 font-medium">
            We do not discriminate against users who exercise their privacy rights.
          </p>
        </div>

        <h3 className="text-xl font-semibold mt-8 mb-4">How to Exercise Your Rights</h3>
        <p className="mb-4">
          To exercise any of the rights described above, please contact us:
        </p>
        <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4 mb-6">
          <p className="font-semibold mb-2">Privacy Team</p>
          <p className="mb-1">
            📧 Email:{" "}
            <a href="mailto:privacy@indiecrowdfund.com" className="text-emerald-600 hover:underline">
              privacy@indiecrowdfund.com
            </a>
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Please include "GDPR Request" or "CCPA Request" in your subject line for faster processing.
          </p>
        </div>

        <p className="mb-4">
          We will respond to your request within the timeframes required by applicable law:
        </p>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li><strong>GDPR:</strong> Within 30 days (may be extended by 60 days for complex requests)</li>
          <li><strong>CCPA:</strong> Within 45 days (may be extended by an additional 45 days)</li>
        </ul>

        <h3 className="text-xl font-semibold mt-8 mb-4">Verification</h3>
        <p className="mb-6">
          To protect your privacy, we may need to verify your identity before processing your request. We will ask you to provide information that matches records we already have.
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">Authorized Agents</h3>
        <p className="mb-6">
          You may designate an authorized agent to submit requests on your behalf. Agents must provide proof of authorization and we may still require verification directly from you.
        </p>

        <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-6 mt-8">
          <p className="font-semibold text-lg mb-2">Questions about your privacy rights?</p>
          <p>
            Contact our Privacy Team at{" "}
            <a href="mailto:privacy@indiecrowdfund.com" className="text-emerald-600 hover:underline">
              privacy@indiecrowdfund.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
