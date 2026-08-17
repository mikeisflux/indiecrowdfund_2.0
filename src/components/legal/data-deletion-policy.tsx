/* eslint-disable react/no-unescaped-entities */

import Link from "next/link";

export function DataDeletionPolicyContent() {
  return (
    <div className="prose prose-zinc dark:prose-invert max-w-none">
      <div className="rounded-lg border bg-white dark:bg-zinc-900 p-6 md:p-8">
        <h2 className="text-2xl font-bold mb-2">IndieCrowdfund — Data Deletion Policy</h2>
        <p className="text-sm text-muted-foreground mb-8">
          <strong>Last Updated:</strong> August 17, 2026
        </p>

        <p className="mb-6">
          This Data Deletion Policy explains how IndieCrowdfund, a DBA of Divinity Comics Inc. ("IndieCrowdfund," "we," "our," "us") handles requests to delete personal data and accounts on IndieCrowdfund.com. This Policy is part of our Privacy Policy and applies to all users, including creators and backers.
        </p>

        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 mb-8">
          <p className="text-emerald-800 dark:text-emerald-200 font-medium">
            We are committed to protecting user privacy and complying with all applicable data laws, including GDPR, CCPA, and other international standards.
          </p>
        </div>

        <h3 className="text-xl font-semibold mt-8 mb-4">1. Your Right to Request Data Deletion</h3>
        <p className="mb-4">Users may request deletion of:</p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li>Account information (name, email, profile)</li>
          <li>Login credentials</li>
          <li>Optional demographic information</li>
          <li>AI personalization and analytics data</li>
          <li>Saved preferences and settings</li>
          <li>Connected social login data</li>
          <li>Support interactions and communications metadata</li>
        </ul>
        <p className="mb-6 font-medium">Deletion requests may require identity verification to prevent unauthorized access.</p>

        <h3 className="text-xl font-semibold mt-8 mb-4">2. What Happens When You Request Deletion</h3>
        <p className="mb-4">When you request account deletion, IndieCrowdfund will:</p>

        <h4 className="text-lg font-semibold mt-6 mb-3">A. Delete Completely</h4>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li>Your user account</li>
          <li>Login and authentication data</li>
          <li>Contact information</li>
          <li>Notification and marketing preferences</li>
          <li>Optional profile details</li>
          <li>AI personalization data</li>
          <li>Non-essential analytics data</li>
          <li>Social login connections</li>
        </ul>

        <h4 className="text-lg font-semibold mt-6 mb-3">B. Anonymize</h4>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li>Comments on public project pages</li>
          <li>Creator updates that were posted publicly</li>
          <li>Project drafts or unpublished campaign content</li>
          <li>Backing history (replaced with a non-identifiable token)</li>
        </ul>

        <h4 className="text-lg font-semibold mt-6 mb-3">C. Retain (Temporarily or Permanently)</h4>
        <p className="mb-2">Certain data must be retained due to:</p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li>Financial, tax, and regulatory obligations</li>
          <li>Anti-fraud and security requirements</li>
          <li>Platform integrity and safety obligations</li>
          <li>Historical archiving requirements</li>
        </ul>
        <p className="mb-2">Examples include:</p>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li>Transaction logs (pseudonymized)</li>
          <li>Chargeback and payout records</li>
          <li>Fraud or abuse investigations</li>
          <li>Project pages (public archive)</li>
        </ul>

        <h3 className="text-xl font-semibold mt-8 mb-4">3. Permanent Nature of Deletion</h3>
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
          <p className="text-red-800 dark:text-red-200 font-medium">
            Account deletion is permanent and cannot be undone.
          </p>
        </div>
        <p className="mb-2">Deletion includes:</p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li>Loss of access to backed projects</li>
          <li>Removal from backer-only areas</li>
          <li>Loss of access to messages</li>
          <li>Loss of access to creator tools</li>
        </ul>
        <p className="mb-6 font-medium">Once deleted, your account cannot be restored.</p>

        <h3 className="text-xl font-semibold mt-8 mb-4">4. Impact on Backed Projects and Rewards</h3>
        <p className="mb-4">By deleting your account, you acknowledge and agree to the following:</p>

        <h4 className="text-lg font-semibold mt-6 mb-3">A. All Creator Obligations Immediately End</h4>
        <p className="mb-2">When your account is deleted:</p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li>Creators are no longer required to fulfill any rewards owed to you</li>
          <li>Creators may stop shipments, digital deliveries, or communications</li>
          <li>Creators are released from all commitments associated with your pledge</li>
        </ul>
        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400 italic">
          This is necessary because we cannot verify identity, shipping information, eligibility, or reward status after your account is removed.
        </p>

        <h4 className="text-lg font-semibold mt-6 mb-3">B. You Voluntarily Forfeit All Rewards</h4>
        <p className="mb-2">Deletion of your account results in:</p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li>Loss of all rewards from active or completed projects</li>
          <li>Loss of rights to future reward updates, tracking, or shipments</li>
          <li>Loss of all backer privileges</li>
          <li>Loss of digital downloads associated with your pledges</li>
        </ul>
        <p className="mb-4 font-medium">Rewards cannot be retrieved, transferred, or honored once deletion is completed.</p>

        <h4 className="text-lg font-semibold mt-6 mb-3">C. Waiver of Refunds, Chargebacks, and Legal Remedies</h4>
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4">
          <p className="font-semibold mb-2 text-amber-800 dark:text-amber-200">By deleting your account, you voluntarily and irrevocably waive:</p>
          <ul className="list-disc pl-6 space-y-1 text-amber-700 dark:text-amber-300">
            <li>Refunds or partial refunds</li>
            <li>Chargebacks or bank disputes</li>
            <li>Payment processor claims</li>
            <li>Legal demands against creators</li>
            <li>Legal claims against IndieCrowdfund</li>
            <li>Any compensation related to incomplete or failed projects</li>
            <li>Any recourse relating to reward delivery</li>
          </ul>
        </div>
        <p className="mb-4 font-medium">This waiver applies to all past and current pledges.</p>

        <h4 className="text-lg font-semibold mt-6 mb-3">D. Deletion Is Considered a Full Release</h4>
        <p className="mb-2">Submitting a deletion request acts as a:</p>
        <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-4 mb-4">
          <p className="font-medium">
            Complete and voluntary release of all rights, claims, entitlements, disputes, and expectations related to rewards, creators, pledges, communications, and all project-related interactions.
          </p>
        </div>
        <p className="mb-6 font-medium text-red-600 dark:text-red-400">
          If you wish to retain your reward rights, do not delete your account until you have received everything owed.
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">5. What Cannot Be Immediately Deleted</h3>
        <p className="mb-4">For compliance and platform integrity, some data must be retained:</p>

        <h4 className="text-lg font-semibold mt-6 mb-3">A. Financial & Transactional Records</h4>
        <p className="mb-2">Required by:</p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li>Tax law</li>
          <li>Audit requirements</li>
          <li>Anti-money laundering laws</li>
          <li>Payment processor regulations</li>
          <li>Fraud prevention mechanisms</li>
        </ul>
        <p className="mb-2">We retain:</p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li>Pledge amounts</li>
          <li>Transaction dates</li>
          <li>Reward tier selections</li>
          <li>Creators' payout logs</li>
        </ul>
        <p className="mb-4 font-medium">We do not retain your full payment details.</p>

        <h4 className="text-lg font-semibold mt-6 mb-3">B. Public Project Archives</h4>
        <p className="mb-2">IndieCrowdfund permanently archives:</p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li>Project pages</li>
          <li>Funding totals</li>
          <li>Public creator updates</li>
          <li>Public comment threads</li>
        </ul>
        <p className="mb-4">Your identity is anonymized, but the content remains for transparency.</p>

        <h4 className="text-lg font-semibold mt-6 mb-3">C. Security & Fraud Data</h4>
        <p className="mb-2">We may retain limited data to:</p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li>Prevent repeat abuse</li>
          <li>Detect suspicious patterns</li>
          <li>Comply with legal inquiries</li>
          <li>Protect backers and creators</li>
        </ul>
        <p className="mb-4">This data is restricted and not used for marketing.</p>
        <p className="mb-6">
          Where an account was banned, suspended, or terminated for violating our Terms, additional identifiers are retained specifically to stop that person returning under a new account. Section 6 sets out exactly what those are and how long we keep them.
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">6. Banned, Suspended, and Terminated Accounts</h3>
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
          <p className="text-red-800 dark:text-red-200 font-medium">
            Deleting a banned account does not lift the ban, and does not entitle you to a new one.
          </p>
        </div>
        <p className="mb-6">
          A ban attaches to the person, not to the account record. If we banned, suspended, or terminated your account, deletion removes your data from the platform but does not end the enforcement action, restore your access, or give you a clean slate. Submitting a deletion request is not an appeal and does not reset your standing with us.
        </p>

        <h4 className="text-lg font-semibold mt-6 mb-3">A. What We Keep to Enforce a Ban</h4>
        <p className="mb-2">
          Where an account has been banned, suspended, or terminated for violating our Terms of Service or policies, we retain a limited set of identifiers for the specific purpose of recognizing that person if they attempt to return:
        </p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li>The name on the account, and any name given for shipping or verification</li>
          <li>The email address or addresses associated with the account</li>
          <li>Any phone number provided for verification</li>
          <li>The last known IP address or addresses used to access the account</li>
          <li>Device and browser signals recorded at sign-up or sign-in</li>
          <li>Payment identifiers associated with a chargeback, fraud, or abuse ban — these are processor-side references, not full card numbers</li>
          <li>The enforcement record itself: the date of the ban, the reason, and the administrator who applied it</li>
        </ul>
        <p className="mb-4">
          These are compared against new and existing accounts to identify the same person returning under a different registration. A name on its own is weak evidence and is never acted on alone — it is used alongside the other identifiers above, and a match is reviewed by a person before any account is closed.
        </p>
        <p className="mb-6">
          We retain these identifiers for as long as the enforcement action remains in force. Where the ban is permanent — including the automatic permanent ban for chargebacks described in Section 5a of our Terms of Service — the retention is indefinite.
        </p>

        <h4 className="text-lg font-semibold mt-6 mb-3">B. Creating a New Account After a Ban</h4>
        <p className="mb-4">
          Registering a new account after a ban, or asking another person to register one on your behalf, is itself a violation of Section 11a of our{" "}
          <Link href="/terms?tab=terms" className="text-emerald-600 hover:underline">
            Terms of Service
          </Link>
          . Any account we identify as belonging to or acting for a banned person may be terminated without notice and without refund, and pledges placed through it may be cancelled.
        </p>
        <p className="mb-6">
          The email address on a deleted account cannot be reused to register (Section 7.D), and that restriction applies to banned accounts regardless of any deletion request.
        </p>

        <h4 className="text-lg font-semibold mt-6 mb-3">C. How This Data Is and Is Not Used</h4>
        <p className="mb-2">Identifiers retained under this Section are used only to:</p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li>Detect and block attempts to evade a ban</li>
          <li>Enforce the original enforcement action</li>
          <li>Protect backers, creators, and our payment processors from repeat abuse and fraud</li>
          <li>Establish, exercise, or defend legal claims, and respond to lawful requests</li>
        </ul>
        <p className="mb-2">They are held under restricted access and are never used to:</p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li>Send marketing or promotional messages</li>
          <li>Build advertising, personalization, or recommendation profiles</li>
          <li>Populate creator-facing backer reports or exports</li>
          <li>Sell, rent, or share with third parties for their own purposes</li>
        </ul>
        <p className="mb-6">
          Everything else covered by Section 2 is still deleted or anonymized on the normal schedule. Retention under this Section is limited to the identifiers listed in 6.A, and nothing more.
        </p>

        <h4 className="text-lg font-semibold mt-6 mb-3">D. Your Rights, and How to Contest This</h4>
        <p className="mb-4">
          The right to erasure is not absolute. Our stated basis for this retention is our legitimate interest in the security and integrity of the platform and in preventing abuse and fraud, under Article 6(1)(f) and Article 17(3) of the GDPR, and the exceptions in California Civil Code § 1798.105(d) covering the detection of security incidents and protection against malicious, deceptive, fraudulent, or illegal activity. Equivalent provisions in other jurisdictions are applied the same way.
        </p>
        <p className="mb-6">
          If you believe an enforcement action against you was wrong, or that we no longer have a reason to hold your identifiers, write to{" "}
          <a href="mailto:privacy@indiecrowdfund.com" className="text-emerald-600 hover:underline">
            privacy@indiecrowdfund.com
          </a>
          . We will review whether continued retention is still justified and respond in writing. Chargeback bans under Section 5a of the Terms of Service are not appealable, but you may still ask us to confirm what identifiers we hold.
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">7. How to Submit a Deletion Request</h3>
        <p className="mb-4">You may request deletion through:</p>

        <h4 className="text-lg font-semibold mt-6 mb-3">A. Email</h4>
        <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4 mb-4">
          <p className="mb-1">
            📧{" "}
            <a href="mailto:privacy@indiecrowdfund.com" className="text-emerald-600 hover:underline">
              privacy@indiecrowdfund.com
            </a>
          </p>
          <p className="text-sm text-muted-foreground">Subject Line: Data Deletion Request</p>
        </div>

        <h4 className="text-lg font-semibold mt-6 mb-3">B. Account Settings</h4>
        <p className="mb-4">
          Dashboard → Settings → Privacy &amp; Security → Delete My Account (if logged in)
        </p>
        <p className="mb-6">You will be required to confirm your password and type a confirmation phrase to verify ownership.</p>

        <h4 className="text-lg font-semibold mt-6 mb-3">C. Additional Requirements for Creators</h4>
        <p className="mb-4">
          If you have ever launched a live campaign on IndieCrowdfund, your account cannot be deleted on request alone. Because deletion releases you from your obligations to the backers who funded you, the following apply:
        </p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li><strong>Outstanding fulfillment blocks deletion entirely.</strong> If any backer on any campaign you launched is not yet marked shipped or delivered, we will not accept a deletion request. You must complete fulfillment first.</li>
          <li><strong>Deletion requires administrator approval.</strong> Once fulfillment is complete, you may submit a request. An IndieCrowdfund administrator reviews it before any data is removed. Your account remains fully active until the request is approved.</li>
          <li><strong>Running campaigns must be concluded.</strong> A campaign that is currently live or paused must be cancelled or finished before a request can be submitted.</li>
        </ul>
        <p className="mb-4">
          Prelaunch pages do not count as launched campaigns. A prelaunch page collects no funds and creates no reward obligations, so creators whose projects never left prelaunch or draft may delete their accounts immediately like any other user.
        </p>
        <p className="mb-6">
          These requirements exist to protect backers. A creator cannot use account deletion to discharge fulfillment obligations they have already been paid for.
        </p>

        <h4 className="text-lg font-semibold mt-6 mb-3">D. Reuse of a Deleted Email Address</h4>
        <p className="mb-6">
          Your name and email address are retained on completed pledge records so creators keep an accurate accounting of who backed them. As a result, the email address on a deleted account cannot be used to register a new account.
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">8. Processing Time</h3>
        <p className="mb-4">Deletion requests are processed within:</p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li><strong>30 days</strong> for standard requests</li>
          <li><strong>Up to 90 days</strong> for complex cases involving financial records or legal holds</li>
        </ul>
        <p className="mb-6">We will notify you if additional time is required.</p>

        <h3 className="text-xl font-semibold mt-8 mb-4">9. Circumstances Where Deletion May Be Delayed or Denied</h3>
        <p className="mb-4">We may temporarily deny or delay deletion if:</p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li>You are a creator with unresolved backer obligations</li>
          <li>You are involved in an active dispute or investigation</li>
          <li>Your account is under an open enforcement review, or is banned or suspended and the deletion would frustrate that enforcement (see Section 6)</li>
          <li>Deletion would violate legal or regulatory requirements</li>
          <li>Fraud indicators require retention</li>
          <li>Requests are incomplete or unverified</li>
        </ul>
        <p className="mb-6">When denial is necessary, we will provide a written explanation.</p>

        <h3 className="text-xl font-semibold mt-8 mb-4">10. Deletion Requests for Creator Accounts</h3>
        <p className="mb-4">Creators who delete their account must:</p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li>Resolve outstanding backer obligations before deletion</li>
          <li>Provide a final status update on all active campaigns</li>
          <li>Ensure physical goods already shipped have tracking</li>
          <li>Ensure digital rewards already delivered remain accessible</li>
          <li>Resolve chargebacks and disputes before deletion</li>
          <li>Understand that deleting their account does not delete project pages</li>
        </ul>
        <p className="mb-6 font-medium">Creator accounts are subject to additional verification.</p>

        <h3 className="text-xl font-semibold mt-8 mb-4">11. Children's Data</h3>
        <p className="mb-6">
          IndieCrowdfund does not knowingly collect data from children under 13. If such data is discovered, it will be deleted immediately upon verification.
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">12. Changes to This Policy</h3>
        <p className="mb-2">We may update this Policy from time to time.</p>
        <p className="mb-2">Major changes will be communicated via:</p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li>Email notifications</li>
          <li>Website announcements</li>
          <li>Account dashboard notices</li>
        </ul>
        <p className="mb-6 font-medium">Continued use of the services after an update constitutes acceptance.</p>

        <h3 className="text-xl font-semibold mt-8 mb-4">13. Contact Information</h3>
        <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4">
          <p className="font-semibold mb-2">IndieCrowdfund — a DBA of Divinity Comics Inc.</p>
          <p className="mb-1">
            📧{" "}
            <a href="mailto:privacy@indiecrowdfund.com" className="text-emerald-600 hover:underline">
              privacy@indiecrowdfund.com
            </a>
          </p>
          <p>
            🌐{" "}
            <a href="https://www.indiecrowdfund.com" className="text-emerald-600 hover:underline">
              https://www.indiecrowdfund.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
