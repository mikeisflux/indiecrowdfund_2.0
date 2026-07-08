 

export function CookiePolicyContent() {
  return (
    <div className="prose prose-zinc dark:prose-invert max-w-none">
      <div className="rounded-lg border bg-white dark:bg-zinc-900 p-6 md:p-8">
        <h2 className="text-2xl font-bold mb-2">Cookie Policy</h2>
        <p className="text-sm text-muted-foreground mb-8">
          <strong>Last Updated:</strong> November 27, 2025
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">IndieCrowdfund Uses Cookies For:</h3>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li>Site functionality</li>
          <li>Login sessions</li>
          <li>Analytics</li>
          <li>Fraud prevention</li>
          <li>User preferences</li>
        </ul>

        <h3 className="text-xl font-semibold mt-8 mb-4">Managing Cookies</h3>
        <p className="mb-4">
          Users can control cookies through browser settings.
        </p>
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-6">
          <p className="text-amber-800 dark:text-amber-200 font-medium">
            Disabling cookies may affect functionality.
          </p>
        </div>

        <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4">
          <p className="font-semibold mb-2">Questions about cookies?</p>
          <p>
            Contact us at{" "}
            <a href="mailto:privacy@indiecrowdfund.com" className="text-emerald-600 hover:underline">
              privacy@indiecrowdfund.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
