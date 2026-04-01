"use client";

import { ArrowLeft, CheckCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";
import { SurveyData, Step } from "./types";

interface SurveyHeaderProps {
  data: SurveyData;
  steps: Step[];
  currentStep: Step;
  currentStepIndex: number;
}

export function SurveyHeader({ data, steps, currentStep, currentStepIndex }: SurveyHeaderProps) {
  return (
    <>
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

      {/* Project Card */}
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
    </>
  );
}
