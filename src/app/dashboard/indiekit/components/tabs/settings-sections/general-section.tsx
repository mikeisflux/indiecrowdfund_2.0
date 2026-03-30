"use client";

import { apiFetch } from "@/lib/fetch-utils";
import React, { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Image as ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface GeneralSectionProps {
  projectId?: string;
  projectName?: string;
  currency?: string;
  timezone?: string;
  onRefresh?: () => void;
}

export function GeneralSection({
  projectId,
  projectName = "Flying Sparks Volumes 1-3",
  currency = "USD",
  timezone = "America/Los_Angeles",
  onRefresh,
}: GeneralSectionProps) {
  const [name, setName] = useState(projectName);
  const [selectedCurrency, setSelectedCurrency] = useState(currency);
  const [selectedTimezone, setSelectedTimezone] = useState(timezone);
  const [isSavingGeneral, setIsSavingGeneral] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !projectId) return;

    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("projectId", projectId);

      const res = await apiFetch("/api/creator/indiekit/settings/image", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to upload image");
      }

      toast.success("Project image updated");
      onRefresh?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload image");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSaveGeneral = async () => {
    if (!projectId) return;

    setIsSavingGeneral(true);
    try {
      const res = await apiFetch("/api/creator/indiekit/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({
          projectId,
          section: "general",
          settings: { name, currency: selectedCurrency, timezone: selectedTimezone },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save settings");
      }

      toast.success("General settings saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save settings");
    } finally {
      setIsSavingGeneral(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>General Settings</CardTitle>
        <CardDescription>Basic project configuration</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Project Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Project Image</Label>
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 rounded-lg bg-muted flex items-center justify-center">
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
            </div>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleImageChange}
            />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploadingImage}>
              {isUploadingImage ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                "Change Image"
              )}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Currency</Label>
          <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">USD - US Dollar</SelectItem>
              <SelectItem value="EUR">EUR - Euro</SelectItem>
              <SelectItem value="GBP">GBP - British Pound</SelectItem>
              <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
              <SelectItem value="AUD">AUD - Australian Dollar</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Timezone</Label>
          <Select value={selectedTimezone} onValueChange={setSelectedTimezone}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="America/Los_Angeles">(UTC-08:00) Pacific Time</SelectItem>
              <SelectItem value="America/Denver">(UTC-07:00) Mountain Time</SelectItem>
              <SelectItem value="America/Chicago">(UTC-06:00) Central Time</SelectItem>
              <SelectItem value="America/New_York">(UTC-05:00) Eastern Time</SelectItem>
              <SelectItem value="Europe/London">(UTC+00:00) London</SelectItem>
              <SelectItem value="Europe/Paris">(UTC+01:00) Paris</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleSaveGeneral} disabled={isSavingGeneral}>
          {isSavingGeneral ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Changes"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
