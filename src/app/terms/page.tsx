/* eslint-disable react/no-unescaped-entities */

"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ScrollText, Shield, Cookie, FileText, Menu, ArrowLeft, RotateCcw, UserCheck, AlertTriangle, Package, CreditCard, ShieldAlert, Copyright, Brain, Globe, Trash2, EyeOff, Lock } from "lucide-react";
import {
  TermsOfServiceContent,
  PrivacyPolicyContent,
  RefundPolicyContent,
  CreatorAgreementContent,
  BackerAgreementContent,
  ShippingPolicyContent,
  ChargebacksPolicyContent,
  FraudPolicyContent,
  CookiePolicyContent,
  ContentGuidelinesContent,
  DmcaPolicyContent,
  AiPolicyContent,
  GdprCcpaPolicyContent,
  DataDeletionPolicyContent,
  NsfwPolicyContent,
  PciComplianceContent,
} from "@/components/legal";

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
                    <TabsTrigger value="nsfw" className="flex items-center gap-3 w-full justify-start px-4 py-3 rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900 data-[state=active]:shadow-sm">
                      <EyeOff className="h-4 w-4" />
                      <span>NSFW Policy</span>
                    </TabsTrigger>
                    <TabsTrigger value="pci-compliance" className="flex items-center gap-3 w-full justify-start px-4 py-3 rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-900 data-[state=active]:shadow-sm">
                      <Lock className="h-4 w-4" />
                      <span>PCI Compliance Certification</span>
                    </TabsTrigger>
                  </TabsList>
                </div>
              </div>

              {/* Right Content Area */}
              <div className="flex-1 min-w-0">
                <TabsContent value="terms">
                  <TermsOfServiceContent />
                </TabsContent>

                <TabsContent value="privacy">
                  <PrivacyPolicyContent />
                </TabsContent>

                <TabsContent value="refunds">
                  <RefundPolicyContent />
                </TabsContent>

                <TabsContent value="creator">
                  <CreatorAgreementContent />
                </TabsContent>

                <TabsContent value="backer">
                  <BackerAgreementContent />
                </TabsContent>

                <TabsContent value="shipping">
                  <ShippingPolicyContent />
                </TabsContent>

                <TabsContent value="chargebacks">
                  <ChargebacksPolicyContent />
                </TabsContent>

                <TabsContent value="fraud">
                  <FraudPolicyContent />
                </TabsContent>

                <TabsContent value="cookies">
                  <CookiePolicyContent />
                </TabsContent>

                <TabsContent value="guidelines">
                  <ContentGuidelinesContent />
                </TabsContent>

                <TabsContent value="dmca">
                  <DmcaPolicyContent />
                </TabsContent>

                <TabsContent value="ai-policy">
                  <AiPolicyContent />
                </TabsContent>

                <TabsContent value="gdpr-ccpa">
                  <GdprCcpaPolicyContent />
                </TabsContent>

                <TabsContent value="data-deletion">
                  <DataDeletionPolicyContent />
                </TabsContent>

                <TabsContent value="nsfw">
                  <NsfwPolicyContent />
                </TabsContent>

                <TabsContent value="pci-compliance">
                  <PciComplianceContent />
                </TabsContent>
              </div>
            </div>

            {/* Mobile Layout - Dropdown */}
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
                  <option value="nsfw">NSFW Policy</option>
                  <option value="pci-compliance">PCI Compliance Certification</option>
                </select>
              </div>

              {/* Mobile Content - Use same components */}
              <TabsContent value="terms">
                <TermsOfServiceContent />
              </TabsContent>

              <TabsContent value="privacy">
                <PrivacyPolicyContent />
              </TabsContent>

              <TabsContent value="refunds">
                <RefundPolicyContent />
              </TabsContent>

              <TabsContent value="creator">
                <CreatorAgreementContent />
              </TabsContent>

              <TabsContent value="backer">
                <BackerAgreementContent />
              </TabsContent>

              <TabsContent value="shipping">
                <ShippingPolicyContent />
              </TabsContent>

              <TabsContent value="chargebacks">
                <ChargebacksPolicyContent />
              </TabsContent>

              <TabsContent value="fraud">
                <FraudPolicyContent />
              </TabsContent>

              <TabsContent value="cookies">
                <CookiePolicyContent />
              </TabsContent>

              <TabsContent value="guidelines">
                <ContentGuidelinesContent />
              </TabsContent>

              <TabsContent value="dmca">
                <DmcaPolicyContent />
              </TabsContent>

              <TabsContent value="ai-policy">
                <AiPolicyContent />
              </TabsContent>

              <TabsContent value="gdpr-ccpa">
                <GdprCcpaPolicyContent />
              </TabsContent>

              <TabsContent value="data-deletion">
                <DataDeletionPolicyContent />
              </TabsContent>

              <TabsContent value="nsfw">
                <NsfwPolicyContent />
              </TabsContent>

              <TabsContent value="pci-compliance">
                <PciComplianceContent />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
