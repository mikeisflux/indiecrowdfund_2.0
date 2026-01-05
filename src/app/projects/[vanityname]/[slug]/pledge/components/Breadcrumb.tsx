"use client";

import { ChevronRight } from "lucide-react";
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
  return (
    <div className="flex items-center gap-2 text-sm">
      {/* In add items mode, skip rewards step */}
      {!isAddItemsMode && (
        <>
          <button
            onClick={() => setStep("rewards")}
            className={step === "rewards" ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}
          >
            Rewards
          </button>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </>
      )}
      {/* Show Add-ons step when there's a selected reward or in add items mode */}
      {(selectedReward || isAddItemsMode) && (
        <>
          <button
            onClick={() => setStep("addons")}
            className={step === "addons" ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}
          >
            {isAddItemsMode ? "Select Items" : "Add-ons"}
          </button>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </>
      )}
      <button
        onClick={() => (selectedReward || pledgeWithoutReward || (isAddItemsMode && Object.keys(selectedAddons).length > 0)) && setStep("payment")}
        className={step === "payment" ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground disabled:cursor-not-allowed"}
        disabled={!selectedReward && !pledgeWithoutReward && !(isAddItemsMode && Object.keys(selectedAddons).length > 0)}
      >
        Payment
      </button>
    </div>
  );
}
