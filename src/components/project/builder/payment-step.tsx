"use client";

import { getCSRFHeaders } from "@/lib/csrf";

import { useState, useEffect } from "react";
import { useProjectStore } from "@/lib/stores/project-store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CreditCard, Check, ExternalLink, Store, Info, AlertTriangle, CheckCircle, RefreshCw, Loader2, Save, Banknote, Lock, Building2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function PaymentStep() {
  const { payment, updatePayment, basics, projectId } = useProjectStore();
  const [isConnecting, setIsConnecting] = useState(false);
  const [stripeStatus, setStripeStatus] = useState<{
    connected: boolean;
    onboarded: boolean;
    loading: boolean;
    error: string | null;
  }>({ connected: false, onboarded: false, loading: true, error: null });
  const [connectError, setConnectError] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [emailSaved, setEmailSaved] = useState(false);

  // DivinityCoin bank account state
  const [bankAccount, setBankAccount] = useState({
    bankName: "",
    accountHolder: "",
    accountNumber: "",
    routingNumber: "",
    accountType: "checking" as "checking" | "savings",
  });
  const [bankAccountStatus, setBankAccountStatus] = useState<{
    saved: boolean;
    loading: boolean;
    lastFour: string | null;
  }>({ saved: false, loading: true, lastFour: null });
  const [isSavingBank, setIsSavingBank] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Chain2Pay bank account state
  const [chain2payBank, setChain2payBank] = useState({
    bankName: "",
    accountHolder: "",
    accountNumber: "",
    routingNumber: "",
    accountType: "checking" as "checking" | "savings",
  });
  const [chain2payBankStatus, setChain2payBankStatus] = useState<{
    saved: boolean;
    loading: boolean;
    lastFour: string | null;
  }>({ saved: false, loading: true, lastFour: null });
  const [isSavingChain2payBank, setIsSavingChain2payBank] = useState(false);

  // Save contact email to database immediately
  const handleSaveContactEmail = async () => {
    if (!projectId) {
      toast.error("Please save your project first before setting the contact email");
      return;
    }

    if (!payment.contactEmail || !payment.contactEmail.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }

    setIsSavingEmail(true);
    try {
      // Use dedicated contact-email endpoint for reliable saving
      const response = await fetch(`/api/projects/${projectId}/contact-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({ contactEmail: payment.contactEmail }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save email");
      }

      setEmailSaved(true);
      updatePayment({ contactEmailConfirmed: true });
      toast.success("Contact email saved!");

      // Reset the saved indicator after 3 seconds
      setTimeout(() => setEmailSaved(false), 3000);
    } catch (error) {
      console.error("Failed to save contact email:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save email");
    } finally {
      setIsSavingEmail(false);
    }
  };

  // Save DivinityCoin bank account
  const handleSaveBankAccount = async () => {
    if (!bankAccount.bankName || !bankAccount.accountHolder ||
        !bankAccount.accountNumber || !bankAccount.routingNumber) {
      toast.error("Please fill in all bank account fields");
      return;
    }

    // Basic validation
    if (bankAccount.routingNumber.length !== 9) {
      toast.error("Routing number must be 9 digits");
      return;
    }

    if (bankAccount.accountNumber.length < 4 || bankAccount.accountNumber.length > 17) {
      toast.error("Please enter a valid account number");
      return;
    }

    setIsSavingBank(true);
    try {
      const response = await fetch("/api/creator/bank-account", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({ ...bankAccount, projectId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save bank account");
      }

      const data = await response.json();
      setBankAccountStatus({
        saved: true,
        loading: false,
        lastFour: data.lastFour,
      });
      // Clear sensitive fields from local state
      setBankAccount(prev => ({
        ...prev,
        accountNumber: "",
        routingNumber: "",
      }));
      toast.success("Bank account saved securely!");
    } catch (error) {
      console.error("Failed to save bank account:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save bank account");
    } finally {
      setIsSavingBank(false);
    }
  };

  // Save Chain2Pay bank account
  const handleSaveChain2payBank = async () => {
    if (!chain2payBank.bankName || !chain2payBank.accountHolder ||
        !chain2payBank.accountNumber || !chain2payBank.routingNumber) {
      toast.error("Please fill in all bank account fields");
      return;
    }

    if (chain2payBank.routingNumber.length !== 9) {
      toast.error("Routing number must be 9 digits");
      return;
    }

    if (chain2payBank.accountNumber.length < 4 || chain2payBank.accountNumber.length > 17) {
      toast.error("Please enter a valid account number");
      return;
    }

    setIsSavingChain2payBank(true);
    try {
      const response = await fetch("/api/creator/chain2pay-bank-account", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({ ...chain2payBank, projectId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save bank account");
      }

      const data = await response.json();
      setChain2payBankStatus({
        saved: true,
        loading: false,
        lastFour: data.lastFour,
      });
      setChain2payBank(prev => ({
        ...prev,
        accountNumber: "",
        routingNumber: "",
      }));
      toast.success("Chain2Pay bank account saved securely!");
    } catch (error) {
      console.error("Failed to save Chain2Pay bank account:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save bank account");
    } finally {
      setIsSavingChain2payBank(false);
    }
  };

  // Load current contact email from database on mount
  useEffect(() => {
    async function loadContactEmail() {
      if (!projectId) return;
      try {
        const response = await fetch(`/api/projects/${projectId}/contact-email`);
        if (response.ok) {
          const data = await response.json();
          if (data.contactEmail && data.contactEmail !== payment.contactEmail) {
            updatePayment({ contactEmail: data.contactEmail, contactEmailConfirmed: true });
            setEmailSaved(true);
          }
        }
      } catch (error) {
        console.error("Failed to load contact email:", error);
      }
    }
    loadContactEmail();
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Check DivinityCoin bank account status on mount
  useEffect(() => {
    async function checkBankAccountStatus() {
      try {
        const response = await fetch("/api/creator/bank-account");
        if (response.ok) {
          const data = await response.json();
          setBankAccountStatus({
            saved: data.exists,
            loading: false,
            lastFour: data.lastFour || null,
          });
          if (data.exists) {
            setBankAccount(prev => ({
              ...prev,
              bankName: data.bankName || "",
              accountHolder: data.accountHolder || "",
              accountType: data.accountType || "checking",
            }));
          }
        } else {
          setBankAccountStatus({ saved: false, loading: false, lastFour: null });
        }
      } catch {
        setBankAccountStatus({ saved: false, loading: false, lastFour: null });
      }
    }
    checkBankAccountStatus();
  }, []);

  // Check Chain2Pay bank account status on mount
  useEffect(() => {
    async function checkChain2payBankStatus() {
      try {
        const response = await fetch("/api/creator/chain2pay-bank-account");
        if (response.ok) {
          const data = await response.json();
          setChain2payBankStatus({
            saved: data.exists,
            loading: false,
            lastFour: data.lastFour || null,
          });
          if (data.exists) {
            setChain2payBank(prev => ({
              ...prev,
              bankName: data.bankName || "",
              accountHolder: data.accountHolder || "",
              accountType: data.accountType || "checking",
            }));
          }
        } else {
          setChain2payBankStatus({ saved: false, loading: false, lastFour: null });
        }
      } catch {
        setChain2payBankStatus({ saved: false, loading: false, lastFour: null });
      }
    }
    checkChain2payBankStatus();
  }, []);

  // Check Stripe connection status on mount
  useEffect(() => {
    async function checkStripeStatus() {
      try {
        const response = await fetch("/api/stripe/connect");
        const data = await response.json();

        if (!response.ok) {
          setStripeStatus({
            connected: false,
            onboarded: false,
            loading: false,
            error: data.error || "Failed to check status",
          });
          return;
        }

        setStripeStatus({
          connected: data.connected || false,
          onboarded: data.onboarded || false,
          loading: false,
          error: null,
        });
      } catch (error) {
        console.error("Failed to check Stripe status:", error);
        setStripeStatus({
          connected: false,
          onboarded: false,
          loading: false,
          error: "Network error checking status"
        });
      }
    }
    checkStripeStatus();
  }, []);

  const goalAmount = basics.goalAmount || 10000;
  const hasAdultContent = payment.hasAdultContent || payment.hasRiskyContent;

  // If adult/risky content is selected, Stripe is NOT allowed (must use DivinityCoin or Chain2Pay)
  const mustUseAltProcessor = payment.hasAdultContent || payment.hasRiskyContent;

  // Auto-switch away from Stripe if adult content is selected (keep Chain2Pay or DivinityCoin if already selected)
  useEffect(() => {
    if (mustUseAltProcessor && payment.paymentProcessor !== "DIVINITYCOIN" && payment.paymentProcessor !== "CHAIN2PAY") {
      updatePayment({ paymentProcessor: "DIVINITYCOIN" });
    }
  }, [mustUseAltProcessor, payment.paymentProcessor, updatePayment]);

  // Stripe fee calculations
  // Stripe: 2.9% + $0.30 per transaction
  // Platform fee: 3%
  const avgPledgeSize = 50; // Assume average pledge
  const numTransactions = goalAmount / avgPledgeSize;
  const stripeFee = goalAmount * 0.029 + numTransactions * 0.30;
  const platformFee = goalAmount * 0.03;
  const totalFees = stripeFee + platformFee;
  const netAmount = goalAmount - totalFees;

  const handleConnectStripe = async () => {
    setIsConnecting(true);
    setConnectError(null);
    try {
      const response = await fetch("/api/stripe/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
      });

      const data = await response.json();

      if (!response.ok) {
        setConnectError(data.error || "Failed to connect Stripe");
        return;
      }

      if (data.onboardingUrl) {
        window.location.href = data.onboardingUrl;
      }
    } catch (error) {
      console.error("Failed to initiate Stripe connection:", error);
      setConnectError("Network error connecting to Stripe");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleResetStripe = async () => {
    setIsResetting(true);
    setConnectError(null);
    try {
      const response = await fetch("/api/stripe/connect/reset", {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        setConnectError(data.error || "Failed to reset Stripe");
        return;
      }

      // Reset the status
      setStripeStatus({
        connected: false,
        onboarded: false,
        loading: false,
        error: null,
      });
    } catch (error) {
      console.error("Failed to reset Stripe connection:", error);
      setConnectError("Network error resetting Stripe");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Contact Email */}
      <div className="space-y-2">
        <Label htmlFor="contactEmail">
          Contact Email <span className="text-destructive">*</span>
        </Label>
        <div className="flex items-center gap-3">
          <Input
            id="contactEmail"
            type="email"
            placeholder="your@email.com"
            value={payment.contactEmail || ""}
            onChange={(e) => {
              updatePayment({ contactEmail: e.target.value, contactEmailConfirmed: false });
              setEmailSaved(false);
            }}
            className="flex-1"
          />
          <Button
            type="button"
            variant={emailSaved ? "default" : "outline"}
            size="sm"
            onClick={handleSaveContactEmail}
            disabled={isSavingEmail || !payment.contactEmail || emailSaved}
            className={emailSaved ? "bg-green-600 hover:bg-green-600" : ""}
          >
            {isSavingEmail ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Saving...
              </>
            ) : emailSaved ? (
              <>
                <CheckCircle className="h-4 w-4 mr-1" />
                Saved
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-1" />
                Save Email
              </>
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {projectId
            ? "Click 'Save Email' to commit this email to your project. This email will receive important notifications about your campaign."
            : "Save your project first (click Next on any step), then you can save your contact email."}
        </p>
      </div>

      {/* Project Type */}
      <div className="space-y-2">
        <Label>Project Type</Label>
        <Select
          value={payment.projectType || "INDIVIDUAL"}
          onValueChange={(value) =>
            updatePayment({ projectType: value as "INDIVIDUAL" | "BUSINESS" | "NONPROFIT" })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="INDIVIDUAL">
              Individual (raising funds in your own name)
            </SelectItem>
            <SelectItem value="BUSINESS">
              Business (raising on behalf of a company)
            </SelectItem>
            <SelectItem value="NONPROFIT">
              Nonprofit (raising for a nonprofit organization)
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {/* Content Declaration */}
      <div className="space-y-4">
        <div>
          <h3 className="font-semibold">Content Declaration</h3>
          <p className="text-sm text-muted-foreground">
            Please indicate if your project contains sensitive content
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="adult-content"
              checked={payment.hasAdultContent || false}
              onCheckedChange={(checked) =>
                updatePayment({ hasAdultContent: checked as boolean })
              }
            />
            <Label htmlFor="adult-content" className="font-normal">
              My project contains adult content but is used to further the narrative of the story and not in an explicit way.
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="risky-content"
              checked={payment.hasRiskyContent || false}
              onCheckedChange={(checked) =>
                updatePayment({ hasRiskyContent: checked as boolean })
              }
            />
            <Label htmlFor="risky-content" className="font-normal">
              My project contains controversial or violent content but is used to further the narrative of the story and not in an explicit way.
            </Label>
          </div>

          {/* SFW promo agreement - mandatory */}
          <div className="mt-4 p-4 rounded-lg border bg-amber-50/50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
            <div className="flex items-start space-x-2">
              <Checkbox
                id="promo-sfw"
                checked={payment.promoContentSfw || false}
                onCheckedChange={(checked) =>
                  updatePayment({ promoContentSfw: checked as boolean })
                }
                required
              />
              <div className="space-y-1">
                <Label htmlFor="promo-sfw" className="font-medium cursor-pointer">
                  I agree that no NSFW content will be used in my project&apos;s promotional video, image, or project title <span className="text-destructive">*</span>
                </Label>
                <p className="text-xs text-muted-foreground">
                  This allows your project to be displayed publicly on the platform. Users will need to verify their age before viewing the full project content.
                </p>
              </div>
            </div>
          </div>
        </div>

        {hasAdultContent && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>I agree that no NSFW content will be used in my project&apos;s promotional video, image, or project title</AlertTitle>
            <AlertDescription>
              Projects with controversial or violent content but is used to further the narrative require additional review before launch.
              Please ensure your promotional materials are safe for work.
            </AlertDescription>
          </Alert>
        )}
      </div>

      <Separator />

      {/* Payment Processor Selection */}
      <div className="space-y-4">
        <div>
          <h3 className="font-semibold">Payment Processing</h3>
          <p className="text-sm text-muted-foreground">
            Select how you want to receive payments from backers
          </p>
        </div>

        {mustUseAltProcessor && (
          <Alert className="bg-blue-50/50 dark:bg-blue-900/20 border-[#0066FF]/30 dark:border-[#0066FF]/40">
            <AlertTriangle className="h-4 w-4 text-[#0066FF]" />
            <AlertTitle>Alternative Processor Required</AlertTitle>
            <AlertDescription>
              Projects with adult or controversial content must use DivinityCoin or Chain2Pay for payment processing.
              Stripe does not process payments for this type of content.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          {/* Stripe Option */}
          <Card
            className={`cursor-pointer transition-all ${
              payment.paymentProcessor === "STRIPE" ? "border-2 border-primary" : "border"
            } ${mustUseAltProcessor ? "opacity-50 cursor-not-allowed" : ""}`}
            onClick={() => !mustUseAltProcessor && updatePayment({ paymentProcessor: "STRIPE" })}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-[#635BFF] flex items-center justify-center">
                    <CreditCard className="h-5 w-5 text-white" />
                  </div>
                  Stripe
                  {!mustUseAltProcessor && (
                    <Badge variant="secondary" className="ml-2">Recommended</Badge>
                  )}
                </CardTitle>
                {payment.paymentProcessor === "STRIPE" && (
                  <CheckCircle className="h-5 w-5 text-primary" />
                )}
              </div>
              <CardDescription>
                {mustUseAltProcessor
                  ? "Not available for adult/controversial content"
                  : "Industry-leading payment processing"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Check className="h-3 w-3 text-green-500" />
                  <span>~6% total fees (2.9% + $0.30 + 3% platform)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-3 w-3 text-green-500" />
                  <span>Fast payouts via Stripe Connect</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-3 w-3 text-green-500" />
                  <span>All major cards + Apple/Google Pay</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* DivinityCoin Option */}
          <Card
            className={`cursor-pointer transition-all ${
              payment.paymentProcessor === "DIVINITYCOIN" ? "border-2 border-primary" : "border"
            }`}
            onClick={() => updatePayment({ paymentProcessor: "DIVINITYCOIN" })}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-[#0066FF] flex items-center justify-center">
                    <Banknote className="h-5 w-5 text-white" />
                  </div>
                  DivinityCoin
                  {mustUseAltProcessor && (
                    <Badge variant="default" className="ml-2 bg-[#0066FF]">Required</Badge>
                  )}
                </CardTitle>
                {payment.paymentProcessor === "DIVINITYCOIN" && (
                  <CheckCircle className="h-5 w-5 text-primary" />
                )}
              </div>
              <CardDescription>
                Universal credit system for all content types
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Check className="h-3 w-3 text-green-500" />
                  <span>~9% total fees (6% partner + 3% platform)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-3 w-3 text-green-500" />
                  <span>Settlements within 14 business days</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-3 w-3 text-green-500" />
                  <span>Supports adult/controversial content</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Chain2Pay Option */}
          <Card
            className={`cursor-pointer transition-all ${
              payment.paymentProcessor === "CHAIN2PAY" ? "border-2 border-indigo-500" : "border"
            }`}
            onClick={() => updatePayment({ paymentProcessor: "CHAIN2PAY" })}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                    <Wallet className="h-5 w-5 text-white" />
                  </div>
                  Chain2Pay
                </CardTitle>
                {payment.paymentProcessor === "CHAIN2PAY" && (
                  <CheckCircle className="h-5 w-5 text-indigo-500" />
                )}
              </div>
              <CardDescription>
                Accept payments via credit card and crypto. Lower fees than Stripe.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Check className="h-3 w-3 text-green-500" />
                  <span>3% platform + 2.5% processing = ~5.5% total</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-3 w-3 text-green-500" />
                  <span>Settlements via bank transfer</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-3 w-3 text-green-500" />
                  <span>Supports adult/controversial content</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Fee Calculator */}
        {payment.paymentProcessor === "STRIPE" && (
          <div className="rounded-lg bg-muted/50 p-4 border">
            <h4 className="font-medium mb-3">
              Stripe Fee Breakdown for {formatCurrency(goalAmount)} Goal
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Stripe processing fee (~2.9% + $0.30/txn)</span>
                <span className="font-medium">{formatCurrency(stripeFee)}</span>
              </div>
              <div className="flex justify-between">
                <span>Platform fee (3%)</span>
                <span className="font-medium">{formatCurrency(platformFee)}</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between font-semibold">
                <span>Total fees</span>
                <span className="text-amber-600">{formatCurrency(totalFees)}</span>
              </div>
              <div className="flex justify-between font-semibold text-lg">
                <span>You receive</span>
                <span className="text-green-600">{formatCurrency(netAmount)}</span>
              </div>
            </div>
          </div>
        )}

        {payment.paymentProcessor === "DIVINITYCOIN" && (
          <>
          <Alert className="bg-gradient-to-r from-blue-50/80 to-sky-50/80 dark:from-blue-900/20 dark:to-sky-900/20 border-[#0066FF]/30 dark:border-[#0066FF]/40">
            <Banknote className="h-4 w-4 text-[#0066FF]" />
            <AlertTitle>Why Choose DivinityCoin?</AlertTitle>
            <AlertDescription className="mt-2 space-y-2 text-sm">
              <p>
                <strong>Content Freedom:</strong> Unlike traditional payment processors, DivinityCoin has no content restrictions.
                Your campaign cannot be taken down or have payments frozen due to adult, mature, or controversial content in your project.
              </p>
              <p>
                <strong>Protection from Processor Policies:</strong> Stripe and other traditional processors can refuse service
                or freeze funds at any time based on their content policies. With DivinityCoin, your funds are secure and protected
                from arbitrary policy changes.
              </p>
              <p>
                <strong>Pre-funded Payments:</strong> Backers purchase DivinityCoin credits in advance, meaning when they pledge
                to your campaign, the funds are already secured. This eliminates failed payment issues common with traditional
                card processing.
              </p>
              <a
                href="https://divinitycoin.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[#0066FF] hover:text-[#0052CC] hover:underline font-medium"
              >
                Learn more about DivinityCoin <ExternalLink className="h-3 w-3" />
              </a>
            </AlertDescription>
          </Alert>

          <div className="rounded-lg bg-muted/50 p-4 border">
            <h4 className="font-medium mb-3">
              DivinityCoin Fee Breakdown for {formatCurrency(goalAmount)} Goal
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>DivinityCoin partner fee (6%)</span>
                <span className="font-medium">{formatCurrency(goalAmount * 0.06)}</span>
              </div>
              <div className="flex justify-between">
                <span>Platform fee (3%)</span>
                <span className="font-medium">{formatCurrency((goalAmount - goalAmount * 0.06) * 0.03)}</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between font-semibold">
                <span>Total fees</span>
                <span className="text-[#0066FF]">
                  {formatCurrency(goalAmount * 0.06 + (goalAmount - goalAmount * 0.06) * 0.03)}
                </span>
              </div>
              <div className="flex justify-between font-semibold text-lg">
                <span>You receive</span>
                <span className="text-green-600">
                  {formatCurrency(goalAmount - goalAmount * 0.06 - (goalAmount - goalAmount * 0.06) * 0.03)}
                </span>
              </div>
            </div>
          </div>
          </>
        )}

        {payment.paymentProcessor === "CHAIN2PAY" && (
          <>
          <Alert className="bg-gradient-to-r from-indigo-50/80 to-blue-50/80 dark:from-indigo-900/20 dark:to-blue-900/20 border-indigo-400/30 dark:border-indigo-500/40">
            <Wallet className="h-4 w-4 text-indigo-600" />
            <AlertTitle>Why Choose Chain2Pay?</AlertTitle>
            <AlertDescription className="mt-2 space-y-2 text-sm">
              <p>
                <strong>Lower Fees:</strong> Chain2Pay offers our lowest total fees at ~5.5% (3% platform fee + 2.5% Chain2Pay processing)
                — lower than traditional card processing through Stripe (~6%). More of your backers&apos; money goes directly to your project.
              </p>
              <p>
                <strong>Chargeback Protection:</strong> Because Chain2Pay settles payments as USDC on the Polygon blockchain,
                transactions are final and irreversible once confirmed. This eliminates the risk of chargebacks that plague
                traditional card processors, where backers can dispute charges months after a campaign ends — protecting your
                revenue and giving you peace of mind during fulfillment.
              </p>
              <p>
                <strong>Content Freedom:</strong> Like DivinityCoin, Chain2Pay has no content restrictions. Your campaign cannot
                be taken down or have payments frozen due to adult, mature, or controversial content. Traditional processors like
                Stripe can refuse service or freeze funds based on their content policies — Chain2Pay removes that risk entirely.
              </p>
              <p>
                <strong>Flexible Payment Options:</strong> Accept both credit card and cryptocurrency payments from your backers.
                Backers pay with their regular card in USD — no crypto knowledge needed on their end. Chain2Pay handles the
                fiat-to-crypto conversion seamlessly behind the scenes.
              </p>
              <p>
                <strong>Bank Settlements:</strong> Receive your funds via direct bank transfer after your campaign is funded.
                Chain2Pay converts crypto settlements to fiat automatically and deposits to your bank account within 14 business days.
              </p>
              <p>
                <strong>PCI Compliant & Secure:</strong> Chain2Pay uses a redirect-based hosted checkout (SAQ A — the lowest PCI
                burden level). Your backers enter card details on Chain2Pay&apos;s secure page, so IndieCrowdfund never touches
                credit card data. All communication is HTTPS-only with CSRF protection on every payment initiation.
              </p>
              <a
                href="https://chain2pay.cloud/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700 hover:underline font-medium"
              >
                Learn more about Chain2Pay <ExternalLink className="h-3 w-3" />
              </a>
            </AlertDescription>
          </Alert>

          <div className="rounded-lg bg-muted/50 p-4 border">
            <h4 className="font-medium mb-3">
              Chain2Pay Fee Breakdown for {formatCurrency(goalAmount)} Goal
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Platform fee (3%)</span>
                <span className="font-medium">{formatCurrency(goalAmount * 0.03)}</span>
              </div>
              <div className="flex justify-between">
                <span>Chain2Pay processing (2.5%)</span>
                <span className="font-medium">{formatCurrency(goalAmount * 0.025)}</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between font-semibold">
                <span>Total fees</span>
                <span className="text-indigo-600">
                  {formatCurrency(goalAmount * 0.055)}
                </span>
              </div>
              <div className="flex justify-between font-semibold text-lg">
                <span>You receive</span>
                <span className="text-green-600">
                  {formatCurrency(goalAmount - goalAmount * 0.055)}
                </span>
              </div>
            </div>
          </div>
          </>
        )}
      </div>

      <Separator />

      {/* Connect Stripe Account - Only show when Stripe is selected */}
      {payment.paymentProcessor === "STRIPE" && (
      <div className="space-y-4">
        <h3 className="font-semibold">Connect Your Stripe Account</h3>

        {/* Show errors if any */}
        {(stripeStatus.error || connectError) && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Stripe Connection Issue</AlertTitle>
            <AlertDescription className="space-y-3">
              <span>{stripeStatus.error || connectError}</span>
              {connectError?.includes("already connected") && (
                <div className="flex flex-col gap-2">
                  <span>
                    If you previously connected a Stripe account but never completed onboarding,
                    you can reset your connection and try again.
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowResetConfirm(true)}
                    disabled={isResetting}
                    className="w-fit"
                  >
                    {isResetting ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Resetting...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Reset Stripe Connection
                      </>
                    )}
                  </Button>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        <Card className={stripeStatus.onboarded ? "border-green-500" : ""}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-4">
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${
                  stripeStatus.onboarded ? "bg-green-500" : "bg-[#635BFF]"
                }`}>
                  {stripeStatus.onboarded ? (
                    <CheckCircle className="h-6 w-6 text-white" />
                  ) : (
                    <CreditCard className="h-6 w-6 text-white" />
                  )}
                </div>
                <div>
                  <p className="font-medium">
                    {stripeStatus.onboarded ? "Stripe Connected" : "Stripe Connect"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {stripeStatus.loading ? (
                      "Checking connection status..."
                    ) : stripeStatus.onboarded ? (
                      "Your Stripe account is connected and ready to receive payments."
                    ) : stripeStatus.connected ? (
                      "Your Stripe account is connected but onboarding is incomplete. Click to continue setup."
                    ) : (
                      "Connect or create a Stripe account to receive payouts. You'll complete identity verification through Stripe's secure process."
                    )}
                  </p>
                </div>
              </div>
              {stripeStatus.onboarded ? (
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="bg-green-500">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Connected
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowResetConfirm(true)}
                    disabled={isResetting}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    {isResetting ? "Disconnecting..." : "Disconnect"}
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={handleConnectStripe}
                  disabled={isConnecting || stripeStatus.loading}
                >
                  {stripeStatus.loading ? "Checking..." : isConnecting ? "Connecting..." : stripeStatus.connected ? "Complete Setup" : "Connect Stripe"}
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {!stripeStatus.onboarded && (
          <p className="text-xs text-muted-foreground">
            Don&apos;t have a Stripe account?{" "}
            <a
              href="https://stripe.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              Sign up for free
            </a>
            {" "}&bull; It only takes a few minutes to get started
          </p>
        )}
      </div>
      )}

      {/* Chain2Pay Bank Account for Settlements - Only show when Chain2Pay is selected */}
      {payment.paymentProcessor === "CHAIN2PAY" && (
      <>
      <Separator />

      <div className="space-y-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Wallet className="h-5 w-5 text-indigo-600" />
            Chain2Pay Settlement Account
          </h3>
          <p className="text-sm text-muted-foreground">
            Enter your bank account details for Chain2Pay settlements. All data is encrypted and stored securely.
          </p>
        </div>

        <Card className={chain2payBankStatus.saved ? "border-green-500" : ""}>
          <CardContent className="pt-6">
            {chain2payBankStatus.loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : chain2payBankStatus.saved ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-xl bg-green-500 flex items-center justify-center shrink-0">
                      <CheckCircle className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="font-medium">Bank Account Connected</p>
                      <p className="text-sm text-muted-foreground">
                        {chain2payBank.bankName} • Account ending in {chain2payBankStatus.lastFour}
                      </p>
                    </div>
                  </div>
                  <Badge variant="default" className="bg-green-500">
                    <Lock className="h-3 w-3 mr-1" />
                    Secured
                  </Badge>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setChain2payBankStatus(prev => ({ ...prev, saved: false }))}
                >
                  Update Bank Account
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <Alert className="bg-blue-50/50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                  <Lock className="h-4 w-4" />
                  <AlertTitle>Secure & Encrypted</AlertTitle>
                  <AlertDescription>
                    Your bank account information is encrypted using AES-256 encryption before storage.
                    We never store unencrypted account numbers.
                  </AlertDescription>
                </Alert>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="c2p-bank-name">Bank Name</Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="c2p-bank-name"
                        placeholder="e.g., Chase Bank, Bank of America"
                        value={chain2payBank.bankName}
                        onChange={(e) => setChain2payBank(prev => ({ ...prev, bankName: e.target.value }))}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="c2p-account-holder">Account Holder Name</Label>
                    <Input
                      id="c2p-account-holder"
                      placeholder="Name as it appears on account"
                      value={chain2payBank.accountHolder}
                      onChange={(e) => setChain2payBank(prev => ({ ...prev, accountHolder: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="c2p-routing-number">Routing Number</Label>
                    <Input
                      id="c2p-routing-number"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={9}
                      placeholder="9-digit routing number"
                      value={chain2payBank.routingNumber}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, "").slice(0, 9);
                        setChain2payBank(prev => ({ ...prev, routingNumber: value }));
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      9 digits, found on the bottom left of your checks
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="c2p-account-number">Account Number</Label>
                    <Input
                      id="c2p-account-number"
                      type="password"
                      inputMode="numeric"
                      maxLength={17}
                      placeholder="Your account number"
                      value={chain2payBank.accountNumber}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, "").slice(0, 17);
                        setChain2payBank(prev => ({ ...prev, accountNumber: value }));
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Account Type</Label>
                  <Select
                    value={chain2payBank.accountType}
                    onValueChange={(value: "checking" | "savings") =>
                      setChain2payBank(prev => ({ ...prev, accountType: value }))
                    }
                  >
                    <SelectTrigger className="w-full sm:w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="checking">Checking</SelectItem>
                      <SelectItem value="savings">Savings</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <Button
                    onClick={handleSaveChain2payBank}
                    disabled={isSavingChain2payBank}
                    className="bg-indigo-600 hover:bg-indigo-700"
                  >
                    {isSavingChain2payBank ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Encrypting & Saving...
                      </>
                    ) : (
                      <>
                        <Lock className="h-4 w-4 mr-2" />
                        Save Bank Account
                      </>
                    )}
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground">
                  Chain2Pay settlements are processed within 14 business days after your campaign ends.{" "}
                  <a
                    href="https://chain2pay.cloud/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    Learn more about Chain2Pay
                  </a>
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      </>
      )}

      {/* DivinityCoin Bank Account for Settlements - Only show when DivinityCoin is selected */}
      {payment.paymentProcessor === "DIVINITYCOIN" && (
      <>
      <Separator />

      <div className="space-y-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Banknote className="h-5 w-5" />
            DivinityCoin Settlement Account
          </h3>
          <p className="text-sm text-muted-foreground">
            Enter your bank account details for DivinityCoin settlements. All data is encrypted and stored securely.
          </p>
        </div>

        <Card className={bankAccountStatus.saved ? "border-green-500" : ""}>
          <CardContent className="pt-6">
            {bankAccountStatus.loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : bankAccountStatus.saved ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-xl bg-green-500 flex items-center justify-center shrink-0">
                      <CheckCircle className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <p className="font-medium">Bank Account Connected</p>
                      <p className="text-sm text-muted-foreground">
                        {bankAccount.bankName} • Account ending in {bankAccountStatus.lastFour}
                      </p>
                    </div>
                  </div>
                  <Badge variant="default" className="bg-green-500">
                    <Lock className="h-3 w-3 mr-1" />
                    Secured
                  </Badge>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBankAccountStatus(prev => ({ ...prev, saved: false }))}
                >
                  Update Bank Account
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <Alert className="bg-blue-50/50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                  <Lock className="h-4 w-4" />
                  <AlertTitle>Secure & Encrypted</AlertTitle>
                  <AlertDescription>
                    Your bank account information is encrypted using AES-256 encryption before storage.
                    We never store unencrypted account numbers.
                  </AlertDescription>
                </Alert>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="bank-name">Bank Name</Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="bank-name"
                        placeholder="e.g., Chase Bank, Bank of America"
                        value={bankAccount.bankName}
                        onChange={(e) => setBankAccount(prev => ({ ...prev, bankName: e.target.value }))}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="account-holder">Account Holder Name</Label>
                    <Input
                      id="account-holder"
                      placeholder="Name as it appears on account"
                      value={bankAccount.accountHolder}
                      onChange={(e) => setBankAccount(prev => ({ ...prev, accountHolder: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="routing-number">Routing Number</Label>
                    <Input
                      id="routing-number"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={9}
                      placeholder="9-digit routing number"
                      value={bankAccount.routingNumber}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, "").slice(0, 9);
                        setBankAccount(prev => ({ ...prev, routingNumber: value }));
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      9 digits, found on the bottom left of your checks
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="account-number">Account Number</Label>
                    <Input
                      id="account-number"
                      type="password"
                      inputMode="numeric"
                      maxLength={17}
                      placeholder="Your account number"
                      value={bankAccount.accountNumber}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, "").slice(0, 17);
                        setBankAccount(prev => ({ ...prev, accountNumber: value }));
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Account Type</Label>
                  <Select
                    value={bankAccount.accountType}
                    onValueChange={(value: "checking" | "savings") =>
                      setBankAccount(prev => ({ ...prev, accountType: value }))
                    }
                  >
                    <SelectTrigger className="w-full sm:w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="checking">Checking</SelectItem>
                      <SelectItem value="savings">Savings</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <Button
                    onClick={handleSaveBankAccount}
                    disabled={isSavingBank}
                  >
                    {isSavingBank ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Encrypting & Saving...
                      </>
                    ) : (
                      <>
                        <Lock className="h-4 w-4 mr-2" />
                        Save Bank Account
                      </>
                    )}
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground">
                  DivinityCoin settlements are processed within 14 business days after your campaign ends.{" "}
                  <a
                    href="https://divinitycoin.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    Learn more about DivinityCoin
                  </a>
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      </>
      )}

      <Separator />

      {/* Retailer Access */}
      <div className="space-y-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Store className="h-5 w-5" />
            Retailer Access (LCS Program)
          </h3>
          <p className="text-sm text-muted-foreground">
            Allow certified retailers to purchase your products at wholesale pricing
          </p>
        </div>

        <Card className={payment.allowRetailerPledges ? "border-primary" : ""}>
          <CardContent className="pt-6">
            <div className="flex items-start space-x-3">
              <Checkbox
                id="allow-retailers"
                checked={payment.allowRetailerPledges || false}
                onCheckedChange={(checked) =>
                  updatePayment({ allowRetailerPledges: checked as boolean })
                }
              />
              <div className="flex-1">
                <Label htmlFor="allow-retailers" className="font-medium">
                  Enable retailer wholesale orders
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Certified retailers (comic shops, bookstores, etc.) will be able to place bulk orders
                  at a discounted wholesale price. This can help increase your project&apos;s reach and
                  get your product into physical stores.
                </p>
              </div>
            </div>

            {payment.allowRetailerPledges && (
              <div className="mt-6 space-y-4 border-t pt-4">
                <Alert className="bg-primary/5 border-primary/20">
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Your project will be visible to all certified retailers in our LCS Program.
                    Retailers must place orders that meet your minimum quantity requirement.
                  </AlertDescription>
                </Alert>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="retailer-discount">Wholesale Discount (%)</Label>
                    <Select
                      value={String(payment.retailerDiscount || 50)}
                      onValueChange={(value) =>
                        updatePayment({ retailerDiscount: parseInt(value) })
                      }
                    >
                      <SelectTrigger id="retailer-discount">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="40">40% off retail</SelectItem>
                        <SelectItem value="45">45% off retail</SelectItem>
                        <SelectItem value="50">50% off retail (recommended)</SelectItem>
                        <SelectItem value="55">55% off retail</SelectItem>
                        <SelectItem value="60">60% off retail</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Industry standard is 50% wholesale discount
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="min-quantity">Minimum Order Quantity</Label>
                    <Input
                      id="min-quantity"
                      type="number"
                      min={1}
                      value={payment.retailerMinQuantity || 5}
                      onChange={(e) =>
                        updatePayment({ retailerMinQuantity: parseInt(e.target.value) || 5 })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Minimum units per wholesale order
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="max-quantity">Maximum Order Quantity</Label>
                    <Input
                      id="max-quantity"
                      type="number"
                      min={0}
                      placeholder="No limit"
                      value={payment.retailerMaxQuantity || ""}
                      onChange={(e) =>
                        updatePayment({
                          retailerMaxQuantity: e.target.value
                            ? parseInt(e.target.value)
                            : undefined,
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Leave empty for no limit
                    </p>
                  </div>
                </div>

                <div className="rounded-lg bg-muted p-4">
                  <h4 className="font-medium mb-2">Retailer Pricing Preview</h4>
                  <div className="text-sm space-y-1">
                    <p>
                      If your reward tier is priced at <span className="font-medium">{formatCurrency(25)}</span>,
                      retailers will pay{" "}
                      <span className="font-medium text-green-600">
                        {formatCurrency(25 * (1 - (payment.retailerDiscount || 50) / 100))}
                      </span>{" "}
                      per unit ({payment.retailerDiscount || 50}% discount)
                    </p>
                    <p className="text-muted-foreground">
                      For a minimum order of {payment.retailerMinQuantity || 5} units, that&apos;s{" "}
                      {formatCurrency(
                        25 * (1 - (payment.retailerDiscount || 50) / 100) * (payment.retailerMinQuantity || 5)
                      )}{" "}
                      wholesale
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={showResetConfirm}
        onOpenChange={setShowResetConfirm}
        title="Disconnect Stripe Account?"
        description="Are you sure you want to disconnect your Stripe account? You will need to reconnect it to accept payments."
        confirmText="Disconnect"
        variant="destructive"
        onConfirm={handleResetStripe}
        loading={isResetting}
      />
    </div>
  );
}
