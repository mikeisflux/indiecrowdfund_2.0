/* #MANDATORY ANY CHANGES MADE ON THIS PAGE SHOULD BE ADAPTED TO MOBILE AS WELL OR YOU WILL CREATE A BREAK IN THE CODE# */
/* eslint-disable react/no-unescaped-entities */

"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ScrollText, Shield, Cookie, FileText, Menu, ArrowLeft, RotateCcw, UserCheck, AlertTriangle, Package, CreditCard, ShieldAlert, Copyright, Brain, Globe, Trash2 } from "lucide-react";

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

        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-white mb-2">
            Legal & Policies
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mb-8">
            Important information about using IndieCrowdfund
          </p>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full" orientation="vertical">
            {/* Desktop Layout - Vertical Tabs on Left */}
            <div className="hidden md:flex gap-8">
              {/* Left Sidebar Navigation */}
              <div className="w-64 flex-shrink-0">
                <div className="sticky top-24">
                  <TabsList className="flex flex-col h-auto w-full bg-zinc-100 dark:bg-zinc-800 rounded-lg p-2 space-y-1">
                    <TabsTrigger value="terms" className="flex items-center gap-3 w-full justify-start px-4 py-3 rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900 data-[state=active]:shadow-sm">
                      <ScrollText className="h-4 w-4" />
                      <span>Terms of Service</span>
                    </TabsTrigger>
                    <TabsTrigger value="privacy" className="flex items-center gap-3 w-full justify-start px-4 py-3 rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900 data-[state=active]:shadow-sm">
                      <Shield className="h-4 w-4" />
                      <span>Privacy Policy</span>
                    </TabsTrigger>
                    <TabsTrigger value="refunds" className="flex items-center gap-3 w-full justify-start px-4 py-3 rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900 data-[state=active]:shadow-sm">
                      <RotateCcw className="h-4 w-4" />
                      <span>Refund Policy</span>
                    </TabsTrigger>
                    <TabsTrigger value="creator" className="flex items-center gap-3 w-full justify-start px-4 py-3 rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900 data-[state=active]:shadow-sm">
                      <UserCheck className="h-4 w-4" />
                      <span>Creator Agreement</span>
                    </TabsTrigger>
                    <TabsTrigger value="backer" className="flex items-center gap-3 w-full justify-start px-4 py-3 rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900 data-[state=active]:shadow-sm">
                      <AlertTriangle className="h-4 w-4" />
                      <span>Backer Risks</span>
                    </TabsTrigger>
                    <TabsTrigger value="shipping" className="flex items-center gap-3 w-full justify-start px-4 py-3 rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900 data-[state=active]:shadow-sm">
                      <Package className="h-4 w-4" />
                      <span>Shipping & Rewards</span>
                    </TabsTrigger>
                    <TabsTrigger value="chargebacks" className="flex items-center gap-3 w-full justify-start px-4 py-3 rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900 data-[state=active]:shadow-sm">
                      <CreditCard className="h-4 w-4" />
                      <span>Chargebacks</span>
                    </TabsTrigger>
                    <TabsTrigger value="fraud" className="flex items-center gap-3 w-full justify-start px-4 py-3 rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900 data-[state=active]:shadow-sm">
                      <ShieldAlert className="h-4 w-4" />
                      <span>Fraud Policy</span>
                    </TabsTrigger>
                    <TabsTrigger value="cookies" className="flex items-center gap-3 w-full justify-start px-4 py-3 rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900 data-[state=active]:shadow-sm">
                      <Cookie className="h-4 w-4" />
                      <span>Cookie Policy</span>
                    </TabsTrigger>
                    <TabsTrigger value="guidelines" className="flex items-center gap-3 w-full justify-start px-4 py-3 rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900 data-[state=active]:shadow-sm">
                      <FileText className="h-4 w-4" />
                      <span>Community Guidelines</span>
                    </TabsTrigger>
                    <TabsTrigger value="dmca" className="flex items-center gap-3 w-full justify-start px-4 py-3 rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900 data-[state=active]:shadow-sm">
                      <Copyright className="h-4 w-4" />
                      <span>DMCA Policy</span>
                    </TabsTrigger>
                    <TabsTrigger value="ai-policy" className="flex items-center gap-3 w-full justify-start px-4 py-3 rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900 data-[state=active]:shadow-sm">
                      <Brain className="h-4 w-4" />
                      <span>AI Policy</span>
                    </TabsTrigger>
                    <TabsTrigger value="gdpr-ccpa" className="flex items-center gap-3 w-full justify-start px-4 py-3 rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900 data-[state=active]:shadow-sm">
                      <Globe className="h-4 w-4" />
                      <span>GDPR + CCPA</span>
                    </TabsTrigger>
                    <TabsTrigger value="data-deletion" className="flex items-center gap-3 w-full justify-start px-4 py-3 rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900 data-[state=active]:shadow-sm">
                      <Trash2 className="h-4 w-4" />
                      <span>Data Deletion</span>
                    </TabsTrigger>
                  </TabsList>
                </div>
              </div>

              {/* Right Content Area */}
              <div className="flex-1 min-w-0">

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

            {/* Chargeback Handling Policy */}
            <TabsContent value="chargebacks">
              <div className="prose prose-zinc dark:prose-invert max-w-none">
                <div className="rounded-lg border bg-white dark:bg-zinc-900 p-6 md:p-8">
                  <h2 className="text-2xl font-bold mb-2">Chargeback Handling Policy</h2>
                  <p className="text-sm text-zinc-500 mb-8">
                    <strong>Last Updated:</strong> November 27, 2025
                  </p>

                  <h3 className="text-xl font-semibold mt-8 mb-4">1. What Is a Chargeback?</h3>
                  <p className="mb-6">
                    A chargeback occurs when a backer disputes a pledge with their bank or card issuer.
                  </p>

                  <h3 className="text-xl font-semibold mt-8 mb-4">2. Consequences of Chargebacks</h3>
                  <p className="mb-4">When a backer files a chargeback:</p>
                  <ul className="list-disc pl-6 mb-6 space-y-2">
                    <li>Funds are withdrawn from the creator</li>
                    <li>The creator must dispute the chargeback</li>
                    <li>Excessive chargebacks may freeze a project</li>
                    <li>Backers who abuse chargebacks may have accounts restricted</li>
                  </ul>

                  <h3 className="text-xl font-semibold mt-8 mb-4">3. When Chargebacks Are Appropriate</h3>
                  <p className="mb-4">Chargebacks should only be filed if:</p>
                  <ul className="list-disc pl-6 mb-6 space-y-2">
                    <li>Fraud is suspected</li>
                    <li>Unauthorized transactions occurred</li>
                    <li>The creator engaged in clear misconduct</li>
                  </ul>

                  <h3 className="text-xl font-semibold mt-8 mb-4">4. IndieCrowdfund's Role</h3>
                  <p className="mb-4">IndieCrowdfund:</p>
                  <ul className="list-disc pl-6 mb-4 space-y-2">
                    <li>Cannot reverse bank chargebacks</li>
                    <li>Provides documentation to payment processors</li>
                    <li>May suspend campaigns with excessive disputes</li>
                  </ul>
                  <p className="mb-6 font-medium">
                    Creators should respond promptly to dispute notifications.
                  </p>

                  <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4">
                    <p className="font-semibold mb-2">Questions about chargebacks?</p>
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

            {/* Fraud & Misuse Enforcement Policy */}
            <TabsContent value="fraud">
              <div className="prose prose-zinc dark:prose-invert max-w-none">
                <div className="rounded-lg border bg-white dark:bg-zinc-900 p-6 md:p-8">
                  <h2 className="text-2xl font-bold mb-2">Fraud & Misuse Enforcement Policy</h2>
                  <p className="text-sm text-zinc-500 mb-8">
                    <strong>Last Updated:</strong> November 27, 2025
                  </p>

                  <p className="mb-4">IndieCrowdfund may take action against:</p>
                  <ul className="list-disc pl-6 mb-6 space-y-2">
                    <li>Fraudulent projects</li>
                    <li>Misuse of funds</li>
                    <li>Identity theft</li>
                    <li>Fake accounts</li>
                    <li>Harassment or threats</li>
                    <li>Use of the platform for illegal activities</li>
                    <li>Abuse of refunds or chargebacks</li>
                  </ul>

                  <p className="mb-4">Possible actions include:</p>
                  <ul className="list-disc pl-6 mb-6 space-y-2">
                    <li>Suspension of accounts</li>
                    <li>Removal of campaigns</li>
                    <li>Freezing payouts</li>
                    <li>Banning payment methods</li>
                    <li>Reporting to law enforcement</li>
                  </ul>

                  <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 mb-6">
                    <p className="text-emerald-800 dark:text-emerald-200 font-medium">
                      We take integrity seriously to protect backers and creators.
                    </p>
                  </div>

                  <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4">
                    <p className="font-semibold mb-2">Report suspicious activity:</p>
                    <p>
                      Contact us at{" "}
                      <a href="mailto:trust@indiecrowdfund.com" className="text-emerald-600 hover:underline">
                        trust@indiecrowdfund.com
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
            </TabsContent>

            {/* Community Guidelines */}
            <TabsContent value="guidelines">
              <div className="prose prose-zinc dark:prose-invert max-w-none">
                <div className="rounded-lg border bg-white dark:bg-zinc-900 p-6 md:p-8">
                  <h2 className="text-2xl font-bold mb-2">Community Guidelines</h2>
                  <p className="text-sm text-zinc-500 mb-8">
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
            </TabsContent>

            {/* DMCA / Intellectual Property Policy */}
            <TabsContent value="dmca">
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
            </TabsContent>

            {/* AI Tracking & Insights Policy */}
            <TabsContent value="ai-policy">
              <div className="prose prose-zinc dark:prose-invert max-w-none">
                <div className="rounded-lg border bg-white dark:bg-zinc-900 p-6 md:p-8">
                  <h2 className="text-2xl font-bold mb-2">Consent for AI Tracking & Insights Policy</h2>
                  <p className="text-sm text-zinc-500 mb-6 italic">
                    (Original Draft — Not Legal Advice)
                  </p>
                  <p className="text-sm text-zinc-500 mb-8">
                    <strong>Last Updated:</strong> November 27, 2025
                  </p>

                  <p className="mb-6">
                    This Consent for AI Tracking & Insights Policy ("Policy") explains how IndieCrowdfund, Inc. ("IndieCrowdfund," "we," "our," "us") uses artificial intelligence ("AI"), machine-learning ("ML"), and automated analytics tools to improve user experience, detect fraud, enhance creator performance insights, and maintain platform safety.
                  </p>

                  <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 mb-8">
                    <p className="text-emerald-800 dark:text-emerald-200 font-medium">
                      By using IndieCrowdfund, you acknowledge and agree to this Policy and provide informed consent to the AI-based processing described below.
                    </p>
                  </div>

                  <h3 className="text-xl font-semibold mt-8 mb-4">1. What Our AI Systems Do</h3>
                  <p className="mb-4">IndieCrowdfund uses AI and machine-learning systems to:</p>

                  <h4 className="text-lg font-semibold mt-6 mb-3">A. Improve Platform Performance</h4>
                  <ul className="list-disc pl-6 mb-4 space-y-2">
                    <li>Recommend relevant projects to users</li>
                    <li>Optimize search, tagging, and category discovery</li>
                    <li>Identify trending campaigns and backer behavior patterns</li>
                  </ul>

                  <h4 className="text-lg font-semibold mt-6 mb-3">B. Assist Creators</h4>
                  <p className="mb-2">We provide creators with insights such as:</p>
                  <ul className="list-disc pl-6 mb-4 space-y-2">
                    <li>Campaign performance predictions</li>
                    <li>Audience engagement heatmaps</li>
                    <li>Suggested reward pricing</li>
                    <li>Drop-off analysis on campaign pages</li>
                    <li>Content clarity scoring</li>
                  </ul>
                  <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400 italic">
                    These tools help creators optimize campaigns but do not guarantee outcomes.
                  </p>

                  <h4 className="text-lg font-semibold mt-6 mb-3">C. Fraud Prevention & Safety</h4>
                  <p className="mb-2">AI systems may analyze:</p>
                  <ul className="list-disc pl-6 mb-4 space-y-2">
                    <li>Duplicate account behavior</li>
                    <li>Suspicious pledge activity</li>
                    <li>Abnormal traffic patterns</li>
                    <li>Bots or automated attacks</li>
                    <li>Chargeback risk indicators</li>
                    <li>Potential violation of platform rules</li>
                  </ul>
                  <p className="mb-4">This allows us to keep the platform secure for both creators and backers.</p>

                  <h4 className="text-lg font-semibold mt-6 mb-3">D. Content Moderation Support</h4>
                  <p className="mb-2">AI may help detect:</p>
                  <ul className="list-disc pl-6 mb-4 space-y-2">
                    <li>Hate speech</li>
                    <li>Explicit content</li>
                    <li>Scams or misleading claims</li>
                    <li>Intellectual property misuse</li>
                  </ul>
                  <p className="mb-6 font-medium">Human reviewers make the final decisions when needed.</p>

                  <h3 className="text-xl font-semibold mt-8 mb-4">2. What Data AI May Process</h3>
                  <p className="mb-2">Our AI systems may analyze:</p>
                  <ul className="list-disc pl-6 mb-4 space-y-2">
                    <li>✓ Public campaign content you post</li>
                    <li>✓ Messaging metadata (not message contents unless flagged for community safety)</li>
                    <li>✓ Page visits, clicks, navigation patterns</li>
                    <li>✓ Pledge behavior and reward selections</li>
                    <li>✓ Device and browser information</li>
                    <li>✓ User-generated images or videos (for moderation, not creative training)</li>
                    <li>✓ Historical performance of similar projects</li>
                  </ul>

                  <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
                    <p className="font-semibold mb-2 text-red-800 dark:text-red-200">We DO NOT:</p>
                    <ul className="list-none space-y-1 text-red-700 dark:text-red-300">
                      <li>❌ use your private messages for marketing</li>
                      <li>❌ train AI models on private financial or personal data</li>
                      <li>❌ sell or license your behavioral data to third parties</li>
                    </ul>
                  </div>

                  <h3 className="text-xl font-semibold mt-8 mb-4">3. Automated Decision-Making</h3>
                  <p className="mb-2">AI tools may contribute to automated decisions related to:</p>
                  <ul className="list-disc pl-6 mb-4 space-y-2">
                    <li>Fraud prevention</li>
                    <li>Suspicious login attempts</li>
                    <li>Security alerts</li>
                    <li>Account verification actions</li>
                    <li>Recommendation ranking</li>
                    <li>Flagging potential policy violations</li>
                  </ul>
                  <p className="mb-6 font-medium">
                    Automated decisions do not result in account bans or removals without human review, except in extreme cases such as botnet attacks or confirmed payment fraud.
                  </p>

                  <h3 className="text-xl font-semibold mt-8 mb-4">4. Your Consent</h3>
                  <p className="mb-2">By using IndieCrowdfund, you:</p>
                  <ul className="list-disc pl-6 mb-4 space-y-2">
                    <li>✔ Consent to the use of AI/ML analytics as described</li>
                    <li>✔ Understand that AI systems help improve platform quality and safety</li>
                    <li>✔ Agree that insights may be generated from anonymized or pseudonymized data</li>
                    <li>✔ Acknowledge that recommendations and performance predictions are not guarantees</li>
                  </ul>

                  <p className="mb-2 font-medium">If you do not wish to allow AI analysis of your data:</p>
                  <p className="mb-2">You may opt out of non-essential analytics (see Section 8).</p>

                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-6">
                    <p className="font-semibold mb-2 text-amber-800 dark:text-amber-200">However, you cannot opt out of:</p>
                    <ul className="list-disc pl-6 space-y-1 text-amber-700 dark:text-amber-300">
                      <li>Security monitoring</li>
                      <li>Fraud detection</li>
                      <li>Abuse prevention</li>
                      <li>Legal compliance processing</li>
                    </ul>
                    <p className="mt-2 text-amber-700 dark:text-amber-300 text-sm">These are required for safe platform operation.</p>
                  </div>

                  <h3 className="text-xl font-semibold mt-8 mb-4">5. Data Privacy & Protection</h3>
                  <p className="mb-2">AI processing follows strict privacy rules:</p>
                  <ul className="list-disc pl-6 mb-4 space-y-2">
                    <li>Personal data is anonymized or pseudonymized whenever possible</li>
                    <li>Sensitive information is excluded from training datasets</li>
                    <li>No biometric identification is performed</li>
                    <li>No third-party sale of AI-generated insights</li>
                    <li>Data is stored according to industry security standards</li>
                    <li>Access to raw data is restricted</li>
                  </ul>
                  <p className="mb-6 font-medium">We comply with GDPR, CCPA, and other applicable regulations.</p>

                  <h3 className="text-xl font-semibold mt-8 mb-4">6. No AI Training on User-Created Content (Unless You Opt In)</h3>
                  <p className="mb-4">
                    IndieCrowdfund does not use your project text, images, videos, or messages to train any generative AI systems unless you explicitly opt in.
                  </p>
                  <p className="mb-2">Opt-in options may be offered for:</p>
                  <ul className="list-disc pl-6 mb-4 space-y-2">
                    <li>Creator tools that generate marketing copy</li>
                    <li>Reward-tier suggestions</li>
                    <li>Automated campaign optimization</li>
                  </ul>
                  <p className="mb-6 font-medium">You may opt out at any time.</p>

                  <h3 className="text-xl font-semibold mt-8 mb-4">7. AI Limitations</h3>
                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4">
                    <p className="font-semibold text-amber-800 dark:text-amber-200">AI insights are advisory only.</p>
                  </div>
                  <p className="mb-2">They may:</p>
                  <ul className="list-disc pl-6 mb-4 space-y-2">
                    <li>Be inaccurate</li>
                    <li>Change over time</li>
                    <li>Rely on incomplete or anonymized data</li>
                    <li>Misclassify or misinterpret certain patterns</li>
                  </ul>
                  <p className="mb-6 font-medium">Creators should use AI insights as guidance, not fact.</p>

                  <h3 className="text-xl font-semibold mt-8 mb-4">8. Opt-Out Options</h3>
                  <p className="mb-2">You may opt out of non-essential analytics, such as:</p>
                  <ul className="list-disc pl-6 mb-4 space-y-2">
                    <li>Behavioral recommendations</li>
                    <li>Creator performance scoring</li>
                    <li>Project prediction tools</li>
                    <li>Personalized browsing suggestions</li>
                  </ul>
                  <p className="mb-2 font-medium">To opt out:</p>
                  <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4 mb-4">
                    <p>
                      📧 Email:{" "}
                      <a href="mailto:privacy@indiecrowdfund.com" className="text-emerald-600 hover:underline">
                        privacy@indiecrowdfund.com
                      </a>
                    </p>
                    <p className="mt-1">Subject: "AI Analytics Opt-Out Request"</p>
                  </div>
                  <p className="mb-6">We will disable optional AI processing on your account within a reasonable timeframe.</p>

                  <h3 className="text-xl font-semibold mt-8 mb-4">9. Your Rights (GDPR, CCPA, Global Privacy Laws)</h3>
                  <p className="mb-2">If applicable in your region, you may:</p>
                  <ul className="list-disc pl-6 mb-4 space-y-2">
                    <li>Request access to AI-related personal data</li>
                    <li>Request correction of inaccurate data</li>
                    <li>Request deletion of personal data</li>
                    <li>Object to certain types of automated processing</li>
                    <li>Request human review of decisions that significantly affect you</li>
                  </ul>
                  <p className="mb-4">Submit requests to:</p>
                  <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4 mb-6">
                    <p>
                      📧{" "}
                      <a href="mailto:privacy@indiecrowdfund.com" className="text-emerald-600 hover:underline">
                        privacy@indiecrowdfund.com
                      </a>
                    </p>
                  </div>

                  <h3 className="text-xl font-semibold mt-8 mb-4">10. Policy Updates</h3>
                  <p className="mb-2">We may update this Policy as our AI tools evolve.</p>
                  <p className="mb-2">Material changes will be communicated via:</p>
                  <ul className="list-disc pl-6 mb-4 space-y-2">
                    <li>Email notifications</li>
                    <li>Website notices</li>
                    <li>Account inbox alerts</li>
                  </ul>
                  <p className="mb-6 font-medium">Continued use of the platform after updates constitutes acceptance.</p>

                  <h3 className="text-xl font-semibold mt-8 mb-4">11. Contact Information</h3>
                  <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4">
                    <p className="font-semibold mb-2">IndieCrowdfund, Inc.</p>
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
            </TabsContent>

            {/* GDPR + CCPA Addendum */}
            <TabsContent value="gdpr-ccpa">
              <div className="prose prose-zinc dark:prose-invert max-w-none">
                <div className="rounded-lg border bg-white dark:bg-zinc-900 p-6 md:p-8">
                  <h2 className="text-2xl font-bold mb-2">GDPR + CCPA Addendum</h2>
                  <p className="text-sm text-zinc-500 mb-8">
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
                    <p className="text-sm text-zinc-500 mt-2">
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
            </TabsContent>

            {/* Data Deletion Policy */}
            <TabsContent value="data-deletion">
              <div className="prose prose-zinc dark:prose-invert max-w-none">
                <div className="rounded-lg border bg-white dark:bg-zinc-900 p-6 md:p-8">
                  <h2 className="text-2xl font-bold mb-2">IndieCrowdfund — Data Deletion Policy</h2>
                  <p className="text-sm text-zinc-500 mb-8">
                    <strong>Last Updated:</strong> November 28, 2025
                  </p>

                  <p className="mb-6">
                    This Data Deletion Policy explains how IndieCrowdfund, Inc. ("IndieCrowdfund," "we," "our," "us") handles requests to delete personal data and accounts on IndieCrowdfund.com. This Policy is part of our Privacy Policy and applies to all users, including creators and backers.
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
                  <p className="mb-6">This data is restricted and not used for marketing.</p>

                  <h3 className="text-xl font-semibold mt-8 mb-4">6. How to Submit a Deletion Request</h3>
                  <p className="mb-4">You may request deletion through:</p>

                  <h4 className="text-lg font-semibold mt-6 mb-3">A. Email</h4>
                  <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4 mb-4">
                    <p className="mb-1">
                      📧{" "}
                      <a href="mailto:privacy@indiecrowdfund.com" className="text-emerald-600 hover:underline">
                        privacy@indiecrowdfund.com
                      </a>
                    </p>
                    <p className="text-sm text-zinc-500">Subject Line: Data Deletion Request</p>
                  </div>

                  <h4 className="text-lg font-semibold mt-6 mb-3">B. Account Settings</h4>
                  <p className="mb-4">
                    Settings → Privacy & Data → Delete My Account (If logged in)
                  </p>
                  <p className="mb-6">You may be required to verify ownership.</p>

                  <h3 className="text-xl font-semibold mt-8 mb-4">7. Processing Time</h3>
                  <p className="mb-4">Deletion requests are processed within:</p>
                  <ul className="list-disc pl-6 mb-4 space-y-2">
                    <li><strong>30 days</strong> for standard requests</li>
                    <li><strong>Up to 90 days</strong> for complex cases involving financial records or legal holds</li>
                  </ul>
                  <p className="mb-6">We will notify you if additional time is required.</p>

                  <h3 className="text-xl font-semibold mt-8 mb-4">8. Circumstances Where Deletion May Be Delayed or Denied</h3>
                  <p className="mb-4">We may temporarily deny or delay deletion if:</p>
                  <ul className="list-disc pl-6 mb-4 space-y-2">
                    <li>You are a creator with unresolved backer obligations</li>
                    <li>You are involved in an active dispute or investigation</li>
                    <li>Deletion would violate legal or regulatory requirements</li>
                    <li>Fraud indicators require retention</li>
                    <li>Requests are incomplete or unverified</li>
                  </ul>
                  <p className="mb-6">When denial is necessary, we will provide a written explanation.</p>

                  <h3 className="text-xl font-semibold mt-8 mb-4">9. Deletion Requests for Creator Accounts</h3>
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

                  <h3 className="text-xl font-semibold mt-8 mb-4">10. Children's Data</h3>
                  <p className="mb-6">
                    IndieCrowdfund does not knowingly collect data from children under 13. If such data is discovered, it will be deleted immediately upon verification.
                  </p>

                  <h3 className="text-xl font-semibold mt-8 mb-4">11. Changes to This Policy</h3>
                  <p className="mb-2">We may update this Policy from time to time.</p>
                  <p className="mb-2">Major changes will be communicated via:</p>
                  <ul className="list-disc pl-6 mb-4 space-y-2">
                    <li>Email notifications</li>
                    <li>Website announcements</li>
                    <li>Account dashboard notices</li>
                  </ul>
                  <p className="mb-6 font-medium">Continued use of the services after an update constitutes acceptance.</p>

                  <h3 className="text-xl font-semibold mt-8 mb-4">12. Contact Information</h3>
                  <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4">
                    <p className="font-semibold mb-2">IndieCrowdfund, Inc.</p>
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
            </TabsContent>
              </div>
            </div>

            {/* Mobile Layout - Dropdown or Grid */}
            <div className="md:hidden">
              {/* Mobile Tab Selector */}
              <div className="mb-6">
                <select
                  value={activeTab}
                  onChange={(e) => setActiveTab(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm font-medium dark:border-zinc-700 dark:bg-zinc-800"
                >
                  <option value="terms">Terms of Service</option>
                  <option value="privacy">Privacy Policy</option>
                  <option value="refunds">Refund Policy</option>
                  <option value="creator">Creator Agreement</option>
                  <option value="backer">Backer Risks</option>
                  <option value="shipping">Shipping & Rewards</option>
                  <option value="chargebacks">Chargebacks</option>
                  <option value="fraud">Fraud Policy</option>
                  <option value="cookies">Cookie Policy</option>
                  <option value="guidelines">Community Guidelines</option>
                  <option value="dmca">DMCA Policy</option>
                  <option value="ai-policy">AI Policy</option>
                  <option value="gdpr-ccpa">GDPR + CCPA</option>
                  <option value="data-deletion">Data Deletion</option>
                </select>
              </div>

              {/* Mobile Content */}
              <TabsContent value="terms">
                <div className="prose prose-zinc dark:prose-invert max-w-none">
                  <div className="rounded-lg border bg-white dark:bg-zinc-900 p-4">
                    <h2 className="text-xl font-bold mb-2">IndieCrowdfund — Terms of Service</h2>
                    <p className="text-sm text-zinc-500 mb-4">
                      <strong>Last Updated:</strong> November 27, 2025
                    </p>
                    <p className="text-sm">
                      View full terms on desktop for complete details.
                    </p>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="privacy">
                <div className="prose prose-zinc dark:prose-invert max-w-none">
                  <div className="rounded-lg border bg-white dark:bg-zinc-900 p-4">
                    <h2 className="text-xl font-bold mb-2">Privacy Policy</h2>
                    <p className="text-sm text-zinc-500 mb-4">
                      <strong>Last Updated:</strong> November 27, 2025
                    </p>
                    <p className="text-sm">
                      View full policy on desktop for complete details.
                    </p>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="refunds">
                <div className="prose prose-zinc dark:prose-invert max-w-none">
                  <div className="rounded-lg border bg-white dark:bg-zinc-900 p-4">
                    <h2 className="text-xl font-bold mb-2">Refund Policy</h2>
                    <p className="text-sm text-zinc-500 mb-4">
                      <strong>Last Updated:</strong> November 27, 2025
                    </p>
                    <p className="text-sm">
                      View full policy on desktop for complete details.
                    </p>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="creator">
                <div className="prose prose-zinc dark:prose-invert max-w-none">
                  <div className="rounded-lg border bg-white dark:bg-zinc-900 p-4">
                    <h2 className="text-xl font-bold mb-2">Creator Agreement</h2>
                    <p className="text-sm text-zinc-500 mb-4">
                      <strong>Last Updated:</strong> November 27, 2025
                    </p>
                    <p className="text-sm">
                      View full agreement on desktop for complete details.
                    </p>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="backer">
                <div className="prose prose-zinc dark:prose-invert max-w-none">
                  <div className="rounded-lg border bg-white dark:bg-zinc-900 p-4">
                    <h2 className="text-xl font-bold mb-2">Backer Risk Disclosure</h2>
                    <p className="text-sm text-zinc-500 mb-4">
                      <strong>Last Updated:</strong> November 27, 2025
                    </p>
                    <p className="text-sm">
                      View full disclosure on desktop for complete details.
                    </p>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="shipping">
                <div className="prose prose-zinc dark:prose-invert max-w-none">
                  <div className="rounded-lg border bg-white dark:bg-zinc-900 p-4">
                    <h2 className="text-xl font-bold mb-2">Shipping & Rewards</h2>
                    <p className="text-sm text-zinc-500 mb-4">
                      <strong>Last Updated:</strong> November 27, 2025
                    </p>
                    <p className="text-sm">
                      View full policy on desktop for complete details.
                    </p>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="chargebacks">
                <div className="prose prose-zinc dark:prose-invert max-w-none">
                  <div className="rounded-lg border bg-white dark:bg-zinc-900 p-4">
                    <h2 className="text-xl font-bold mb-2">Chargeback Policy</h2>
                    <p className="text-sm text-zinc-500 mb-4">
                      <strong>Last Updated:</strong> November 27, 2025
                    </p>
                    <p className="text-sm">
                      View full policy on desktop for complete details.
                    </p>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="fraud">
                <div className="prose prose-zinc dark:prose-invert max-w-none">
                  <div className="rounded-lg border bg-white dark:bg-zinc-900 p-4">
                    <h2 className="text-xl font-bold mb-2">Fraud Policy</h2>
                    <p className="text-sm text-zinc-500 mb-4">
                      <strong>Last Updated:</strong> November 27, 2025
                    </p>
                    <p className="text-sm">
                      View full policy on desktop for complete details.
                    </p>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="cookies">
                <div className="prose prose-zinc dark:prose-invert max-w-none">
                  <div className="rounded-lg border bg-white dark:bg-zinc-900 p-4">
                    <h2 className="text-xl font-bold mb-2">Cookie Policy</h2>
                    <p className="text-sm text-zinc-500 mb-4">
                      <strong>Last Updated:</strong> November 27, 2025
                    </p>
                    <p className="text-sm">
                      View full policy on desktop for complete details.
                    </p>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="guidelines">
                <div className="prose prose-zinc dark:prose-invert max-w-none">
                  <div className="rounded-lg border bg-white dark:bg-zinc-900 p-4">
                    <h2 className="text-xl font-bold mb-2">Community Guidelines</h2>
                    <p className="text-sm text-zinc-500 mb-4">
                      <strong>Last Updated:</strong> November 27, 2025
                    </p>
                    <p className="text-sm">
                      View full guidelines on desktop for complete details.
                    </p>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="dmca">
                <div className="prose prose-zinc dark:prose-invert max-w-none">
                  <div className="rounded-lg border bg-white dark:bg-zinc-900 p-4">
                    <h2 className="text-xl font-bold mb-2">DMCA Policy</h2>
                    <p className="text-sm text-zinc-500 mb-4">
                      <strong>Last Updated:</strong> November 27, 2025
                    </p>
                    <p className="text-sm">
                      View full policy on desktop for complete details.
                    </p>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="ai-policy">
                <div className="prose prose-zinc dark:prose-invert max-w-none">
                  <div className="rounded-lg border bg-white dark:bg-zinc-900 p-4">
                    <h2 className="text-xl font-bold mb-2">AI Policy</h2>
                    <p className="text-sm text-zinc-500 mb-4">
                      <strong>Last Updated:</strong> November 27, 2025
                    </p>
                    <p className="text-sm">
                      View full policy on desktop for complete details.
                    </p>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="gdpr-ccpa">
                <div className="prose prose-zinc dark:prose-invert max-w-none">
                  <div className="rounded-lg border bg-white dark:bg-zinc-900 p-4">
                    <h2 className="text-xl font-bold mb-2">GDPR + CCPA Addendum</h2>
                    <p className="text-sm text-zinc-500 mb-4">
                      <strong>Last Updated:</strong> November 28, 2025
                    </p>
                    <p className="text-sm">
                      View full addendum on desktop for complete details.
                    </p>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="data-deletion">
                <div className="prose prose-zinc dark:prose-invert max-w-none">
                  <div className="rounded-lg border bg-white dark:bg-zinc-900 p-4">
                    <h2 className="text-xl font-bold mb-2">Data Deletion Policy</h2>
                    <p className="text-sm text-zinc-500 mb-4">
                      <strong>Last Updated:</strong> November 28, 2025
                    </p>
                    <p className="text-sm">
                      View full policy on desktop for complete details.
                    </p>
                  </div>
                </div>
              </TabsContent>
            </div>
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
