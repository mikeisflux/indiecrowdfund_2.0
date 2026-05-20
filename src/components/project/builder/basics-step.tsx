"use client";

import NextLink from "next/link";
import { apiFetch } from "@/lib/fetch-utils";
import { useMemo, useState, useEffect, useCallback } from "react";
import { useProjectStore } from "@/lib/stores/project-store";
import { PROJECT_CATEGORIES } from "@/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImageUpload } from "@/components/ui/image-upload";
import { LocationAutocomplete } from "@/components/ui/location-autocomplete";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar, Lightbulb, Upload, Trash2, Video, Link, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { slugify } from "@/lib/utils";
import { toast } from "sonner";

// A type="date" input needs "YYYY-MM-DD" or "". Clearing the field
// yields new Date("") (Invalid Date); calling .toISOString() on that
// throws "RangeError: Invalid time value" — and since it runs during
// render, it takes the whole edit page down via the error boundary.
function toDateInputValue(value: Date | string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  return isNaN(d.getTime()) ? "" : d.toISOString().split("T")[0];
}

// Helper to extract video embed URL from YouTube or Vimeo links
function getVideoEmbedUrl(url: string): string | null {
  if (!url) return null;

  // Check if it's an uploaded video (local URL)
  if (url.startsWith("/api/uploads/") || url.includes("/api/uploads/")) {
    return null; // Return null so we know to use native video player
  }

  // YouTube patterns
  const youtubeRegex = /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const youtubeMatch = url.match(youtubeRegex);
  if (youtubeMatch) {
    return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
  }

  // Vimeo patterns
  const vimeoRegex = /(?:vimeo\.com\/)(\d+)/;
  const vimeoMatch = url.match(vimeoRegex);
  if (vimeoMatch) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  }

  return null;
}

// Check if URL is an uploaded video
function isUploadedVideo(url: string): boolean {
  if (!url) return false;
  return url.startsWith("/api/uploads/") || url.includes("/api/uploads/");
}

export function BasicsStep() {
  const { basics, updateBasics, projectId } = useProjectStore();
  const [slugInput, setSlugInput] = useState(basics.slug || "");
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [slugMessage, setSlugMessage] = useState("");
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [userVanityUrl, setUserVanityUrl] = useState<string | null>(null);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(!!basics.slug);

  // Fetch user's vanity URL on mount and when page becomes visible (e.g., after navigating back)
  useEffect(() => {
    const fetchUserVanityUrl = async () => {
      try {
        const res = await fetch("/api/user/me");
        if (res.ok) {
          const data = await res.json();
          setUserVanityUrl(data.vanityUrl || null);
        }
      } catch {
        // Ignore errors - vanity URL is optional
      }
    };

    // Fetch on mount
    fetchUserVanityUrl();

    // Re-fetch when page becomes visible (handles browser back button)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchUserVanityUrl();
      }
    };

    // Re-fetch when window gains focus
    const handleFocus = () => {
      fetchUserVanityUrl();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  // Handle video file upload
  const handleVideoUpload = async (file: File) => {
    if (!projectId) {
      toast.error("Please save the project first before uploading a video");
      return;
    }

    // Validate file type
    const validTypes = ["video/mp4", "video/webm", "video/quicktime"];
    if (!validTypes.includes(file.type)) {
      toast.error("Please upload an MP4, WebM, or MOV video file");
      return;
    }

    // Validate file size (200MB max)
    const maxSize = 200 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("Video file must be less than 200MB");
      return;
    }

    setIsUploadingVideo(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("projectId", projectId);
      formData.append("type", "video");

      const response = await apiFetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to upload video");
      }

      const result = await response.json();
      updateBasics({ videoUrl: result.url });
    } catch (error) {
      console.error("Video upload error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to upload video");
    } finally {
      setIsUploadingVideo(false);
    }
  };

  // Auto-generate slug from title when title changes (unless user manually edited)
  useEffect(() => {
    if (basics.title && !slugManuallyEdited) {
      const generatedSlug = slugify(basics.title);
      setSlugInput(generatedSlug);
    }
  }, [basics.title, slugManuallyEdited]);

  // Debounced slug availability check
  const checkSlugAvailability = useCallback(async (slug: string) => {
    if (!slug || slug.length < 3) {
      setSlugStatus("invalid");
      setSlugMessage("Slug must be at least 3 characters");
      return;
    }

    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(slug)) {
      setSlugStatus("invalid");
      setSlugMessage("Only lowercase letters, numbers, and hyphens allowed");
      return;
    }

    setSlugStatus("checking");
    setSlugMessage("Checking availability...");

    try {
      const res = await fetch(`/api/projects/slug/${slug}/check${projectId ? `?projectId=${projectId}` : ""}`);
      const data = await res.json();

      if (data.available) {
        setSlugStatus("available");
        setSlugMessage("This URL is available!");
        updateBasics({ slug });
      } else {
        setSlugStatus("taken");
        setSlugMessage("This URL is already taken");
      }
    } catch {
      setSlugStatus("idle");
      setSlugMessage("");
    }
  }, [projectId, updateBasics]);

  // Debounce the slug check
  useEffect(() => {
    if (!slugInput) {
      setSlugStatus("idle");
      setSlugMessage("");
      return;
    }

    const timer = setTimeout(() => {
      checkSlugAvailability(slugInput);
    }, 500);

    return () => clearTimeout(timer);
  }, [slugInput, checkSlugAvailability]);

  // Get video embed URL
  const videoEmbedUrl = useMemo(() => {
    return getVideoEmbedUrl(basics.videoUrl || "");
  }, [basics.videoUrl]);

  // Get subcategories for the selected primary category
  const primarySubcategories = useMemo(() => {
    if (!basics.category) return [];
    const category = PROJECT_CATEGORIES.find((c) => c.value === basics.category);
    return category?.subcategories || [];
  }, [basics.category]);

  // Get subcategories for the selected secondary category
  const secondarySubcategories = useMemo(() => {
    if (!basics.secondaryCategory) return [];
    const category = PROJECT_CATEGORIES.find((c) => c.value === basics.secondaryCategory);
    return category?.subcategories || [];
  }, [basics.secondaryCategory]);

  // Handle primary category change - reset subcategory when category changes
  const handlePrimaryCategoryChange = (value: string) => {
    updateBasics({ category: value, subcategory: undefined });
  };

  // Handle secondary category change - reset secondary subcategory when category changes
  const handleSecondaryCategoryChange = (value: string) => {
    updateBasics({ secondaryCategory: value, secondarySubcategory: undefined });
  };

  return (
    <div className="space-y-6">
      {/* Project Title */}
      <div className="space-y-2">
        <Label htmlFor="title">
          Project Title <span className="text-destructive">*</span>
        </Label>
        <Input
          id="title"
          name="project-title"
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
          data-form-type="other"
          placeholder="Enter your project title"
          value={basics.title || ""}
          onChange={(e) => updateBasics({ title: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Make it clear and memorable
        </p>
      </div>

      {/* Subtitle */}
      <div className="space-y-2">
        <Label htmlFor="subtitle">Subtitle</Label>
        <Textarea
          id="subtitle"
          placeholder="A brief tagline for your project"
          value={basics.subtitle || ""}
          onChange={(e) => updateBasics({ subtitle: e.target.value })}
          rows={2}
        />
      </div>

      {/* Project URL / Slug */}
      <div className="space-y-2">
        <Label htmlFor="slug">
          <div className="flex items-center gap-2">
            <Link className="h-4 w-4" />
            Project URL
          </div>
        </Label>
        {userVanityUrl ? (
          <>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                indiecrowdfund.com/projects/{userVanityUrl}/
              </span>
              <div className="relative flex-1">
                <Input
                  id="slug"
                  name="project-slug-url"
                  autoComplete="off"
                  data-1p-ignore
                  data-lpignore="true"
                  data-form-type="other"
                  placeholder="my-awesome-project"
                  value={slugInput}
                  onChange={(e) => {
                    const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
                    setSlugInput(value);
                    setSlugManuallyEdited(true);
                  }}
                  className={`pr-10 ${
                    slugStatus === "available" ? "border-green-500 focus-visible:ring-green-500" :
                    slugStatus === "taken" || slugStatus === "invalid" ? "border-red-500 focus-visible:ring-red-500" :
                    ""
                  }`}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {slugStatus === "checking" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  {slugStatus === "available" && <Check className="h-4 w-4 text-green-500" />}
                  {(slugStatus === "taken" || slugStatus === "invalid") && <X className="h-4 w-4 text-red-500" />}
                </div>
              </div>
            </div>
            {slugMessage && (
              <p className={`text-xs ${
                slugStatus === "available" ? "text-green-600" :
                slugStatus === "taken" || slugStatus === "invalid" ? "text-red-600" :
                "text-muted-foreground"
              }`}>
                {slugMessage}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              This will be your project&apos;s permanent URL. Choose something memorable and relevant.
            </p>
          </>
        ) : (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              You need to set up a custom username before creating a project URL.
            </p>
            <NextLink
              href="/dashboard/profile"
              className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-amber-700 underline hover:no-underline dark:text-amber-300"
            >
              Set up your username in profile settings
              <Link className="h-3 w-3" />
            </NextLink>
          </div>
        )}
      </div>

      {/* Tip Banner */}
      <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
        <Lightbulb className="h-4 w-4 flex-shrink-0" />
        <span>
          Give backers the best first impression of your project with great titles.{" "}
          <a href="#" className="font-medium underline hover:no-underline">
            Learn more...
          </a>
        </span>
      </div>

      {/* Project Category Section */}
      <div className="space-y-4 rounded-lg border bg-card p-6">
        <div>
          <h3 className="text-lg font-semibold">Project category</h3>
          <p className="text-sm text-muted-foreground">
            Choose a primary category and subcategory to help backers find your project.
          </p>
        </div>

        {/* Primary Category Row */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="primary-category">Primary category</Label>
            <Select
              value={basics.category || ""}
              onValueChange={handlePrimaryCategoryChange}
            >
              <SelectTrigger id="primary-category">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_CATEGORIES.map((category) => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="primary-subcategory">Primary subcategory</Label>
            <Select
              value={basics.subcategory || ""}
              onValueChange={(value) => updateBasics({ subcategory: value })}
              disabled={!basics.category}
            >
              <SelectTrigger id="primary-subcategory">
                <SelectValue placeholder={basics.category ? "Select a subcategory" : "Select a category first"} />
              </SelectTrigger>
              <SelectContent>
                {primarySubcategories.map((sub) => (
                  <SelectItem key={sub.value} value={sub.value}>
                    {sub.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Secondary Category Row */}
        <div className="space-y-2 pt-2">
          <p className="text-sm text-muted-foreground">
            Your second subcategory will help us provide more relevant guidance for your project.
            It won&apos;t display on your project page or affect how it appears in search results.
          </p>
          <p className="text-sm text-muted-foreground">
            You can change these anytime before and during your campaign.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="secondary-category">Category</Label>
            <Select
              value={basics.secondaryCategory || ""}
              onValueChange={handleSecondaryCategoryChange}
            >
              <SelectTrigger id="secondary-category">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_CATEGORIES.map((category) => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="secondary-subcategory">Subcategory</Label>
            <Select
              value={basics.secondarySubcategory || ""}
              onValueChange={(value) => updateBasics({ secondarySubcategory: value })}
              disabled={!basics.secondaryCategory}
            >
              <SelectTrigger id="secondary-subcategory">
                <SelectValue placeholder={basics.secondaryCategory ? "Select a subcategory" : "Select a category first"} />
              </SelectTrigger>
              <SelectContent>
                {secondarySubcategories.map((sub) => (
                  <SelectItem key={sub.value} value={sub.value}>
                    {sub.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Location */}
      <div className="space-y-2">
        <Label htmlFor="location">Location</Label>
        <LocationAutocomplete
          value={basics.location || ""}
          onChange={(value) => updateBasics({ location: value })}
          placeholder="Start typing a city name..."
        />
        <p className="text-xs text-muted-foreground">
          Where are you based? This helps backers know where your project is coming from.
        </p>
      </div>

      {/* Project Image */}
      <div className="space-y-2">
        <Label>Project Image</Label>
        <ImageUpload
          value={basics.imageUrl}
          onChange={(url) => updateBasics({ imageUrl: url })}
          projectId={projectId || undefined}
          uploadType="project"
          aspectRatio="aspect-video"
          recommendedSize="1024 x 576 px (16:9 ratio)"
          maxSizeMB={10}
        />
      </div>

      {/* Project Video Section */}
      <div className="grid gap-6 md:grid-cols-[300px_1fr] items-start rounded-lg border bg-card p-6">
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Project video (optional)</h3>
          <p className="text-sm text-muted-foreground">
            Add a video that describes your project.
          </p>
          <p className="text-sm text-muted-foreground">
            Tell people what you&apos;re raising funds to do, how you plan to make it happen, who you are, and why you care about this project.
          </p>
          <p className="text-sm text-muted-foreground">
            After you&apos;ve added your video, use our editor to add captions and subtitles so your project is more accessible to everyone.
          </p>
        </div>

        <div className="space-y-4">
          {/* Video Preview or Upload Area */}
          {isUploadedVideo(basics.videoUrl || "") ? (
            // Native video player for uploaded videos
            <div className="space-y-3">
              <div className="relative aspect-video rounded-lg overflow-hidden bg-black">
                <video
                  src={basics.videoUrl || ""}
                  className="absolute inset-0 w-full h-full object-contain"
                  controls
                  preload="metadata"
                />
              </div>
              <div className="flex items-center justify-end gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => updateBasics({ videoUrl: "" })}
                  aria-label="Remove video"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : videoEmbedUrl ? (
            // YouTube/Vimeo iframe embed
            <div className="space-y-3">
              <div className="relative aspect-video rounded-lg overflow-hidden bg-black">
                <iframe
                  src={videoEmbedUrl}
                  className="absolute inset-0 w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <div className="flex items-center justify-end gap-3">
                <div className="flex items-center gap-2">
                  <Switch id="captions" />
                  <Label htmlFor="captions" className="text-sm font-normal">Add captions</Label>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    const url = prompt("Enter YouTube or Vimeo URL:", basics.videoUrl || "");
                    if (url !== null) {
                      updateBasics({ videoUrl: url });
                    }
                  }}
                  aria-label="Change video URL"
                >
                  <Link className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => updateBasics({ videoUrl: "" })}
                  aria-label="Remove video"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            // Empty state - show upload and URL options
            <div className="space-y-3">
              <div className="flex flex-col items-center justify-center aspect-video rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/50 p-6">
                {isUploadingVideo ? (
                  <>
                    <Loader2 className="h-12 w-12 text-muted-foreground/50 mb-4 animate-spin" />
                    <p className="text-sm text-muted-foreground">Uploading video...</p>
                  </>
                ) : (
                  <>
                    <Video className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-md">
                      <Button
                        variant="outline"
                        className="w-full sm:w-auto"
                        onClick={() => {
                          const input = document.createElement("input");
                          input.type = "file";
                          input.accept = "video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov";
                          input.onchange = (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (file) {
                              handleVideoUpload(file);
                            }
                          };
                          input.click();
                        }}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Video
                      </Button>
                      <span className="text-xs text-muted-foreground">or</span>
                      <Input
                        id="videoUrl"
                        placeholder="Paste YouTube/Vimeo URL"
                        value={basics.videoUrl || ""}
                        onChange={(e) => updateBasics({ videoUrl: e.target.value })}
                        className="flex-1"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">
                      Upload MP4, WebM, or MOV (max 200MB) or paste a YouTube/Vimeo link
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Video Tip */}
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
            <Lightbulb className="h-4 w-4 flex-shrink-0" />
            <span>
              80% of successful projects have a video. Make a great one, regardless of your budget.{" "}
              <a href="#" className="font-medium underline hover:no-underline">
                Learn more...
              </a>
            </span>
          </div>
        </div>
      </div>

      {/* Funding Goal */}
      <div className="space-y-2">
        <Label htmlFor="goalAmount">
          Funding Goal <span className="text-destructive">*</span>
        </Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            $
          </span>
          <Input
            id="goalAmount"
            type="number"
            className="pl-8"
            placeholder="10,000"
            value={basics.goalAmount || ""}
            onChange={(e) =>
              updateBasics({ goalAmount: parseFloat(e.target.value) || 0 })
            }
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Set a realistic goal that covers your costs
        </p>
      </div>

      {/* Campaign Duration */}
      <div className="space-y-4">
        <Label>Campaign Duration</Label>
        <RadioGroup
          value={basics.durationType || "FIXED_DAYS"}
          onValueChange={(value) =>
            updateBasics({ durationType: value as "FIXED_DAYS" | "END_DATE" })
          }
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="FIXED_DAYS" id="fixed-days" />
            <Label htmlFor="fixed-days" className="font-normal">
              Fixed number of days
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="END_DATE" id="end-date" />
            <Label htmlFor="end-date" className="font-normal">
              End on a specific date
            </Label>
          </div>
        </RadioGroup>

        {basics.durationType === "FIXED_DAYS" && (
          <div className="space-y-2">
            <Label htmlFor="durationDays">Number of days (1-60)</Label>
            <Input
              id="durationDays"
              type="number"
              min={1}
              max={60}
              value={basics.durationDays || 30}
              onChange={(e) =>
                updateBasics({
                  durationDays: Math.min(60, Math.max(1, parseInt(e.target.value) || 30)),
                })
              }
            />
          </div>
        )}

        {basics.durationType === "END_DATE" && (
          <div className="space-y-2">
            <Label htmlFor="endDate">End Date</Label>
            <div className="relative">
              <Input
                id="endDate"
                type="date"
                value={toDateInputValue(basics.endDate)}
                onChange={(e) =>
                  updateBasics({
                    endDate: e.target.value ? new Date(e.target.value) : undefined,
                  })
                }
              />
              <Calendar className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      {/* Target Launch Date */}
      <div className="space-y-2">
        <Label htmlFor="launchDate">Target Launch Date (optional)</Label>
        <Input
          id="launchDate"
          type="date"
          value={toDateInputValue(basics.launchDate)}
          onChange={(e) =>
            updateBasics({
              launchDate: e.target.value ? new Date(e.target.value) : undefined,
            })
          }
        />
        <p className="text-xs text-muted-foreground">
          When do you plan to launch your campaign?
        </p>
      </div>
    </div>
  );
}
