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
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { Check, ChevronLeft, ChevronRight, Loader2, Save, Rocket, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

// Helper to strip base64 images from URLs - only send actual URLs, not large data URIs
const stripBase64 = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith('data:')) return undefined;
  return url;
};

export function ProjectBuilder() {
  const router = useRouter();
  const {
    currentStep,
    setCurrentStep,
    nextStep,
    prevStep,
    basics,
    story,
    rewards,
    items,
    people,
    payment,
    promotion,
    projectId,
    setProjectId,
    projectStatus,
    setProjectStatus,
    reset,
  } = useProjectStore();

  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [isSubFormOpen, setIsSubFormOpen] = useState(false);
  const [showReReviewWarning, setShowReReviewWarning] = useState(false);

  const isApproved = projectStatus === "APPROVED";
  const isLive = projectStatus === "LIVE";
  const isSubmitted = projectStatus === "SUBMITTED";

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

      // Transform rewards to include items from the items store
      console.log("[Save Debug] Items in store:", items.length, items);
      console.log("[Save Debug] Rewards in store:", rewards.length, rewards);
      const transformedRewards = rewards.map((reward) => ({
        id: reward.id,
        type: reward.type || "TIER",
        title: reward.title,
        description: reward.description || "",
        amount: reward.amount,
        imageUrl: stripBase64(reward.imageUrl), // Strip base64 images to reduce payload size
        estimatedDelivery: reward.estimatedDelivery
          ? new Date(reward.estimatedDelivery).toISOString()
          : null,
        shippingType: reward.shippingType || "NO_SHIPPING",
        shippingCountries: reward.shippingCountries || [],
        shippingCost: reward.shippingCost || {},
        quantityAvailable: reward.quantityAvailable,
        isEnded: reward.isEnded || false,
        items: reward.items?.map((item) => {
          // Find the full item details from the items store
          const fullItem = items.find((i) => i.id === item.id);
          return {
            id: item.id,
            title: fullItem?.title || item.title || "Item",
            description: fullItem?.description,
            imageUrl: stripBase64(fullItem?.imageUrl), // Strip base64 images
          };
        }) || [],
      }));

      const projectData = {
        // Basics
        title: basics.title,
        subtitle: basics.subtitle,
        category: basics.category,
        subcategory: basics.subcategory,
        secondaryCategory: basics.secondaryCategory,
        secondarySubcategory: basics.secondarySubcategory,
        location: basics.location,
        imageUrl: stripBase64(basics.imageUrl), // Strip base64 images to reduce payload size
        videoUrl: basics.videoUrl,
        goalAmount: basics.goalAmount || 10000,
        durationType: basics.durationType || "FIXED_DAYS",
        durationDays: basics.durationDays,
        endDate: basics.endDate instanceof Date ? basics.endDate.toISOString() : basics.endDate,
        launchDate: basics.launchDate instanceof Date ? basics.launchDate.toISOString() : basics.launchDate,

        // Story
        description: story.description || "",
        risks: story.risks || "",
        usesAI: story.usesAI || false,
        faqs: story.faqs || [],

        // Payment
        projectType: payment.projectType || "INDIVIDUAL",
        hasAdultContent: payment.hasAdultContent || false,
        hasRiskyContent: payment.hasRiskyContent || false,
        promoContentSfw: payment.promoContentSfw !== false,
        allowRetailerPledges: payment.allowRetailerPledges || false,
        retailerDiscount: payment.retailerDiscount || 50,
        retailerMinQuantity: payment.retailerMinQuantity || 5,

        // Promotion
        prelaunchActive: promotion.prelaunchActive || false,
        prelaunchDescription: promotion.prelaunchDescription,
        customReferralTags: promotion.customReferralTags || [],
        googleAnalyticsId: promotion.googleAnalyticsId,
        metaPixelId: promotion.metaPixelId,

        // Rewards
        rewards: transformedRewards,

        // Collaborators
        collaborators: people.collaborators || [],
      };

      console.log("[Save Debug] Transformed rewards being sent:", transformedRewards.length, transformedRewards);
      console.log("[Save Debug] Project data being sent:", JSON.stringify(projectData).length, "bytes");

      let response;

      if (projectId) {
        // Update existing project
        response = await fetch(`/api/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(projectData),
        });
      } else {
        // Create new project (POST doesn't handle rewards yet, will need a subsequent PATCH)
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

        // For new projects, we need to save rewards with a PATCH since POST doesn't handle them
        if (transformedRewards.length > 0) {
          const rewardsResponse = await fetch(`/api/projects/${result.project.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rewards: transformedRewards }),
          });

          if (!rewardsResponse.ok) {
            console.error("Failed to save rewards");
          }
        }
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
      setProjectStatus("SUBMITTED");
      reset();
      router.push("/dashboard");
    } catch (error) {
      console.error("Submit for review error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to submit");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLaunchNow = async () => {
    if (!projectId) {
      toast.error("Project ID is required");
      return;
    }

    setIsLaunching(true);

    try {
      const response = await fetch(`/api/projects/${projectId}/launch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to launch project");
      }

      toast.success("Your project is now live!");
      setProjectStatus("LIVE");
      reset();
      router.push(`/projects/${basics.title?.toLowerCase().replace(/\s+/g, "-")}`);
    } catch (error) {
      console.error("Launch project error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to launch");
    } finally {
      setIsLaunching(false);
    }
  };

  const handleSaveApprovedProject = async () => {
    // For approved projects, saving will trigger re-review
    setShowReReviewWarning(true);
  };

  const confirmSaveAndResubmit = async () => {
    setShowReReviewWarning(false);
    const saved = await saveProject();
    if (saved) {
      // Resubmit for review after saving
      await handleSubmitForReview();
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <BasicsStep />;
      case 1:
        return <RewardsStep onFormOpenChange={setIsSubFormOpen} />;
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

  const getStatusBadge = () => {
    switch (projectStatus) {
      case "APPROVED":
        return <Badge className="bg-green-600 hover:bg-green-600">Approved - Ready to Launch</Badge>;
      case "SUBMITTED":
        return <Badge variant="secondary">Under Review</Badge>;
      case "LIVE":
        return <Badge className="bg-blue-600 hover:bg-blue-600">Live</Badge>;
      case "FUNDED":
        return <Badge className="bg-emerald-600 hover:bg-emerald-600">Funded</Badge>;
      default:
        return <Badge variant="outline">Draft</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Re-review Warning Dialog */}
      <AlertDialog open={showReReviewWarning} onOpenChange={setShowReReviewWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Changes Require Re-Review
            </AlertDialogTitle>
            <AlertDialogDescription>
              Your project has already been approved. Making changes will require the project to be re-reviewed by our team before you can launch. This may take 1-3 business days.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSaveAndResubmit}>
              Save & Resubmit for Review
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Header */}
      <div className="border-b bg-background">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold">
                {projectId ? "Edit Project" : "Create Your Project"}
              </h1>
              {projectId && getStatusBadge()}
            </div>
            <div className="flex items-center gap-2">
              {isApproved && (
                <Button
                  onClick={handleLaunchNow}
                  disabled={isLaunching}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isLaunching ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Launching...
                    </>
                  ) : (
                    <>
                      <Rocket className="mr-2 h-4 w-4" />
                      Launch Now
                    </>
                  )}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={isApproved ? handleSaveApprovedProject : handleSaveAndExit}
                disabled={isSaving || isSubmitting || isLaunching}
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

          {/* Navigation Buttons - hidden when a sub-form is open */}
          {!isSubFormOpen && (
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
              ) : isApproved ? (
                <Button
                  onClick={handleLaunchNow}
                  disabled={isLaunching}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isLaunching ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Launching...
                    </>
                  ) : (
                    <>
                      <Rocket className="mr-2 h-4 w-4" />
                      Launch Now
                    </>
                  )}
                </Button>
              ) : isSubmitted ? (
                <Button disabled variant="secondary">
                  Under Review
                </Button>
              ) : isLive ? (
                <Button
                  onClick={saveProject}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  )}
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
          )}
        </div>
      </div>
    </div>
  );
}
