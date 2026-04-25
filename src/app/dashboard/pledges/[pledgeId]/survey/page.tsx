"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { toast } from "sonner";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { loadStripe, Stripe } from "@stripe/stripe-js";

import { SurveyData, SavedAddress, Step, ShippingAddressForm } from "./components/types";
import { SurveyErrorState } from "./components/SurveyErrorState";
import { SurveyLockedState } from "./components/SurveyLockedState";
import { SurveyHeader } from "./components/SurveyHeader";
import { SurveyIntroStep } from "./components/SurveyIntroStep";
import { SurveyItemsStep } from "./components/SurveyItemsStep";
import { SurveyQuestionsStep } from "./components/SurveyQuestionsStep";
import { SurveyAddonsStep } from "./components/SurveyAddonsStep";
import { SurveyAddressStep } from "./components/SurveyAddressStep";
import { SurveyReviewStep } from "./components/SurveyReviewStep";
import { SurveyPaymentStep } from "./components/SurveyPaymentStep";

export default function BackerSurveyPage() {
  const params = useParams();
  const router = useRouter();
  const pledgeId = (params?.pledgeId as string) || "";

  const [data, setData] = useState<SurveyData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState<Step>("intro");
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);

  // Form state
  const [itemResponses, setItemResponses] = useState<Record<string, { variants?: Record<string, string>; customAnswers?: Record<string, string | string[]> }>>({});
  const [backerResponses, setBackerResponses] = useState<Record<string, string | string[]>>({});
  const [shippingAddress, setShippingAddress] = useState<ShippingAddressForm>({
    name: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "US",
    phone: "",
  });

  // Saved addresses from user profile
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);

  // Addon selection state
  const [selectedAddons, setSelectedAddons] = useState<Record<string, number>>({});

  // Payment state
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const creatingPaymentRef = useRef(false);

  const fetchSurvey = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/surveys/${pledgeId}/respond`);
      if (response.ok) {
        const surveyData = await response.json();
        setData(surveyData);

        // Initialize form state from existing response
        if (surveyData.response) {
          setItemResponses(surveyData.response.itemResponses || {});
          // Default address/email type questions to "No change needed" if not yet answered
          const existingResponses = surveyData.response.backerResponses || {};
          if (surveyData.backerQuestions) {
            for (const q of surveyData.backerQuestions) {
              if ((q.displayType === "address" || q.displayType === "email") && !existingResponses[q.id]) {
                existingResponses[q.id] = "No change needed";
              }
            }
          }
          setBackerResponses(existingResponses);
          if (surveyData.response.shippingAddress) {
            setShippingAddress({
              name: surveyData.response.shippingAddress.name || "",
              line1: surveyData.response.shippingAddress.line1 || "",
              line2: surveyData.response.shippingAddress.line2 || "",
              city: surveyData.response.shippingAddress.city || "",
              state: surveyData.response.shippingAddress.state || "",
              postalCode: surveyData.response.shippingAddress.postalCode || "",
              country: surveyData.response.shippingAddress.country || "US",
              phone: surveyData.response.shippingAddress.phone || "",
            });
          }
          if (surveyData.response.selectedAddons) {
            setSelectedAddons(surveyData.response.selectedAddons);
          }
        }
      } else {
        const err = await response.json();
        setErrorStatus(response.status);
        setError(err.error || "Failed to load survey");
      }
    } catch (err) {
      console.error("Error fetching survey:", err);
      setError("Failed to load survey");
    } finally {
      setIsLoading(false);
    }
  }, [pledgeId]);

  useEffect(() => {
    fetchSurvey();
  }, [fetchSurvey]);

  // Fetch saved addresses from user profile
  const fetchSavedAddresses = useCallback(async () => {
    try {
      const response = await fetch("/api/backer/addresses");
      if (response.ok) {
        const result = await response.json();
        setSavedAddresses(result.addresses || []);
      }
    } catch (err) {
      console.error("Error fetching saved addresses:", err);
    }
  }, []);

  useEffect(() => {
    fetchSavedAddresses();
  }, [fetchSavedAddresses]);

  // Auto-fill address from default saved address when survey loads
  // Only if no address was previously saved in the survey response
  useEffect(() => {
    if (
      savedAddresses.length > 0 &&
      data &&
      !data.response.shippingAddress?.name &&
      shippingAddress.name === ""
    ) {
      const defaultAddr = savedAddresses.find((a) => a.isDefault) || savedAddresses[0];
      if (defaultAddr) {
        setShippingAddress({
          name: defaultAddr.fullName,
          line1: defaultAddr.line1,
          line2: defaultAddr.line2 || "",
          city: defaultAddr.city,
          state: defaultAddr.state,
          postalCode: defaultAddr.postalCode,
          country: defaultAddr.country,
          phone: defaultAddr.phone || "",
        });
      }
    }
  }, [savedAddresses, data, shippingAddress.name]);

  // Apply a saved address to the form
  const applySavedAddress = (addr: SavedAddress) => {
    setShippingAddress({
      name: addr.fullName,
      line1: addr.line1,
      line2: addr.line2 || "",
      city: addr.city,
      state: addr.state,
      postalCode: addr.postalCode,
      country: addr.country,
      phone: addr.phone || "",
    });
  };

  // Calculate addon totals
  const addonsTotal = Object.entries(selectedAddons).reduce((sum, [id, qty]) => {
    if (qty <= 0) return sum;
    const addon = data?.availableAddons?.find((a) => a.id === id);
    return sum + (addon?.price || 0) * qty;
  }, 0);

  const hasNewAddons = Object.values(selectedAddons).some((qty) => qty > 0);

  const saveProgress = async (submit = false): Promise<boolean> => {
    setIsSaving(true);
    setError(null);
    try {
      const response = await apiFetch(`/api/surveys/${pledgeId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemResponses,
          backerResponses,
          shippingAddress: showAddressStep && shippingAddress.name.trim()
            ? shippingAddress
            : null,
          submit,
        }),
      });

      if (response.ok) {
        return true;
      } else {
        const err = await response.json();
        setError(err.error || "Failed to save");
        return false;
      }
    } catch (err) {
      console.error("Error saving survey:", err);
      setError("Failed to save survey");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // Mirror the server-side validation in /api/surveys/[pledgeId]/respond
  // so the user sees a single inline error and we never POST a request
  // the server will only reject. Returns null when valid, or an error
  // string otherwise. Keep these checks in lockstep with the route's
  // 400 returns — adding a new server check requires a matching client
  // check here.
  const validateBeforeSubmit = (): string | null => {
    if (!data) return "Survey is still loading. Please wait.";

    if (data.survey.status === "DRAFT") {
      return "This survey hasn't been sent yet. Please wait for the creator to send it.";
    }
    if (data.survey.status === "LOCKED") {
      return "This survey has been locked by the creator and can no longer be edited.";
    }

    // Backer-level required questions
    for (const q of data.backerQuestions || []) {
      if (!q.isRequired) continue;
      const answer = backerResponses[q.id];
      const empty =
        answer === undefined ||
        answer === null ||
        (typeof answer === "string" && answer.trim() === "") ||
        (Array.isArray(answer) && answer.length === 0);
      if (empty) {
        return `Please answer: "${q.question}"`;
      }
    }

    // Per-item variants and required custom questions
    for (const itemQ of data.itemQuestions || []) {
      const itemResponse = itemResponses[itemQ.id] || {};
      // Every variant is required server-side ("Please select a <type> for <item>")
      for (const variant of itemQ.variants) {
        const selected = itemResponse.variants?.[variant.variantType];
        if (!selected || selected.trim() === "") {
          return `Please select a ${variant.variantType} for ${itemQ.itemName}.`;
        }
      }
      // Required custom questions per item
      for (const customQ of itemQ.customQuestions) {
        if (!customQ.isRequired) continue;
        const answer = itemResponse.customAnswers?.[customQ.id];
        const empty =
          answer === undefined ||
          answer === null ||
          (typeof answer === "string" && answer.trim() === "") ||
          (Array.isArray(answer) && answer.length === 0);
        if (empty) {
          return `Please answer "${customQ.question}" for ${itemQ.itemName}.`;
        }
      }
    }

    // Shipping address — required when survey collects addresses AND the
    // pledge requires shipping. Mirror the strict zod schema on the server.
    if (showAddressStep) {
      const required: { key: keyof typeof shippingAddress; label: string }[] = [
        { key: "name", label: "Name" },
        { key: "line1", label: "Address line 1" },
        { key: "city", label: "City" },
        { key: "state", label: "State / Region" },
        { key: "postalCode", label: "Postal code" },
        { key: "country", label: "Country" },
      ];
      for (const f of required) {
        if (!shippingAddress[f.key] || shippingAddress[f.key].trim() === "") {
          return `Shipping address is incomplete: ${f.label} is required.`;
        }
      }
    }

    return null;
  };

  // Submit survey: if addons selected, submit then go to payment; otherwise submit and redirect
  const handleSubmit = async () => {
    const validationError = validateBeforeSubmit();
    if (validationError) {
      setError(validationError);
      // Scroll the inline error banner into view so the user actually sees it.
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      return;
    }

    const saved = await saveProgress(true);
    if (!saved) return;

    if (hasNewAddons) {
      // Go to payment step - survey is saved, now we need to charge for addons
      setCurrentStep("payment");
    } else {
      router.push("/dashboard/backer?tab=wallet");
    }
  };

  // Create payment intent for addon purchase via existing add-items API
  const createAddonPayment = useCallback(async () => {
    if (!data || !hasNewAddons || clientSecret) return;
    if (creatingPaymentRef.current) return;
    creatingPaymentRef.current = true;

    setIsProcessingPayment(true);
    setPaymentError(null);

    try {
      const addonsWithQuantity = Object.entries(selectedAddons)
        .filter(([, qty]) => qty > 0)
        .map(([id, quantity]) => ({ id, quantity }));

      const response = await apiFetch(`/api/pledges/${pledgeId}/add-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addons: addonsWithQuantity,
          amount: addonsTotal,
          source: "survey",
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to create payment");
      }

      // Load appropriate Stripe instance
      let stripeLoaded = !!stripePromise;
      if (result.paymentMethod === "DIVINITYCOIN") {
        // DivinityCoin: must use DC's own publishable key
        if (result.publishableKey) {
          setStripePromise(loadStripe(result.publishableKey));
          stripeLoaded = true;
        } else {
          throw new Error("DivinityCoin payment configuration is missing. Please contact support.");
        }
      } else if (!stripePromise) {
        // Stripe: load platform Stripe key
        const configRes = await fetch("/api/stripe/config");
        if (!configRes.ok) {
          throw new Error("Failed to load payment configuration. Please contact support.");
        }
        const configData = await configRes.json();
        if (configData.publishableKey) {
          setStripePromise(loadStripe(configData.publishableKey));
          stripeLoaded = true;
        }
      }

      if (!stripeLoaded) {
        throw new Error("Payment system is not configured. Please contact support.");
      }

      setClientSecret(result.clientSecret);
      setIsProcessingPayment(false);
      creatingPaymentRef.current = false;
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : "Failed to create payment");
      setIsProcessingPayment(false);
      creatingPaymentRef.current = false;
    }
  }, [data, hasNewAddons, clientSecret, selectedAddons, pledgeId, addonsTotal, stripePromise]);

  // Auto-create payment intent when entering payment step
  useEffect(() => {
    if (currentStep === "payment" && !clientSecret && !isProcessingPayment && !paymentError) {
      createAddonPayment();
    }
  }, [currentStep, clientSecret, isProcessingPayment, paymentError, createAddonPayment]);

  // Handle successful addon payment
  const handlePaymentSuccess = async () => {
    try {
      // Confirm the add-items purchase
      const response = await apiFetch(`/api/pledges/${pledgeId}/confirm-add-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const err = await response.json();
        console.error("Failed to confirm add-items:", err);
        toast.error(err.error || "Payment recorded but confirmation failed. Please contact support.");
        return;
      }
    } catch (err) {
      console.error("Error confirming add-items:", err);
      toast.error("Payment recorded but confirmation failed. Please contact support.");
      return;
    }

    // Redirect to dashboard
    router.push("/dashboard/backer?tab=wallet");
  };

  const handlePaymentError = (message: string) => {
    setPaymentError(message);
    setIsProcessingPayment(false);
  };

  // Whether address collection applies to this specific pledge
  const showAddressStep = data?.survey.collectAddresses && data?.survey.requiresShipping;

  const getSteps = (): Step[] => {
    const steps: Step[] = ["intro"];
    if (data?.itemQuestions && data.itemQuestions.length > 0) steps.push("items");
    if (data?.backerQuestions && data.backerQuestions.length > 0) steps.push("questions");
    if (data?.availableAddons && data.availableAddons.length > 0) steps.push("addons");
    if (showAddressStep) steps.push("address");
    steps.push("review");
    // Payment step is only shown dynamically after submit if addons selected
    return steps;
  };

  const steps = getSteps();
  const currentStepIndex = currentStep === "payment" ? steps.length : steps.indexOf(currentStep);

  const nextStep = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex]);
      saveProgress(false);
    }
  };

  const prevStep = () => {
    if (currentStep === "payment") {
      // Go back to review from payment
      setCurrentStep("review");
      setClientSecret(null);
      setPaymentError(null);
      creatingPaymentRef.current = false;
      return;
    }
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex]);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <SurveyErrorState
        error={error}
        errorStatus={errorStatus}
        pledgeId={pledgeId}
        onRetry={fetchSurvey}
      />
    );
  }

  if (!data) return null;

  const isAddressLocked = data.response.addressLocked || data.survey.addressesLocked;
  const isSurveyLocked = data.survey.status === "LOCKED";

  // If survey is locked, show read-only notice
  if (isSurveyLocked) {
    return <SurveyLockedState data={data} />;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <SurveyHeader
        data={data}
        steps={steps}
        currentStep={currentStep}
        currentStepIndex={currentStepIndex}
      />

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {currentStep === "intro" && (
        <SurveyIntroStep data={data} onNext={nextStep} />
      )}

      {currentStep === "items" && (
        <SurveyItemsStep
          data={data}
          itemResponses={itemResponses}
          setItemResponses={setItemResponses}
          onNext={nextStep}
          onPrev={prevStep}
        />
      )}

      {currentStep === "questions" && (
        <SurveyQuestionsStep
          data={data}
          backerResponses={backerResponses}
          setBackerResponses={setBackerResponses}
          onNext={nextStep}
          onPrev={prevStep}
        />
      )}

      {currentStep === "addons" && data.availableAddons && (
        <SurveyAddonsStep
          data={data}
          selectedAddons={selectedAddons}
          setSelectedAddons={setSelectedAddons}
          addonsTotal={addonsTotal}
          hasNewAddons={hasNewAddons}
          onNext={nextStep}
          onPrev={prevStep}
        />
      )}

      {currentStep === "address" && (
        <SurveyAddressStep
          shippingAddress={shippingAddress}
          setShippingAddress={setShippingAddress}
          savedAddresses={savedAddresses}
          isAddressLocked={isAddressLocked}
          onNext={nextStep}
          onPrev={prevStep}
          onApplySavedAddress={applySavedAddress}
        />
      )}

      {currentStep === "review" && (
        <SurveyReviewStep
          data={data}
          itemResponses={itemResponses}
          backerResponses={backerResponses}
          selectedAddons={selectedAddons}
          setSelectedAddons={setSelectedAddons}
          shippingAddress={shippingAddress}
          showAddressStep={showAddressStep}
          addonsTotal={addonsTotal}
          hasNewAddons={hasNewAddons}
          isSaving={isSaving}
          onSubmit={handleSubmit}
          onPrev={prevStep}
        />
      )}

      {currentStep === "payment" && (
        <SurveyPaymentStep
          data={data}
          selectedAddons={selectedAddons}
          addonsTotal={addonsTotal}
          clientSecret={clientSecret}
          stripePromise={stripePromise}
          isProcessingPayment={isProcessingPayment}
          setIsProcessingPayment={setIsProcessingPayment}
          paymentError={paymentError}
          setPaymentError={setPaymentError}
          setClientSecret={setClientSecret}
          creatingPaymentRef={creatingPaymentRef}
          onSuccess={handlePaymentSuccess}
          onError={handlePaymentError}
          onPrev={prevStep}
        />
      )}
    </div>
  );
}
