"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useProjectStore, BUILDER_STEPS } from "@/lib/stores/project-store";
import { BasicsStep } from "./basics-step";
import { RewardsStep } from "./rewards-step";
import { StoryStep } from "./story-step";
import { PeopleStep } from "./people-step";
import { PaymentStep } from "./payment-step";
import { PromotionStep } from "./promotion-step";
import { VanityUrlSetupDialog } from "./vanity-url-setup-dialog";
import { GrantAgreementDialog } from "@/components/grant/grant-agreement-dialog";
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
import { Check, ChevronLeft, ChevronRight, Loader2, Save, Rocket, AlertTriangle, ArrowLeft } from "lucide-react";
import Link from "next/link";
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
    rewards,
    items,
    people,
    payment,
    promotion,
    projectId,
    setProjectId,
    projectStatus,
    setProjectStatus,
    updateReward,
    reset,
  } = useProjectStore();

  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [isSubFormOpen, setIsSubFormOpen] = useState(false);
  const [showReReviewWarning, setShowReReviewWarning] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  // Grant Program: launch is blocked until the creator signs the grant
  // agreement; the launch handler opens this dialog on that error code.
  const [showGrantAgreement, setShowGrantAgreement] = useState(false);

  // A creator must claim a custom URL before building a campaign — without one,
  // their project links (/projects/[vanityname]/[slug]) collapse to a 2-segment
  // URL that 404s. Check on mount and, if missing, force the guided setup.
  const [needsVanityUrl, setNeedsVanityUrl] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/user/vanity-url");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && !data.isSet) setNeedsVanityUrl(true);
      } catch {
        // Non-fatal: if the check fails we don't block building; launch still
        // requires a vanity server-side.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Unsaved-changes guard: warn before the tab closes or reloads while the
  // builder holds edits that haven't been pushed to the server yet.
  const isDirtyRef = useRef(false);
  const hydratedRef = useRef(false);
  // ProjectItem ids known to exist server-side: seeded from what the edit page
  // loaded, then extended as we create items. Anything not in here is a
  // client-side placeholder that needs POSTing rather than PATCHing.
  const savedItemIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // The first run is the post-hydration baseline, not a user edit.
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      // Everything present at hydration came from the server, so it already
      // exists as a ProjectItem row and must be PATCHed, never re-POSTed.
      items.forEach((item) => {
        if (item.id) savedItemIdsRef.current.add(item.id);
      });
      return;
    }
    isDirtyRef.current = true;
  }, [basics, story, rewards, items, people, payment, promotion]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  useEffect(() => {
    if (!justSaved) return;
    const timer = setTimeout(() => setJustSaved(false), 2500);
    return () => clearTimeout(timer);
  }, [justSaved]);

  const isApproved = projectStatus === "APPROVED";
  const isLive = !!projectStatus && ["LIVE", "FUNDED", "PAUSED"].includes(projectStatus);
  const isSubmitted = projectStatus === "SUBMITTED";

  const progress = ((currentStep + 1) / BUILDER_STEPS.length) * 100;

  const saveProject = async () => {
    setIsSaving(true);
    setJustSaved(false);

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
      let transformedRewards = rewards.map((reward) => ({
        id: reward.id,
        type: reward.type || "TIER",
        title: reward.title,
        description: reward.description || "",
        amount: Number(reward.amount) || 0,
        imageUrl: reward.imageUrl || undefined,
        estimatedDelivery: reward.estimatedDelivery
          ? new Date(reward.estimatedDelivery).toISOString()
          : null,
        shippingType: reward.shippingType || "NO_SHIPPING",
        shippingCountries: reward.shippingCountries || [],
        shippingCost: reward.shippingCost || {},
        quantityAvailable: reward.quantityAvailable != null ? Number(reward.quantityAvailable) : null,
        isEnded: reward.isEnded || false,
        visibility: reward.visibility || "PUBLIC",
        items: reward.items?.map((item) => {
          // Find the full item details from the items store
          const fullItem = items.find((i) => i.id === item.id);
          return {
            id: item.id,
            // Preserve existing projectItemId reference, or null if none exists
            projectItemId: (item as { projectItemId?: string | null }).projectItemId || null,
            title: fullItem?.title || item.title || "Item",
            description: fullItem?.description,
            imageUrl: fullItem?.imageUrl || undefined,
          };
        }) || [],
      }));

      // If no projectId, create the project first
      if (!projectId) {
        const projectData = {
          title: basics.title,
          subtitle: basics.subtitle,
          category: basics.category,
          subcategory: basics.subcategory,
          secondaryCategory: basics.secondaryCategory,
          secondarySubcategory: basics.secondarySubcategory,
          location: basics.location,
          imageUrl: basics.imageUrl || undefined,
          videoUrl: basics.videoUrl,
          goalAmount: Number(basics.goalAmount) || 10000,
          durationType: basics.durationType || "FIXED_DAYS",
          durationDays: basics.durationDays != null ? Number(basics.durationDays) : undefined,
          endDate: basics.endDate instanceof Date ? basics.endDate.toISOString() : basics.endDate,
          launchDate: basics.launchDate instanceof Date ? basics.launchDate.toISOString() : basics.launchDate,
          description: story.description || "",
          risks: story.risks || "",
          usesAI: story.usesAI || false,
          faqs: story.faqs || [],
          contactEmail: payment.contactEmail,
          projectType: payment.projectType || "INDIVIDUAL",
          hasAdultContent: payment.hasAdultContent || false,
          hasRiskyContent: payment.hasRiskyContent || false,
          promoContentSfw: payment.promoContentSfw !== false,
          allowRetailerPledges: payment.allowRetailerPledges || false,
          retailerDiscount: Number(payment.retailerDiscount) || 50,
          retailerMinQuantity: Number(payment.retailerMinQuantity) || 5,
          prelaunchActive: promotion.prelaunchActive || false,
          prelaunchDescription: promotion.prelaunchDescription,
          customReferralTags: promotion.customReferralTags || [],
          googleAnalyticsId: promotion.googleAnalyticsId,
          metaPixelId: promotion.metaPixelId,
        };

        const response = await apiFetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json", },
          body: JSON.stringify(projectData),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to create project");
        }

        const result = await response.json();
        const newProjectId = result.project?.id;

        if (newProjectId) {
          setProjectId(newProjectId);

          // Save items FIRST so the ProjectItem records exist before rewards
          // reference them via projectItemId (FK constraint). Without this
          // step the batch rewards endpoint silently drops each reward with a
          // FK error, making it look like "the reward wasn't saved".
          const oldToNewItemIdMap: Record<string, string> = {};
          const itemsToSave = items.filter((item) => item.title);
          const itemSaveResults = await Promise.allSettled(
            itemsToSave.map((item) =>
              apiFetch(`/api/projects/${newProjectId}/items`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  title: item.title,
                  description: item.description || "",
                  imageUrl: item.imageUrl || undefined,
                }),
              }).then(async (res) => {
                if (!res.ok) throw new Error(`Failed to save item: ${res.status}`);
                return { oldId: item.id, result: await res.json() };
              })
            )
          );
          itemSaveResults.forEach((res) => {
            if (res.status === "fulfilled") {
              const { oldId, result } = res.value;
              if (oldId && result.item?.id) {
                oldToNewItemIdMap[oldId] = result.item.id;
              }
            } else {
              console.error("Failed to save item:", res.reason);
            }
          });

          // Rewrite reward items to reference the newly-created ProjectItem IDs
          const rewardsWithRealItemIds = transformedRewards.map((reward) => ({
            ...reward,
            items: (reward.items ?? []).map((item) => {
              const oldId = item.id || item.projectItemId || "";
              const newId = oldToNewItemIdMap[oldId];
              return {
                ...item,
                id: newId || undefined,
                projectItemId: newId || null,
              };
            }),
          }));

          // Save rewards (batch) and collaborators in parallel for new projects
          const rewardsPromise = rewardsWithRealItemIds.length > 0
            ? apiFetch(`/api/projects/${newProjectId}/rewards`, {
                method: "POST",
                headers: { "Content-Type": "application/json", },
                body: JSON.stringify({ rewards: rewardsWithRealItemIds }),
              })
            : Promise.resolve(new Response());

          const collabPromises = (people.collaborators || []).map((collab) =>
            apiFetch(`/api/projects/${newProjectId}/collaborators`, {
              method: "POST",
              headers: { "Content-Type": "application/json", },
              body: JSON.stringify(collab),
            })
          );

          const allResults = await Promise.allSettled([rewardsPromise, ...collabPromises]);
          const rewardsResult = allResults[0];

          // Update store with IDs returned from batch save to prevent duplicates on next save
          if (rewardsResult.status === "fulfilled" && rewardsResult.value.ok) {
            try {
              const rewardsData = await rewardsResult.value.json();
              if (rewardsData.results) {
                const failedRewards = rewardsData.results.filter(
                  (r: { success: boolean }) => !r.success
                );
                if (failedRewards.length > 0) {
                  console.error("Some rewards failed to save:", failedRewards);
                  toast.error(
                    `${failedRewards.length} reward(s) failed to save. Please try again.`
                  );
                }
                rewardsData.results.forEach((result: { success: boolean; reward?: { id: string } }, idx: number) => {
                  if (result.success && result.reward?.id && idx < rewards.length) {
                    const existingReward = rewards[idx];
                    if (!existingReward.id) {
                      updateReward(idx, { ...existingReward, id: result.reward.id });
                    }
                  }
                });
              }
            } catch {
              // Non-critical: IDs will be synced on next page load
            }
          }
        }

        isDirtyRef.current = false;
        setJustSaved(true);
        toast.success("Project created successfully");
        return true;
      }

      // Save items BEFORE anything else, exactly as the create path does.
      //
      // This step used to be missing entirely on the existing-project path:
      // /basics, /story, /payment, /promotion and /rewards were all saved, but
      // items were only ever GET'd on load and never written back. Items added
      // or CSV-imported while editing a live project lived in React state
      // alone, looked fine until reload, then vanished — and because rewards
      // reference items by projectItemId, any reward built on an unsaved item
      // was silently dropped by the rewards endpoint on a FK error.
      const editItemIdMap: Record<string, string> = {};
      const editItemsToSave = items.filter((item) => item.title);
      if (editItemsToSave.length > 0) {
        const results = await Promise.allSettled(
          editItemsToSave.map(async (item) => {
            // Items already persisted carry a server id; everything else is a
            // client-generated placeholder that needs creating.
            const isPersisted = !!item.id && savedItemIdsRef.current.has(item.id);
            const res = await apiFetch(`/api/projects/${projectId}/items`, {
              method: isPersisted ? "PATCH" : "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...(isPersisted ? { id: item.id } : {}),
                title: item.title,
                description: item.description || "",
                imageUrl: item.imageUrl || undefined,
              }),
            });
            if (!res.ok) throw new Error(`Failed to save item "${item.title}" (${res.status})`);
            return { oldId: item.id, result: await res.json() };
          })
        );
        const failedItems: string[] = [];
        results.forEach((res) => {
          if (res.status === "fulfilled") {
            const { oldId, result } = res.value;
            if (result.item?.id) {
              if (oldId) editItemIdMap[oldId] = result.item.id;
              savedItemIdsRef.current.add(result.item.id);
            }
          } else {
            failedItems.push(String(res.reason));
          }
        });
        if (failedItems.length > 0) {
          console.error("Failed to save items:", failedItems);
          toast.error(
            `${failedItems.length} item${failedItems.length > 1 ? "s" : ""} couldn't be saved`
          );
        }
      }

      // Point rewards at the real ProjectItem ids created just above, so the
      // batch rewards save doesn't fail its foreign key.
      transformedRewards = transformedRewards.map((reward) => ({
        ...reward,
        items: (reward.items ?? []).map((item) => {
          const oldId = item.id || item.projectItemId || "";
          const newId = editItemIdMap[oldId];
          return newId ? { ...item, id: newId, projectItemId: newId } : item;
        }),
      }));

      // For existing projects, use dedicated endpoints in parallel for reliability
      const savePromises: Promise<Response>[] = [];

      // Save basics - for launched projects, only send allowed fields
      const basicsPayload = isLive
        ? {
            imageUrl: basics.imageUrl || undefined,
            videoUrl: basics.videoUrl,
          }
        : {
            title: basics.title,
            subtitle: basics.subtitle,
            slug: basics.slug || undefined,
            category: basics.category,
            subcategory: basics.subcategory,
            secondaryCategory: basics.secondaryCategory,
            secondarySubcategory: basics.secondarySubcategory,
            location: basics.location,
            imageUrl: basics.imageUrl || undefined,
            videoUrl: basics.videoUrl,
            goalAmount: Number(basics.goalAmount) || 10000,
            durationType: basics.durationType || "FIXED_DAYS",
            durationDays: basics.durationDays != null ? Number(basics.durationDays) : undefined,
            endDate: basics.endDate instanceof Date ? basics.endDate.toISOString() : basics.endDate,
            launchDate: basics.launchDate instanceof Date ? basics.launchDate.toISOString() : basics.launchDate,
          };
      savePromises.push(
        apiFetch(`/api/projects/${projectId}/basics`, {
          method: "POST",
          headers: { "Content-Type": "application/json", },
          body: JSON.stringify(basicsPayload),
        })
      );

      // Save story
      savePromises.push(
        apiFetch(`/api/projects/${projectId}/story`, {
          method: "POST",
          headers: { "Content-Type": "application/json", },
          body: JSON.stringify({
            description: story.description || "",
            risks: story.risks || "",
            usesAI: story.usesAI || false,
            faqs: story.faqs || [],
          }),
        })
      );

      // Save payment settings - for launched projects, send retailer settings
      // PLUS NSFW flags and campaignType. NSFW projects must be KEEP_IT_ALL
      // (Stripe/PayPal-style holds aren't possible with Divinity Payments/Whop), and
      // without sending these fields the server-side NSFW → KEEP_IT_ALL
      // auto-correction never fires on a live campaign.
      const paymentPayload = isLive
        ? {
            hasAdultContent: payment.hasAdultContent || false,
            hasRiskyContent: payment.hasRiskyContent || false,
            promoContentSfw: payment.promoContentSfw !== false,
            campaignType: payment.campaignType || "ALL_OR_NOTHING",
            allowRetailerPledges: payment.allowRetailerPledges || false,
            retailerDiscount: Number(payment.retailerDiscount) || 50,
            retailerMinQuantity: Number(payment.retailerMinQuantity) || 5,
          }
        : {
            projectType: payment.projectType || "INDIVIDUAL",
            paymentProcessor: payment.paymentProcessor,
            campaignType: payment.campaignType || "ALL_OR_NOTHING",
            hasAdultContent: payment.hasAdultContent || false,
            hasRiskyContent: payment.hasRiskyContent || false,
            promoContentSfw: payment.promoContentSfw !== false,
            allowRetailerPledges: payment.allowRetailerPledges || false,
            retailerDiscount: Number(payment.retailerDiscount) || 50,
            retailerMinQuantity: Number(payment.retailerMinQuantity) || 5,
          };
      savePromises.push(
        apiFetch(`/api/projects/${projectId}/payment`, {
          method: "POST",
          headers: { "Content-Type": "application/json", },
          body: JSON.stringify(paymentPayload),
        })
      );

      // Save contact email separately (dedicated endpoint for reliability)
      if (payment.contactEmail) {
        savePromises.push(
          apiFetch(`/api/projects/${projectId}/contact-email`, {
            method: "POST",
            headers: { "Content-Type": "application/json", },
            body: JSON.stringify({ contactEmail: payment.contactEmail }),
          })
        );
      }

      // Save promotion settings
      savePromises.push(
        apiFetch(`/api/projects/${projectId}/promotion`, {
          method: "POST",
          headers: { "Content-Type": "application/json", },
          body: JSON.stringify({
            customReferralTags: promotion.customReferralTags || [],
            googleAnalyticsId: promotion.googleAnalyticsId,
            metaPixelId: promotion.metaPixelId,
          }),
        })
      );

      // Save prelaunch settings (skip for launched projects - not applicable)
      if (!isLive) {
        savePromises.push(
          apiFetch(`/api/projects/${projectId}/prelaunch`, {
            method: "POST",
            headers: { "Content-Type": "application/json", },
            body: JSON.stringify({
              prelaunchActive: promotion.prelaunchActive || false,
              prelaunchDescription: promotion.prelaunchDescription,
            }),
          })
        );
      }

      // Execute all saves in parallel
      const results = await Promise.allSettled(savePromises);

      // Check for any failures and extract error messages
      const failedResults: string[] = [];
      for (const r of results) {
        if (r.status === "rejected") {
          failedResults.push(String(r.reason));
        } else if (r.status === "fulfilled" && !r.value.ok) {
          try {
            const errBody = await r.value.json();
            failedResults.push(errBody.error || `Save failed (${r.value.status})`);
          } catch {
            failedResults.push(`Save failed (${r.value.status})`);
          }
        }
      }

      // Handle rewards with dedicated endpoint - batch save all rewards in a single request
      if (transformedRewards.length > 0) {
        const rewardsResponse = await apiFetch(`/api/projects/${projectId}/rewards`, {
          method: "POST",
          headers: { "Content-Type": "application/json", },
          body: JSON.stringify({ rewards: transformedRewards }),
        });

        // Update store with IDs returned from the API to prevent duplicate creation on next save
        if (rewardsResponse.ok) {
          try {
            const rewardsResult = await rewardsResponse.json();
            if (rewardsResult.results) {
              rewardsResult.results.forEach((result: { success: boolean; reward?: { id: string } }, idx: number) => {
                if (result.success && result.reward?.id && idx < rewards.length) {
                  const existingReward = rewards[idx];
                  if (!existingReward.id) {
                    updateReward(idx, { ...existingReward, id: result.reward!.id });
                  }
                }
              });
            }
          } catch {
            // Non-critical: IDs will be synced on next page load
          }
        }
      }

      if (failedResults.length > 0) {
        console.error("Save failures:", failedResults);
        if (failedResults.length === results.length) {
          // All saves failed
          toast.error(`Failed to save project: ${failedResults[0]}`);
          return false;
        } else {
          // Partial failure
          toast.error(`Some sections failed to save: ${failedResults[0]}`);
          return true;
        }
      }

      isDirtyRef.current = false;
      setJustSaved(true);
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
      const response = await apiFetch(`/api/projects/${projectId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", },
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
      const response = await apiFetch(`/api/projects/${projectId}/launch`, {
        method: "POST",
        headers: { "Content-Type": "application/json", },
      });

      const result = await response.json();

      if (!response.ok) {
        // Grant Program: launch requires a signed grant agreement. Open the
        // signing dialog instead of surfacing a dead-end error; on accept we
        // re-run the launch automatically.
        if (result.code === "GRANT_AGREEMENT_REQUIRED") {
          setShowGrantAgreement(true);
          return;
        }
        throw new Error(result.error || "Failed to launch project");
      }

      toast.success("Your project is now live!");
      setProjectStatus("LIVE");
      reset();
      // Use the projectUrl from API response if available, otherwise fallback to slug
      const projectUrl = result.project?.projectUrl || `/projects/${result.project?.slug || basics.slug}`;
      router.push(projectUrl);
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
      {/* Mandatory custom-URL setup — gates the whole builder until claimed */}
      <VanityUrlSetupDialog
        open={needsVanityUrl}
        onComplete={() => setNeedsVanityUrl(false)}
      />

      {/* Grant Program agreement — required to launch; re-launches on accept */}
      {projectId && (
        <GrantAgreementDialog
          open={showGrantAgreement}
          onOpenChange={setShowGrantAgreement}
          projectId={projectId}
          projectTitle={basics.title}
          onAccepted={handleLaunchNow}
        />
      )}

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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Link href="/dashboard">
                <Button variant="ghost" size="icon" aria-label="Back to dashboard">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <h1 className="text-lg sm:text-xl font-semibold">
                {projectId ? "Edit Project" : "Create Your Project"}
              </h1>
              {projectId && getStatusBadge()}
            </div>
            <div className="flex items-center gap-2">
              {isApproved && (
                <Button
                  onClick={handleLaunchNow}
                  disabled={isLaunching}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isLaunching ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      <span className="hidden sm:inline">Launching...</span>
                    </>
                  ) : (
                    <>
                      <Rocket className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Launch Now</span>
                    </>
                  )}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={isApproved ? handleSaveApprovedProject : handleSaveAndExit}
                disabled={isSaving || isSubmitting || isLaunching || isSubFormOpen}
                title={isSubFormOpen ? "Finish saving the current form first" : undefined}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 sm:mr-2 animate-spin" />
                    <span className="hidden sm:inline">Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Save & Exit</span>
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
                onClick={async () => {
                  // Auto-save when switching steps (only if moving away from current step)
                  if (index !== currentStep && !isSaving) {
                    await saveProject();
                  }
                  setCurrentStep(index);
                }}
                disabled={isSaving || isSubFormOpen}
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
                <Button
                  onClick={async () => {
                    // Auto-save when clicking Next
                    const saved = await saveProject();
                    if (saved) {
                      nextStep();
                    }
                  }}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      Next
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </>
                  )}
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
                  ) : justSaved ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Saved
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
