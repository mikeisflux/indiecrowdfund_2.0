"use client";

import { Package, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SurveyData } from "./types";
import { QuestionInput } from "./QuestionInput";

interface SurveyItemsStepProps {
  data: SurveyData;
  itemResponses: Record<string, { variants?: Record<string, string>; customAnswers?: Record<string, string | string[]> }>;
  setItemResponses: React.Dispatch<React.SetStateAction<Record<string, { variants?: Record<string, string>; customAnswers?: Record<string, string | string[]> }>>>;
  onNext: () => void;
  onPrev: () => void;
}

export function SurveyItemsStep({ data, itemResponses, setItemResponses, onNext, onPrev }: SurveyItemsStepProps) {
  return (
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
                  <p className="text-sm text-muted-foreground">{q.description}</p>
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
