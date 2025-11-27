/* #MANDATORY ANY CHANGES MADE ON THIS PAGE SHOULD BE ADAPTED TO MOBILE AS WELL OR YOU WILL CREATE A BREAK IN THE CODE# */

"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ScrollText, Shield, Cookie, FileText, Menu, ArrowLeft, RotateCcw, UserCheck, AlertTriangle, Package } from "lucide-react";

export default function TermsPage() {
  const [activeTab, setActiveTab] = useState("terms");

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-zinc-900">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-sm dark:bg-zinc-950/80">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-xl font-bold text-zinc-900 dark:text-white">
              IndieCrowdfund
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/discover" className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">
              Discover
            </Link>
            <Link href="/projects/new" className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">
              Start a Project
            </Link>
            <Link href="/retailers" className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">
              Retailers
            </Link>
            <Link href="/about-us" className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">
              About Us
            </Link>
            <Link href="/faq" className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">
              FAQ
            </Link>
          </nav>

          {/* Mobile Menu */}
          <Sheet>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px]">
              <nav className="flex flex-col gap-4 mt-6">
                <Link href="/discover" className="text-lg font-medium">Discover</Link>
                <Link href="/projects/new" className="text-lg font-medium">Start a Project</Link>
                <Link href="/retailers" className="text-lg font-medium">Retailers</Link>
                <Link href="/about-us" className="text-lg font-medium">About Us</Link>
                <Link href="/faq" className="text-lg font-medium">FAQ</Link>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Back Link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-white mb-2">
            Legal & Policies
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mb-8">
            Important information about using IndieCrowdfund
          </p>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            {/* Desktop Tabs - Scrollable for many tabs */}
            <div className="hidden md:block overflow-x-auto mb-8">
              <TabsList className="inline-flex w-auto min-w-full">
                <TabsTrigger value="terms" className="flex items-center gap-2 whitespace-nowrap">
                  <ScrollText className="h-4 w-4" />
                  Terms
                </TabsTrigger>
                <TabsTrigger value="privacy" className="flex items-center gap-2 whitespace-nowrap">
                  <Shield className="h-4 w-4" />
                  Privacy
                </TabsTrigger>
                <TabsTrigger value="refunds" className="flex items-center gap-2 whitespace-nowrap">
                  <RotateCcw className="h-4 w-4" />
                  Refunds
                </TabsTrigger>
                <TabsTrigger value="creator" className="flex items-center gap-2 whitespace-nowrap">
                  <UserCheck className="h-4 w-4" />
                  Creator
                </TabsTrigger>
                <TabsTrigger value="backer" className="flex items-center gap-2 whitespace-nowrap">
                  <AlertTriangle className="h-4 w-4" />
                  Backer Risks
                </TabsTrigger>
                <TabsTrigger value="shipping" className="flex items-center gap-2 whitespace-nowrap">
                  <Package className="h-4 w-4" />
                  Shipping
                </TabsTrigger>
                <TabsTrigger value="cookies" className="flex items-center gap-2 whitespace-nowrap">
                  <Cookie className="h-4 w-4" />
                  Cookies
                </TabsTrigger>
                <TabsTrigger value="guidelines" className="flex items-center gap-2 whitespace-nowrap">
                  <FileText className="h-4 w-4" />
                  Guidelines
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Mobile Tabs */}
            <TabsList className="md:hidden grid w-full grid-cols-3 gap-2 mb-8 h-auto">
              <TabsTrigger value="terms" className="flex items-center gap-2 py-3">
                <ScrollText className="h-4 w-4" />
                <span className="text-xs">Terms</span>
              </TabsTrigger>
              <TabsTrigger value="privacy" className="flex items-center gap-2 py-3">
                <Shield className="h-4 w-4" />
                <span className="text-xs">Privacy</span>
              </TabsTrigger>
              <TabsTrigger value="refunds" className="flex items-center gap-2 py-3">
                <RotateCcw className="h-4 w-4" />
                <span className="text-xs">Refunds</span>
              </TabsTrigger>
              <TabsTrigger value="creator" className="flex items-center gap-2 py-3">
                <UserCheck className="h-4 w-4" />
                <span className="text-xs">Creator</span>
              </TabsTrigger>
              <TabsTrigger value="backer" className="flex items-center gap-2 py-3">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-xs">Risks</span>
              </TabsTrigger>
              <TabsTrigger value="shipping" className="flex items-center gap-2 py-3">
                <Package className="h-4 w-4" />
                <span className="text-xs">Shipping</span>
              </TabsTrigger>
              <TabsTrigger value="cookies" className="flex items-center gap-2 py-3">
                <Cookie className="h-4 w-4" />
                <span className="text-xs">Cookies</span>
              </TabsTrigger>
              <TabsTrigger value="guidelines" className="flex items-center gap-2 py-3">
                <FileText className="h-4 w-4" />
                <span className="text-xs">Guidelines</span>
              </TabsTrigger>
            </TabsList>

            {/* Terms of Service */}
            <TabsContent value="terms">
              <div className="prose prose-zinc dark:prose-invert max-w-none">
                <div className="rounded-lg border bg-white dark:bg-zinc-900 p-6 md:p-8">
                  <h2 className="text-2xl font-bold mb-2">IndieCrowdfund — Terms of Service</h2>
                  <p className="text-sm text-zinc-500 mb-6 italic">
                    (Original Draft — Not Legal Advice. You should have an attorney review.)
                  </p>
                  <p className="text-sm text-zinc-500 mb-8">
                    <strong>Last Updated:</strong> November 27, 2025
                  </p>

                  <p className="mb-6">
                    Welcome to IndieCrowdfund.com, a crowdfunding and project-launch platform operated by IndieCrowdfund, Inc. ("IndieCrowdfund," "we," "our," or "us"). These Terms of Service ("Terms") govern your access to and use of IndieCrowdfund.com, our services, applications, and related tools (collectively, the "Services").
                  </p>

                  <p className="mb-8 font-medium">
                    By accessing or using the Services, you agree to be bound by these Terms. If you do not agree, you may not use IndieCrowdfund.
                  </p>

                  <h3 className="text-xl font-semibold mt-8 mb-4">1. What IndieCrowdfund Is</h3>
                  <p className="mb-4">
                    IndieCrowdfund is a platform where creators can publish projects, raise funding, offer rewards, and communicate with supporters ("Backers"). IndieCrowdfund facilitates these interactions but does not itself run or guarantee the success of any project.
                  </p>
                  <p className="mb-6">
                    We are not a store, a bank, or an investment service. We provide tools; creators are responsible for their own projects and for fulfilling commitments made to backers.
                  </p>

                  <h3 className="text-xl font-semibold mt-8 mb-4">2. Eligibility</h3>
                  <p className="mb-4">To use IndieCrowdfund, you must:</p>
                  <ul className="list-disc pl-6 mb-4 space-y-2">
                    <li>Be at least 18 years old</li>
                    <li>Have the legal capacity to form a binding contract</li>
                    <li>Not be barred from using the Services under applicable law</li>
                  </ul>
                  <p className="mb-6">
                    Creators launching projects must also comply with our Creator Guidelines and local financial regulations.
                  </p>

                  <h3 className="text-xl font-semibold mt-8 mb-4">3. User Accounts</h3>
                  <p className="mb-4">To use certain features, you must create an account. You agree to:</p>
                  <ul className="list-disc pl-6 mb-4 space-y-2">
                    <li>Provide accurate and up-to-date information</li>
                    <li>Maintain the security of your account</li>
                    <li>Be responsible for all activity conducted under your credentials</li>
                  </ul>
                  <p className="mb-6">We may suspend or terminate accounts that violate these Terms.</p>

                  <h3 className="text-xl font-semibold mt-8 mb-4">4. Launching Projects</h3>
                  <p className="mb-4">Creators who launch a project on IndieCrowdfund agree to:</p>
                  <ul className="list-disc pl-6 mb-4 space-y-2">
                    <li>Provide truthful and complete information about their project</li>
                    <li>Set accurate funding goals, deadlines, and reward tiers</li>
                    <li>Fulfill all rewards if the project is successfully funded</li>
                    <li>Communicate clearly and promptly with backers about progress</li>
                  </ul>
                  <p className="mb-4">Creators assume full legal responsibility for their commitments.</p>
                  <p className="mb-6 font-medium">
                    IndieCrowdfund does not guarantee reward delivery, shipping, timelines, or the quality of any product.
                  </p>

                  <h3 className="text-xl font-semibold mt-8 mb-4">5. Backing Projects</h3>
                  <p className="mb-4">When backers support a project:</p>
                  <ul className="list-disc pl-6 mb-4 space-y-2">
                    <li>They are funding a creative process—not purchasing a guaranteed product</li>
                    <li>They understand that delays, changes, or cancellations are possible</li>
                    <li>They may be entitled to refunds only at the creator's discretion unless required by law</li>
                    <li>They agree to read the full project description and associated risks</li>
                  </ul>
                  <p className="mb-6">IndieCrowdfund is not responsible for disputes between creators and backers.</p>

                  <h3 className="text-xl font-semibold mt-8 mb-4">6. Fees and Payments</h3>
                  <p className="mb-4">
                    IndieCrowdfund charges platform and processing fees for funded projects. Fees are disclosed during project setup and may vary by region.
                  </p>
                  <p className="mb-4">Creators authorize IndieCrowdfund and its payment partners to:</p>
                  <ul className="list-disc pl-6 mb-4 space-y-2">
                    <li>Collect funds from backers</li>
                    <li>Deduct platform and processing fees</li>
                    <li>Transfer net funds to the creator</li>
                  </ul>
                  <p className="mb-6">
                    Creators are responsible for all taxes, shipping costs, duties, and regulatory compliance.
                  </p>

                  <h3 className="text-xl font-semibold mt-8 mb-4">7. Prohibited Activities</h3>
                  <p className="mb-4">Users may not:</p>
                  <ul className="list-disc pl-6 mb-4 space-y-2">
                    <li>Break any laws while using the platform</li>
                    <li>Launch fraudulent or misleading projects</li>
                    <li>Abuse, harass, or impersonate others</li>
                    <li>Use the platform to launder money or engage in financial misconduct</li>
                    <li>Upload malware, attempt hacks, or disrupt platform operations</li>
                    <li>Use IndieCrowdfund to fund prohibited items (weapons, hate material, adult services, etc.)</li>
                  </ul>
                  <p className="mb-6 font-medium">Violations may result in account termination.</p>

                  <h3 className="text-xl font-semibold mt-8 mb-4">8. Intellectual Property</h3>
                  <p className="mb-4">
                    Creators retain ownership of their content but grant IndieCrowdfund a limited license to:
                  </p>
                  <ul className="list-disc pl-6 mb-4 space-y-2">
                    <li>Host, display, and distribute project content</li>
                    <li>Promote and market the project on-site or via social channels</li>
                    <li>Archive project pages permanently after campaigns end</li>
                  </ul>
                  <p className="mb-6">Users may not copy, steal, or misuse other creators' content.</p>

                  <h3 className="text-xl font-semibold mt-8 mb-4">9. Platform Rights</h3>
                  <p className="mb-4">IndieCrowdfund may:</p>
                  <ul className="list-disc pl-6 mb-6 space-y-2">
                    <li>Remove content that violates these Terms</li>
                    <li>Suspend or terminate accounts</li>
                    <li>Modify or update the Services</li>
                    <li>Interrupt access for maintenance or system upgrades</li>
                    <li>Refuse service at our discretion</li>
                  </ul>

                  <h3 className="text-xl font-semibold mt-8 mb-4">10. Disclaimers</h3>
                  <p className="mb-4 font-medium">IndieCrowdfund is provided "as is" without warranties.</p>
                  <p className="mb-4">We do not guarantee:</p>
                  <ul className="list-disc pl-6 mb-4 space-y-2">
                    <li>Project success</li>
                    <li>Creator performance</li>
                    <li>Reward delivery</li>
                    <li>Platform uptime</li>
                    <li>Accuracy of user-submitted information</li>
                  </ul>
                  <p className="mb-6 font-medium">Use the platform at your own risk.</p>

                  <h3 className="text-xl font-semibold mt-8 mb-4">11. Limitation of Liability</h3>
                  <p className="mb-4">To the fullest extent permitted by law:</p>
                  <ul className="list-disc pl-6 mb-4 space-y-2">
                    <li>IndieCrowdfund is not liable for losses related to project failures, disputes, delays, or unfulfilled rewards</li>
                    <li>Our total aggregate liability shall not exceed the fees paid to IndieCrowdfund in the prior 12 months</li>
                  </ul>
                  <p className="mb-6">
                    Some jurisdictions do not allow certain limitations; in such cases, the limitations apply to the maximum extent allowed.
                  </p>

                  <h3 className="text-xl font-semibold mt-8 mb-4">12. Dispute Resolution</h3>
                  <p className="mb-4">
                    You agree to resolve disputes through binding arbitration, not in court. Class actions are waived. Local consumer rights may apply based on your jurisdiction.
                  </p>

                  <h3 className="text-xl font-semibold mt-8 mb-4">13. Governing Law</h3>
                  <p className="mb-6">
                    These Terms are governed by the laws of the State of Indiana, without regard to conflicts of law.
                  </p>

                  <h3 className="text-xl font-semibold mt-8 mb-4">14. Changes to These Terms</h3>
                  <p className="mb-6">
                    We may update these Terms at any time. We will notify users by email or website notice. Continued use after changes means you accept the updated Terms.
                  </p>

                  <h3 className="text-xl font-semibold mt-8 mb-4">15. Contact Information</h3>
                  <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4">
                    <p className="font-semibold mb-2">IndieCrowdfund, Inc.</p>
                    <p className="mb-1">
                      Email:{" "}
                      <a href="mailto:support@indiecrowdfund.com" className="text-emerald-600 hover:underline">
                        support@indiecrowdfund.com
                      </a>
                    </p>
                    <p>
                      Website:{" "}
                      <a href="https://www.indiecrowdfund.com" className="text-emerald-600 hover:underline">
                        https://www.indiecrowdfund.com
                      </a>
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Privacy Policy */}
            <TabsContent value="privacy">
              <div className="prose prose-zinc dark:prose-invert max-w-none">
                <div className="rounded-lg border bg-white dark:bg-zinc-900 p-6 md:p-8">
                  <h2 className="text-2xl font-bold mb-2">IndieCrowdfund — Privacy Policy</h2>
                  <p className="text-sm text-zinc-500 mb-8">
                    <strong>Last Updated:</strong> November 27, 2025
                  </p>

                  <p className="mb-8">
                    This Privacy Policy describes how IndieCrowdfund, Inc. ("IndieCrowdfund," "we," "our") collects, uses, stores, and protects your personal information when you visit IndieCrowdfund.com or use our Services.
                  </p>

                  <h3 className="text-xl font-semibold mt-8 mb-4">1. Information We Collect</h3>
                  <p className="mb-4">We collect the following categories of information:</p>

                  <h4 className="text-lg font-semibold mt-6 mb-3">A. Information You Provide</h4>
                  <ul className="list-disc pl-6 mb-4 space-y-2">
                    <li>Name</li>
                    <li>Email address</li>
                    <li>Phone number (optional)</li>
                    <li>Payment information (processed by third-party providers; we do not store full card numbers)</li>
                    <li>Project descriptions, images, and updates</li>
                    <li>Messages sent to creators or customer support</li>
                  </ul>

                  <h4 className="text-lg font-semibold mt-6 mb-3">B. Information Collected Automatically</h4>
                  <ul className="list-disc pl-6 mb-4 space-y-2">
                    <li>IP address</li>
                    <li>Device/browser data</li>
                    <li>Usage analytics</li>
                    <li>Cookies and tracking technologies</li>
                    <li>Pages visited and actions taken</li>
                  </ul>

                  <h4 className="text-lg font-semibold mt-6 mb-3">C. Third-Party Data</h4>
                  <p className="mb-6">
                    Payment processors may return limited information needed for transaction records.
                  </p>

                  <h3 className="text-xl font-semibold mt-8 mb-4">2. How We Use Your Information</h3>
                  <p className="mb-4">We use your data to:</p>
                  <ul className="list-disc pl-6 mb-4 space-y-2">
                    <li>Create and manage accounts</li>
                    <li>Process payments and contributions</li>
                    <li>Support communication between creators and backers</li>
                    <li>Send notifications and updates</li>
                    <li>Improve platform performance</li>
                    <li>Detect fraud, abuse, or security threats</li>
                    <li>Comply with legal obligations</li>
                  </ul>
                  <p className="mb-6 font-medium">We do not sell your personal data.</p>

                  <h3 className="text-xl font-semibold mt-8 mb-4">3. Sharing Your Information</h3>
                  <p className="mb-4">We may share information with:</p>
                  <ul className="list-disc pl-6 mb-4 space-y-2">
                    <li>Payment processors (Stripe, PayPal, etc.)</li>
                    <li>Shipping providers when creators fulfill rewards</li>
                    <li>Analytics partners (privacy respecting; no personal data sold)</li>
                    <li>Legal/regulatory entities when required by law</li>
                    <li>Creators (backer name, email, pledge details for reward fulfillment)</li>
                  </ul>
                  <p className="mb-6">
                    Creators must keep backer information confidential and may only use it for project-related communications.
                  </p>

                  <h3 className="text-xl font-semibold mt-8 mb-4">4. Cookies & Tracking</h3>
                  <p className="mb-4">IndieCrowdfund uses cookies for:</p>
                  <ul className="list-disc pl-6 mb-4 space-y-2">
                    <li>Session authentication</li>
                    <li>Analytics</li>
                    <li>Fraud prevention</li>
                    <li>User preferences</li>
                  </ul>
                  <p className="mb-6">You may disable cookies, but some features may not work correctly.</p>

                  <h3 className="text-xl font-semibold mt-8 mb-4">5. Data Storage & Security</h3>
                  <p className="mb-4">We store user data on secure servers and apply:</p>
                  <ul className="list-disc pl-6 mb-4 space-y-2">
                    <li>Encryption in transit</li>
                    <li>Access controls</li>
                    <li>Monitoring and intrusion detection</li>
                    <li>Regular security audits</li>
                  </ul>
                  <p className="mb-6">No system is 100% secure, but we take reasonable steps to protect data.</p>

                  <h3 className="text-xl font-semibold mt-8 mb-4">6. Your Rights</h3>
                  <p className="mb-4">Depending on your jurisdiction, you may have rights to:</p>
                  <ul className="list-disc pl-6 mb-4 space-y-2">
                    <li>Access your personal data</li>
                    <li>Correct inaccurate information</li>
                    <li>Delete your account</li>
                    <li>Request copies of your data</li>
                    <li>Opt out of marketing communications</li>
                  </ul>
                  <p className="mb-6">
                    Requests may be submitted to{" "}
                    <a href="mailto:privacy@indiecrowdfund.com" className="text-emerald-600 hover:underline">
                      privacy@indiecrowdfund.com
                    </a>
                    .
                  </p>

                  <h3 className="text-xl font-semibold mt-8 mb-4">7. Data Retention</h3>
                  <p className="mb-4">We retain:</p>
                  <ul className="list-disc pl-6 mb-4 space-y-2">
                    <li>Project pages indefinitely for archival and legal compliance</li>
                    <li>Account data while your account is active</li>
                    <li>Payment records for as long as required by law</li>
                  </ul>
                  <p className="mb-6">Users may request account deletion at any time.</p>

                  <h3 className="text-xl font-semibold mt-8 mb-4">8. Children's Privacy</h3>
                  <p className="mb-6">
                    IndieCrowdfund is not intended for users under 13. We do not knowingly collect data from minors under 13.
                  </p>

                  <h3 className="text-xl font-semibold mt-8 mb-4">9. International Users</h3>
                  <p className="mb-6">
                    Your data may be stored or processed in the United States. By using IndieCrowdfund, you consent to such transfers.
                  </p>

                  <h3 className="text-xl font-semibold mt-8 mb-4">10. Changes to This Policy</h3>
                  <p className="mb-6">
                    We may update this policy periodically. We will notify users of significant changes via email or website notice.
                  </p>

                  <h3 className="text-xl font-semibold mt-8 mb-4">11. Contact Information</h3>
                  <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4">
                    <p className="font-semibold mb-2">IndieCrowdfund, Inc.</p>
                    <p className="mb-1">
                      Email:{" "}
                      <a href="mailto:privacy@indiecrowdfund.com" className="text-emerald-600 hover:underline">
                        privacy@indiecrowdfund.com
                      </a>
                    </p>
                    <p>
                      Website:{" "}
                      <a href="https://www.indiecrowdfund.com" className="text-emerald-600 hover:underline">
                        https://www.indiecrowdfund.com
                      </a>
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Refund Policy */}
            <TabsContent value="refunds">
              <div className="prose prose-zinc dark:prose-invert max-w-none">
                <div className="rounded-lg border bg-white dark:bg-zinc-900 p-6 md:p-8">
                  <h2 className="text-2xl font-bold mb-2">IndieCrowdfund — Refund Policy</h2>
                  <p className="text-sm text-zinc-500 mb-8">
                    <strong>Last Updated:</strong> November 27, 2025
                  </p>

                  <p className="mb-8">
                    IndieCrowdfund is a platform that helps creators bring ideas to life through community support. Backers pledge funds to support projects they believe in, with the understanding that crowdfunding is not the same as buying a finished product. Because of this, refund rules and responsibilities function differently than a traditional online store.
                  </p>

                  <p className="mb-8 font-medium">Below is our full refund policy and how refunds work on IndieCrowdfund.</p>

                  <h3 className="text-xl font-semibold mt-8 mb-4">1. Who Issues Refunds</h3>
                  <p className="mb-4 font-medium">IndieCrowdfund does not issue refunds.</p>
                  <p className="mb-4">
                    All funds pledged to a project go directly to the creator once a campaign is successfully funded (minus platform and processing fees).
                  </p>
                  <p className="mb-4">Therefore:</p>
                  <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
                    <p className="text-red-800 dark:text-red-200 font-medium">
                      Refunds can only be issued by the creator of the project.
                    </p>
                  </div>
                  <p className="mb-6">
                    Creators may choose to grant or deny refund requests at their discretion unless required by applicable law.
                  </p>

                  <h3 className="text-xl font-semibold mt-8 mb-4">2. When Backers May Request a Refund</h3>
                  <p className="mb-4">
                    Backers may request a refund before funds are transferred to the creator, but the ability to receive a refund depends entirely on the creator's policies.
                  </p>
                  <p className="mb-4">Creators may choose to provide refunds when:</p>
                  <ul className="list-disc pl-6 mb-4 space-y-2">
                    <li>The campaign has not yet been paid out</li>
                    <li>A reward will not be fulfilled</li>
                    <li>A project has experienced significant delays</li>
                    <li>The creator voluntarily offers refunds</li>
                  </ul>
                  <p className="mb-6 font-medium">However, creators are not required to provide refunds unless legally obligated.</p>

                  <h3 className="text-xl font-semibold mt-8 mb-4">3. When Refunds Cannot Be Issued</h3>
                  <p className="mb-4">Once funds have been transferred to a creator after successful funding:</p>
                  <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
                    <p className="text-red-800 dark:text-red-200 font-medium">
                      IndieCrowdfund cannot reverse or refund the transaction.
                    </p>
                  </div>
                  <p className="mb-4">This includes situations such as:</p>
                  <ul className="list-disc pl-6 mb-4 space-y-2">
                    <li>Project delays</li>
                    <li>Production changes</li>
                    <li>Cost overruns</li>
                    <li>Design updates</li>
                    <li>Missed deadlines</li>
                    <li>Reward modifications</li>
                  </ul>
                  <p className="mb-6 font-medium">Backers pledge to support a creative process with inherent risks.</p>

                  <h3 className="text-xl font-semibold mt-8 mb-4">4. Creator Responsibilities Regarding Refunds</h3>
                  <p className="mb-4">Creators agree to:</p>
                  <ul className="list-disc pl-6 mb-4 space-y-2">
                    <li>Clearly communicate project risks and timelines</li>
                    <li>Make honest efforts to complete their project</li>
                    <li>Fulfill all promised rewards</li>
                    <li>Keep backers informed of progress</li>
                    <li>Act in good faith when responding to refund requests</li>
                  </ul>
                  <p className="mb-4">If a creator cannot complete their project or fulfill rewards, they must:</p>
                  <ul className="list-disc pl-6 mb-4 space-y-2">
                    <li>Provide updates explaining what happened</li>
                    <li>Offer solutions where possible</li>
                    <li>Attempt to fulfill outstanding rewards or provide alternative options</li>
                    <li>Consider partial or full refunds depending on the circumstances</li>
                  </ul>
                  <p className="mb-6">
                    Creators who fail to act responsibly may face account suspension, removal from the platform, or other actions.
                  </p>

                  <h3 className="text-xl font-semibold mt-8 mb-4">5. Backer Responsibilities</h3>
                  <p className="mb-4">By backing a project, you acknowledge and agree that:</p>
                  <ul className="list-disc pl-6 mb-4 space-y-2">
                    <li>You are supporting a creative endeavor — not purchasing a guaranteed product</li>
                    <li>Delays, changes, and unexpected setbacks may occur</li>
                    <li>Refunds are not guaranteed</li>
                    <li>IndieCrowdfund is not liable for a creator's failure to deliver rewards</li>
                  </ul>
                  <p className="mb-6">Backers should read project descriptions and risk disclosures carefully before pledging.</p>

                  <h3 className="text-xl font-semibold mt-8 mb-4">6. Failed or Unsuccessful Campaigns</h3>
                  <p className="mb-4">
                    If a campaign does not reach its funding goal, backers are not charged and no funds are collected.
                  </p>
                  <p className="mb-4">Because no funds are transferred:</p>
                  <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 mb-6">
                    <ul className="list-none space-y-1">
                      <li className="text-emerald-800 dark:text-emerald-200">No refunds are necessary</li>
                      <li className="text-emerald-800 dark:text-emerald-200">No action is needed</li>
                      <li className="text-emerald-800 dark:text-emerald-200">The pledge is automatically void</li>
                    </ul>
                  </div>

                  <h3 className="text-xl font-semibold mt-8 mb-4">7. Fraud, Misconduct, or Abuse</h3>
                  <p className="mb-4">IndieCrowdfund may intervene if a creator is suspected of:</p>
                  <ul className="list-disc pl-6 mb-4 space-y-2">
                    <li>Fraudulent activity</li>
                    <li>Theft of funds</li>
                    <li>Repeated failure to deliver rewards</li>
                    <li>Misuse of backer data</li>
                    <li>Harassment, threats, or abusive behavior</li>
                  </ul>
                  <p className="mb-4">In such cases, IndieCrowdfund may:</p>
                  <ul className="list-disc pl-6 mb-4 space-y-2">
                    <li>Freeze project payouts</li>
                    <li>Suspend or terminate creator accounts</li>
                    <li>Notify payment processors or legal authorities</li>
                    <li>Assist backers in escalating claims</li>
                  </ul>
                  <p className="mb-6 font-medium">However, IndieCrowdfund still cannot issue refunds on behalf of creators.</p>

                  <h3 className="text-xl font-semibold mt-8 mb-4">8. Chargebacks</h3>
                  <p className="mb-4">Backers who file chargebacks through their bank should understand:</p>
                  <ul className="list-disc pl-6 mb-4 space-y-2">
                    <li>Banks may require creators to dispute the chargeback</li>
                    <li>Chargebacks may result in the creator losing funds</li>
                    <li>Excessive chargebacks may lead to project suspension</li>
                    <li>IndieCrowdfund may limit an account that files repeated chargebacks</li>
                  </ul>
                  <p className="mb-6">Chargebacks should be used only when fraud or clear misuse is suspected.</p>

                  <h3 className="text-xl font-semibold mt-8 mb-4">9. How to Request a Refund From a Creator</h3>
                  <p className="mb-4">Backers should contact the creator directly through:</p>
                  <ul className="list-disc pl-6 mb-4 space-y-2">
                    <li>The IndieCrowdfund messaging system</li>
                    <li>The email address provided in the project profile</li>
                    <li>Any official communication channel listed on their project page</li>
                  </ul>
                  <p className="mb-4">Creators should respond promptly and professionally.</p>
                  <p className="mb-4">
                    If a creator refuses to engage or has abandoned the project, contact us:
                  </p>
                  <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4 mb-6">
                    <p>
                      <a href="mailto:support@indiecrowdfund.com" className="text-emerald-600 hover:underline">
                        support@indiecrowdfund.com
                      </a>
                    </p>
                  </div>
                  <p className="mb-6">We will review the situation and take appropriate platform-level action.</p>

                  <h3 className="text-xl font-semibold mt-8 mb-4">10. Contact Us</h3>
                  <p className="mb-4">For questions related to refunds or project concerns:</p>
                  <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4">
                    <p className="mb-1">
                      Email:{" "}
                      <a href="mailto:support@indiecrowdfund.com" className="text-emerald-600 hover:underline">
                        support@indiecrowdfund.com
                      </a>
                    </p>
                    <p>
                      Website:{" "}
                      <a href="https://www.indiecrowdfund.com" className="text-emerald-600 hover:underline">
                        https://www.indiecrowdfund.com
                      </a>
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Creator Responsibility Agreement */}
            <TabsContent value="creator">
              <div className="prose prose-zinc dark:prose-invert max-w-none">
                <div className="rounded-lg border bg-white dark:bg-zinc-900 p-6 md:p-8">
                  <h2 className="text-2xl font-bold mb-2">Creator Responsibility Agreement</h2>
                  <p className="text-sm text-zinc-500 mb-8">
                    <strong>Last Updated:</strong> November 27, 2025
                  </p>

                  <p className="mb-8 font-medium">
                    Creators using IndieCrowdfund agree to the following responsibilities:
                  </p>

                  <h3 className="text-xl font-semibold mt-8 mb-4">1. Accuracy & Transparency</h3>
                  <p className="mb-4">Creators must:</p>
                  <ul className="list-disc pl-6 mb-4 space-y-2">
                    <li>Provide truthful and complete project descriptions</li>
                    <li>Disclose risks, challenges, and realistic timelines</li>
                    <li>Use funds only for the project described</li>
                  </ul>
                  <p className="mb-6 font-medium">Misleading or fraudulent campaigns are prohibited.</p>

                  <h3 className="text-xl font-semibold mt-8 mb-4">2. Reward Fulfillment</h3>
                  <p className="mb-4">If a campaign is successfully funded, creators must:</p>
                  <ul className="list-disc pl-6 mb-4 space-y-2">
                    <li>Produce and deliver rewards as described</li>
                    <li>Communicate delays, design changes, or setbacks openly</li>
                    <li>Provide updates until rewards are fully delivered</li>
                  </ul>
                  <p className="mb-6">
                    Creators assume full responsibility for shipping costs, taxes, customs duties, and inventory management.
                  </p>

                  <h3 className="text-xl font-semibold mt-8 mb-4">3. Use of Funds</h3>
                  <p className="mb-4">Funds raised must be used exclusively for:</p>
                  <ul className="list-disc pl-6 mb-4 space-y-2">
                    <li>Development of the project</li>
                    <li>Production and shipment of rewards</li>
                    <li>Project-related costs disclosed to backers</li>
                  </ul>
                  <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
                    <p className="text-red-800 dark:text-red-200 font-medium">
                      Misuse of funds can result in account suspension or legal referral.
                    </p>
                  </div>

                  <h3 className="text-xl font-semibold mt-8 mb-4">4. Communication</h3>
                  <p className="mb-4">Creators must maintain active communication by:</p>
                  <ul className="list-disc pl-6 mb-4 space-y-2">
                    <li>Posting meaningful updates</li>
                    <li>Responding to backer messages</li>
                    <li>Informing backers promptly if plans change</li>
                  </ul>
                  <p className="mb-6 font-medium">Silence or abandonment of a campaign violates this agreement.</p>

                  <h3 className="text-xl font-semibold mt-8 mb-4">5. Failure to Complete a Project</h3>
                  <p className="mb-4">If a creator cannot complete a project, they must:</p>
                  <ul className="list-disc pl-6 mb-4 space-y-2">
                    <li>Explain what happened</li>
                    <li>Provide a plan to remedy the situation</li>
                    <li>Offer refunds or partial refunds when feasible</li>
                    <li>Distribute any remaining assets or prototypes to backers where possible</li>
                    <li>Demonstrate a good-faith attempt to fulfill obligations</li>
                  </ul>
                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-6">
                    <p className="text-amber-800 dark:text-amber-200 font-medium">
                      Creators who fail to act responsibly may be removed from the platform.
                    </p>
                  </div>

                  <h3 className="text-xl font-semibold mt-8 mb-4">6. Legal Compliance</h3>
                  <p className="mb-4">Creators are responsible for:</p>
                  <ul className="list-disc pl-6 mb-4 space-y-2">
                    <li>All taxes</li>
                    <li>Business licenses</li>
                    <li>Regulatory requirements for their product category</li>
                    <li>Age restrictions, safety certifications, or other required disclosures</li>
                  </ul>
                  <p className="mb-6 font-medium">Creators must not use IndieCrowdfund to violate any law.</p>

                  <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4">
                    <p className="font-semibold mb-2">Questions about creator responsibilities?</p>
                    <p>
                      Contact us at{" "}
                      <a href="mailto:creators@indiecrowdfund.com" className="text-emerald-600 hover:underline">
                        creators@indiecrowdfund.com
                      </a>
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Backer Risk Disclosure */}
            <TabsContent value="backer">
              <div className="prose prose-zinc dark:prose-invert max-w-none">
                <div className="rounded-lg border bg-white dark:bg-zinc-900 p-6 md:p-8">
                  <h2 className="text-2xl font-bold mb-2">Backer Risk Disclosure</h2>
                  <p className="text-sm text-zinc-500 mb-8">
                    <strong>Last Updated:</strong> November 27, 2025
                  </p>

                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-6 mb-8">
                    <p className="text-amber-800 dark:text-amber-200 font-medium text-lg mb-0">
                      Backing a project on IndieCrowdfund is not a purchase — it is support for a creative process with inherent risks.
                    </p>
                  </div>

                  <p className="mb-6 font-medium text-lg">By backing a project, you acknowledge:</p>

                  <h3 className="text-xl font-semibold mt-8 mb-4">A. Final products may differ from early concepts</h3>
                  <p className="mb-6">
                    Design changes, material substitutions, or process changes may occur.
                  </p>

                  <h3 className="text-xl font-semibold mt-8 mb-4">B. Timelines are estimates, not guarantees</h3>
                  <p className="mb-4">Delays may occur due to:</p>
                  <ul className="list-disc pl-6 mb-6 space-y-2">
                    <li>Manufacturing issues</li>
                    <li>Shipping or logistics problems</li>
                    <li>Cost increases</li>
                    <li>Creative revisions</li>
                  </ul>

                  <h3 className="text-xl font-semibold mt-8 mb-4">C. Rewards are not guaranteed</h3>
                  <p className="mb-6">
                    Creators are responsible for fulfilling rewards. IndieCrowdfund is not liable for unfulfilled commitments.
                  </p>

                  <h3 className="text-xl font-semibold mt-8 mb-4">D. You may not receive a refund</h3>
                  <p className="mb-6">
                    Refunds are solely the responsibility of the creator.
                  </p>

                  <h3 className="text-xl font-semibold mt-8 mb-4">E. Project failure is possible</h3>
                  <p className="mb-6">
                    Some projects may not be completed despite good-faith efforts.
                  </p>

                  <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-6 mt-8">
                    <p className="font-semibold text-lg mb-0">
                      By pledging, you agree you understand these risks.
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Shipping & Rewards Policy */}
            <TabsContent value="shipping">
              <div className="prose prose-zinc dark:prose-invert max-w-none">
                <div className="rounded-lg border bg-white dark:bg-zinc-900 p-6 md:p-8">
                  <h2 className="text-2xl font-bold mb-2">Shipping & Rewards Policy</h2>
                  <p className="text-sm text-zinc-500 mb-8">
                    <strong>Last Updated:</strong> November 27, 2025
                  </p>

                  <h3 className="text-xl font-semibold mt-8 mb-4">1. Who Handles Shipping</h3>
                  <p className="mb-4">Creators are solely responsible for:</p>
                  <ul className="list-disc pl-6 mb-4 space-y-2">
                    <li>Packaging</li>
                    <li>Shipping</li>
                    <li>Tracking</li>
                    <li>Customs forms</li>
                    <li>Lost package claims</li>
                  </ul>
                  <p className="mb-6 font-medium">IndieCrowdfund does not ship or handle rewards.</p>

                  <h3 className="text-xl font-semibold mt-8 mb-4">2. Shipping Fees</h3>
                  <p className="mb-4">
                    Creators must list shipping fees clearly before campaign launch.
                  </p>
                  <p className="mb-6">
                    If shipping costs increase, creators are responsible for covering the difference.
                  </p>

                  <h3 className="text-xl font-semibold mt-8 mb-4">3. Digital Rewards</h3>
                  <p className="mb-4">Creators must ensure digital rewards:</p>
                  <ul className="list-disc pl-6 mb-6 space-y-2">
                    <li>Are delivered via secure links or downloads</li>
                    <li>Remain accessible for a reasonable period</li>
                    <li>Are not used to distribute harmful or infringing content</li>
                  </ul>

                  <h3 className="text-xl font-semibold mt-8 mb-4">4. Missing or Damaged Rewards</h3>
                  <p className="mb-4">Creators must:</p>
                  <ul className="list-disc pl-6 mb-6 space-y-2">
                    <li>Replace damaged items</li>
                    <li>Re-ship missing rewards</li>
                    <li>Provide reasonable solutions for international issues</li>
                  </ul>

                  <h3 className="text-xl font-semibold mt-8 mb-4">5. Address Collection</h3>
                  <p className="mb-4">
                    Backers must provide accurate shipping information.
                  </p>
                  <p className="mb-6">
                    Creators may request updated addresses before shipment.
                  </p>

                  <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4">
                    <p className="font-semibold mb-2">Questions about shipping or rewards?</p>
                    <p>
                      Contact us at{" "}
                      <a href="mailto:support@indiecrowdfund.com" className="text-emerald-600 hover:underline">
                        support@indiecrowdfund.com
                      </a>
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Cookie Policy */}
            <TabsContent value="cookies">
              <div className="prose prose-zinc dark:prose-invert max-w-none">
                <div className="rounded-lg border bg-white dark:bg-zinc-900 p-6 md:p-8">
                  <h2 className="text-2xl font-bold mb-2">Cookie Policy</h2>
                  <p className="text-sm text-zinc-500 mb-8">
                    <strong>Last Updated:</strong> November 27, 2025
                  </p>

                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-6">
                    <p className="text-amber-800 dark:text-amber-200">
                      This is a placeholder. A complete Cookie Policy will be added here explaining our use of cookies and similar technologies.
                    </p>
                  </div>

                  <h3 className="text-xl font-semibold mt-8 mb-4">Coming Soon</h3>
                  <p className="mb-4">Our full Cookie Policy will cover:</p>
                  <ul className="list-disc pl-6 mb-6 space-y-2">
                    <li>What are cookies</li>
                    <li>How we use cookies</li>
                    <li>Types of cookies we use (essential, analytics, marketing)</li>
                    <li>Third-party cookies</li>
                    <li>How to manage your cookie preferences</li>
                    <li>Updates to this policy</li>
                  </ul>

                  <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4">
                    <p className="font-semibold mb-2">Questions about cookies?</p>
                    <p>
                      Contact us at{" "}
                      <a href="mailto:support@indiecrowdfund.com" className="text-emerald-600 hover:underline">
                        support@indiecrowdfund.com
                      </a>
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Creator Guidelines */}
            <TabsContent value="guidelines">
              <div className="prose prose-zinc dark:prose-invert max-w-none">
                <div className="rounded-lg border bg-white dark:bg-zinc-900 p-6 md:p-8">
                  <h2 className="text-2xl font-bold mb-2">Creator Guidelines</h2>
                  <p className="text-sm text-zinc-500 mb-8">
                    <strong>Last Updated:</strong> November 27, 2025
                  </p>

                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-6">
                    <p className="text-amber-800 dark:text-amber-200">
                      This is a placeholder. Complete Creator Guidelines will be added here with rules and best practices for running campaigns.
                    </p>
                  </div>

                  <h3 className="text-xl font-semibold mt-8 mb-4">Coming Soon</h3>
                  <p className="mb-4">Our full Creator Guidelines will cover:</p>
                  <ul className="list-disc pl-6 mb-6 space-y-2">
                    <li>Project eligibility requirements</li>
                    <li>Prohibited project types</li>
                    <li>Reward fulfillment obligations</li>
                    <li>Communication standards</li>
                    <li>Financial reporting requirements</li>
                    <li>Intellectual property rules</li>
                    <li>Consequences for violations</li>
                    <li>Best practices for successful campaigns</li>
                  </ul>

                  <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4">
                    <p className="font-semibold mb-2">Questions for creators?</p>
                    <p>
                      Contact us at{" "}
                      <a href="mailto:creators@indiecrowdfund.com" className="text-emerald-600 hover:underline">
                        creators@indiecrowdfund.com
                      </a>
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white dark:bg-zinc-950 mt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-zinc-500">
              © {new Date().getFullYear()} IndieCrowdfund, Inc. All rights reserved.
            </p>
            <nav className="flex flex-wrap justify-center gap-4 md:gap-6">
              <Link href="/terms" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
                Terms
              </Link>
              <Link href="/terms?tab=privacy" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
                Privacy
              </Link>
              <Link href="/faq" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
                FAQ
              </Link>
              <a href="mailto:support@indiecrowdfund.com" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
                Contact
              </a>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
