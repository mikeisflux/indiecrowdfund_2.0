"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useState, useEffect } from "react";
import { useProjectStore } from "@/lib/stores/project-store";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  CampaignTypeSection,
  ContactEmailSection,
  ProjectTypeSection,
  ContentDeclarationSection,
  PaymentProcessorSection,
  DivinityCoinBankSection,
  PayPalBankPayoutSection,
  WhopBankPayoutSection,
  RetailerAccessSection,
  ChargebackCardSection,
  PaymentCloudBankSection,
} from "./payment-sections";
import type {
  PaymentCloudBankAccountState,
  PaymentCloudBankAccountStatus,
} from "./payment-sections";
import { UserChargebackCardSection } from "@/components/payments/user-chargeback-card-section";

export function PaymentStep() {
  const { payment, updatePayment, basics, projectId, projectStatus } = useProjectStore();
  const [isMigratingToPayPal, setIsMigratingToPayPal] = useState(false);

  const handleMigrateToPayPal = async () => {
    if (!projectId) return;
    setIsMigratingToPayPal(true);
    try {
      const res = await apiFetch(`/api/projects/${projectId}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentProcessor: "PAYPAL" }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to switch processor");
      }
      updatePayment({ paymentProcessor: "PAYPAL" });
      toast.success("Switched to PayPal! New pledges will now use PayPal checkout.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to switch to PayPal");
    } finally {
      setIsMigratingToPayPal(false);
    }
  };

  const showPayPalMigrationBanner =
    payment.paymentProcessor === "STRIPE" &&
    !payment.hasAdultContent &&
    !payment.hasRiskyContent &&
    (projectStatus === "LIVE" || projectStatus === "APPROVED" || projectStatus === "FUNDED");
  // Stripe Connect state - DISABLED: Stripe replaced by PayPal
  // const [isConnecting, setIsConnecting] = useState(false);
  // const [stripeStatus, setStripeStatus] = useState<{
  //   connected: boolean;
  //   onboarded: boolean;
  //   loading: boolean;
  //   error: string | null;
  // }>({ connected: false, onboarded: false, loading: true, error: null });
  // const [connectError, setConnectError] = useState<string | null>(null);
  // const [isResetting, setIsResetting] = useState(false);

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
  // const [showResetConfirm, setShowResetConfirm] = useState(false); // Stripe Connect removed

  // Chargeback card state
  const [chargebackCard, setChargebackCard] = useState({
    cardNumber: "",
    expMonth: "",
    expYear: "",
    cvc: "",
    billingName: "",
    billingLine1: "",
    billingLine2: "",
    billingCity: "",
    billingState: "",
    billingZip: "",
    billingCountry: "US",
  });
  const [chargebackCardStatus, setChargebackCardStatus] = useState<{
    saved: boolean;
    loading: boolean;
    lastFour: string | null;
    brand: string | null;
    expMonth: number | null;
    expYear: number | null;
  }>({ saved: false, loading: true, lastFour: null, brand: null, expMonth: null, expYear: null });
  const [isSavingCard, setIsSavingCard] = useState(false);

  // PaymentCloud-specific: public tokenization key for Collect.js +
  // creator's payout bank account state. Loaded lazily so the legacy
  // (DivinityCoin/PayPal/Whop) flows aren't affected.
  const [nmiPublicKey, setNmiPublicKey] = useState<string | null>(null);
  const [nmiPublicKeyLoading, setNmiPublicKeyLoading] = useState(false);
  const [pcBankAccount, setPcBankAccount] = useState<PaymentCloudBankAccountState>({
    bankName: "",
    firstName: "",
    lastName: "",
    accountNumber: "",
    routingNumber: "",
    accountType: "checking",
    billingLine1: "",
    billingLine2: "",
    billingCity: "",
    billingState: "",
    billingZip: "",
    billingCountry: "US",
  });
  const [pcBankAccountStatus, setPcBankAccountStatus] = useState<PaymentCloudBankAccountStatus>({
    saved: false,
    loading: true,
    lastFour: null,
  });

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
      const response = await apiFetch("/api/creator/bank-account", {
        method: "POST",
        headers: { "Content-Type": "application/json", },
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

  // PaymentCloud loaders. We only fetch when the project is on NMI to
  // avoid hitting a 404 from /api/payments/nmi/public-key on legacy
  // (PayPal/DivinityCoin/Whop) projects whose admin keys aren't set.
  useEffect(() => {
    if (payment.paymentProcessor !== "NMI") return;
    let cancelled = false;
    (async () => {
      // Public tokenization key
      if (!nmiPublicKey && !nmiPublicKeyLoading) {
        setNmiPublicKeyLoading(true);
        try {
          const r = await fetch("/api/payments/nmi/public-key");
          if (r.ok) {
            const data = await r.json();
            if (!cancelled && data?.publicKey) setNmiPublicKey(data.publicKey);
          }
        } catch {
          /* swallow — form will show "not configured" */
        } finally {
          if (!cancelled) setNmiPublicKeyLoading(false);
        }
      }

      // Existing PaymentCloud bank account
      try {
        const r = await fetch("/api/creator/paymentcloud-bank-account");
        if (cancelled) return;
        if (r.ok) {
          const data = await r.json();
          setPcBankAccountStatus({
            saved: !!data.exists,
            loading: false,
            lastFour: data.lastFour ?? null,
          });
          if (data.exists) {
            setPcBankAccount((prev) => ({
              ...prev,
              bankName: data.bankName || "",
              accountType: data.accountType || "checking",
            }));
          }
        } else {
          setPcBankAccountStatus({ saved: false, loading: false, lastFour: null });
        }
      } catch {
        if (!cancelled)
          setPcBankAccountStatus({ saved: false, loading: false, lastFour: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [payment.paymentProcessor, nmiPublicKey, nmiPublicKeyLoading]);

  // Check chargeback card status on mount
  useEffect(() => {
    const checkChargebackCard = async () => {
      if (!projectId) {
        setChargebackCardStatus(prev => ({ ...prev, loading: false }));
        return;
      }
      try {
        const response = await fetch(`/api/projects/${projectId}/chargeback-card`);
        if (response.ok) {
          const data = await response.json();
          setChargebackCardStatus({
            saved: data.exists,
            loading: false,
            lastFour: data.lastFour || null,
            brand: data.brand || null,
            expMonth: data.expMonth || null,
            expYear: data.expYear || null,
          });
        } else {
          setChargebackCardStatus({ saved: false, loading: false, lastFour: null, brand: null, expMonth: null, expYear: null });
        }
      } catch {
        setChargebackCardStatus({ saved: false, loading: false, lastFour: null, brand: null, expMonth: null, expYear: null });
      }
    };
    checkChargebackCard();
  }, [projectId]);

  // Save chargeback card
  const handleSaveChargebackCard = async () => {
    if (!projectId) {
      toast.error("Please save your project first");
      return;
    }

    const { cardNumber, expMonth, expYear, cvc, billingName, billingLine1, billingCity, billingState, billingZip, billingCountry } = chargebackCard;

    if (!cardNumber || !expMonth || !expYear || !cvc) {
      toast.error("Please fill in all card fields");
      return;
    }

    if (!billingName || !billingLine1 || !billingCity || !billingState || !billingZip || !billingCountry) {
      toast.error("Please fill in all billing address fields");
      return;
    }

    setIsSavingCard(true);
    try {
      const response = await apiFetch(`/api/projects/${projectId}/chargeback-card`, {
        method: "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify(chargebackCard),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save card");
      }

      const data = await response.json();
      setChargebackCardStatus({
        saved: true,
        loading: false,
        lastFour: data.lastFour,
        brand: data.brand,
        expMonth: data.expMonth,
        expYear: data.expYear,
      });
      // Clear sensitive fields from local state
      setChargebackCard(prev => ({
        ...prev,
        cardNumber: "",
        cvc: "",
      }));
      toast.success("Chargeback protection card saved securely!");
    } catch (error) {
      console.error("Failed to save chargeback card:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save card");
    } finally {
      setIsSavingCard(false);
    }
  };

  // Check Stripe connection status - DISABLED: Stripe replaced by PayPal
  // useEffect(() => {
  //   async function checkStripeStatus() {
  //     try {
  //       const response = await fetch("/api/stripe/connect");
  //       const data = await response.json();
  //       if (!response.ok) {
  //         setStripeStatus({ connected: false, onboarded: false, loading: false, error: data.error || "Failed to check status" });
  //         return;
  //       }
  //       setStripeStatus({ connected: data.connected || false, onboarded: data.onboarded || false, loading: false, error: null });
  //     } catch (error) {
  //       console.error("Failed to check Stripe status:", error);
  //       setStripeStatus({ connected: false, onboarded: false, loading: false, error: "Network error checking status" });
  //     }
  //   }
  //   checkStripeStatus();
  // }, []);

  const goalAmount = Number(basics.goalAmount) || 10000;
  const hasAdultContent = payment.hasAdultContent || payment.hasRiskyContent;

  // If adult/risky content is selected, PayPal is NOT allowed (DivinityCoin,
  // Whop, and PaymentCloud are all fine). PayPal flags adult content during
  // their KYC review, so we steer creators away from it up front.
  const mustUseAltProcessor = payment.hasAdultContent || payment.hasRiskyContent;

  const campaignType = payment.campaignType || "ALL_OR_NOTHING";
  const isLaunched = ["LIVE", "FUNDED", "FAILED", "CANCELLED"].includes(projectStatus || "");

  // PaymentCloud is the only processor for new campaigns. The auto-switch
  // effects that previously routed projects between PayPal/DivinityCoin/
  // Whop are no longer needed because there's nothing to switch between.
  // Existing projects already on those processors keep their selection
  // (the field is locked once a project goes LIVE/FUNDED/FAILED), and
  // their backend payout/webhook flows continue to work.

  // Auto-migrate legacy non-launched drafts to NMI on load. Without
  // this, a draft created before the PaymentCloud rollout still has
  // paymentProcessor="PAYPAL" stored, which renders the wrong fee
  // breakdown panel beneath the PaymentCloud card (the only
  // selectable card after the legacy ones were commented out).
  // Launched projects keep their original processor — admins can
  // change it via the legacy migration banner if needed.
  useEffect(() => {
    if (isLaunched) return;
    if (!payment.paymentProcessor) return;
    if (payment.paymentProcessor === "NMI") return;
    updatePayment({ paymentProcessor: "NMI" });
  }, [isLaunched, payment.paymentProcessor, updatePayment]);

  // Fee calculations
  const avgPledgeSize = 50; // Assume average pledge
  const numTransactions = goalAmount / avgPledgeSize;

  // Stripe: 2.9% + $0.30 per transaction
  const stripeFee = goalAmount * 0.029 + numTransactions * 0.30;
  const platformFee = goalAmount * 0.03;
  const totalFees = stripeFee + platformFee;
  const netAmount = goalAmount - totalFees;

  // PayPal Advanced Checkout: 3.49% + $0.49 per transaction
  const paypalFee = goalAmount * 0.0349 + numTransactions * 0.49;
  const paypalTotalFees = paypalFee + platformFee;
  const paypalNetAmount = goalAmount - paypalTotalFees;

  // Whop: 3% per transaction
  const whopFee = goalAmount * 0.03;
  const whopTotalFees = whopFee + platformFee;
  const whopNetAmount = goalAmount - whopTotalFees;

  // PaymentCloud (NMI white-label): 4% + $0.38 per transaction
  // ($0.25 NMI gateway + $0.13 Customer Vault per-txn fee, since
  // every pledge tokenizes through the vault). Platform fee is taken
  // on the remainder after processor fees.
  const paymentCloudFee = goalAmount * 0.04;
  const paymentCloudPerTxnFee = numTransactions * 0.38;
  const paymentCloudPlatformFee = (goalAmount - paymentCloudFee - paymentCloudPerTxnFee) * 0.03;
  const paymentCloudTotalFees =
    paymentCloudFee + paymentCloudPerTxnFee + paymentCloudPlatformFee;
  const paymentCloudNetAmount = goalAmount - paymentCloudTotalFees;

  // Stripe Connect handlers - DISABLED: Stripe replaced by PayPal
  // const handleConnectStripe = async () => { ... };
  // const handleResetStripe = async () => { ... };

  return (
    <div className="space-y-8">
      {/* PayPal Migration Banner — shown for live/approved Stripe campaigns */}
      {showPayPalMigrationBanner && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30 p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5 sm:mt-0" />
          <div className="flex-1">
            <p className="font-semibold text-amber-900 dark:text-amber-200">
              Your campaign is using Stripe (legacy)
            </p>
            <p className="text-sm text-amber-800 dark:text-amber-300 mt-0.5">
              IndieCrowdfund has switched to PayPal as the primary payment processor. Switch your live campaign now — existing pledges are unaffected, and new pledges will use PayPal checkout immediately.
            </p>
          </div>
          <Button
            onClick={handleMigrateToPayPal}
            disabled={isMigratingToPayPal}
            className="bg-amber-600 hover:bg-amber-700 text-white whitespace-nowrap flex-shrink-0"
          >
            {isMigratingToPayPal ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" />Switching...</>
            ) : (
              "Switch to PayPal"
            )}
          </Button>
        </div>
      )}

      {/* Contact Email */}
      <ContactEmailSection
        payment={payment}
        updatePayment={updatePayment}
        projectId={projectId}
      />

      {/* Project Type */}
      <ProjectTypeSection
        payment={payment}
        updatePayment={updatePayment}
      />

      <Separator />

      {/* Content Declaration */}
      <ContentDeclarationSection
        payment={payment}
        updatePayment={updatePayment}
        hasAdultContent={hasAdultContent}
      />

      <Separator />

      {/* Campaign Funding Model */}
      <CampaignTypeSection
        campaignType={campaignType}
        onSelect={(type) => updatePayment({ campaignType: type })}
        mustUseAltProcessor={!!mustUseAltProcessor}
      />

      <Separator />

      {/* Payment Processor Selection */}
      <PaymentProcessorSection
        payment={payment}
        updatePayment={updatePayment}
        mustUseAltProcessor={mustUseAltProcessor}
        campaignType={campaignType}
        isLaunched={isLaunched}
        goalAmount={goalAmount}
        stripeFee={stripeFee}
        platformFee={platformFee}
        totalFees={totalFees}
        netAmount={netAmount}
        paypalFee={paypalFee}
        paypalTotalFees={paypalTotalFees}
        paypalNetAmount={paypalNetAmount}
        whopFee={whopFee}
        whopTotalFees={whopTotalFees}
        whopNetAmount={whopNetAmount}
        paymentCloudFee={paymentCloudFee}
        paymentCloudPerTxnFee={paymentCloudPerTxnFee}
        paymentCloudTotalFees={paymentCloudTotalFees}
        paymentCloudNetAmount={paymentCloudNetAmount}
      />

      <Separator />

      {/* Connect Stripe Account - DISABLED: Stripe replaced by PayPal */}
      {/* {payment.paymentProcessor === "STRIPE" && (
        <StripeConnectSection
          stripeStatus={stripeStatus}
          connectError={connectError}
          isConnecting={isConnecting}
          isResetting={isResetting}
          handleConnectStripe={handleConnectStripe}
          setShowResetConfirm={setShowResetConfirm}
        />
      )} */}

      {/* Chargeback Protection Card — placed before the payout bank
          section so creators set up their recoup card first. PaymentCloud
          projects use Collect.js (PAN never touches our servers); legacy
          projects keep the old AES-encrypted form so existing rows still work. */}
      <Separator />
      {payment.paymentProcessor === "NMI" ? (
        // User-level chargeback card (shared with IndieKit Payments tab
        // and marketplace settings). Saving here unlocks the same card
        // everywhere; each creator only sees their own.
        <UserChargebackCardSection idPrefix="builder-cb" />
      ) : (
        <ChargebackCardSection
          chargebackCard={chargebackCard}
          setChargebackCard={setChargebackCard}
          chargebackCardStatus={chargebackCardStatus}
          setChargebackCardStatus={setChargebackCardStatus}
          isSavingCard={isSavingCard}
          handleSaveChargebackCard={handleSaveChargebackCard}
          projectId={projectId}
        />
      )}

      {/* PaymentCloud (NMI) creator payout bank account */}
      {payment.paymentProcessor === "NMI" && (
        <>
          <Separator />
          <PaymentCloudBankSection
            bankAccount={pcBankAccount}
            setBankAccount={setPcBankAccount}
            status={pcBankAccountStatus}
            setStatus={setPcBankAccountStatus}
            projectId={projectId}
          />
        </>
      )}

      {/* DivinityCoin Bank Account for Settlements - Only show when DivinityCoin is selected */}
      {payment.paymentProcessor === "DIVINITYCOIN" && (
        <>
          <Separator />

          <DivinityCoinBankSection
            bankAccount={bankAccount}
            setBankAccount={setBankAccount}
            bankAccountStatus={bankAccountStatus}
            setBankAccountStatus={setBankAccountStatus}
            isSavingBank={isSavingBank}
            handleSaveBankAccount={handleSaveBankAccount}
          />
        </>
      )}

      {/* PayPal Bank Payout Account - Only show when PayPal is selected */}
      {payment.paymentProcessor === "PAYPAL" && (
        <>
          <Separator />
          <PayPalBankPayoutSection />
        </>
      )}

      {/* Whop Bank Payout Account - Only show when Whop is selected */}
      {payment.paymentProcessor === "WHOP" && (
        <>
          <Separator />
          <WhopBankPayoutSection />
        </>
      )}

      <Separator />

      {/* Retailer Access */}
      <RetailerAccessSection
        payment={payment}
        updatePayment={updatePayment}
      />

      {/* Stripe ConfirmDialog - DISABLED: Stripe Connect removed */}
      {/* <ConfirmDialog
        open={showResetConfirm}
        onOpenChange={setShowResetConfirm}
        title="Disconnect Stripe Account?"
        description="Are you sure you want to disconnect your Stripe account? You will need to reconnect it to accept payments."
        confirmText="Disconnect"
        variant="destructive"
        onConfirm={handleResetStripe}
        loading={isResetting}
      /> */}
    </div>
  );
}
