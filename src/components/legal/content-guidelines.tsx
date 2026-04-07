 

export function ContentGuidelinesContent() {
  return (
    <div className="prose prose-zinc dark:prose-invert max-w-none">
      <div className="rounded-lg border bg-white dark:bg-zinc-900 p-6 md:p-8">
        <h2 className="text-2xl font-bold mb-2">Community Guidelines</h2>
        <p className="text-sm text-muted-foreground mb-8">
          <strong>Last Updated:</strong> November 27, 2025
        </p>

        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-6 mb-8">
          <p className="text-emerald-800 dark:text-emerald-200 font-medium text-lg mb-0">
            IndieCrowdfund is a place for creativity, collaboration, and respect.
          </p>
        </div>

        <h3 className="text-xl font-semibold mt-8 mb-4">Users May Not:</h3>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li>Harass, bully, or threaten others</li>
          <li>Discriminate or promote hate</li>
          <li>Post sexually explicit content (except within platform-allowed categories)</li>
          <li>Promote violence, weapons, or harmful activities</li>
          <li>Misrepresent identity</li>
          <li>Spam or solicit unrelated products/services</li>
          <li>Post copyrighted content without permission</li>
        </ul>

        <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-6 mt-8">
          <p className="font-semibold text-lg mb-0">
            Be respectful and constructive in discussions and updates.
          </p>
        </div>

        <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4 mt-8">
          <p className="font-semibold mb-2">Report community violations:</p>
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
