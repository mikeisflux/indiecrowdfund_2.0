"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { getCSRFHeaders } from "@/lib/csrf";

import { useState, useEffect } from "react";
import { useProjectStore } from "@/lib/stores/project-store";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

import {
  ContactEmailSection,
  ProjectTypeSection,
  ContentDeclarationSection,
  PaymentProcessorSection,
  StripeConnectSection,
  DivinityCoinBankSection,
  RetailerAccessSection,
  ChargebackCardSection,
} from "./payment-sections";

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

  // If adult/risky content is selected, Stripe is NOT allowed (must use DivinityCoin)
  const mustUseAltProcessor = payment.hasAdultContent || payment.hasRiskyContent;

  // Auto-switch away from Stripe if adult content is selected
  useEffect(() => {
    if (mustUseAltProcessor && payment.paymentProcessor !== "DIVINITYCOIN") {
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
      const response = await apiFetch("/api/stripe/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json", },
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
      const response = await apiFetch("/api/stripe/connect/reset", {
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
      />

      <Separator />

      {/* Connect Stripe Account - Only show when Stripe is selected */}
      {payment.paymentProcessor === "STRIPE" && (
        <StripeConnectSection
          stripeStatus={stripeStatus}
          connectError={connectError}
          isConnecting={isConnecting}
          isResetting={isResetting}
          handleConnectStripe={handleConnectStripe}
          setShowResetConfirm={setShowResetConfirm}
        />
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
