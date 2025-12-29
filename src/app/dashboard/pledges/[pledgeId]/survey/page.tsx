"use client";

import { getCSRFHeaders } from "@/lib/csrf";

import { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";

interface SurveyData {
  survey: {
    id: string;
    introTitle?: string;
    introMessage?: string;
    collectAddresses: boolean;
    status: string;
    addressesLocked: boolean;
  };
  pledge: {
    id: string;
    projectTitle: string;
    projectImage?: string;
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
  };
}

type Step = "intro" | "items" | "questions" | "address" | "review";

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

  const saveProgress = async (submit = false) => {
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/surveys/${pledgeId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          itemResponses,
          backerResponses,
          // Only send address if it has content (at least name filled in)
          shippingAddress: data?.survey.collectAddresses && shippingAddress.name.trim()
            ? shippingAddress
            : null,
          submit,
        }),
      });

      if (response.ok) {
        if (submit) {
          router.push("/dashboard/backer");
        }
      } else {
        const err = await response.json();
        setError(err.error || "Failed to save");
      }
    } catch (err) {
      console.error("Error saving survey:", err);
      setError("Failed to save survey");
    } finally {
      setIsSaving(false);
    }
  };

  const getSteps = (): Step[] => {
    const steps: Step[] = ["intro"];
    if (data?.itemQuestions && data.itemQuestions.length > 0) steps.push("items");
    if (data?.backerQuestions && data.backerQuestions.length > 0) steps.push("questions");
    if (data?.survey.collectAddresses) steps.push("address");
    steps.push("review");
    return steps;
  };

  const steps = getSteps();
  const currentStepIndex = steps.indexOf(currentStep);

  const nextStep = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex]);
      saveProgress(false);
    }
  };

  const prevStep = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex]);
    }
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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
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
        {steps.map((step, index) => (
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
            <CardTitle>{data.survey.introTitle || "Complete Your Survey"}</CardTitle>
            {data.survey.introMessage && (
              <CardDescription className="whitespace-pre-wrap">
                {data.survey.introMessage}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <Button onClick={nextStep} className="w-full">
              Get Started
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
                      <SelectItem value="US">United States</SelectItem>
                      <SelectItem value="CA">Canada</SelectItem>
                      <SelectItem value="GB">United Kingdom</SelectItem>
                      <SelectItem value="AU">Australia</SelectItem>
                      <SelectItem value="DE">Germany</SelectItem>
                      <SelectItem value="FR">France</SelectItem>
                      {/* Add more countries as needed */}
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

              {/* Address */}
              {data.survey.collectAddresses && shippingAddress.name && (
                <div>
                  <h4 className="font-medium">Shipping Address</h4>
                  <p className="text-sm text-zinc-600">
                    {shippingAddress.name}<br />
                    {shippingAddress.line1}<br />
                    {shippingAddress.line2 && <>{shippingAddress.line2}<br /></>}
                    {shippingAddress.city}, {shippingAddress.state} {shippingAddress.postalCode}<br />
                    {shippingAddress.country}
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
              onClick={() => saveProgress(true)}
              className="flex-1"
              disabled={isSaving}
            >
              {isSaving ? "Submitting..." : "Submit Survey"}
            </Button>
          </div>
        </div>
      )}
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
