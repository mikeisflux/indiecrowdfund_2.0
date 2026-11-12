"use client";

import Image from "next/image";
import { Package, ChevronLeft, ChevronRight, Copy } from "lucide-react";
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
import { unitKey, unitLabel, type ItemResponses } from "@/lib/surveys/item-units";

interface SurveyItemsStepProps {
  data: SurveyData;
  itemResponses: ItemResponses;
  setItemResponses: React.Dispatch<React.SetStateAction<ItemResponses>>;
  onNext: () => void;
  onPrev: () => void;
}

// One card per unit held. A backer who added "Art Print of Your Choice" x10
// gets ten cards (#1 of 10 … #10 of 10) so each print can be a different
// one; before, the question was asked once and ten copies of one print was
// the only possible order. Answers for unit 1 are stored under the item id,
// later units under "<id>#n" (see @/lib/surveys/item-units).
export function SurveyItemsStep({ data, itemResponses, setItemResponses, onNext, onPrev }: SurveyItemsStepProps) {
  const copyFromFirst = (itemId: string, quantity: number) => {
    const first = itemResponses[itemId];
    if (!first) return;
    setItemResponses((prev) => {
      const next = { ...prev };
      for (let unit = 1; unit < quantity; unit++) {
        next[unitKey(itemId, unit)] = {
          variants: first.variants ? { ...first.variants } : undefined,
          customAnswers: first.customAnswers ? { ...first.customAnswers } : undefined,
        };
      }
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <Package className="h-5 w-5" />
        Choose Your Options
      </h2>

      {data.itemQuestions.map((item) => {
        const quantity = Math.max(1, item.quantity || 1);
        const hasOptions = item.variants.length > 0 || item.customQuestions.length > 0;
        return Array.from({ length: quantity }, (_, unit) => {
          const key = unitKey(item.id, unit);
          const response = itemResponses[key];
          return (
            <Card key={key}>
              <CardHeader>
                <div className="flex gap-4">
                  {item.imageUrl && (
                    <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden bg-muted shrink-0">
                      <Image src={item.imageUrl} alt={item.itemName} fill sizes="96px" className="object-cover" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-lg">{unitLabel(item.itemName, unit, quantity)}</CardTitle>
                    {item.itemDescription && (
                      <CardDescription className="mt-1">{item.itemDescription}</CardDescription>
                    )}
                    {quantity > 1 && unit === 0 && (
                      <p className="text-xs text-muted-foreground mt-2">
                        You have {quantity} of these. Choose options for each one below; they can all be different.
                      </p>
                    )}
                  </div>
                </div>
                {quantity > 1 && unit === 0 && hasOptions && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3 w-fit"
                    disabled={!response}
                    onClick={() => copyFromFirst(item.id, quantity)}
                  >
                    <Copy className="h-3.5 w-3.5 mr-1.5" />
                    Use these choices for all {quantity}
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Variants */}
                {item.variants.map((variant) => (
                  <div key={variant.id} className="space-y-2">
                    <Label>{variant.variantType}</Label>
                    <Select
                      value={response?.variants?.[variant.id] || response?.variants?.[variant.variantType] || ""}
                      onValueChange={(value) =>
                        setItemResponses((prev) => ({
                          ...prev,
                          [key]: {
                            ...prev[key],
                            variants: {
                              ...prev[key]?.variants,
                              // Write under BOTH keys: the variant.id so
                              // brand-new responses are stable, and the
                              // variantType so a creator re-saving the
                              // survey (which regenerates variant.ids)
                              // doesn't orphan the backer's selection.
                              [variant.id]: value,
                              [variant.variantType]: value,
                            },
                          },
                        }))
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
                      questionId={`${key}-${q.id}`}
                      type={q.questionType}
                      options={q.options}
                      value={response?.customAnswers?.[q.id]}
                      onChange={(value) =>
                        setItemResponses((prev) => ({
                          ...prev,
                          [key]: {
                            ...prev[key],
                            customAnswers: {
                              ...prev[key]?.customAnswers,
                              [q.id]: value,
                            },
                          },
                        }))
                      }
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        });
      })}

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
