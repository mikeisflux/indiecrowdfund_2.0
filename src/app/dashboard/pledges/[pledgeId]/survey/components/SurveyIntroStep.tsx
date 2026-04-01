"use client";

import { ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SurveyData } from "./types";

interface SurveyIntroStepProps {
  data: SurveyData;
  onNext: () => void;
}

export function SurveyIntroStep({ data, onNext }: SurveyIntroStepProps) {
  return (
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
        <Button onClick={onNext} className="w-full">
          {data.response.isComplete ? "Edit Responses" : "Get Started"}
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
