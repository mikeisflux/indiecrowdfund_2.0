"use client";

import { useProjectStore, BUILDER_STEPS } from "@/lib/stores/project-store";
import { BasicsStep } from "./basics-step";
import { RewardsStep } from "./rewards-step";
import { StoryStep } from "./story-step";
import { PeopleStep } from "./people-step";
import { PaymentStep } from "./payment-step";
import { PromotionStep } from "./promotion-step";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";

export function ProjectBuilder() {
  const { currentStep, setCurrentStep, nextStep, prevStep } = useProjectStore();

  const progress = ((currentStep + 1) / BUILDER_STEPS.length) * 100;

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <BasicsStep />;
      case 1:
        return <RewardsStep />;
      case 2:
        return <StoryStep />;
      case 3:
        return <PeopleStep />;
      case 4:
        return <PaymentStep />;
      case 5:
        return <PromotionStep />;
      default:
        return <BasicsStep />;
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="border-b bg-background">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">Create Your Project</h1>
            <Button variant="outline" size="sm">
              Save & Exit
            </Button>
          </div>
          <Progress value={progress} className="mt-4 h-2" />
        </div>
      </div>

      {/* Steps Navigation */}
      <div className="border-b bg-background">
        <div className="container">
          <nav className="flex overflow-x-auto">
            {BUILDER_STEPS.map((step, index) => (
              <button
                key={step.id}
                onClick={() => setCurrentStep(index)}
                className={cn(
                  "flex min-w-[140px] flex-col items-center border-b-2 px-4 py-3 text-sm transition-colors",
                  currentStep === index
                    ? "border-primary text-primary"
                    : index < currentStep
                    ? "border-primary/50 text-primary/80"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-2">
                  {index < currentStep ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full border text-xs">
                      {index + 1}
                    </span>
                  )}
                  <span className="font-medium">{step.title}</span>
                </div>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Step Content */}
      <div className="container py-8">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6">
            <h2 className="text-2xl font-bold">{BUILDER_STEPS[currentStep].title}</h2>
            <p className="text-muted-foreground">
              {BUILDER_STEPS[currentStep].description}
            </p>
          </div>

          <div className="rounded-lg border bg-card p-6">{renderStep()}</div>

          {/* Navigation Buttons */}
          <div className="mt-6 flex justify-between">
            <Button
              variant="outline"
              onClick={prevStep}
              disabled={currentStep === 0}
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Previous
            </Button>

            {currentStep < BUILDER_STEPS.length - 1 ? (
              <Button onClick={nextStep}>
                Next
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button>Submit for Review</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
