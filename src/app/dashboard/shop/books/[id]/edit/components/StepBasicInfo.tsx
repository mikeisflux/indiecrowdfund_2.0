"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BlockEditor } from "@/components/ui/block-editor";
import { FileText, AlertTriangle } from "lucide-react";
import { BookFormData, MEDIA_CATEGORIES, COMICS_GENRES, GENRES_BY_MEDIA_CATEGORY } from "./types";

interface StepBasicInfoProps {
  formData: BookFormData;
  canEdit: boolean;
  isLive: boolean;
  updateForm: (field: keyof BookFormData, value: string | boolean | string[] | number | null) => void;
}

export function StepBasicInfo({ formData, canEdit, isLive, updateForm }: StepBasicInfoProps) {
  const genres = GENRES_BY_MEDIA_CATEGORY[formData.mediaCategory] || COMICS_GENRES;

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <FileText className="h-5 w-5 text-purple-500 dark:text-purple-400" />
          Basic Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Book Title *</Label>
          <Input
            placeholder="Enter your book title"
            value={formData.title}
            onChange={(e) => updateForm("title", e.target.value)}
            disabled={!canEdit && !isLive}
          />
        </div>

        <div className="space-y-2">
          <Label>Description *</Label>
          <BlockEditor
            placeholder="Describe your book in detail..."
            value={formData.description}
            onChange={(val) => updateForm("description", val)}
          />
          <p className="text-xs text-muted-foreground">
            {formData.description.replace(/<[^>]*>/g, "").length} characters
          </p>
        </div>

        <div className="space-y-2">
          <Label>Type *</Label>
          <Select
            value={formData.mediaCategory}
            onValueChange={(value) => {
              updateForm("mediaCategory", value);
              updateForm("category", "");
            }}
            disabled={!canEdit && !isLive}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a type" />
            </SelectTrigger>
            <SelectContent>
              {MEDIA_CATEGORIES.map((mc) => (
                <SelectItem key={mc.value} value={mc.value}>
                  {mc.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Genre *</Label>
          <Select
            value={formData.category}
            onValueChange={(value) => updateForm("category", value)}
            disabled={!canEdit && !isLive}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a genre" />
            </SelectTrigger>
            <SelectContent>
              {genres.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Tags (comma-separated)</Label>
          <Input
            placeholder="e.g., fantasy, adventure, magic"
            value={formData.tags.join(", ")}
            onChange={(e) => updateForm("tags", e.target.value.split(",").map(t => t.trim()).filter(Boolean))}
            disabled={!canEdit && !isLive}
          />
        </div>

        <div className="flex items-center justify-between p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 dark:text-amber-400" />
            <div>
              <p className="font-medium text-foreground">Contains NSFW Content</p>
              <p className="text-sm text-muted-foreground">
                If enabled, payments will be processed via DivinityCoin only
              </p>
            </div>
          </div>
          <Switch
            checked={formData.isNsfw}
            onCheckedChange={(checked) => {
              updateForm("isNsfw", checked);
              if (checked) {
                updateForm("paymentProcessor", "DIVINITYCOIN");
              }
            }}
            disabled={!canEdit && !isLive}
          />
        </div>
      </CardContent>
    </Card>
  );
}
