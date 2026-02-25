"use client";

import { getCSRFHeaders } from "@/lib/csrf";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ClipboardList,
  Package,
  MapPin,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  Lock,
  ArrowLeft,
  ShoppingBag,
  Plus,
  Minus,
  CreditCard,
  ShieldCheck,
  Trash2,
  BookOpen,
} from "lucide-react";
import Link from "next/link";
import { ALL_COUNTRIES } from "@/types";
import { loadStripe, Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

interface AvailableAddon {
  id: string;
  title: string;
  description?: string;
  price: number;
  imageUrl?: string;
  quantityAvailable: number | null;
  alreadyPurchased: boolean;
}

interface SavedAddress {
  id: string;
  label: string;
  isDefault: boolean;
  fullName: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string | null;
}

interface SurveyData {
  survey: {
    id: string;
    introTitle?: string;
    introMessage?: string;
    collectAddresses: boolean;
    status: string;
    addressesLocked: boolean;
    requiresShipping: boolean;
  };
  pledge: {
    id: string;
    projectId: string;
    projectTitle: string;
    projectImage?: string;
    projectSlug?: string;
    paymentProcessor: string;
    rewardTitle: string;
    addons: { id: string; title: string }[];
  };
  itemQuestions: {
    id: string;
    rewardId: string;
    itemName: string;
    itemDescription?: string;
    imageUrl?: string;
    variants: {
      id: string;
      variantType: string;
      options: string[];
    }[];
    customQuestions: {
      id: string;
      question: string;
      description?: string;
      questionType: string;
      options: string[];
      isRequired: boolean;
    }[];
  }[];
  backerQuestions: {
    id: string;
    question: string;
    description?: string;
    questionType: string;
    options: string[];
    isRequired: boolean;
  }[];
  availableAddons?: AvailableAddon[];
  response: {
    itemResponses?: Record<string, { variants?: Record<string, string>; customAnswers?: Record<string, string | string[]> }>;
    backerResponses?: Record<string, string | string[]>;
    shippingAddress?: {
      name?: string;
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
      phone?: string;
    };
    isComplete: boolean;
    addressLocked: boolean;
    selectedAddons?: Record<string, number>;
  };
}

type Step = "intro" | "items" | "questions" | "addons" | "address" | "review" | "payment";

export default function BackerSurveyPage() {
  const params = useParams();
  const router = useRouter();
  const pledgeId = (params?.pledgeId as string) || "";

  const [data, setData] = useState<SurveyData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState<Step>("intro");
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [itemResponses, setItemResponses] = useState<Record<string, { variants?: Record<string, string>; customAnswers?: Record<string, string | string[]> }>>({});
  const [backerResponses, setBackerResponses] = useState<Record<string, string | string[]>>({});
  const [shippingAddress, setShippingAddress] = useState({
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
          setBackerResponses(surveyData.response.backerResponses || {});
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
      const defaultAddr = savedAddresses.find(a => a.isDefault) || savedAddresses[0];
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
    const addon = data?.availableAddons?.find(a => a.id === id);
    return sum + (addon?.price || 0) * qty;
  }, 0);

  const hasNewAddons = Object.values(selectedAddons).some(qty => qty > 0);

  const saveProgress = async (submit = false): Promise<boolean> => {
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/surveys/${pledgeId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
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

  // Submit survey: if addons selected, submit then go to payment; otherwise submit and redirect
  const handleSubmit = async () => {
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

      const response = await fetch(`/api/pledges/${pledgeId}/add-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
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
      if (result.paymentMethod === "DIVINITYCOIN" && result.publishableKey) {
        setStripePromise(loadStripe(result.publishableKey));
      } else if (!stripePromise) {
        // Load platform Stripe key
        const configRes = await fetch("/api/stripe/config");
        const configData = await configRes.json();
        if (configData.publishableKey) {
          setStripePromise(loadStripe(configData.publishableKey));
        }
      }

      setClientSecret(result.clientSecret);
      setIsProcessingPayment(false);
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
      const response = await fetch(`/api/pledges/${pledgeId}/confirm-add-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
      });

      if (!response.ok) {
        const err = await response.json();
        console.error("Failed to confirm add-items:", err);
      }
    } catch (err) {
      console.error("Error confirming add-items:", err);
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

  // Addon quantity helpers
  const updateAddonQuantity = (addonId: string, delta: number) => {
    setSelectedAddons(prev => {
      const current = prev[addonId] || 0;
      const addon = data?.availableAddons?.find(a => a.id === addonId);
      const maxQty = addon?.quantityAvailable ?? 99;
      const newQty = Math.max(0, Math.min(current + delta, maxQty));
      if (newQty === 0) {
        const next = { ...prev };
        delete next[addonId];
        return next;
      }
      return { ...prev, [addonId]: newQty };
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <Card className="max-w-lg mx-auto mt-12">
        <CardContent className="py-12 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Unable to Load Survey</h3>
          <p className="text-zinc-500">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const isAddressLocked = data.response.addressLocked || data.survey.addressesLocked;
  const isSurveyLocked = data.survey.status === "LOCKED";

  // If survey is locked, show read-only notice
  if (isSurveyLocked) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <Link href="/dashboard/backer" className="hidden sm:inline-block">
            <Button variant="ghost" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
          <Link href="/dashboard/backer" className="sm:hidden">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
        </div>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              {data.pledge.projectImage && (
                <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-zinc-100">
                  <Image
                    src={data.pledge.projectImage}
                    alt={data.pledge.projectTitle}
                    fill
                    className="object-cover"
                  />
                </div>
              )}
              <div>
                <h1 className="font-semibold">{data.pledge.projectTitle}</h1>
                <p className="text-sm text-zinc-500">{data.pledge.rewardTitle}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-8 text-center">
            <Lock className="h-10 w-10 mx-auto text-amber-600 mb-3" />
            <h2 className="text-lg font-semibold text-amber-800">Survey Locked</h2>
            <p className="text-amber-700 mt-2">
              The creator has locked this survey for fulfillment. Responses can no longer be edited.
            </p>
            {data.response.isComplete && (
              <Badge className="mt-4 bg-emerald-100 text-emerald-700">
                <CheckCircle className="h-3 w-3 mr-1" />
                Your survey was submitted
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back Button */}
      <div>
        <Link href="/dashboard/backer" className="hidden sm:inline-block">
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>
        <Link href="/dashboard/backer" className="sm:hidden">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      {/* Header */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-4">
            {data.pledge.projectImage && (
              <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-zinc-100">
                <Image
                  src={data.pledge.projectImage}
                  alt={data.pledge.projectTitle}
                  fill
                  className="object-cover"
                />
              </div>
            )}
            <div>
              <h1 className="font-semibold">{data.pledge.projectTitle}</h1>
              <p className="text-sm text-zinc-500">{data.pledge.rewardTitle}</p>
              {data.response.isComplete && (
                <Badge className="mt-1 bg-emerald-100 text-emerald-700">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Survey Complete
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress */}
      <div className="flex items-center gap-2">
        {[...steps, ...(currentStep === "payment" ? ["payment" as const] : [])].map((step, index) => (
          <div key={step} className="flex items-center">
            <div
              className={`h-2 w-8 rounded ${
                index <= currentStepIndex ? "bg-primary" : "bg-zinc-200"
              }`}
            />
          </div>
        ))}
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Intro Step */}
      {currentStep === "intro" && (
        <Card>
          <CardHeader>
            <CardTitle>{data.response.isComplete ? "Survey Submitted" : (data.survey.introTitle || "Complete Your Survey")}</CardTitle>
            {data.response.isComplete ? (
              <CardDescription>
                Your survey has been submitted. You can edit your responses below if you need to make changes.
              </CardDescription>
            ) : data.survey.introMessage ? (
              <CardDescription className="whitespace-pre-wrap">
                {data.survey.introMessage}
              </CardDescription>
            ) : null}
          </CardHeader>
          <CardContent>
            <Button onClick={nextStep} className="w-full">
              {data.response.isComplete ? "Edit Responses" : "Get Started"}
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Items Step */}
      {currentStep === "items" && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Package className="h-5 w-5" />
            Choose Your Options
          </h2>

          {data.itemQuestions.map((item) => (
            <Card key={item.id}>
              <CardHeader>
                <CardTitle className="text-lg">{item.itemName}</CardTitle>
                {item.itemDescription && (
                  <CardDescription>{item.itemDescription}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Variants */}
                {item.variants.map((variant) => (
                  <div key={variant.id} className="space-y-2">
                    <Label>{variant.variantType}</Label>
                    <Select
                      value={itemResponses[item.id]?.variants?.[variant.id] || ""}
                      onValueChange={(value) =>
                        setItemResponses({
                          ...itemResponses,
                          [item.id]: {
                            ...itemResponses[item.id],
                            variants: {
                              ...itemResponses[item.id]?.variants,
                              [variant.id]: value,
                            },
                          },
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={`Select ${variant.variantType}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {variant.options.map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}

                {/* Custom Questions */}
                {item.customQuestions.map((q) => (
                  <div key={q.id} className="space-y-2">
                    <Label>
                      {q.question}
                      {q.isRequired && <span className="text-red-500 ml-1">*</span>}
                    </Label>
                    {q.description && (
                      <p className="text-sm text-zinc-500">{q.description}</p>
                    )}
                    <QuestionInput
                      type={q.questionType}
                      options={q.options}
                      value={itemResponses[item.id]?.customAnswers?.[q.id]}
                      onChange={(value) =>
                        setItemResponses({
                          ...itemResponses,
                          [item.id]: {
                            ...itemResponses[item.id],
                            customAnswers: {
                              ...itemResponses[item.id]?.customAnswers,
                              [q.id]: value,
                            },
                          },
                        })
                      }
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}

          <div className="flex gap-3">
            <Button variant="outline" onClick={prevStep}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button onClick={nextStep} className="flex-1">
              Continue
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Questions Step */}
      {currentStep === "questions" && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Additional Questions
          </h2>

          {data.backerQuestions.map((q) => (
            <Card key={q.id}>
              <CardContent className="py-4 space-y-2">
                <Label>
                  {q.question}
                  {q.isRequired && <span className="text-red-500 ml-1">*</span>}
                </Label>
                {q.description && (
                  <p className="text-sm text-zinc-500">{q.description}</p>
                )}
                <QuestionInput
                  type={q.questionType}
                  options={q.options}
                  value={backerResponses[q.id]}
                  onChange={(value) =>
                    setBackerResponses({
                      ...backerResponses,
                      [q.id]: value,
                    })
                  }
                />
              </CardContent>
            </Card>
          ))}

          <div className="flex gap-3">
            <Button variant="outline" onClick={prevStep}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button onClick={nextStep} className="flex-1">
              Continue
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Addons Step */}
      {currentStep === "addons" && data.availableAddons && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            Add-ons
          </h2>
          <p className="text-sm text-muted-foreground">
            Want to add more to your pledge? Select any additional items below. These will be charged separately.
          </p>

          {data.availableAddons.map((addon) => {
            const qty = selectedAddons[addon.id] || 0;
            const isAlreadyPurchased = addon.alreadyPurchased;

            return (
              <Card key={addon.id} className={qty > 0 ? "ring-2 ring-emerald-500 border-emerald-500" : ""}>
                <CardContent className="py-4">
                  <div className="flex gap-4">
                    {addon.imageUrl && (
                      <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-zinc-100 shrink-0">
                        <Image
                          src={addon.imageUrl}
                          alt={addon.title}
                          fill
                          className="object-cover"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold">{addon.title}</h3>
                      {addon.description && (
                        <p className="text-sm text-zinc-500 mt-1 line-clamp-2">{addon.description}</p>
                      )}
                      <p className="text-lg font-semibold text-emerald-600 mt-2">
                        ${addon.price.toFixed(2)}
                      </p>
                      {addon.quantityAvailable !== null && (
                        <p className="text-xs text-zinc-400 mt-1">
                          {addon.quantityAvailable} remaining
                        </p>
                      )}
                      {isAlreadyPurchased && (
                        <Badge variant="outline" className="mt-1 text-xs">
                          Already in your pledge
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Quantity controls and remove - always visible on mobile */}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => updateAddonQuantity(addon.id, -1)}
                        disabled={qty === 0}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-8 text-center font-semibold text-lg">{qty}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => updateAddonQuantity(addon.id, 1)}
                        disabled={addon.quantityAvailable !== null && qty >= addon.quantityAvailable}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {qty > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 h-9 px-3 text-sm gap-1.5"
                        onClick={() => setSelectedAddons(prev => {
                          const next = { ...prev };
                          delete next[addon.id];
                          return next;
                        })}
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Addon Total */}
          {hasNewAddons && (
            <Card className="bg-emerald-50 border-emerald-200">
              <CardContent className="py-3">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Add-on Total</span>
                  <span className="text-lg font-semibold text-emerald-700">
                    ${addonsTotal.toFixed(2)}
                  </span>
                </div>
                <p className="text-xs text-emerald-600 mt-1">
                  This amount will be charged after you submit your survey.
                </p>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={prevStep}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button onClick={nextStep} className="flex-1">
              {hasNewAddons ? `Continue with $${addonsTotal.toFixed(2)} in add-ons` : "Skip Add-ons"}
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Address Step */}
      {currentStep === "address" && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Shipping Address
          </h2>

          {isAddressLocked && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3">
              <Lock className="h-5 w-5 text-amber-600" />
              <div>
                <p className="font-medium text-amber-800">Address Locked</p>
                <p className="text-sm text-amber-700">
                  Your shipping address has been locked and cannot be changed.
                </p>
              </div>
            </div>
          )}

          {/* Saved Address Picker */}
          {savedAddresses.length > 0 && !isAddressLocked && (
            <Card className="border-blue-200 bg-blue-50/50">
              <CardContent className="py-4">
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-800">Use a saved address</span>
                </div>
                <div className="space-y-2">
                  {savedAddresses.map((addr) => (
                    <button
                      key={addr.id}
                      onClick={() => applySavedAddress(addr)}
                      className="w-full text-left p-3 rounded-lg border bg-white hover:border-blue-400 hover:bg-blue-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {addr.label}
                          {addr.isDefault && (
                            <span className="ml-2 text-xs text-blue-600 font-normal">(Default)</span>
                          )}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 mt-1">
                        {addr.fullName} — {addr.line1}, {addr.city}, {addr.state} {addr.postalCode}, {addr.country}
                      </p>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="py-4 space-y-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input
                  value={shippingAddress.name}
                  onChange={(e) => setShippingAddress({ ...shippingAddress, name: e.target.value })}
                  disabled={isAddressLocked}
                />
              </div>

              <div className="space-y-2">
                <Label>Address Line 1</Label>
                <Input
                  value={shippingAddress.line1}
                  onChange={(e) => setShippingAddress({ ...shippingAddress, line1: e.target.value })}
                  placeholder="Street address"
                  disabled={isAddressLocked}
                />
              </div>

              <div className="space-y-2">
                <Label>Address Line 2 (Optional)</Label>
                <Input
                  value={shippingAddress.line2}
                  onChange={(e) => setShippingAddress({ ...shippingAddress, line2: e.target.value })}
                  placeholder="Apt, suite, unit, etc."
                  disabled={isAddressLocked}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input
                    value={shippingAddress.city}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, city: e.target.value })}
                    disabled={isAddressLocked}
                  />
                </div>
                <div className="space-y-2">
                  <Label>State/Province</Label>
                  <Input
                    value={shippingAddress.state}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, state: e.target.value })}
                    disabled={isAddressLocked}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Postal Code</Label>
                  <Input
                    value={shippingAddress.postalCode}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, postalCode: e.target.value })}
                    disabled={isAddressLocked}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Country</Label>
                  <Select
                    value={shippingAddress.country}
                    onValueChange={(v) => setShippingAddress({ ...shippingAddress, country: v })}
                    disabled={isAddressLocked}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ALL_COUNTRIES.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Phone Number (Optional)</Label>
                <Input
                  value={shippingAddress.phone}
                  onChange={(e) => setShippingAddress({ ...shippingAddress, phone: e.target.value })}
                  placeholder="For delivery notifications"
                  disabled={isAddressLocked}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" onClick={prevStep}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button onClick={nextStep} className="flex-1">
              Continue
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Review Step */}
      {currentStep === "review" && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Review & Submit
          </h2>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Your Selections</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Item Responses */}
              {data.itemQuestions.map((item) => {
                const response = itemResponses[item.id];
                if (!response) return null;
                return (
                  <div key={item.id} className="border-b pb-4">
                    <h4 className="font-medium">{item.itemName}</h4>
                    {response.variants && Object.entries(response.variants).map(([variantId, value]) => {
                      const variant = item.variants.find(v => v.id === variantId);
                      return (
                        <p key={variantId} className="text-sm text-zinc-600">
                          {variant?.variantType}: {value}
                        </p>
                      );
                    })}
                  </div>
                );
              })}

              {/* Backer Responses */}
              {data.backerQuestions.map((q) => {
                const response = backerResponses[q.id];
                if (!response) return null;
                return (
                  <div key={q.id} className="border-b pb-4">
                    <h4 className="font-medium">{q.question}</h4>
                    <p className="text-sm text-zinc-600">
                      {Array.isArray(response) ? response.join(", ") : response}
                    </p>
                  </div>
                );
              })}

              {/* Selected Addons */}
              {hasNewAddons && data.availableAddons && (
                <div className="border-b pb-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4" />
                    Additional Add-ons
                  </h4>
                  <div className="mt-2 space-y-2">
                    {Object.entries(selectedAddons)
                      .filter(([, qty]) => qty > 0)
                      .map(([id, qty]) => {
                        const addon = data.availableAddons?.find(a => a.id === id);
                        if (!addon) return null;
                        return (
                          <div key={id} className="flex items-center justify-between text-sm">
                            <span className="text-zinc-600">
                              {addon.title} x{qty}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                ${(addon.price * qty).toFixed(2)}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-red-400 hover:text-red-600 hover:bg-red-50"
                                onClick={() => setSelectedAddons(prev => {
                                  const next = { ...prev };
                                  delete next[id];
                                  return next;
                                })}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    <div className="flex justify-between text-sm font-semibold pt-2 border-t">
                      <span>Add-on Total</span>
                      <span className="text-emerald-600">${addonsTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Address */}
              {showAddressStep && shippingAddress.name && (
                <div>
                  <h4 className="font-medium">Shipping Address</h4>
                  <p className="text-sm text-zinc-600">
                    {shippingAddress.name}<br />
                    {shippingAddress.line1}<br />
                    {shippingAddress.line2 && <>{shippingAddress.line2}<br /></>}
                    {shippingAddress.city}, {shippingAddress.state} {shippingAddress.postalCode}<br />
                    {ALL_COUNTRIES.find(c => c.code === shippingAddress.country)?.name || shippingAddress.country}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" onClick={prevStep}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button
              onClick={handleSubmit}
              className="flex-1"
              disabled={isSaving}
            >
              {isSaving ? "Submitting..." : hasNewAddons ? (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Submit & Continue to Payment
                </>
              ) : data.response.isComplete ? "Update Survey" : "Submit Survey"}
            </Button>
          </div>
        </div>
      )}

      {/* Payment Step */}
      {currentStep === "payment" && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Complete Payment
          </h2>

          <p className="text-sm text-muted-foreground">
            Your survey has been submitted. Complete your payment below to finalize your add-on purchases.
          </p>

          {/* Order Summary */}
          <Card className="bg-zinc-50">
            <CardContent className="py-4">
              <h3 className="font-medium mb-3">Order Summary</h3>
              {data.availableAddons && Object.entries(selectedAddons)
                .filter(([, qty]) => qty > 0)
                .map(([id, qty]) => {
                  const addon = data.availableAddons?.find(a => a.id === id);
                  if (!addon) return null;
                  return (
                    <div key={id} className="flex justify-between text-sm py-1">
                      <span>{addon.title} x{qty}</span>
                      <span>${(addon.price * qty).toFixed(2)}</span>
                    </div>
                  );
                })}
              <div className="flex justify-between font-semibold text-lg pt-3 mt-3 border-t">
                <span>Total</span>
                <span className="text-emerald-600">${addonsTotal.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Payment Error */}
          {paymentError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600 mb-2">{paymentError}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPaymentError(null);
                  setClientSecret(null);
                  setIsProcessingPayment(false);
                  creatingPaymentRef.current = false;
                }}
              >
                Try Again
              </Button>
            </div>
          )}

          {/* Stripe Payment Form */}
          <Card>
            <CardContent className="py-5">
              {clientSecret && stripePromise ? (
                <Elements
                  key={clientSecret}
                  stripe={stripePromise}
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
                  <SurveyPaymentForm
                    onSuccess={handlePaymentSuccess}
                    onError={handlePaymentError}
                    isProcessing={isProcessingPayment}
                    setIsProcessing={setIsProcessingPayment}
                    total={addonsTotal}
                  />
                </Elements>
              ) : !paymentError ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">Loading payment form...</p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" onClick={prevStep}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back to Review
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Stripe Payment Form for Survey Addons
function SurveyPaymentForm({
  onSuccess,
  onError,
  isProcessing,
  setIsProcessing,
  total,
}: {
  onSuccess: () => void;
  onError: (message: string) => void;
  isProcessing: boolean;
  setIsProcessing: (val: boolean) => void;
  total: number;
}) {
  const stripe = useStripe();
  const elements = useElements();

  const handleSubmit = async () => {
    if (!stripe || !elements) return;

    setIsProcessing(true);

    try {
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/dashboard/backer?tab=wallet`,
        },
        redirect: "if_required",
      });

      if (result.error) {
        onError(result.error.message || "Payment failed");
        setIsProcessing(false);
      } else {
        onSuccess();
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : "An unexpected error occurred");
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Secure payment header */}
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground pb-3 border-b">
        <Lock className="h-4 w-4 text-emerald-600" />
        <span>Secure Payment</span>
      </div>

      <PaymentElement
        options={{
          layout: { type: "tabs", defaultCollapsed: false },
        }}
      />

      <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
        <span>Your payment information is encrypted and secure.</span>
      </div>

      <Button
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-12 text-base"
        size="lg"
        onClick={handleSubmit}
        disabled={!stripe || !elements || isProcessing}
      >
        {isProcessing ? (
          <span className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            Processing...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Pay ${total.toFixed(2)}
          </span>
        )}
      </Button>
    </div>
  );
}

// Question Input Component
function QuestionInput({
  type,
  options,
  value,
  onChange,
}: {
  type: string;
  options: string[];
  value?: string | string[];
  onChange: (value: string | string[]) => void;
}) {
  if (type === "OPEN_TEXT") {
    return (
      <Textarea
        value={(value as string) || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter your answer..."
      />
    );
  }

  if (type === "SINGLE_SELECT") {
    return (
      <RadioGroup
        value={(value as string) || ""}
        onValueChange={onChange}
      >
        {options.map((opt) => (
          <div key={opt} className="flex items-center space-x-2">
            <RadioGroupItem value={opt} id={opt} />
            <Label htmlFor={opt}>{opt}</Label>
          </div>
        ))}
      </RadioGroup>
    );
  }

  if (type === "MULTIPLE_SELECT") {
    const selected = (value as string[]) || [];
    return (
      <div className="space-y-2">
        {options.map((opt) => (
          <div key={opt} className="flex items-center space-x-2">
            <Checkbox
              id={opt}
              checked={selected.includes(opt)}
              onCheckedChange={(checked) => {
                if (checked) {
                  onChange([...selected, opt]);
                } else {
                  onChange(selected.filter((s) => s !== opt));
                }
              }}
            />
            <Label htmlFor={opt}>{opt}</Label>
          </div>
        ))}
      </div>
    );
  }

  return null;
}
