"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  ClipboardList,
  Package,
  MapPin,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  User,
  Mail,
} from "lucide-react";
import { fetchWithRetry } from "@/lib/fetch-utils";

interface SurveyData {
  survey: {
    id: string;
    introTitle?: string;
    introMessage?: string;
    collectAddresses: boolean;
    status: string;
    addressesLocked: boolean;
  } | null;
  pledge: {
    id: string;
    rewardTitle: string;
    backerName?: string;
    backerEmail?: string;
    addons: { id: string; title: string }[];
  };
  questions: {
    itemQuestions: {
      id: string;
      itemName: string;
      itemDescription?: string;
      variants: { id: string; variantType: string; options: string[] }[];
      customQuestions: { id: string; question: string; questionType: string; options: string[] }[];
    }[];
    backerQuestions: {
      id: string;
      question: string;
      questionType: string;
      options: string[];
    }[];
  };
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
    completedAt?: string;
  } | null;
}

export default function CreatorSurveyViewPage() {
  const params = useParams();
  const router = useRouter();
  const pledgeId = params?.pledgeId as string;

  const [data, setData] = useState<SurveyData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSurvey = useCallback(async () => {
    if (!pledgeId) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetchWithRetry(`/api/creator/indiekit/surveys/${pledgeId}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to load survey");
      }
      const surveyData = await res.json();
      setData(surveyData);
    } catch (err) {
      console.error("Error fetching survey:", err);
      setError(err instanceof Error ? err.message : "Failed to load survey");
    } finally {
      setIsLoading(false);
    }
  }, [pledgeId]);

  useEffect(() => {
    fetchSurvey();
  }, [fetchSurvey]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto mt-12">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Unable to Load Survey</h3>
            <p className="text-zinc-500 mb-4">{error}</p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={() => router.back()}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go Back
              </Button>
              <Button onClick={fetchSurvey}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const { survey, pledge, questions, response } = data;

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-6">
      {/* Back Button */}
      <div>
        <Link href="/dashboard/indiekit">
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to IndieKit
          </Button>
        </Link>
      </div>

      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-teal-600" />
                Survey Response
              </CardTitle>
              <CardDescription className="mt-1">
                Viewing survey responses for this backer
              </CardDescription>
            </div>
            <Badge variant={response?.isComplete ? "default" : "secondary"} className="text-sm">
              {response?.isComplete ? (
                <>
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Completed
                </>
              ) : (
                <>
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Pending
                </>
              )}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Backer</p>
                <p className="font-medium">{pledge.backerName || "Unknown"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{pledge.backerEmail || "Unknown"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Package className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Reward Tier</p>
                <p className="font-medium">{pledge.rewardTitle}</p>
              </div>
            </div>
            {pledge.addons.length > 0 && (
              <div className="flex items-center gap-3">
                <Package className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Add-ons</p>
                  <p className="font-medium">{pledge.addons.map(a => a.title).join(", ")}</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {!survey ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-8 w-8 mx-auto text-amber-500 mb-4" />
            <p className="text-muted-foreground">No survey has been configured or sent for this project yet.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Survey Intro */}
          {(survey.introTitle || survey.introMessage) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{survey.introTitle || "Survey Introduction"}</CardTitle>
                {survey.introMessage && (
                  <CardDescription className="whitespace-pre-wrap">{survey.introMessage}</CardDescription>
                )}
              </CardHeader>
            </Card>
          )}

          {/* Item Questions */}
          {questions.itemQuestions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="h-5 w-5 text-teal-600" />
                  Item Selections
                </CardTitle>
                <CardDescription>Variant and option selections for reward items</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {questions.itemQuestions.map((item) => {
                  const itemResponse = response?.itemResponses?.[item.id];
                  return (
                    <div key={item.id} className="border rounded-lg p-4">
                      <h4 className="font-medium mb-2">{item.itemName}</h4>
                      {item.itemDescription && (
                        <p className="text-sm text-muted-foreground mb-3">{item.itemDescription}</p>
                      )}

                      {/* Variants */}
                      {item.variants.length > 0 && (
                        <div className="space-y-2 mb-3">
                          {item.variants.map((variant) => {
                            const selection = itemResponse?.variants?.[variant.id];
                            return (
                              <div key={variant.id} className="flex justify-between items-center py-2 border-b last:border-0">
                                <span className="text-sm text-muted-foreground">{variant.variantType}</span>
                                <span className={`text-sm font-medium ${!selection ? "text-amber-600 italic" : ""}`}>
                                  {selection || "Not selected"}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Custom Questions */}
                      {item.customQuestions.length > 0 && (
                        <div className="space-y-3 pt-2 border-t">
                          {item.customQuestions.map((q) => {
                            const answer = itemResponse?.customAnswers?.[q.id];
                            const displayAnswer = answer
                              ? Array.isArray(answer)
                                ? answer.join(", ")
                                : answer
                              : null;
                            return (
                              <div key={q.id}>
                                <p className="text-sm text-muted-foreground">{q.question}</p>
                                <p className={`text-sm mt-1 ${!displayAnswer ? "text-amber-600 italic" : "font-medium"}`}>
                                  {displayAnswer || "No answer"}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Backer Questions */}
          {questions.backerQuestions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-teal-600" />
                  Survey Questions
                </CardTitle>
                <CardDescription>General questions for backers</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {questions.backerQuestions.map((q) => {
                  const answer = response?.backerResponses?.[q.id];
                  const displayAnswer = answer
                    ? Array.isArray(answer)
                      ? answer.join(", ")
                      : answer
                    : null;
                  return (
                    <div key={q.id} className="border rounded-lg p-4">
                      <p className="text-sm text-muted-foreground mb-2">{q.question}</p>
                      <p className={`${!displayAnswer ? "text-amber-600 italic" : "font-medium"}`}>
                        {displayAnswer || "No answer"}
                      </p>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Shipping Address */}
          {survey.collectAddresses && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-teal-600" />
                  Shipping Address
                </CardTitle>
              </CardHeader>
              <CardContent>
                {response?.shippingAddress && response.shippingAddress.line1 ? (
                  <div className="space-y-1">
                    {response.shippingAddress.name && (
                      <p className="font-medium">{response.shippingAddress.name}</p>
                    )}
                    <p>{response.shippingAddress.line1}</p>
                    {response.shippingAddress.line2 && <p>{response.shippingAddress.line2}</p>}
                    <p>
                      {response.shippingAddress.city}
                      {response.shippingAddress.state && `, ${response.shippingAddress.state}`}{" "}
                      {response.shippingAddress.postalCode}
                    </p>
                    <p>{response.shippingAddress.country}</p>
                    {response.shippingAddress.phone && (
                      <p className="text-muted-foreground">Phone: {response.shippingAddress.phone}</p>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <AlertCircle className="h-6 w-6 text-amber-500 mx-auto mb-2" />
                    <p className="text-amber-600 italic">No shipping address provided</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* No questions message */}
          {questions.itemQuestions.length === 0 && questions.backerQuestions.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <ClipboardList className="h-8 w-8 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No survey questions configured for this backer&apos;s reward tier.</p>
              </CardContent>
            </Card>
          )}

          {/* Completion Info */}
          {response?.completedAt && (
            <p className="text-center text-sm text-muted-foreground">
              Survey completed on {new Date(response.completedAt).toLocaleDateString()} at{" "}
              {new Date(response.completedAt).toLocaleTimeString()}
            </p>
          )}
        </>
      )}
    </div>
  );
}
