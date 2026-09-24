"use client";

import { apiFetch } from "@/lib/fetch-utils";
import React, { useState, useEffect, useRef, useCallback } from "react";
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
  onRefresh?: () => void;
}

// Display currencies the platform can convert to (ECB daily rates).
// Pledges settle in USD; this changes what the campaign page SHOWS.
// Keep in sync with COUNTRY_TO_CURRENCY in src/lib/currency.ts — the
// API validates against the same list.
const DISPLAY_CURRENCIES = [
  "USD", "AUD", "BRL", "CAD", "CHF", "CNY", "DKK", "EUR", "GBP", "HKD",
  "INR", "JPY", "KRW", "MXN", "NOK", "NZD", "PLN", "SEK", "SGD",
];

export function GeneralSection({ projectId, onRefresh }: GeneralSectionProps) {
  const [name, setName] = useState("");
  const [selectedCurrency, setSelectedCurrency] = useState("USD");
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingGeneral, setIsSavingGeneral] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load the real stored values — this card used to start from a
  // hardcoded demo campaign name ("Flying Sparks Volumes 1-3").
  const loadSettings = useCallback(async () => {
    if (!projectId) {
      setIsLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/creator/indiekit/settings?projectId=${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setName(data.project?.title || "");
        setSelectedCurrency(data.project?.currency || "USD");
      }
    } catch {
      // Leave fields blank rather than show fake defaults.
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

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
    if (!name.trim()) {
      toast.error("Campaign name can't be empty");
      return;
    }

    setIsSavingGeneral(true);
    try {
      const res = await apiFetch("/api/creator/indiekit/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({
          projectId,
          action: "update_general",
          title: name.trim(),
          currency: selectedCurrency,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save settings");
      }

      toast.success("General settings saved");
      onRefresh?.();
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
        <CardDescription>Campaign name, display currency, and image</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="general-name">Campaign Name</Label>
              <Input
                id="general-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={200}
              />
            </div>

            <div className="space-y-2">
              <Label>Display Currency</Label>
              <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                <SelectTrigger className="w-full sm:w-[240px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DISPLAY_CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                What your campaign page shows amounts in (converted daily at ECB rates).
                Pledges are still charged and settled in USD.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Project Image</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleImageChange}
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingImage}
              >
                {isUploadingImage ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading...</>
                ) : (
                  <><ImageIcon className="h-4 w-4 mr-2" />Change Image</>
                )}
              </Button>
            </div>

            <Button
              className="bg-teal-600 hover:bg-teal-700"
              onClick={handleSaveGeneral}
              disabled={isSavingGeneral}
            >
              {isSavingGeneral ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
              ) : (
                "Save Changes"
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
