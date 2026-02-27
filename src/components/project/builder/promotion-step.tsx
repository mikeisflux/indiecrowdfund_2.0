"use client";

import { getCSRFHeaders } from "@/lib/csrf";

import { useState, useEffect } from "react";
import { useProjectStore } from "@/lib/stores/project-store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { BlockEditor } from "@/components/ui/block-editor";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Trash2, Copy, Link2, BarChart3, Share2, Rocket, Loader2, CheckCircle, ExternalLink, Send, Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export function PromotionStep() {
  const { promotion, updatePromotion, basics, projectId, setProjectId, projectSlug, setProjectSlug, items, rewards, story, payment, people } = useProjectStore();
  const [newTag, setNewTag] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [justPublished, setJustPublished] = useState(false);
  const [isSubmittingForReview, setIsSubmittingForReview] = useState(false);
  const [prelaunchStatus, setPrelaunchStatus] = useState<string>("DRAFT");

  // Vanity URL state (fetched from profile)
  const [vanityUrl, setVanityUrl] = useState("");

  // Fetch user's vanity URL on mount
  useEffect(() => {
    const fetchVanityUrl = async () => {
      try {
        const response = await fetch("/api/user/vanity-url");
        if (response.ok) {
          const data = await response.json();
          if (data.vanityUrl) {
            setVanityUrl(data.vanityUrl);
          }
        }
      } catch (error) {
        console.error("Failed to fetch vanity URL:", error);
      }
    };
    fetchVanityUrl();
  }, []);

  // Fetch prelaunch status when projectId changes
  useEffect(() => {
    const fetchPrelaunchStatus = async () => {
      if (!projectId) return;
      try {
        const response = await fetch(`/api/projects/${projectId}/prelaunch`);
        if (response.ok) {
          const data = await response.json();
          if (data.prelaunchStatus) {
            setPrelaunchStatus(data.prelaunchStatus);
          }
          if (data.prelaunchActive) {
            setJustPublished(true);
          }
        }
      } catch (error) {
        console.error("Failed to fetch prelaunch status:", error);
      }
    };
    fetchPrelaunchStatus();
  }, [projectId]);

  const customTags = promotion.customReferralTags || [];

  // Use actual project slug from store, or generate a preview slug from title
  const displaySlug = projectSlug || (basics.title
    ? basics.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50)
    : "your-project");

  // URL now uses vanity URL format: /projects/[vanityname]/[slug]
  const displayVanityUrl = vanityUrl || "your-username";
  const projectUrl = `/projects/${displayVanityUrl}/${displaySlug}`;
  const prelaunchUrl = `${projectUrl}/prelaunch`;
  const hasActualSlug = !!projectSlug;
  const hasVanityUrl = !!vanityUrl;

  // Get full URL for sharing (window.location.origin for current domain)
  const getFullUrl = (path: string) => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}${path}`;
    }
    return path;
  };

  const publishPrelaunchPage = async () => {
    // Require vanity URL to be set first
    if (!vanityUrl) {
      toast.error("Please set your creator URL in your profile settings first");
      return;
    }

    if (!basics.title || basics.title.trim().length < 3) {
      toast.error("Please enter a project title first (in the Basics step)");
      return;
    }

    if (!basics.category) {
      toast.error("Please select a project category first (in the Basics step)");
      return;
    }

    setIsPublishing(true);

    try {
      // Transform rewards to include items from the items store
      const transformedRewards = rewards.map((reward) => ({
        id: reward.id,
        type: reward.type || "TIER",
        title: reward.title,
        description: reward.description || "",
        amount: reward.amount,
        imageUrl: reward.imageUrl || undefined,
        estimatedDelivery: reward.estimatedDelivery
          ? new Date(reward.estimatedDelivery).toISOString()
          : null,
        shippingType: reward.shippingType || "NO_SHIPPING",
        shippingCountries: reward.shippingCountries || [],
        shippingCost: reward.shippingCost || {},
        quantityAvailable: reward.quantityAvailable,
        isEnded: reward.isEnded || false,
        items: reward.items?.map((item) => {
          const fullItem = items.find((i) => i.id === item.id);
          return {
            id: item.id,
            title: fullItem?.title || item.title || "Item",
            description: fullItem?.description,
            imageUrl: fullItem?.imageUrl || undefined,
          };
        }) || [],
      }));

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
        goalAmount: basics.goalAmount || 10000,
        durationType: basics.durationType || "FIXED_DAYS",
        durationDays: basics.durationDays,
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
        retailerDiscount: payment.retailerDiscount || 50,
        retailerMinQuantity: payment.retailerMinQuantity || 5,
        prelaunchActive: true,
        prelaunchDescription: promotion.prelaunchDescription,
        customReferralTags: promotion.customReferralTags || [],
        googleAnalyticsId: promotion.googleAnalyticsId,
        metaPixelId: promotion.metaPixelId,
        rewards: transformedRewards,
        collaborators: people.collaborators || [],
      };

      let response;
      if (projectId) {
        response = await fetch(`/api/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
          body: JSON.stringify(projectData),
        });
      } else {
        response = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
          body: JSON.stringify(projectData),
        });
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to publish pre-launch page");
      }

      const result = await response.json();

      // If this was a new project, save the project ID and slug
      if (!projectId && result.project?.id) {
        setProjectId(result.project.id);
      }
      if (result.project?.slug) {
        setProjectSlug(result.project.slug);
      }

      // Check if the prelaunch requires approval
      if (result.requiresApproval) {
        toast.info(result.message || "Your pre-launch page has been submitted for review.");
        // Don't set prelaunchActive - it's pending approval
        updatePromotion({ prelaunchActive: false });
        setPrelaunchStatus("SUBMITTED");
        setJustPublished(false);
      } else {
        updatePromotion({ prelaunchActive: true });
        setJustPublished(true);
        toast.success("Pre-launch page published!");
      }
    } catch (error) {
      console.error("Publish pre-launch error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to publish");
    } finally {
      setIsPublishing(false);
    }
  };

  const submitPrelaunchForReview = async () => {
    // Require vanity URL to be set first
    if (!vanityUrl) {
      toast.error("Please set your creator URL in your profile settings first");
      return;
    }

    if (!basics.title || basics.title.trim().length < 3) {
      toast.error("Please enter a project title first (in the Basics step)");
      return;
    }

    if (!basics.category) {
      toast.error("Please select a project category first (in the Basics step)");
      return;
    }

    setIsSubmittingForReview(true);

    try {
      // First save the project if needed
      let currentProjectId = projectId;

      if (!currentProjectId) {
        // Create the project first
        const projectData = {
          title: basics.title,
          subtitle: basics.subtitle,
          category: basics.category,
          subcategory: basics.subcategory,
          location: basics.location,
          imageUrl: basics.imageUrl || undefined,
          goalAmount: basics.goalAmount || 10000,
          prelaunchDescription: promotion.prelaunchDescription,
        };

        const createResponse = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
          body: JSON.stringify(projectData),
        });

        if (!createResponse.ok) {
          const error = await createResponse.json();
          throw new Error(error.error || "Failed to save project");
        }

        const createResult = await createResponse.json();
        currentProjectId = createResult.project.id;
        setProjectId(currentProjectId);
        if (createResult.project.slug) {
          setProjectSlug(createResult.project.slug);
        }
      }

      // Submit the prelaunch for review
      const response = await fetch(`/api/projects/${currentProjectId}/prelaunch`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({ prelaunchActive: true }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to submit for review");
      }

      if (result.requiresApproval) {
        setPrelaunchStatus("SUBMITTED");
        toast.success("Pre-launch page submitted for review! You'll be notified once it's approved.");
      } else {
        // User can publish directly (trusted user)
        updatePromotion({ prelaunchActive: true });
        setJustPublished(true);
        toast.success("Pre-launch page published!");
      }
    } catch (error) {
      console.error("Submit for review error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to submit for review");
    } finally {
      setIsSubmittingForReview(false);
    }
  };

  const deactivatePrelaunchPage = async () => {
    if (!projectId) {
      toast.error("No project to deactivate");
      return;
    }

    setIsDeactivating(true);

    try {
      // Use dedicated prelaunch endpoint for reliable deactivation
      const response = await fetch(`/api/projects/${projectId}/prelaunch`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({ prelaunchActive: false }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to deactivate pre-launch page");
      }

      updatePromotion({ prelaunchActive: false });
      setJustPublished(false);
      toast.success("Pre-launch page deactivated");
    } catch (error) {
      console.error("Deactivate pre-launch error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to deactivate");
    } finally {
      setIsDeactivating(false);
    }
  };

  const addReferralTag = () => {
    if (!newTag.trim()) return;
    if (customTags.includes(newTag)) {
      toast.error("Tag already exists");
      return;
    }
    updatePromotion({
      customReferralTags: [...customTags, newTag.toLowerCase().replace(/\s+/g, "-")],
    });
    setNewTag("");
    toast.success("Referral tag created");
  };

  const removeTag = (tag: string) => {
    updatePromotion({
      customReferralTags: customTags.filter((t) => t !== tag),
    });
    toast.success("Tag removed");
  };

  const copyTagUrl = (tag: string) => {
    navigator.clipboard.writeText(getFullUrl(`${projectUrl}?ref=${tag}`));
    toast.success("URL copied to clipboard");
  };

  return (
    <div className="space-y-8">
      {/* Project URL */}
      <div className="space-y-2">
        <Label>Project URL</Label>
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-md border bg-muted px-3 py-2">
            <span className="text-sm text-muted-foreground">
              {getFullUrl(projectUrl)}
            </span>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              navigator.clipboard.writeText(getFullUrl(projectUrl));
              toast.success("URL copied");
            }}
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {hasVanityUrl
            ? "This URL cannot be changed after launch"
            : "Set your creator URL in your profile settings to see the final project URL"}
        </p>
      </div>

      <Separator />

      {/* Pre-launch Page */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Share2 className="h-5 w-5" />
                Pre-launch Page
              </CardTitle>
              <CardDescription>
                Build an audience before your campaign goes live
              </CardDescription>
            </div>
            <Switch
              checked={promotion.prelaunchActive || false}
              onCheckedChange={(checked) =>
                updatePromotion({ prelaunchActive: checked })
              }
            />
          </div>
        </CardHeader>
        {promotion.prelaunchActive && (
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>More About This Project</Label>
              <BlockEditor
                value={promotion.prelaunchDescription || ""}
                onChange={(val) =>
                  updatePromotion({ prelaunchDescription: val })
                }
                placeholder="Give potential backers a sneak peek of what you're creating..."
                projectId={projectId || undefined}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Your project title, subtitle, and image from the Basics step will
              automatically appear on your pre-launch page.
            </p>

            <Separator />

            {/* URL Preview */}
            {hasActualSlug && (
              <div className="rounded-md border bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground mb-2">Pre-launch page URL:</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-md border bg-white dark:bg-zinc-900 px-3 py-2">
                    <span className="text-sm">{getFullUrl(prelaunchUrl)}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(getFullUrl(prelaunchUrl));
                      toast.success("URL copied!");
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => window.open(prelaunchUrl, "_blank")}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {!hasActualSlug && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Note: The final URL will be generated when you publish. It may include a unique suffix.
              </p>
            )}

            {/* Status-based buttons */}
            {justPublished ? (
              /* Pre-launch is live */
              <>
                <Alert className="border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  <AlertDescription className="ml-2">
                    <p className="font-medium text-emerald-800 dark:text-emerald-200">
                      Your pre-launch page is live! Share the URL above to start building your audience.
                    </p>
                  </AlertDescription>
                </Alert>
                <Button
                  onClick={publishPrelaunchPage}
                  disabled={isPublishing}
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                >
                  {isPublishing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Rocket className="mr-2 h-4 w-4" />
                      Update Pre-launch Page
                    </>
                  )}
                </Button>
                <Button
                  onClick={deactivatePrelaunchPage}
                  disabled={isDeactivating}
                  variant="destructive"
                  className="w-full"
                >
                  {isDeactivating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Deactivating...
                    </>
                  ) : (
                    "Deactivate Pre-launch Page"
                  )}
                </Button>
              </>
            ) : prelaunchStatus === "SUBMITTED" ? (
              /* Pending review */
              <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
                <Clock className="h-4 w-4 text-amber-600" />
                <AlertDescription className="ml-2">
                  <p className="font-medium text-amber-800 dark:text-amber-200">
                    Your pre-launch page is pending review.
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    You&apos;ll be notified once it&apos;s approved and you can publish it.
                  </p>
                </AlertDescription>
              </Alert>
            ) : prelaunchStatus === "REJECTED" ? (
              /* Rejected - can resubmit */
              <>
                <Alert className="border-red-200 bg-red-50 dark:bg-red-950/20">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="ml-2">
                    <p className="font-medium text-red-800 dark:text-red-200">
                      Your pre-launch page was not approved.
                    </p>
                    <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                      Please make the requested changes and submit again for review.
                    </p>
                  </AlertDescription>
                </Alert>
                <Button
                  onClick={submitPrelaunchForReview}
                  disabled={isSubmittingForReview}
                  className="w-full"
                >
                  {isSubmittingForReview ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Resubmit for Review
                    </>
                  )}
                </Button>
              </>
            ) : prelaunchStatus === "APPROVED" ? (
              /* Approved - can publish */
              <div className="space-y-3">
                <Alert className="border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  <AlertDescription className="ml-2">
                    <p className="font-medium text-emerald-800 dark:text-emerald-200">
                      Your pre-launch page has been approved!
                    </p>
                  </AlertDescription>
                </Alert>
                <Button
                  onClick={publishPrelaunchPage}
                  disabled={isPublishing}
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                >
                  {isPublishing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Publishing...
                    </>
                  ) : (
                    <>
                      <Rocket className="mr-2 h-4 w-4" />
                      Publish Pre-launch Page
                    </>
                  )}
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  Publishing will make the pre-launch page visible to the public.
                </p>
              </div>
            ) : (
              /* Draft - submit for review */
              <div className="space-y-3">
                <Button
                  onClick={submitPrelaunchForReview}
                  disabled={isSubmittingForReview}
                  className="w-full"
                >
                  {isSubmittingForReview ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Submit Pre-launch for Review
                    </>
                  )}
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  Your pre-launch page will be reviewed before it can go live.
                </p>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      <Separator />

      {/* Custom Referral Tags */}
      <div className="space-y-4">
        <div>
          <h3 className="flex items-center gap-2 font-semibold">
            <Link2 className="h-5 w-5" />
            Custom Referral Tags
          </h3>
          <p className="text-sm text-muted-foreground">
            Create trackable URLs for your marketing campaigns
          </p>
        </div>

        {customTags.length > 0 && (
          <div className="space-y-2">
            {customTags.map((tag) => (
              <div
                key={tag}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div className="flex-1">
                  <Badge variant="secondary">{tag}</Badge>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {projectUrl}?ref={tag}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copyTagUrl(tag)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeTag(tag)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Input
            placeholder="e.g., newsletter, instagram-story, twitter"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addReferralTag()}
          />
          <Button onClick={addReferralTag} variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            Add Tag
          </Button>
        </div>
      </div>

      <Separator />

      {/* Analytics Integration */}
      <div className="space-y-4">
        <div>
          <h3 className="flex items-center gap-2 font-semibold">
            <BarChart3 className="h-5 w-5" />
            Analytics Integration
          </h3>
          <p className="text-sm text-muted-foreground">
            Connect your analytics tools for deeper insights
          </p>
        </div>

        {/* Google Analytics */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Google Analytics</CardTitle>
            <CardDescription>
              Track visitors, conversion rates, and referrer sources
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <form onSubmit={(e) => e.preventDefault()}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ga-id">Tracking ID</Label>
                  <Input
                    id="ga-id"
                    placeholder="G-XXXXXXXXXX"
                    autoComplete="off"
                    value={promotion.googleAnalyticsId || ""}
                    onChange={(e) =>
                      updatePromotion({ googleAnalyticsId: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ga-secret">API Secret (optional)</Label>
                  <Input
                    id="ga-secret"
                    type="password"
                    placeholder="Your API secret"
                    autoComplete="off"
                    value={promotion.googleAnalyticsSecret || ""}
                    onChange={(e) =>
                      updatePromotion({ googleAnalyticsSecret: e.target.value })
                    }
                  />
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Meta Pixel */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Meta Pixel</CardTitle>
            <CardDescription>
              Track Facebook and Instagram ad effectiveness
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <form onSubmit={(e) => e.preventDefault()}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="meta-pixel">Pixel ID</Label>
                  <Input
                    id="meta-pixel"
                    placeholder="1234567890123456"
                    autoComplete="off"
                    value={promotion.metaPixelId || ""}
                    onChange={(e) =>
                      updatePromotion({ metaPixelId: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="meta-token">
                    Conversions API Token (optional)
                  </Label>
                  <Input
                    id="meta-token"
                    type="password"
                    placeholder="Your access token"
                    autoComplete="off"
                    value={promotion.metaConversionsToken || ""}
                    onChange={(e) =>
                      updatePromotion({ metaConversionsToken: e.target.value })
                    }
                  />
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
