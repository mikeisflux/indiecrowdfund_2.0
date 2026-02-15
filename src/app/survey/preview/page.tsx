"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  Loader2,
  Eye,
} from "lucide-react";

interface SurveyPreviewData {
  survey: {
    id: string;
    introTitle?: string;
    introMessage?: string;
    collectAddresses: boolean;
    status: string;
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
  } | null;
  rewards: { id: string; title: string }[];
}

type Step = "intro" | "items" | "questions" | "address" | "review";

export default function SurveyPreviewPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams?.get("projectId") ?? null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SurveyPreviewData | null>(null);
  const [currentStep, setCurrentStep] = useState<Step>("intro");

  const fetchSurvey = useCallback(async () => {
    if (!projectId) {
      setError("No project ID provided");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`/api/projects/${projectId}/survey`);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to load survey");
      }

      const surveyData = await res.json();
      setData(surveyData);

      if (!surveyData.survey) {
        setError("No survey has been created for this project yet. Create survey questions first.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load survey preview");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchSurvey();
  }, [fetchSurvey]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
          <p className="text-muted-foreground">Loading survey preview...</p>
        </div>
      </div>
    );
  }

  if (error || !data?.survey) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <Card className="max-w-md mx-4">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Survey Preview Unavailable</h2>
            <p className="text-muted-foreground mb-4">{error || "No survey found"}</p>
            <Button variant="outline" onClick={() => window.close()}>
              Close
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const survey = data.survey;
  const hasItems = survey.itemQuestions && survey.itemQuestions.length > 0;
  const hasQuestions = survey.backerQuestions && survey.backerQuestions.length > 0;

  const steps: { id: Step; label: string; icon: React.ElementType }[] = [
    { id: "intro", label: "Welcome", icon: ClipboardList },
    ...(hasItems ? [{ id: "items" as Step, label: "Items", icon: Package }] : []),
    ...(hasQuestions ? [{ id: "questions" as Step, label: "Questions", icon: ClipboardList }] : []),
    ...(survey.collectAddresses ? [{ id: "address" as Step, label: "Address", icon: MapPin }] : []),
    { id: "review", label: "Review", icon: ClipboardList },
  ];

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  const goNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStep(steps[currentStepIndex + 1].id);
    }
  };

  const goPrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStep(steps[currentStepIndex - 1].id);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      {/* Preview Banner */}
      <div className="bg-amber-500 text-amber-950 py-2 px-4 text-center text-sm font-medium flex items-center justify-center gap-2">
        <Eye className="h-4 w-4" />
        Preview Mode - This is how backers will see your survey. No responses will be saved.
      </div>

      <div className="max-w-3xl mx-auto py-8 px-4">
        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isCurrent = step.id === currentStep;
            const isPast = idx < currentStepIndex;
            return (
              <div key={step.id} className="flex items-center">
                {idx > 0 && (
                  <div className={`w-8 h-0.5 mx-1 ${isPast ? "bg-teal-500" : "bg-border"}`} />
                )}
                <button
                  onClick={() => setCurrentStep(step.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    isCurrent
                      ? "bg-teal-600 text-white"
                      : isPast
                      ? "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{step.label}</span>
                </button>
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        {currentStep === "intro" && (
          <Card>
            <CardHeader>
              <CardTitle>{survey.introTitle || "Backer Survey"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {survey.introMessage ? (
                <div className="prose prose-sm max-w-none text-muted-foreground whitespace-pre-wrap">
                  {survey.introMessage}
                </div>
              ) : (
                <p className="text-muted-foreground">
                  Thank you for backing this project! Please complete this survey so we can
                  fulfill your rewards.
                </p>
              )}
              <div className="bg-muted/50 border rounded-lg p-4 text-sm space-y-2">
                <p><strong>What to expect:</strong></p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  {hasItems && <li>Select variants for your items (size, color, etc.)</li>}
                  {hasQuestions && <li>Answer a few questions from the creator</li>}
                  {survey.collectAddresses && <li>Confirm your shipping address</li>}
                  <li>Review and submit your responses</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === "items" && hasItems && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Your Items</h2>
            {survey.itemQuestions.map((item) => {
              const rewardInfo = data.rewards.find((r) => r.id === item.rewardId);
              return (
                <Card key={item.id}>
                  <CardContent className="pt-6 space-y-4">
                    <div className="flex items-start gap-4">
                      {item.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.imageUrl}
                          alt={item.itemName}
                          className="w-20 h-20 object-cover rounded-lg"
                        />
                      )}
                      <div>
                        <h3 className="font-semibold">{item.itemName}</h3>
                        {rewardInfo && (
                          <Badge variant="outline" className="mt-1">{rewardInfo.title}</Badge>
                        )}
                        {item.itemDescription && (
                          <p className="text-sm text-muted-foreground mt-1">{item.itemDescription}</p>
                        )}
                      </div>
                    </div>

                    {/* Variants */}
                    {item.variants.map((variant) => (
                      <div key={variant.id} className="space-y-2">
                        <Label>{variant.variantType}</Label>
                        <Select disabled>
                          <SelectTrigger>
                            <SelectValue placeholder={`Select ${variant.variantType.toLowerCase()}...`} />
                          </SelectTrigger>
                          <SelectContent>
                            {variant.options.map((opt) => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
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
                          <p className="text-xs text-muted-foreground">{q.description}</p>
                        )}
                        {q.questionType === "OPEN_TEXT" && (
                          <Textarea placeholder="Your answer..." disabled />
                        )}
                        {q.questionType === "SINGLE_SELECT" && (
                          <RadioGroup disabled>
                            {q.options.map((opt) => (
                              <div key={opt} className="flex items-center space-x-2">
                                <RadioGroupItem value={opt} id={`${q.id}-${opt}`} disabled />
                                <Label htmlFor={`${q.id}-${opt}`}>{opt}</Label>
                              </div>
                            ))}
                          </RadioGroup>
                        )}
                        {q.questionType === "MULTIPLE_SELECT" && (
                          <div className="space-y-2">
                            {q.options.map((opt) => (
                              <div key={opt} className="flex items-center space-x-2">
                                <Checkbox disabled />
                                <label className="text-sm">{opt}</label>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {currentStep === "questions" && hasQuestions && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Questions</h2>
            <Card>
              <CardContent className="pt-6 space-y-6">
                {survey.backerQuestions.map((q) => (
                  <div key={q.id} className="space-y-2">
                    <Label>
                      {q.question}
                      {q.isRequired && <span className="text-red-500 ml-1">*</span>}
                    </Label>
                    {q.description && (
                      <p className="text-xs text-muted-foreground">{q.description}</p>
                    )}
                    {q.questionType === "OPEN_TEXT" && (
                      <Textarea placeholder="Your answer..." disabled />
                    )}
                    {q.questionType === "SINGLE_SELECT" && (
                      <RadioGroup disabled>
                        {q.options.map((opt) => (
                          <div key={opt} className="flex items-center space-x-2">
                            <RadioGroupItem value={opt} id={`bq-${q.id}-${opt}`} disabled />
                            <Label htmlFor={`bq-${q.id}-${opt}`}>{opt}</Label>
                          </div>
                        ))}
                      </RadioGroup>
                    )}
                    {q.questionType === "MULTIPLE_SELECT" && (
                      <div className="space-y-2">
                        {q.options.map((opt) => (
                          <div key={opt} className="flex items-center space-x-2">
                            <Checkbox disabled />
                            <label className="text-sm">{opt}</label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {currentStep === "address" && survey.collectAddresses && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Shipping Address</h2>
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-2">
                    <Label>Full Name</Label>
                    <Input placeholder="John Doe" disabled />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label>Address Line 1</Label>
                    <Input placeholder="123 Main St" disabled />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label>Address Line 2</Label>
                    <Input placeholder="Apt 4B (optional)" disabled />
                  </div>
                  <div className="space-y-2">
                    <Label>City</Label>
                    <Input placeholder="New York" disabled />
                  </div>
                  <div className="space-y-2">
                    <Label>State/Province</Label>
                    <Input placeholder="NY" disabled />
                  </div>
                  <div className="space-y-2">
                    <Label>Postal Code</Label>
                    <Input placeholder="10001" disabled />
                  </div>
                  <div className="space-y-2">
                    <Label>Country</Label>
                    <Select disabled>
                      <SelectTrigger>
                        <SelectValue placeholder="Select country..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="US">United States</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label>Phone (optional)</Label>
                    <Input placeholder="+1 (555) 123-4567" disabled />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {currentStep === "review" && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold">Review & Submit</h2>
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <p className="text-sm text-amber-800 dark:text-amber-300 flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    This is a preview. The submit button is disabled in preview mode.
                  </p>
                </div>

                {hasItems && (
                  <div>
                    <h3 className="font-medium mb-2">Item Selections</h3>
                    <p className="text-sm text-muted-foreground">
                      {survey.itemQuestions.length} item(s) to configure
                    </p>
                  </div>
                )}

                {hasQuestions && (
                  <div>
                    <h3 className="font-medium mb-2">Backer Questions</h3>
                    <p className="text-sm text-muted-foreground">
                      {survey.backerQuestions.length} question(s) to answer
                    </p>
                  </div>
                )}

                {survey.collectAddresses && (
                  <div>
                    <h3 className="font-medium mb-2">Shipping Address</h3>
                    <p className="text-sm text-muted-foreground">Address collection enabled</p>
                  </div>
                )}

                <Button className="w-full bg-teal-600" disabled>
                  Submit Survey (Preview Mode)
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-8">
          <Button
            variant="outline"
            onClick={goPrev}
            disabled={currentStepIndex === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>
          {currentStepIndex < steps.length - 1 ? (
            <Button onClick={goNext} className="bg-teal-600 hover:bg-teal-700">
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button variant="outline" onClick={() => window.close()}>
              Close Preview
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
