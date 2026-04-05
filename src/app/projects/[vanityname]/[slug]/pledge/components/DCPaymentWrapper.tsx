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
        intentType="payment_intent"
        pledgeId={pledgeId}
        projectPath={projectPath}
        buttonLabel={isModifyMode ? `Pay Additional $${displayTotal.toFixed(2)}` : undefined}
      />
    </Elements>
  );
}
