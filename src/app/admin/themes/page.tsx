"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Palette, Layers, Sparkles, Save, RefreshCw, Undo2, Check } from "lucide-react";
import { EffectsPanel } from "./effects-panel";

/**
 * Themes & Styling.
 *
 * Rebuilt from a page whose Save had never once succeeded (its payload
 * never matched the API's allowed fields — every save was a 400) and
 * whose typography/spacing tabs edited values nothing on the site
 * could consume. What remains is exactly what the site really applies:
 *
 *  - Light-palette brand colors -> CSS tokens injected by the root
 *    layout (dark mode keeps its designed palette)
 *  - Corner radius -> --radius (both themes)
 *  - Default mode for first-time visitors
 *  - The Effects panel (scanlines, marquee, tilt, ...), which was
 *    already real
 *
 * Everything saves into PlatformSettings.themeConfig and takes effect
 * on the site within a minute (server-side 60s cache).
 */

const presetThemes = [
  {
    id: "indiecrowdfund",
    name: "IndieCrowdFund",
    primary: "#0E9F6E",
    secondary: "#4F46E5",
    accent: "#10B981",
    background: "#F7FAF9",
    text: "#182420",
  },
  {
    id: "kickstarter",
    name: "Kickstarter Classic",
    primary: "#05CE78",
    secondary: "#2B2D42",
    accent: "#0A4D3C",
    background: "#FFFFFF",
    text: "#1A1A1A",
  },
  {
    id: "indiegogo",
    name: "Indiegogo Style",
    primary: "#E51075",
    secondary: "#1F1F1F",
    accent: "#FF6B6B",
    background: "#FFFFFF",
    text: "#1F1F1F",
  },
  {
    id: "ocean",
    name: "Ocean Breeze",
    primary: "#0EA5E9",
    secondary: "#164E63",
    accent: "#22D3EE",
    background: "#F0F9FF",
    text: "#0C4A6E",
  },
  {
    id: "forest",
    name: "Forest Green",
    primary: "#22C55E",
    secondary: "#14532D",
    accent: "#86EFAC",
    background: "#F0FDF4",
    text: "#14532D",
  },
  {
    id: "sunset",
    name: "Sunset Glow",
    primary: "#F97316",
    secondary: "#7C2D12",
    accent: "#FB923C",
    background: "#FFF7ED",
    text: "#431407",
  },
];

interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
  textMuted: string;
  border: string;
}

const DEFAULT_COLORS: ThemeColors = {
  primary: "#0E9F6E",
  secondary: "#4F46E5",
  accent: "#10B981",
  background: "#F7FAF9",
  text: "#182420",
  textMuted: "#5B6E66",
  border: "#DDE5E1",
};

const COLOR_FIELDS: Array<{ key: keyof ThemeColors; label: string; hint: string }> = [
  { key: "primary", label: "Primary", hint: "Buttons, links, focus states" },
  { key: "secondary", label: "Secondary", hint: "Secondary buttons and highlights" },
  { key: "accent", label: "Accent", hint: "Badges, accents, small highlights" },
  { key: "background", label: "Background", hint: "Page background (light mode)" },
  { key: "text", label: "Text", hint: "Main text color" },
  { key: "textMuted", label: "Muted text", hint: "Captions and secondary text" },
  { key: "border", label: "Borders", hint: "Card and input borders" },
];

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export default function ThemesPage() {
  const [activeTab, setActiveTab] = useState("colors");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [colors, setColors] = useState<ThemeColors>(DEFAULT_COLORS);
  const [borderRadius, setBorderRadius] = useState(12);
  const [defaultMode, setDefaultMode] = useState<"light" | "dark" | "system">("light");

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/settings");
      if (response.ok) {
        const data = await response.json();
        const theme = data.settings?.themeConfig;
        if (theme) {
          if (theme.colors) setColors((prev) => ({ ...prev, ...theme.colors }));
          if (typeof theme.borderRadius === "number") setBorderRadius(theme.borderRadius);
          if (theme.defaultMode) setDefaultMode(theme.defaultMode);
          setSelectedPreset(theme.preset ?? null);
        }
      }
    } catch {
      setSaveMessage("Failed to load theme settings");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const applyPreset = (preset: (typeof presetThemes)[0]) => {
    setSelectedPreset(preset.id);
    setColors((prev) => ({
      ...prev,
      primary: preset.primary,
      secondary: preset.secondary,
      accent: preset.accent,
      background: preset.background,
      text: preset.text,
    }));
  };

  const setColor = (key: keyof ThemeColors, value: string) => {
    setSelectedPreset(null);
    setColors((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    const bad = COLOR_FIELDS.find((f) => !HEX_RE.test(colors[f.key]));
    if (bad) {
      setSaveMessage(`Failed: ${bad.label} is not a valid hex color`);
      return;
    }

    setIsSaving(true);
    setSaveMessage(null);
    try {
      const response = await apiFetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: "theme",
          data: {
            themeConfig: {
              colors,
              borderRadius,
              defaultMode,
              preset: selectedPreset,
            },
          },
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Failed to save settings");
      setSaveMessage("Saved — live on the site within a minute");
      setTimeout(() => setSaveMessage(null), 4000);
    } catch (error) {
      setSaveMessage(error instanceof Error ? `Failed: ${error.message}` : "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white sm:text-2xl">
            Themes &amp; Styling
          </h1>
          <p className="text-muted-foreground">
            Brand colors and appearance — applied to the site&apos;s light theme.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {saveMessage && (
            <span
              className={`text-sm ${saveMessage.startsWith("Failed") ? "text-red-600" : "text-emerald-600"}`}
            >
              {saveMessage}
            </span>
          )}
          <Button variant="outline" onClick={loadSettings} className="flex-1 sm:flex-none">
            <Undo2 className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Reset</span>
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="flex-1 sm:flex-none">
            {isSaving ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin sm:mr-2" />
                <span className="hidden sm:inline">Saving...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Save Changes</span>
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="space-y-6 md:col-span-2">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="flex w-full overflow-x-auto md:grid md:grid-cols-3">
              <TabsTrigger value="colors" className="whitespace-nowrap">
                <Palette className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Colors</span>
              </TabsTrigger>
              <TabsTrigger value="appearance" className="whitespace-nowrap">
                <Layers className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Appearance</span>
              </TabsTrigger>
              <TabsTrigger value="effects" className="whitespace-nowrap">
                <Sparkles className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Effects</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="colors" className="mt-6 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Preset Themes</CardTitle>
                  <CardDescription>Quick-start with a pre-designed color scheme</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                    {presetThemes.map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => applyPreset(preset)}
                        className={`relative rounded-lg border p-4 text-left transition-all hover:shadow-md ${
                          selectedPreset === preset.id
                            ? "border-emerald-500 ring-2 ring-emerald-500/20"
                            : ""
                        }`}
                      >
                        {selectedPreset === preset.id && (
                          <div className="absolute -right-1 -top-1 rounded-full bg-emerald-500 p-1">
                            <Check className="h-3 w-3 text-white" />
                          </div>
                        )}
                        <div className="flex gap-1">
                          <div className="h-8 w-8 rounded" style={{ backgroundColor: preset.primary }} />
                          <div className="h-8 w-8 rounded" style={{ backgroundColor: preset.secondary }} />
                          <div className="h-8 w-8 rounded" style={{ backgroundColor: preset.accent }} />
                        </div>
                        <p className="mt-2 font-medium">{preset.name}</p>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Brand Colors</CardTitle>
                  <CardDescription>
                    These override the site&apos;s light theme. Dark mode keeps its designed
                    palette.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {COLOR_FIELDS.map((field) => (
                    <div
                      key={field.key}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">{field.label}</p>
                        <p className="text-xs text-muted-foreground">{field.hint}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          aria-label={`${field.label} color`}
                          value={HEX_RE.test(colors[field.key]) ? colors[field.key] : "#000000"}
                          onChange={(e) => setColor(field.key, e.target.value)}
                          className="h-9 w-12 cursor-pointer rounded border bg-transparent p-0.5"
                        />
                        <Input
                          value={colors[field.key]}
                          onChange={(e) => setColor(field.key, e.target.value)}
                          className="w-28 font-mono text-sm"
                          maxLength={7}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="appearance" className="mt-6 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Appearance</CardTitle>
                  <CardDescription>Defaults that apply across the whole site</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label>Default theme for new visitors</Label>
                    <Select
                      value={defaultMode}
                      onValueChange={(v) => setDefaultMode(v as typeof defaultMode)}
                    >
                      <SelectTrigger className="w-56">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="system">Match visitor&apos;s system</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Visitors who already picked a theme keep their choice.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Corner radius</Label>
                      <span className="font-mono text-sm text-muted-foreground">{borderRadius}px</span>
                    </div>
                    <Slider
                      value={[borderRadius]}
                      min={0}
                      max={24}
                      step={1}
                      onValueChange={([v]) => setBorderRadius(v)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Roundness of cards, buttons, and inputs, in both themes.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="effects" className="mt-6">
              <EffectsPanel />
            </TabsContent>
          </Tabs>
        </div>

        {/* Live preview driven by the current (unsaved) values */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Preview</CardTitle>
              <CardDescription>Light theme with your colors, before saving</CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className="space-y-3 border p-4"
                style={{
                  backgroundColor: colors.background,
                  color: colors.text,
                  borderColor: colors.border,
                  borderRadius: `${borderRadius}px`,
                }}
              >
                <p className="font-semibold">Campaign Card</p>
                <p className="text-sm" style={{ color: colors.textMuted }}>
                  How cards, text, and buttons read with this palette.
                </p>
                <div
                  className="h-2 w-full overflow-hidden"
                  style={{ backgroundColor: colors.border, borderRadius: `${borderRadius}px` }}
                >
                  <div
                    className="h-full w-2/3"
                    style={{ backgroundColor: colors.primary, borderRadius: `${borderRadius}px` }}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <span
                    className="px-3 py-1.5 text-sm font-medium text-white"
                    style={{ backgroundColor: colors.primary, borderRadius: `${borderRadius}px` }}
                  >
                    Back this project
                  </span>
                  <span
                    className="px-3 py-1.5 text-sm font-medium text-white"
                    style={{ backgroundColor: colors.secondary, borderRadius: `${borderRadius}px` }}
                  >
                    Follow
                  </span>
                </div>
                <span
                  className="inline-block px-2 py-0.5 text-xs font-semibold text-white"
                  style={{ backgroundColor: colors.accent, borderRadius: `${borderRadius}px` }}
                >
                  FUNDED
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
