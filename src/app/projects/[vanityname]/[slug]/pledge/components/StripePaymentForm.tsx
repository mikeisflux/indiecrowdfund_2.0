"use client";

import { Button } from "@/components/ui/button";
import { PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

interface StripePaymentFormProps {
  onSuccess: () => void;
  onError: (message: string) => void;
  agreedToTerms: boolean;
  isProcessing: boolean;
  setIsProcessing: (val: boolean) => void;
  total: number;
  intentType: "payment_intent" | "setup_intent";
  pledgeId: string | null;
  projectPath: string;
}

export function StripePaymentForm({
  onSuccess,
  onError,
  agreedToTerms,
  isProcessing,
  setIsProcessing,
  total,
  intentType,
  pledgeId,
  projectPath,
}: StripePaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();

  const handleSubmit = async () => {
    if (!stripe || !elements || !agreedToTerms) return;

    setIsProcessing(true);

    try {
      // Include pledgeId in return URL so confirmation can happen after 3D Secure redirect
      const return_url = `${window.location.origin}${projectPath}/pledge?success=true${pledgeId ? `&pledgeId=${pledgeId}` : ""}`;

      // Use the correct confirmation method based on intent type
      // SetupIntent is used for campaigns that haven't reached their goal yet (card is saved but not charged)
      // PaymentIntent is used when the campaign is already funded (card is charged immediately)
      let error;

      if (intentType === "setup_intent") {
        const result = await stripe.confirmSetup({
          elements,
          confirmParams: {
            return_url,
          },
          redirect: "if_required",
        });
        error = result.error;
      } else {
        const result = await stripe.confirmPayment({
          elements,
          confirmParams: {
            return_url,
          },
          redirect: "if_required",
        });
        error = result.error;
      }

      if (error) {
        onError(error.message || "Payment failed");
        setIsProcessing(false);
      } else {
        onSuccess();
      }
    } catch {
      onError("An unexpected error occurred");
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <PaymentElement />
      <Button
        className="w-full bg-zinc-300 hover:bg-[#028858] text-zinc-600 hover:text-white font-medium disabled:bg-zinc-300 disabled:text-zinc-500"
        size="lg"
        onClick={handleSubmit}
        disabled={!stripe || !elements || !agreedToTerms || isProcessing}
      >
        {isProcessing ? "Processing..." : `Pledge $${total}`}
      </Button>
    </div>
  );
}
