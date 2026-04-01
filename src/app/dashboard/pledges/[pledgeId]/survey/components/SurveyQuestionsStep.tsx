"use client";

import { ClipboardList, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SurveyData } from "./types";
import { QuestionInput } from "./QuestionInput";

interface SurveyQuestionsStepProps {
  data: SurveyData;
  backerResponses: Record<string, string | string[]>;
  setBackerResponses: React.Dispatch<React.SetStateAction<Record<string, string | string[]>>>;
  onNext: () => void;
  onPrev: () => void;
}

export function SurveyQuestionsStep({ data, backerResponses, setBackerResponses, onNext, onPrev }: SurveyQuestionsStepProps) {
  return (
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
              questionId={q.id}
              type={q.questionType}
              displayType={q.displayType}
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
        <Button variant="outline" onClick={onPrev}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button onClick={onNext} className="flex-1">
          Continue
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
