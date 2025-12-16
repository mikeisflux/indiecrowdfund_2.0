"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useProjectStore } from "@/lib/stores/project-store";
import { ProjectBuilder } from "@/components/project/builder/project-builder";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function EditProjectPage() {
  const params = useParams();
  const router = useRouter();
  const slug = (params?.slug as string) || "";
  const [loading, setLoading] = useState(true);

  const {
    setProjectId,
    setProjectSlug,
    setProjectStatus,
    updateBasics,
    updateStory,
    updatePeople,
    updatePayment,
    updatePromotion,
    addReward,
    addItem,
    reset,
  } = useProjectStore();

  useEffect(() => {
    async function loadProject() {
      try {
        setLoading(true);

        // Fetch project data by slug
        const response = await fetch(`/api/projects/slug/${slug}`);

        if (!response.ok) {
          if (response.status === 404) {
            toast.error("Project not found");
            router.push("/dashboard");
            return;
          }
          throw new Error("Failed to load project");
        }

        const data = await response.json();
        const project = data.project;
        const rewards = data.rewards || [];
        const addons = data.addons || [];

        // Reset store before loading new data
        reset();

        // Set project ID, slug, and status
        setProjectId(project.id);
        setProjectSlug(project.slug);
        setProjectStatus(project.status);

        // Load basics
        updateBasics({
          title: project.title,
          subtitle: project.subtitle || "",
          category: project.category,
          subcategory: project.subcategory || "",
          secondaryCategory: project.secondaryCategory || "",
          secondarySubcategory: project.secondarySubcategory || "",
          location: project.location || "",
          imageUrl: project.imageUrl || "",
          videoUrl: project.videoUrl || "",
          goalAmount: project.goalAmount,
          durationType: project.durationType || "FIXED_DAYS",
          durationDays: project.durationDays,
          endDate: project.endDate ? new Date(project.endDate) : undefined,
          launchDate: project.launchDate ? new Date(project.launchDate) : undefined,
        });

        // Load story
        updateStory({
          description: project.description || "",
          risks: project.risks || "",
          usesAI: project.usesAI || false,
          faqs: project.faqs || [],
        });

        // Load payment settings
        updatePayment({
          contactEmail: project.contactEmail || "",
          projectType: project.projectType || "INDIVIDUAL",
          hasAdultContent: project.hasAdultContent || false,
          hasRiskyContent: project.hasRiskyContent || false,
          promoContentSfw: project.promoContentSfw !== false,
          allowRetailerPledges: project.allowRetailerPledges || false,
          retailerDiscount: project.retailerDiscount || 50,
          retailerMinQuantity: project.retailerMinQuantity || 5,
        });

        // Load promotion settings
        updatePromotion({
          prelaunchActive: project.prelaunchActive || false,
          prelaunchDescription: project.prelaunchDescription || "",
          customReferralTags: project.customReferralTags || [],
          googleAnalyticsId: project.googleAnalyticsId || "",
          metaPixelId: project.metaPixelId || "",
        });

        // Load collaborators
        try {
          const collabResponse = await fetch(`/api/projects/${project.id}/collaborators`);
          if (collabResponse.ok) {
            const collabData = await collabResponse.json();
            const collaborators = (collabData.collaborators || []).map((c: {
              id: string;
              email: string;
              title?: string;
              status: string;
              canEditProject: boolean;
              canManageCommunity: boolean;
              canCoordinateFulfillment: boolean;
              canConfigurePledgeManager: boolean;
              user?: { name?: string; image?: string };
            }) => ({
              id: c.id,
              email: c.email,
              title: c.title || "",
              canEditProject: c.canEditProject,
              canManageCommunity: c.canManageCommunity,
              canCoordinateFulfillment: c.canCoordinateFulfillment,
              canConfigurePledgeManager: c.canConfigurePledgeManager,
            }));
            updatePeople({ collaborators });
          }
        } catch (collabError) {
          console.error("Failed to load collaborators:", collabError);
          // Non-fatal - continue loading the project
        }

        // Load project items from database
        try {
          const itemsResponse = await fetch(`/api/projects/${project.id}/items`);
          if (itemsResponse.ok) {
            const itemsData = await itemsResponse.json();
            for (const item of itemsData.items || []) {
              addItem({
                id: item.id,
                title: item.title,
                description: item.description || "",
                imageUrl: item.imageUrl || "",
              });
            }
          }
        } catch (itemsError) {
          console.error("Failed to load items:", itemsError);
          // Non-fatal - continue loading the project
        }

        // Load rewards (tiers and addons)
        const allRewards = [...rewards, ...addons];
        for (const reward of allRewards) {
          // Add the reward
          addReward({
            id: reward.id,
            type: reward.type,
            title: reward.title,
            description: reward.description,
            amount: reward.amount,
            imageUrl: reward.imageUrl || "",
            estimatedDelivery: reward.estimatedDelivery
              ? new Date(reward.estimatedDelivery)
              : undefined,
            shippingType: reward.shippingType || "NO_SHIPPING",
            shippingCountries: reward.shippingCountries || [],
            shippingCost: (typeof reward.shippingCost === 'object' ? reward.shippingCost : {}) as Record<string, number>,
            quantityAvailable: reward.quantityAvailable,
            quantityClaimed: reward.quantityClaimed || 0,
            backerCount: reward.backerCount || 0,
            visibility: reward.visibility || "PUBLIC",
            items: (reward.items || []).map((item: { id: string; projectItemId?: string; title: string; imageUrl?: string; quantity?: number }) => ({
              id: item.projectItemId || item.id, // Use projectItemId to match global items, fallback to id
              projectItemId: item.projectItemId, // Preserve projectItemId for future reference
              title: item.title,
              imageUrl: item.imageUrl || "",
              quantity: item.quantity || 1,
            })),
            isEnded: reward.isEnded || false,
            endedAt: reward.endedAt ? new Date(reward.endedAt) : undefined,
          });
        }

        setLoading(false);
      } catch (error) {
        console.error("Error loading project:", error);
        toast.error("Failed to load project");
        router.push("/dashboard");
      }
    }

    if (slug) {
      loadProject();
    }
  }, [slug, router, reset, setProjectId, setProjectSlug, setProjectStatus, updateBasics, updateStory, updatePeople, updatePayment, updatePromotion, addReward, addItem]);

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading project...</p>
        </div>
      </div>
    );
  }

  return <ProjectBuilder />;
}
