/* eslint-disable react/no-unescaped-entities */

import { Lock } from "lucide-react";

export function PciComplianceContent() {
  return (
    <div className="prose prose-zinc dark:prose-invert max-w-none">
      <div className="rounded-lg border bg-white dark:bg-zinc-900 p-6 md:p-8">
        <h2 className="text-2xl font-bold mb-2">PCI Compliance Certification</h2>
        <p className="text-sm text-zinc-500 mb-8">
          <strong>Last Updated:</strong> December 11, 2025
        </p>

        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-6 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Lock className="h-6 w-6 text-emerald-600" />
            <h3 className="text-lg font-semibold text-emerald-800 dark:text-emerald-200 m-0">Payment Security Status</h3>
          </div>
          <p className="text-emerald-700 dark:text-emerald-300 m-0">
            IndieCrowdfund maintains PCI DSS compliance across all payment processors. We partner with <strong>PayPal</strong> (Level 1 PCI Service Provider) as our primary processor, <strong>DivinityCoin</strong> for NSFW/adult content campaigns, and <strong>Whop</strong> as an additional payment processor option for creators. We never store, process, or transmit credit card data on our servers.
          </p>
        </div>

        <h3 className="text-xl font-semibold mt-8 mb-4">1. What is PCI DSS?</h3>
        <p className="mb-4">
          The Payment Card Industry Data Security Standard (PCI DSS) is a set of security standards designed to ensure that ALL companies that accept, process, store, or transmit credit card information maintain a secure environment.
        </p>
        <p className="mb-6">
          PCI DSS compliance is mandatory for any organization that handles cardholder data, and helps protect consumers from credit card fraud and data breaches.
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">2. Our Approach to Payment Security</h3>
        <p className="mb-4">IndieCrowdfund takes a security-first approach to handling payment information across all payment processors:</p>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li><strong>No storage of card data:</strong> We never store, process, or transmit full credit card numbers on our servers</li>
          <li><strong>Tokenization (PayPal):</strong> All PayPal payment information is securely tokenized before reaching our systems</li>
          <li><strong>Outsourced processing (DivinityCoin):</strong> DivinityCoin is an independent payment sub-processor with its own PCI-compliant infrastructure. Card data entered through DivinityCoin&apos;s payment forms never reaches our servers</li>
          <li><strong>Outsourced processing (Whop):</strong> Whop is an additional independent payment processor with its own PCI-compliant infrastructure. Card data entered through Whop&apos;s payment forms never reaches our servers</li>
          <li><strong>Encrypted connections:</strong> All data transmission uses TLS 1.2+ encryption (HTTPS-only)</li>
          <li><strong>CSRF protection:</strong> All payment initiation endpoints are protected with CSRF tokens to prevent cross-site request forgery</li>
          <li><strong>Secure checkout:</strong> Payment forms are served directly from each processor's PCI-compliant infrastructure</li>
        </ul>

        <h3 className="text-xl font-semibold mt-8 mb-4">3. Our Payment Partners</h3>

        <h4 className="text-lg font-semibold mt-6 mb-3">PayPal (Primary Processor)</h4>
        <p className="mb-4">
          PayPal, Inc. is our primary payment processor and maintains the highest level of PCI compliance:
        </p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li><strong>PCI DSS Level 1:</strong> The most rigorous level of certification, processing billions of transactions annually</li>
          <li><strong>Annual audits:</strong> Conducted by a PCI-qualified security assessor (QSA)</li>
          <li><strong>Advanced fraud protection:</strong> PayPal&apos;s fraud detection tools help prevent unauthorized transactions</li>
          <li><strong>Buyer and seller protection:</strong> PayPal provides dispute resolution and protection programs</li>
        </ul>
        <p className="mb-6">
          For more information about PayPal&apos;s security practices, visit{" "}
          <a href="https://www.paypal.com/us/webapps/mpp/paypal-safety-and-security" target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline">
            paypal.com/security
          </a>
        </p>

        <h4 className="text-lg font-semibold mt-6 mb-3">DivinityCoin</h4>
        <p className="mb-6">
          DivinityCoin is an independent payment sub-processor that maintains its own PCI DSS compliance. When backers pay through DivinityCoin, their card details are entered into DivinityCoin&apos;s own PCI-compliant payment infrastructure. IndieCrowdfund never receives, processes, or stores card data from DivinityCoin transactions, eliminating PCI scope for these transactions on our platform.
        </p>

        <h4 className="text-lg font-semibold mt-6 mb-3">Whop</h4>
        <p className="mb-6">
          Whop is an additional independent payment processor available to creators on IndieCrowdfund. Whop maintains its own PCI DSS compliance. When backers pay through Whop, their card details are entered into Whop&apos;s own PCI-compliant payment infrastructure. IndieCrowdfund never receives, processes, or stores card data from Whop transactions.
        </p>

        <h3 className="text-xl font-semibold mt-8 mb-4">4. SAQ A Compliance</h3>
        <p className="mb-4">
          IndieCrowdfund qualifies for SAQ A (Self-Assessment Questionnaire A), which applies to merchants who:
        </p>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li>Have completely outsourced all cardholder data functions to PCI DSS validated third-party service providers</li>
          <li>Do not electronically store, process, or transmit any cardholder data on their systems</li>
          <li>Use only PCI DSS compliant payment gateways (PayPal, DivinityCoin, Whop) for all card transactions</li>
        </ul>

        <h3 className="text-xl font-semibold mt-8 mb-4">5. Security Measures We Implement</h3>
        <p className="mb-4">Beyond delegating payment processing to our partners, we implement additional security measures:</p>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li><strong>HTTPS everywhere:</strong> Our entire platform uses SSL/TLS encryption</li>
          <li><strong>Regular security audits:</strong> We conduct periodic security assessments</li>
          <li><strong>Access controls:</strong> Strict role-based access to sensitive systems</li>
          <li><strong>Fraud detection:</strong> PayPal&apos;s advanced fraud protection helps prevent unauthorized transactions</li>
          <li><strong>Secure authentication:</strong> Multi-factor authentication available for user accounts</li>
          <li><strong>Data minimization:</strong> We only collect and retain data necessary for operations</li>
        </ul>

        <h3 className="text-xl font-semibold mt-8 mb-4">6. What This Means for You</h3>

        <h4 className="text-lg font-semibold mt-6 mb-3">For Backers:</h4>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li>Your payment card information is never stored on IndieCrowdfund servers</li>
          <li>All transactions are protected by bank-level security regardless of payment processor</li>
          <li>PayPal&apos;s fraud protection helps prevent unauthorized charges on PayPal transactions</li>
          <li>DivinityCoin transactions use their own PCI-compliant payment infrastructure — your card data never reaches IndieCrowdfund</li>
          <li>Whop transactions use their own PCI-compliant payment infrastructure — your card data never reaches IndieCrowdfund</li>
          <li>You can manage saved payment methods securely through your account</li>
        </ul>

        <h4 className="text-lg font-semibold mt-6 mb-3">For Creators:</h4>
        <ul className="list-disc pl-6 mb-6 space-y-2">
          <li>Funds are securely processed through your chosen payment processor (PayPal, DivinityCoin, or Whop)</li>
          <li>Settlement account details (bank information) are encrypted with AES-256 encryption</li>
          <li>You never have direct access to backer payment card details</li>
          <li>Chargeback and dispute handling follows industry-standard procedures</li>
        </ul>

        <h3 className="text-xl font-semibold mt-8 mb-4">7. Reporting Security Concerns</h3>
        <p className="mb-4">
          If you believe you have discovered a security vulnerability or have concerns about payment security, please contact us immediately:
        </p>
        <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4 mb-6">
          <p className="font-semibold mb-2">Security Team</p>
          <p className="mb-1">
            Email:{" "}
            <a href="mailto:security@indiecrowdfund.com" className="text-emerald-600 hover:underline">
              security@indiecrowdfund.com
            </a>
          </p>
          <p>
            For urgent security matters:{" "}
            <a href="mailto:compliance@indiecrowdfund.com" className="text-emerald-600 hover:underline">
              compliance@indiecrowdfund.com
            </a>
          </p>
        </div>

        <h3 className="text-xl font-semibold mt-8 mb-4">8. Compliance Verification</h3>
        <p className="mb-4">
          Our PCI compliance status can be verified through:
        </p>
        <ul className="list-disc pl-6 mb-4 space-y-2">
          <li>PayPal&apos;s PCI attestation available at{" "}
            <a href="https://www.paypal.com/us/webapps/mpp/paypal-safety-and-security" target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline">
              paypal.com/security
            </a>
          </li>
          <li>Our Attestation of Compliance (AOC) is available upon request for business partners</li>
          <li>Contact <a href="mailto:compliance@indiecrowdfund.com" className="text-emerald-600 hover:underline">compliance@indiecrowdfund.com</a> for verification requests</li>
        </ul>

        <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-6 mt-8">
          <h4 className="text-lg font-semibold mb-4">Summary</h4>
          <p className="mb-0">
            IndieCrowdfund maintains PCI DSS compliance across all payment processors. We partner with PayPal (Level 1 PCI Service Provider) as our primary processor for standard campaigns, DivinityCoin (independent PCI-compliant payment sub-processor) for NSFW/adult content campaigns, and Whop as an additional payment processor option for creators. We never store credit card information on our servers, enforce CSRF protection on all payment endpoints, and communicate exclusively over HTTPS. This approach ensures the highest level of protection for all financial transactions on our platform.
          </p>
        </div>
      </div>
    </div>
  );
}
