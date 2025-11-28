"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { Check, ChevronLeft, ChevronRight, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

export function ProjectBuilder() {
  const router = useRouter();
  const {
    currentStep,
    setCurrentStep,
    nextStep,
    prevStep,
    basics,
    story,
    projectId,
    setProjectId,
    reset,
  } = useProjectStore();

  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const progress = ((currentStep + 1) / BUILDER_STEPS.length) * 100;

  const saveProject = async () => {
    setIsSaving(true);

    try {
      // Validate minimum requirements
      if (!basics.title || basics.title.trim().length < 3) {
        toast.error("Please enter a project title (at least 3 characters)");
        setIsSaving(false);
        return false;
      }

      if (!basics.category) {
        toast.error("Please select a project category");
        setIsSaving(false);
        return false;
      }

      const projectData = {
        title: basics.title,
        subtitle: basics.subtitle,
        category: basics.category,
        location: basics.location,
        imageUrl: basics.imageUrl,
        videoUrl: basics.videoUrl,
        goalAmount: basics.goalAmount || 10000,
        durationType: basics.durationType || "FIXED_DAYS",
        durationDays: basics.durationDays,
        endDate: basics.endDate?.toISOString(),
        launchDate: basics.launchDate?.toISOString(),
        description: story.description,
        risks: story.risks,
      };

      let response;

      if (projectId) {
        // Update existing project
        response = await fetch(`/api/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(projectData),
        });
      } else {
        // Create new project
        response = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(projectData),
        });
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save project");
      }

      const result = await response.json();

      if (!projectId && result.project?.id) {
        setProjectId(result.project.id);
      }

      toast.success("Project saved successfully");
      return true;
    } catch (error) {
      console.error("Save project error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save project");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAndExit = async () => {
    const saved = await saveProject();
    if (saved) {
      router.push("/dashboard");
    }
  };

  const handleSubmitForReview = async () => {
    // First save the project
    const saved = await saveProject();
    if (!saved) return;

    if (!projectId) {
      toast.error("Project must be saved first");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/projects/${projectId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.validationErrors) {
          toast.error(
            <div>
              <p className="font-semibold mb-2">Please fix the following:</p>
              <ul className="list-disc list-inside text-sm">
                {result.validationErrors.map((err: string, i: number) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>,
            { duration: 10000 }
          );
        } else {
          throw new Error(result.error || "Failed to submit for review");
        }
        return;
      }

      toast.success("Project submitted for review!");
      reset();
      router.push("/dashboard");
    } catch (error) {
      console.error("Submit for review error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to submit");
    } finally {
      setIsSubmitting(false);
    }
  };

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
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveAndExit}
              disabled={isSaving || isSubmitting}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save & Exit
                </>
              )}
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
              <Button
                onClick={handleSubmitForReview}
                disabled={isSaving || isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit for Review"
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
