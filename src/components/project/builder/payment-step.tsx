"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useState, useEffect } from "react";
import { useProjectStore } from "@/lib/stores/project-store";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  ContactEmailSection,
  ProjectTypeSection,
  ContentDeclarationSection,
  PaymentProcessorSection,
  DivinityCoinBankSection,
  PayPalPayoutSection,
  RetailerAccessSection,
  ChargebackCardSection,
} from "./payment-sections";

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

  const goalAmount = basics.goalAmount || 10000;
  const hasAdultContent = payment.hasAdultContent || payment.hasRiskyContent;

  // If adult/risky content is selected, Stripe is NOT allowed (must use DivinityCoin)
  const mustUseAltProcessor = payment.hasAdultContent || payment.hasRiskyContent;

  // Auto-switch away from Stripe if adult content is selected
  useEffect(() => {
    if (mustUseAltProcessor && payment.paymentProcessor !== "DIVINITYCOIN") {
      updatePayment({ paymentProcessor: "DIVINITYCOIN" });
    }
  }, [mustUseAltProcessor, payment.paymentProcessor, updatePayment]);

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

      {/* Payment Processor Selection */}
      <PaymentProcessorSection
        payment={payment}
        updatePayment={updatePayment}
        mustUseAltProcessor={mustUseAltProcessor}
        goalAmount={goalAmount}
        stripeFee={stripeFee}
        platformFee={platformFee}
        totalFees={totalFees}
        netAmount={netAmount}
        paypalFee={paypalFee}
        paypalTotalFees={paypalTotalFees}
        paypalNetAmount={paypalNetAmount}
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

      {/* PayPal Payout Email - Only show when PayPal is selected */}
      {payment.paymentProcessor === "PAYPAL" && (
        <>
          <Separator />
          <PayPalPayoutSection />
        </>
      )}

      <Separator />

      {/* Retailer Access */}
      <RetailerAccessSection
        payment={payment}
        updatePayment={updatePayment}
      />

      {/* Chargeback Protection Card */}
      <ChargebackCardSection
        chargebackCard={chargebackCard}
        setChargebackCard={setChargebackCard}
        chargebackCardStatus={chargebackCardStatus}
        setChargebackCardStatus={setChargebackCardStatus}
        isSavingCard={isSavingCard}
        handleSaveChargebackCard={handleSaveChargebackCard}
        projectId={projectId}
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
