"use client";

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
import { Calendar } from "lucide-react";

export function BasicsStep() {
  const { basics, updateBasics } = useProjectStore();

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

      {/* Category */}
      <div className="space-y-2">
        <Label>
          Category <span className="text-destructive">*</span>
        </Label>
        <Select
          value={basics.category || ""}
          onValueChange={(value) => updateBasics({ category: value })}
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

      {/* Video URL */}
      <div className="space-y-2">
        <Label htmlFor="videoUrl">Project Video (optional)</Label>
        <Input
          id="videoUrl"
          placeholder="YouTube or Vimeo URL"
          value={basics.videoUrl || ""}
          onChange={(e) => updateBasics({ videoUrl: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Videos help increase project success rates
        </p>
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
