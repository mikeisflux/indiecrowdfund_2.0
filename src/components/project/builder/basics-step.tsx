"use client";

import { useMemo } from "react";
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
import { Calendar, Lightbulb, Upload, Trash2, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

// Helper to extract video embed URL from YouTube or Vimeo links
function getVideoEmbedUrl(url: string): string | null {
  if (!url) return null;

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

export function BasicsStep() {
  const { basics, updateBasics } = useProjectStore();

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
            <Label>Primary category</Label>
            <Select
              value={basics.category || ""}
              onValueChange={handlePrimaryCategoryChange}
            >
              <SelectTrigger>
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
            <Label>Primary subcategory</Label>
            <Select
              value={basics.subcategory || ""}
              onValueChange={(value) => updateBasics({ subcategory: value })}
              disabled={!basics.category}
            >
              <SelectTrigger>
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
            <Label>Category</Label>
            <Select
              value={basics.secondaryCategory || ""}
              onValueChange={handleSecondaryCategoryChange}
            >
              <SelectTrigger>
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
            <Label>Subcategory</Label>
            <Select
              value={basics.secondarySubcategory || ""}
              onValueChange={(value) => updateBasics({ secondarySubcategory: value })}
              disabled={!basics.secondaryCategory}
            >
              <SelectTrigger>
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
          {videoEmbedUrl ? (
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
                    const input = document.createElement("input");
                    input.type = "text";
                    const url = prompt("Enter YouTube or Vimeo URL:", basics.videoUrl || "");
                    if (url !== null) {
                      updateBasics({ videoUrl: url });
                    }
                  }}
                >
                  <Upload className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => updateBasics({ videoUrl: "" })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-col items-center justify-center aspect-video rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/50 p-6">
                <Video className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <Input
                  id="videoUrl"
                  placeholder="Paste YouTube or Vimeo URL"
                  value={basics.videoUrl || ""}
                  onChange={(e) => updateBasics({ videoUrl: e.target.value })}
                  className="max-w-sm"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Supports YouTube and Vimeo links
                </p>
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
                value={
                  basics.endDate
                    ? new Date(basics.endDate).toISOString().split("T")[0]
                    : ""
                }
                onChange={(e) =>
                  updateBasics({ endDate: new Date(e.target.value) })
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
          value={
            basics.launchDate
              ? new Date(basics.launchDate).toISOString().split("T")[0]
              : ""
          }
          onChange={(e) =>
            updateBasics({ launchDate: new Date(e.target.value) })
          }
        />
        <p className="text-xs text-muted-foreground">
          When do you plan to launch your campaign?
        </p>
      </div>
    </div>
  );
}
