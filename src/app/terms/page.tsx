"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
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

// Tab values exposed in the URL ?tab=… so other legal docs (e.g. TOS
// "see our Content Guidelines § 4") can deep-link to a specific tab
// instead of dumping users on the Terms tab and making them hunt for
// the right sidebar entry.
const VALID_TAB_VALUES = new Set([
  "terms", "privacy", "refunds", "creator", "backer", "shipping",
  "chargebacks", "fraud", "cookies", "guidelines", "dmca", "ai",
  "gdpr", "data-deletion", "nsfw", "pci",
]);

export default function TermsPage() {
  const searchParams = useSearchParams();
  const tabParam = searchParams?.get("tab");
  const [activeTab, setActiveTab] = useState(
    tabParam && VALID_TAB_VALUES.has(tabParam) ? tabParam : "terms"
  );

  // Re-sync if the URL changes via navigation (e.g. Link inside this
  // page goes to /terms?tab=privacy without a full reload). Skip
  // unknown values so a typo'd link doesn't blank the page.
  useEffect(() => {
    if (tabParam && VALID_TAB_VALUES.has(tabParam) && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabParam]);

  return (
    <div className="relative min-h-screen bg-background overflow-hidden">
      {/* Floating orbs background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="floating-orb absolute -top-40 -right-40 w-[500px] h-[500px] bg-primary/10" />
        <div className="floating-orb absolute top-1/2 -left-40 w-[400px] h-[400px] bg-purple-500/8" style={{ animationDelay: '-7s' }} />
        <div className="floating-orb absolute -bottom-40 right-1/3 w-[350px] h-[350px] bg-blue-500/8" style={{ animationDelay: '-14s' }} />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
              IndieCrowdfund
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/discover" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Discover
            </Link>
            <Link href="/projects/new" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Start a Project
            </Link>
            <Link href="/retailers" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Retailers
            </Link>
            <Link href="/about-us" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              About Us
            </Link>
            <Link href="/faq" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
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

      <main className="container mx-auto px-4 py-8 relative">
        {/* Back Link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            Legal & Policies
          </h1>
          <p className="text-muted-foreground mb-8">
            Important information about using IndieCrowdfund
          </p>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full" orientation="vertical">
            {/* Desktop Layout - Vertical Tabs on Left */}
            <div className="hidden md:flex gap-8">
              {/* Left Sidebar Navigation */}
              <div className="w-64 flex-shrink-0">
                <div className="sticky top-24">
                  <TabsList className="flex flex-col h-auto w-full glass-card rounded-lg p-2 space-y-1">
                    <TabsTrigger value="terms" className="flex items-center gap-3 w-full justify-start px-4 py-3 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">
                      <ScrollText className="h-4 w-4" />
                      <span>Terms of Service</span>
                    </TabsTrigger>
                    <TabsTrigger value="privacy" className="flex items-center gap-3 w-full justify-start px-4 py-3 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">
                      <Shield className="h-4 w-4" />
                      <span>Privacy Policy</span>
                    </TabsTrigger>
                    <TabsTrigger value="refunds" className="flex items-center gap-3 w-full justify-start px-4 py-3 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">
                      <RotateCcw className="h-4 w-4" />
                      <span>Refund Policy</span>
                    </TabsTrigger>
                    <TabsTrigger value="creator" className="flex items-center gap-3 w-full justify-start px-4 py-3 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">
                      <UserCheck className="h-4 w-4" />
                      <span>Creator Agreement</span>
                    </TabsTrigger>
                    <TabsTrigger value="backer" className="flex items-center gap-3 w-full justify-start px-4 py-3 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">
                      <AlertTriangle className="h-4 w-4" />
                      <span>Backer Risks</span>
                    </TabsTrigger>
                    <TabsTrigger value="shipping" className="flex items-center gap-3 w-full justify-start px-4 py-3 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">
                      <Package className="h-4 w-4" />
                      <span>Shipping & Rewards</span>
                    </TabsTrigger>
                    <TabsTrigger value="chargebacks" className="flex items-center gap-3 w-full justify-start px-4 py-3 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">
                      <CreditCard className="h-4 w-4" />
                      <span>Chargebacks</span>
                    </TabsTrigger>
                    <TabsTrigger value="fraud" className="flex items-center gap-3 w-full justify-start px-4 py-3 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">
                      <ShieldAlert className="h-4 w-4" />
                      <span>Fraud Policy</span>
                    </TabsTrigger>
                    <TabsTrigger value="cookies" className="flex items-center gap-3 w-full justify-start px-4 py-3 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">
                      <Cookie className="h-4 w-4" />
                      <span>Cookie Policy</span>
                    </TabsTrigger>
                    <TabsTrigger value="guidelines" className="flex items-center gap-3 w-full justify-start px-4 py-3 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">
                      <FileText className="h-4 w-4" />
                      <span>Community Guidelines</span>
                    </TabsTrigger>
                    <TabsTrigger value="dmca" className="flex items-center gap-3 w-full justify-start px-4 py-3 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">
                      <Copyright className="h-4 w-4" />
                      <span>DMCA Policy</span>
                    </TabsTrigger>
                    <TabsTrigger value="ai-policy" className="flex items-center gap-3 w-full justify-start px-4 py-3 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">
                      <Brain className="h-4 w-4" />
                      <span>AI Policy</span>
                    </TabsTrigger>
                    <TabsTrigger value="gdpr-ccpa" className="flex items-center gap-3 w-full justify-start px-4 py-3 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">
                      <Globe className="h-4 w-4" />
                      <span>GDPR + CCPA</span>
                    </TabsTrigger>
                    <TabsTrigger value="data-deletion" className="flex items-center gap-3 w-full justify-start px-4 py-3 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">
                      <Trash2 className="h-4 w-4" />
                      <span>Data Deletion</span>
                    </TabsTrigger>
                    <TabsTrigger value="nsfw" className="flex items-center gap-3 w-full justify-start px-4 py-3 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">
                      <EyeOff className="h-4 w-4" />
                      <span>NSFW Policy</span>
                    </TabsTrigger>
                    <TabsTrigger value="pci-compliance" className="flex items-center gap-3 w-full justify-start px-4 py-3 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all">
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
                  className="w-full rounded-lg border border-border bg-white px-4 py-3 text-sm font-medium dark:border-zinc-700 dark:bg-zinc-800"
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
