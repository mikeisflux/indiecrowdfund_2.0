/* eslint-disable react/no-unescaped-entities */

export function DmcaPolicyContent() {
  return (
    <div className="prose prose-zinc dark:prose-invert max-w-none">
      <div className="rounded-lg border bg-white dark:bg-zinc-900 p-6 md:p-8">
        <h2 className="text-2xl font-bold mb-2">DMCA / Intellectual Property Policy</h2>
        <p className="text-sm text-zinc-500 mb-8">
          <strong>Last Updated:</strong> November 27, 2025
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">1. Reporting Infringement</h3>
        <p className="mb-4">
          If you believe your copyrighted work is being infringed, send a DMCA notice to:
        </p>
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 mb-6">
          <p className="text-emerald-800 dark:text-emerald-200 font-medium">
            📧{" "}
            <a href="mailto:dmca@indiecrowdfund.com" className="text-emerald-600 hover:underline">
              dmca@indiecrowdfund.com
            </a>
          </p>
        </div>

        <p className="mb-4 font-medium">Include:</p>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li>Your contact information</li>
          <li>Description of the copyrighted work</li>
          <li>URL of the infringing content</li>
          <li>A statement under penalty of perjury</li>
          <li>Your electronic signature</li>
        </ul>

        <h3 className="text-xl font-semibold mt-8 mb-4">2. Counter-Notification</h3>
        <p className="mb-6">
          If content is removed in error, creators may submit a counter-notice.
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">3. Repeat Infringers</h3>
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-800 dark:text-red-200 font-medium">
            Accounts with repeated copyright violations may be terminated.
          </p>
        </div>

        <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4 mt-8">
          <p className="font-semibold mb-2">DMCA inquiries:</p>
          <p>
            Contact us at{" "}
            <a href="mailto:dmca@indiecrowdfund.com" className="text-emerald-600 hover:underline">
              dmca@indiecrowdfund.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
