"use client";

import { Elements } from "@stripe/react-stripe-js";
import { Stripe } from "@stripe/stripe-js";
import { StripePaymentForm } from "./StripePaymentForm";

interface DCPaymentWrapperProps {
  clientSecret: string;
  dcStripePromise: Promise<Stripe | null>;
  pledgeId: string | null;
  projectPath: string;
  agreedToTerms: boolean;
  isProcessing: boolean;
  setIsProcessing: (val: boolean) => void;
  onSuccess: () => void;
  onError: (message: string) => void;
  displayTotal: number;
  isModifyMode?: boolean;
  // "setup_intent" when this is a DC AoN-unfunded pledge that saves the
  // card now and defers the charge to the cron. "payment_intent" for
  // KIA / already-funded AoN where the charge happens on confirm.
  intentType?: "payment_intent" | "setup_intent";
}

export default function DCPaymentWrapper({
  clientSecret,
  dcStripePromise,
  pledgeId,
  projectPath,
  agreedToTerms,
  isProcessing,
  setIsProcessing,
  onSuccess,
  onError,
  displayTotal,
  isModifyMode,
  intentType = "payment_intent",
}: DCPaymentWrapperProps) {
  return (
    <Elements
      key={clientSecret}
      stripe={dcStripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: "stripe",
          variables: {
            colorPrimary: "#028858",
            fontFamily: "system-ui, -apple-system, sans-serif",
            borderRadius: "8px",
            spacingUnit: "5px",
          },
          rules: {
            ".Tab": { borderRadius: "8px", boxShadow: "none" },
            ".Tab--selected": { borderColor: "#028858", boxShadow: "0 0 0 1.5px #028858" },
            ".Input": { borderRadius: "8px", boxShadow: "none", padding: "10px 12px" },
            ".Input:focus": { borderColor: "#028858", boxShadow: "0 0 0 1.5px #028858" },
            ".Label": { fontWeight: "500", fontSize: "14px", marginBottom: "6px" },
          },
        },
      }}
    >
      <StripePaymentForm
        onSuccess={onSuccess}
        onError={onError}
        agreedToTerms={agreedToTerms}
        isProcessing={isProcessing}
        setIsProcessing={setIsProcessing}
        total={displayTotal}
        intentType={intentType}
        pledgeId={pledgeId}
        projectPath={projectPath}
        buttonLabel={
          isModifyMode
            ? `Pay Additional $${displayTotal.toFixed(2)}`
            : intentType === "setup_intent"
              ? `Pledge $${displayTotal.toFixed(2)}`
              : undefined
        }
        setupConfirmUrl={
          intentType === "setup_intent" && pledgeId
            ? `/api/pledges/${encodeURIComponent(pledgeId)}/confirm-dc-setup`
            : undefined
        }
      />
    </Elements>
  );
}
