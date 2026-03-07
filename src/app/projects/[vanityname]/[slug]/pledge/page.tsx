"use client";

/**
 * Pledge page for both vanity URLs (/projects/[vanityname]/[slug]/pledge)
 * and legacy URLs (/projects/[slug]/pledge via middleware rewrite to /projects/_/[slug]/pledge)
 *
 * Logic extracted to hooks/usePledge.ts
 * Loading/Error/Address states extracted to components/
 */

import Image from "next/image";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { usePledge } from "./hooks/usePledge";
import { LoadingState } from "./components/LoadingState";
import { ErrorState } from "./components/ErrorState";
import { AddressWarning } from "./components/AddressWarning";
import { Breadcrumb } from "./components/Breadcrumb";
import { RewardSelector } from "./components/RewardSelector";
import { AddonSelector } from "./components/AddonSelector";
import { PaymentStep } from "./components/PaymentStep";
import { OrderSummary } from "./components/OrderSummary";
import { FAQSection } from "./components/FAQSection";
import { SuccessPage } from "./components/SuccessPage";

export default function PledgePage() {
  const pledge = usePledge();

  // Auth loading state
  if (pledge.authStatus === "loading" || pledge.authStatus === "unauthenticated") {
    return (
      <LoadingState
        message={pledge.authStatus === "unauthenticated" ? "Redirecting to login..." : "Checking authentication..."}
      />
    );
  }

  // Loading state
  if (pledge.isLoading) {
    return <LoadingState message="Loading pledge details..." orbColor="bg-cyan-500/10" />;
  }

  // Error state
  if (pledge.error || !pledge.project) {
    return <ErrorState error={pledge.error} />;
  }

  // Success state
  if (pledge.step === "success") {
    return (
      <SuccessPage
        project={pledge.project}
        isAddItemsMode={pledge.isAddItemsMode}
        isModifyMode={pledge.isModifyMode}
        pledgeWithoutReward={pledge.pledgeWithoutReward}
        selectedReward={pledge.selectedReward}
        customPledgeAmount={pledge.customPledgeAmount}
        selectedAddons={pledge.selectedAddons}
        addons={pledge.addons}
        bonusSupport={pledge.bonusSupport}
        totalShipping={pledge.totalShipping}
        addonsShipping={pledge.addonsShipping}
        total={pledge.total}
        addItemsTotal={pledge.addItemsTotal}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 dark:from-background dark:to-background relative">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="floating-orb absolute -top-40 -right-40 w-[500px] h-[500px] bg-primary/5" />
        <div className="floating-orb absolute top-1/3 -left-40 w-[400px] h-[400px] bg-cyan-500/5" style={{ animationDelay: '-5s' }} />
        <div className="floating-orb absolute bottom-20 right-1/4 w-[300px] h-[300px] bg-purple-500/5" style={{ animationDelay: '-10s' }} />
      </div>

      {/* Header */}
      <header className="border-b border-border/50 glass-card relative z-10">
        <div className="container py-6">
          <div className="text-center mb-4">
            <h1 className="text-2xl md:text-3xl font-bold mb-3 bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/80">{pledge.project.title}</h1>
            <div className="flex items-center justify-center gap-2">
              {pledge.project.creator.image ? (
                <Image
                  src={pledge.project.creator.image}
                  alt={pledge.project.creator.name}
                  width={28}
                  height={28}
                  className="rounded-full ring-2 ring-border/50"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-emerald-600 flex items-center justify-center text-white text-xs font-medium">
                  {pledge.project.creator.name.charAt(0)}
                </div>
              )}
              <span className="text-sm text-muted-foreground">by <span className="font-medium text-foreground/80">{pledge.project.creator.name}</span></span>
            </div>
          </div>
          <div className="flex justify-center">
            <Breadcrumb
              step={pledge.step}
              setStep={pledge.setStep}
              selectedReward={pledge.selectedReward}
              pledgeWithoutReward={pledge.pledgeWithoutReward}
              isAddItemsMode={pledge.isAddItemsMode || pledge.isModifyMode}
              selectedAddons={pledge.selectedAddons}
            />
          </div>
        </div>
      </header>

      <div className="container py-8">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <AddressWarning hasSavedAddress={pledge.hasSavedAddress} allRewards={pledge.allRewards} />

            {pledge.step === "rewards" && (
              <RewardSelector
                allRewards={pledge.allRewards}
                customPledgeAmount={pledge.customPledgeAmount}
                setCustomPledgeAmount={pledge.setCustomPledgeAmount}
                handlePledgeWithoutReward={pledge.handlePledgeWithoutReward}
                shippingCountry={pledge.shippingCountry}
                setShippingCountry={pledge.setShippingCountry}
                handleSelectReward={pledge.handleSelectReward}
                getShippingCost={pledge.getShippingCost}
              />
            )}

            {pledge.step === "addons" && (
              <AddonSelector
                addons={pledge.addons}
                selectedAddons={pledge.selectedAddons}
                isAddItemsMode={pledge.isAddItemsMode}
                shippingCountry={pledge.shippingCountry}
                handleAddonToggle={pledge.handleAddonToggle}
                handleAddonQuantityChange={pledge.handleAddonQuantityChange}
                getShippingCost={pledge.getShippingCost}
              />
            )}

            {pledge.step === "payment" && (
              <PaymentStep
                project={pledge.project}
                isAddItemsMode={pledge.isAddItemsMode}
                isModifyMode={pledge.isModifyMode}
                modifyChargeAmount={pledge.modifyChargeAmount}
                paymentError={pledge.paymentError}
                setPaymentError={pledge.setPaymentError}
                setClientSecret={pledge.setClientSecret}
                setIsProcessing={pledge.setIsProcessing}
                total={pledge.total}
                agreedToTerms={pledge.agreedToTerms}
                currentPledgeId={pledge.currentPledgeId}
                handlePaymentSuccess={pledge.handlePaymentSuccess}
                handlePaymentError={pledge.handlePaymentError}
                isProcessing={pledge.isProcessing}
                clientSecret={pledge.clientSecret}
                stripePromise={pledge.stripePromise}
                dcStripePromise={pledge.dcStripePromise}
                intentType={pledge.intentType}
                projectPath={pledge.projectPath}
              />
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-6 space-y-6">
              <OrderSummary
                step={pledge.step}
                isAddItemsMode={pledge.isAddItemsMode}
                isModifyMode={pledge.isModifyMode}
                originalPledgeAmount={pledge.originalPledgeAmount}
                modifyChargeAmount={pledge.modifyChargeAmount}
                selectedReward={pledge.selectedReward}
                pledgeWithoutReward={pledge.pledgeWithoutReward}
                customPledgeAmount={pledge.customPledgeAmount}
                selectedAddons={pledge.selectedAddons}
                addons={pledge.addons}
                bonusSupport={pledge.bonusSupport}
                setBonusSupport={pledge.setBonusSupport}
                totalShipping={pledge.totalShipping}
                addonsShipping={pledge.addonsShipping}
                total={pledge.total}
                addItemsTotal={pledge.addItemsTotal}
                setStep={pledge.setStep}
                agreedToTerms={pledge.agreedToTerms}
                setAgreedToTerms={pledge.setAgreedToTerms}
                clientSecret={pledge.clientSecret}
                project={pledge.project}
              />

              {/* Rewards Warning */}
              <div className="flex gap-3 text-sm">
                <AlertTriangle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="font-medium mb-1">Rewards aren&apos;t guaranteed.</p>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    You&apos;re supporting an ambitious creative project that has yet to be developed.
                    It&apos;s important to consider that, despite a creator&apos;s efforts, there&apos;s a risk
                    that your reward may not be fulfilled. IndieCrowdfund is not responsible for
                    reward fulfillment or refunds.
                  </p>
                  <Link href="/trust-safety" className="text-xs underline hover:no-underline mt-2 inline-block">
                    Learn more about accountability
                  </Link>
                </div>
              </div>

              <FAQSection project={pledge.project} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
