"use client";

import Image from "next/image";
import { ArrowUpCircle, ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ModifierQuestionView, ModifierSelections } from "./types";

interface SurveyUpgradesStepProps {
  questions: ModifierQuestionView[];
  selections: ModifierSelections;
  setSelections: React.Dispatch<React.SetStateAction<ModifierSelections>>;
  onNext?: () => void;
  onPrev?: () => void;
  /** Embedded in another form (creator fill-in): no heading or Back/Continue. */
  embedded?: boolean;
}

/**
 * One card per upgrade add-on; one dropdown per copy of it, listing only
 * the items this backer actually holds that the upgrade can apply to.
 * "Upgrade to foil" x2 with three covers in the order = two dropdowns of
 * those three covers. The old survey asked this as free text ("which
 * cover?"), which production couldn't read; now the answer IS the item.
 */
export function SurveyUpgradesStep({ questions, selections, setSelections, onNext, onPrev, embedded = false }: SurveyUpgradesStepProps) {
  const targetLabel = (q: ModifierQuestionView, key: string) => q.targets.find((t) => t.key === key)?.title || "";

  // How many times each target has been picked across this question's units,
  // so a backer with one SW3-18 can't put two upgrades on it.
  const usage = (q: ModifierQuestionView, exceptUnit: number) => {
    const picks = selections[q.modifierAddonId] ?? q.selections;
    const used = new Map<string, number>();
    picks.forEach((p, i) => {
      if (p && i !== exceptUnit) used.set(p, (used.get(p) ?? 0) + 1);
    });
    return used;
  };

  return (
    <div className="space-y-4">
      {!embedded && (
        <>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <ArrowUpCircle className="h-5 w-5" />
            Apply Your Upgrades
          </h2>
          <p className="text-sm text-muted-foreground">
            You bought upgrades that change an item you already have. Tell us which item each one applies to.
          </p>
        </>
      )}

      {questions.map((q) => {
        const picks = selections[q.modifierAddonId] ?? q.selections;
        return (
          <Card key={q.modifierAddonId}>
            <CardHeader>
              <div className="flex gap-4">
                {q.imageUrl && (
                  <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden bg-muted shrink-0">
                    <Image src={q.imageUrl} alt={q.title} fill sizes="96px" className="object-cover" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-lg">
                    {q.title}
                    {q.quantity > 1 && <span className="text-muted-foreground font-normal"> × {q.quantity}</span>}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {q.auto
                      ? "There is only one way to apply this, so it has been set for you."
                      : q.quantity > 1
                        ? `Choose which item each of your ${q.quantity} upgrades applies to. They can all be different.`
                        : "Choose which item this upgrade applies to."}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {q.targets.length === 0 ? (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
                  None of the items in your order can take this upgrade. The creator will sort this out with you — you can still submit the survey.
                </p>
              ) : q.auto ? (
                <ul className="space-y-1">
                  {picks.map((p, unit) => (
                    <li key={unit} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span>
                        {q.quantity > 1 && <span className="text-muted-foreground">#{unit + 1}: </span>}
                        {p ? targetLabel(q, p) : "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                picks.map((p, unit) => {
                  const used = usage(q, unit);
                  return (
                    <div key={unit} className="space-y-2">
                      <Label>
                        {q.quantity > 1 ? `${q.title} #${unit + 1} of ${q.quantity}` : "Apply to"}
                        <span className="text-red-500 ml-1">*</span>
                      </Label>
                      <Select
                        value={p || ""}
                        onValueChange={(value) =>
                          setSelections((prev) => {
                            const next = [...(prev[q.modifierAddonId] ?? q.selections)];
                            while (next.length < q.quantity) next.push(null);
                            next[unit] = value;
                            return { ...prev, [q.modifierAddonId]: next };
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose an item from your order" />
                        </SelectTrigger>
                        <SelectContent>
                          {q.targets.map((t) => {
                            const left = t.quantity - (used.get(t.key) ?? 0);
                            return (
                              <SelectItem key={t.key} value={t.key} disabled={left <= 0}>
                                {t.title}
                                {t.quantity > 1 ? ` (${left} of ${t.quantity} left)` : ""}
                                {left <= 0 ? " — already upgraded" : ""}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        );
      })}

      {!embedded && (
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
      )}
    </div>
  );
}
