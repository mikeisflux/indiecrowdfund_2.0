"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { validateBankFields, parseBankCountry, type BankCountry } from "@/lib/bank-countries";
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
} from "./payment-sections";

export function PaymentStep() {
  const { payment, updatePayment, basics, projectId, projectStatus } = useProjectStore();
  // Stripe Connect state - DISABLED
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
    bankCountry: "US" as BankCountry,
    payoutPhone: "",
    billingLine1: "",
    billingLine2: "",
    billingCity: "",
    billingState: "",
    billingZip: "",
    billingCountry: "US",
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

  // Save DivinityCoin bank account
  const handleSaveBankAccount = async () => {
    if (!bankAccount.bankName || !bankAccount.accountHolder ||
        !bankAccount.accountNumber || !bankAccount.routingNumber) {
      toast.error("Please fill in all bank account fields");
      return;
    }

    if (!bankAccount.billingLine1.trim() || !bankAccount.billingCity.trim() ||
        !bankAccount.billingZip.trim() || !bankAccount.billingCountry.trim()) {
      toast.error("Billing address is required (line 1, city, ZIP, country)");
      return;
    }

    // Country-specific format validation (US ABA / UK Sort Code / IT
    // IBAN + BIC) — shared with the API route and the other processors.
    const validationError = validateBankFields(bankAccount.bankCountry, bankAccount);
    if (validationError) {
      toast.error(validationError);
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
        payoutPhone: "",
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
              bankCountry: parseBankCountry(data.bankCountry),
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

  // Stripe Connect was removed: the /api/stripe/connect endpoints it
  // called never existed on this app, and payouts run through
  // DivinityCoin / PayPal / Whop. The commented-out status check that
  // used to sit here was deleted with the rest of that UI.
  const goalAmount = Number(basics.goalAmount) || 10000;
  const hasAdultContent = payment.hasAdultContent || payment.hasRiskyContent;

  // If adult/risky content is selected, PayPal is NOT allowed (DivinityCoin
  // and Whop are both fine). PayPal flags adult content during their KYC
  // review, so we steer creators away from it up front.
  const mustUseAltProcessor = payment.hasAdultContent || payment.hasRiskyContent;

  const campaignType = payment.campaignType || "ALL_OR_NOTHING";
  const isLaunched = ["LIVE", "FUNDED", "FAILED", "CANCELLED"].includes(projectStatus || "");

  // Fee calculations
  const avgPledgeSize = 50; // Assume average pledge
  const numTransactions = goalAmount / avgPledgeSize;

  // Platform fee (used by all processors)
  const platformFee = goalAmount * 0.03;

  // PayPal Advanced Checkout: 3.49% + $0.49 per transaction
  const paypalFee = goalAmount * 0.0349 + numTransactions * 0.49;
  const paypalTotalFees = paypalFee + platformFee;
  const paypalNetAmount = goalAmount - paypalTotalFees;

  // Whop's effective per-transaction fee on domestic US cards is
  // 3.5% + $0.37 (2.7% payment processing + 0.8% orchestration +
  // $0.30 fixed card + $0.07 fraud prevention -- the breakdown
  // visible in Whop's Activity feed). International cards add ~1%
  // currency conversion + $0.03 3D Secure.
  const whopFee = goalAmount * 0.035 + numTransactions * 0.37;
  const whopTotalFees = whopFee + platformFee;
  const whopNetAmount = goalAmount - whopTotalFees;

  // Stripe Connect handlers - DISABLED: Stripe replaced by PayPal
  // const handleConnectStripe = async () => { ... };
  // const handleResetStripe = async () => { ... };

  return (
    <div className="space-y-8">
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
        platformFee={platformFee}
        paypalFee={paypalFee}
        paypalTotalFees={paypalTotalFees}
        paypalNetAmount={paypalNetAmount}
        whopFee={whopFee}
        whopTotalFees={whopTotalFees}
        whopNetAmount={whopNetAmount}
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
          section so creators set up their recoup card first. */}
      <Separator />
      <ChargebackCardSection
        chargebackCard={chargebackCard}
        setChargebackCard={setChargebackCard}
        chargebackCardStatus={chargebackCardStatus}
        setChargebackCardStatus={setChargebackCardStatus}
        isSavingCard={isSavingCard}
        handleSaveChargebackCard={handleSaveChargebackCard}
        projectId={projectId}
      />

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

      {/* Legacy PayPal payout details. PayPal is no longer selectable as a
          processor, but campaigns that ran on it before the withdrawal still
          need their payout account visible so the creator can be paid. */}
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
