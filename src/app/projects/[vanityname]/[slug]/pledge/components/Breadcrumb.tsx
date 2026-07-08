"use client";

import { ChevronRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Step, RewardData } from "../types";

interface BreadcrumbProps {
  step: Step;
  setStep: (step: Step) => void;
  selectedReward: RewardData | null;
  pledgeWithoutReward: boolean;
  isAddItemsMode: boolean;
  selectedAddons: Record<string, number>;
}

export function Breadcrumb({
  step,
  setStep,
  selectedReward,
  pledgeWithoutReward,
  isAddItemsMode,
  selectedAddons,
}: BreadcrumbProps) {
  const canEnterPayment =
    !!selectedReward ||
    pledgeWithoutReward ||
    (isAddItemsMode && Object.keys(selectedAddons).length > 0);

  // Visible steps depend on mode: add-items mode skips the rewards step, and
  // the add-ons step only appears once a reward is chosen.
  const steps: { id: Step; label: string; disabled: boolean }[] = [];
  if (!isAddItemsMode) {
    steps.push({ id: "rewards", label: "Rewards", disabled: false });
  }
  if (selectedReward || isAddItemsMode) {
    steps.push({
      id: "addons",
      label: isAddItemsMode ? "Select Items" : "Add-ons",
      disabled: false,
    });
  }
  steps.push({ id: "payment", label: "Payment", disabled: !canEnterPayment });

  const currentIndex = steps.findIndex((s) => s.id === step);

  return (
    <div className="flex items-center gap-2 text-sm">
      {steps.map((s, index) => {
        const isCurrent = index === currentIndex;
        const isCompleted = currentIndex > -1 && index < currentIndex;
        return (
          <div key={s.id} className="flex items-center gap-2">
            {index > 0 && (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <button
              type="button"
              onClick={() => !s.disabled && setStep(s.id)}
              disabled={s.disabled}
              aria-current={isCurrent ? "step" : undefined}
              className={cn(
                "flex items-center gap-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                isCurrent
                  ? "font-semibold text-foreground"
                  : isCompleted
                  ? "font-medium text-primary hover:text-primary/80"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {isCompleted && <Check className="h-3.5 w-3.5" />}
              {s.label}
            </button>
          </div>
        );
      })}
    </div>
  );
}
