"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Palette,
  Type,
  Layout,
  Layers,
  Sun,
  Moon,
  Monitor,
  Eye,
  RefreshCw,
  Save,
  Download,
  Undo2,
  Check,
  Copy,
} from "lucide-react";

// Preset themes
const presetThemes = [
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
    id: "modern-dark",
    name: "Modern Dark",
    primary: "#6366F1",
    secondary: "#0F172A",
    accent: "#F59E0B",
    background: "#0F172A",
    text: "#F1F5F9",
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

const fontOptions = [
  { value: "inter", label: "Inter", preview: "The quick brown fox" },
  { value: "roboto", label: "Roboto", preview: "The quick brown fox" },
  { value: "poppins", label: "Poppins", preview: "The quick brown fox" },
  { value: "open-sans", label: "Open Sans", preview: "The quick brown fox" },
  { value: "lato", label: "Lato", preview: "The quick brown fox" },
  { value: "montserrat", label: "Montserrat", preview: "The quick brown fox" },
  { value: "nunito", label: "Nunito", preview: "The quick brown fox" },
  { value: "source-sans", label: "Source Sans Pro", preview: "The quick brown fox" },
];

export default function ThemesPage() {
  const [activeTab, setActiveTab] = useState("colors");
  const [isSaving, setIsSaving] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string | null>("kickstarter");

  // Theme settings
  const [colors, setColors] = useState({
    primary: "#05CE78",
    primaryHover: "#04B86A",
    secondary: "#2B2D42",
    secondaryHover: "#3D3F57",
    accent: "#0A4D3C",
    background: "#FFFFFF",
    backgroundAlt: "#F8FAFC",
    text: "#1A1A1A",
    textMuted: "#64748B",
    border: "#E2E8F0",
    success: "#22C55E",
    warning: "#F59E0B",
    error: "#EF4444",
    info: "#3B82F6",
  });

  const [typography, setTypography] = useState({
    headingFont: "inter",
    bodyFont: "inter",
    baseSize: 16,
    scaleRatio: 1.25,
    lineHeight: 1.5,
    letterSpacing: 0,
    headingWeight: "700",
    bodyWeight: "400",
  });

  const [spacing, setSpacing] = useState({
    containerWidth: 1280,
    sectionPadding: 80,
    cardPadding: 24,
    buttonPadding: 16,
    borderRadius: 8,
    shadowIntensity: 50,
  });

  const [appearance, setAppearance] = useState({
    defaultMode: "system",
    allowUserToggle: true,
    animationsEnabled: true,
    reducedMotion: false,
    highContrast: false,
  });

  const applyPreset = (preset: typeof presetThemes[0]) => {
    setSelectedPreset(preset.id);
    setColors({
      ...colors,
      primary: preset.primary,
      secondary: preset.secondary,
      accent: preset.accent,
      background: preset.background,
      text: preset.text,
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSaving(false);
  };

  const copyToClipboard = (value: string) => {
    navigator.clipboard.writeText(value);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Themes & Styling</h1>
          <p className="text-zinc-500">Customize your platform&apos;s visual appearance</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline">
            <Undo2 className="mr-2 h-4 w-4" />
            Reset
          </Button>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Editor Panel */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="colors">
                <Palette className="mr-2 h-4 w-4" />
                Colors
              </TabsTrigger>
              <TabsTrigger value="typography">
                <Type className="mr-2 h-4 w-4" />
                Typography
              </TabsTrigger>
              <TabsTrigger value="spacing">
                <Layout className="mr-2 h-4 w-4" />
                Spacing
              </TabsTrigger>
              <TabsTrigger value="appearance">
                <Layers className="mr-2 h-4 w-4" />
                Appearance
              </TabsTrigger>
            </TabsList>

            {/* Colors Tab */}
            <TabsContent value="colors" className="mt-6 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Preset Themes</CardTitle>
                  <CardDescription>Quick-start with a pre-designed color scheme</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 md:grid-cols-3">
                    {presetThemes.map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => applyPreset(preset)}
                        className={`relative rounded-lg border p-4 text-left transition-all hover:shadow-md ${
                          selectedPreset === preset.id ? "border-emerald-500 ring-2 ring-emerald-500/20" : ""
                        }`}
                      >
                        {selectedPreset === preset.id && (
                          <div className="absolute -right-1 -top-1 rounded-full bg-emerald-500 p-1">
                            <Check className="h-3 w-3 text-white" />
                          </div>
                        )}
                        <div className="flex gap-1">
                          <div
                            className="h-8 w-8 rounded"
                            style={{ backgroundColor: preset.primary }}
                          />
                          <div
                            className="h-8 w-8 rounded"
                            style={{ backgroundColor: preset.secondary }}
                          />
                          <div
                            className="h-8 w-8 rounded"
                            style={{ backgroundColor: preset.accent }}
                          />
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
                  <CardDescription>Primary colors used throughout the platform</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-3">
                      <Label>Primary Color</Label>
                      <div className="flex gap-2">
                        <div
                          className="h-10 w-10 rounded-lg border"
                          style={{ backgroundColor: colors.primary }}
                        />
                        <Input
                          value={colors.primary}
                          onChange={(e) => setColors({ ...colors, primary: e.target.value })}
                          className="font-mono"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyToClipboard(colors.primary)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label>Primary Hover</Label>
                      <div className="flex gap-2">
                        <div
                          className="h-10 w-10 rounded-lg border"
                          style={{ backgroundColor: colors.primaryHover }}
                        />
                        <Input
                          value={colors.primaryHover}
                          onChange={(e) => setColors({ ...colors, primaryHover: e.target.value })}
                          className="font-mono"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label>Secondary Color</Label>
                      <div className="flex gap-2">
                        <div
                          className="h-10 w-10 rounded-lg border"
                          style={{ backgroundColor: colors.secondary }}
                        />
                        <Input
                          value={colors.secondary}
                          onChange={(e) => setColors({ ...colors, secondary: e.target.value })}
                          className="font-mono"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label>Accent Color</Label>
                      <div className="flex gap-2">
                        <div
                          className="h-10 w-10 rounded-lg border"
                          style={{ backgroundColor: colors.accent }}
                        />
                        <Input
                          value={colors.accent}
                          onChange={(e) => setColors({ ...colors, accent: e.target.value })}
                          className="font-mono"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Background & Text</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-3">
                      <Label>Background</Label>
                      <div className="flex gap-2">
                        <div
                          className="h-10 w-10 rounded-lg border"
                          style={{ backgroundColor: colors.background }}
                        />
                        <Input
                          value={colors.background}
                          onChange={(e) => setColors({ ...colors, background: e.target.value })}
                          className="font-mono"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label>Background Alt</Label>
                      <div className="flex gap-2">
                        <div
                          className="h-10 w-10 rounded-lg border"
                          style={{ backgroundColor: colors.backgroundAlt }}
                        />
                        <Input
                          value={colors.backgroundAlt}
                          onChange={(e) => setColors({ ...colors, backgroundAlt: e.target.value })}
                          className="font-mono"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label>Text Color</Label>
                      <div className="flex gap-2">
                        <div
                          className="h-10 w-10 rounded-lg border"
                          style={{ backgroundColor: colors.text }}
                        />
                        <Input
                          value={colors.text}
                          onChange={(e) => setColors({ ...colors, text: e.target.value })}
                          className="font-mono"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label>Muted Text</Label>
                      <div className="flex gap-2">
                        <div
                          className="h-10 w-10 rounded-lg border"
                          style={{ backgroundColor: colors.textMuted }}
                        />
                        <Input
                          value={colors.textMuted}
                          onChange={(e) => setColors({ ...colors, textMuted: e.target.value })}
                          className="font-mono"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Status Colors</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 md:grid-cols-4">
                    <div className="space-y-3">
                      <Label>Success</Label>
                      <div className="flex gap-2">
                        <div
                          className="h-10 w-10 rounded-lg border"
                          style={{ backgroundColor: colors.success }}
                        />
                        <Input
                          value={colors.success}
                          onChange={(e) => setColors({ ...colors, success: e.target.value })}
                          className="font-mono text-xs"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label>Warning</Label>
                      <div className="flex gap-2">
                        <div
                          className="h-10 w-10 rounded-lg border"
                          style={{ backgroundColor: colors.warning }}
                        />
                        <Input
                          value={colors.warning}
                          onChange={(e) => setColors({ ...colors, warning: e.target.value })}
                          className="font-mono text-xs"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label>Error</Label>
                      <div className="flex gap-2">
                        <div
                          className="h-10 w-10 rounded-lg border"
                          style={{ backgroundColor: colors.error }}
                        />
                        <Input
                          value={colors.error}
                          onChange={(e) => setColors({ ...colors, error: e.target.value })}
                          className="font-mono text-xs"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label>Info</Label>
                      <div className="flex gap-2">
                        <div
                          className="h-10 w-10 rounded-lg border"
                          style={{ backgroundColor: colors.info }}
                        />
                        <Input
                          value={colors.info}
                          onChange={(e) => setColors({ ...colors, info: e.target.value })}
                          className="font-mono text-xs"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Typography Tab */}
            <TabsContent value="typography" className="mt-6 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Font Families</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-3">
                      <Label>Heading Font</Label>
                      <Select
                        value={typography.headingFont}
                        onValueChange={(v) => setTypography({ ...typography, headingFont: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {fontOptions.map((font) => (
                            <SelectItem key={font.value} value={font.value}>
                              {font.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-3">
                      <Label>Body Font</Label>
                      <Select
                        value={typography.bodyFont}
                        onValueChange={(v) => setTypography({ ...typography, bodyFont: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {fontOptions.map((font) => (
                            <SelectItem key={font.value} value={font.value}>
                              {font.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Font Sizes & Scaling</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-3">
                      <Label>Base Font Size ({typography.baseSize}px)</Label>
                      <Slider
                        value={[typography.baseSize]}
                        onValueChange={([v]) => setTypography({ ...typography, baseSize: v })}
                        min={12}
                        max={20}
                        step={1}
                      />
                    </div>

                    <div className="space-y-3">
                      <Label>Type Scale ({typography.scaleRatio})</Label>
                      <Slider
                        value={[typography.scaleRatio * 100]}
                        onValueChange={([v]) => setTypography({ ...typography, scaleRatio: v / 100 })}
                        min={110}
                        max={150}
                        step={5}
                      />
                    </div>

                    <div className="space-y-3">
                      <Label>Line Height ({typography.lineHeight})</Label>
                      <Slider
                        value={[typography.lineHeight * 100]}
                        onValueChange={([v]) => setTypography({ ...typography, lineHeight: v / 100 })}
                        min={120}
                        max={200}
                        step={10}
                      />
                    </div>

                    <div className="space-y-3">
                      <Label>Letter Spacing ({typography.letterSpacing}px)</Label>
                      <Slider
                        value={[typography.letterSpacing + 2]}
                        onValueChange={([v]) => setTypography({ ...typography, letterSpacing: v - 2 })}
                        min={0}
                        max={4}
                        step={0.5}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Font Weights</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-3">
                      <Label>Heading Weight</Label>
                      <Select
                        value={typography.headingWeight}
                        onValueChange={(v) => setTypography({ ...typography, headingWeight: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="400">Regular (400)</SelectItem>
                          <SelectItem value="500">Medium (500)</SelectItem>
                          <SelectItem value="600">Semibold (600)</SelectItem>
                          <SelectItem value="700">Bold (700)</SelectItem>
                          <SelectItem value="800">Extra Bold (800)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-3">
                      <Label>Body Weight</Label>
                      <Select
                        value={typography.bodyWeight}
                        onValueChange={(v) => setTypography({ ...typography, bodyWeight: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="300">Light (300)</SelectItem>
                          <SelectItem value="400">Regular (400)</SelectItem>
                          <SelectItem value="500">Medium (500)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Spacing Tab */}
            <TabsContent value="spacing" className="mt-6 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Layout</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <Label>Max Container Width ({spacing.containerWidth}px)</Label>
                    <Slider
                      value={[spacing.containerWidth]}
                      onValueChange={([v]) => setSpacing({ ...spacing, containerWidth: v })}
                      min={960}
                      max={1536}
                      step={16}
                    />
                  </div>

                  <div className="space-y-3">
                    <Label>Section Padding ({spacing.sectionPadding}px)</Label>
                    <Slider
                      value={[spacing.sectionPadding]}
                      onValueChange={([v]) => setSpacing({ ...spacing, sectionPadding: v })}
                      min={40}
                      max={120}
                      step={8}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Components</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-3">
                      <Label>Card Padding ({spacing.cardPadding}px)</Label>
                      <Slider
                        value={[spacing.cardPadding]}
                        onValueChange={([v]) => setSpacing({ ...spacing, cardPadding: v })}
                        min={12}
                        max={48}
                        step={4}
                      />
                    </div>

                    <div className="space-y-3">
                      <Label>Button Padding ({spacing.buttonPadding}px)</Label>
                      <Slider
                        value={[spacing.buttonPadding]}
                        onValueChange={([v]) => setSpacing({ ...spacing, buttonPadding: v })}
                        min={8}
                        max={24}
                        step={2}
                      />
                    </div>

                    <div className="space-y-3">
                      <Label>Border Radius ({spacing.borderRadius}px)</Label>
                      <Slider
                        value={[spacing.borderRadius]}
                        onValueChange={([v]) => setSpacing({ ...spacing, borderRadius: v })}
                        min={0}
                        max={24}
                        step={2}
                      />
                    </div>

                    <div className="space-y-3">
                      <Label>Shadow Intensity ({spacing.shadowIntensity}%)</Label>
                      <Slider
                        value={[spacing.shadowIntensity]}
                        onValueChange={([v]) => setSpacing({ ...spacing, shadowIntensity: v })}
                        min={0}
                        max={100}
                        step={10}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Appearance Tab */}
            <TabsContent value="appearance" className="mt-6 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Color Mode</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    {[
                      { value: "light", label: "Light", icon: Sun },
                      { value: "dark", label: "Dark", icon: Moon },
                      { value: "system", label: "System", icon: Monitor },
                    ].map(({ value, label, icon: Icon }) => (
                      <button
                        key={value}
                        onClick={() => setAppearance({ ...appearance, defaultMode: value })}
                        className={`flex items-center gap-3 rounded-lg border p-4 transition-all hover:shadow-md ${
                          appearance.defaultMode === value
                            ? "border-emerald-500 ring-2 ring-emerald-500/20"
                            : ""
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                        <span className="font-medium">{label}</span>
                        {appearance.defaultMode === value && (
                          <Check className="ml-auto h-4 w-4 text-emerald-500" />
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <Label>Allow User Toggle</Label>
                      <p className="text-sm text-zinc-500">Let users switch between light and dark mode</p>
                    </div>
                    <Switch
                      checked={appearance.allowUserToggle}
                      onCheckedChange={(checked) =>
                        setAppearance({ ...appearance, allowUserToggle: checked })
                      }
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Accessibility</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <Label>Animations</Label>
                      <p className="text-sm text-zinc-500">Enable smooth animations and transitions</p>
                    </div>
                    <Switch
                      checked={appearance.animationsEnabled}
                      onCheckedChange={(checked) =>
                        setAppearance({ ...appearance, animationsEnabled: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <Label>Reduced Motion</Label>
                      <p className="text-sm text-zinc-500">Respect user&apos;s reduced motion preference</p>
                    </div>
                    <Switch
                      checked={appearance.reducedMotion}
                      onCheckedChange={(checked) =>
                        setAppearance({ ...appearance, reducedMotion: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <Label>High Contrast Mode</Label>
                      <p className="text-sm text-zinc-500">Increase contrast for better visibility</p>
                    </div>
                    <Switch
                      checked={appearance.highContrast}
                      onCheckedChange={(checked) =>
                        setAppearance({ ...appearance, highContrast: checked })
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Live Preview Panel */}
        <div className="space-y-6">
          <Card className="sticky top-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Live Preview
                </CardTitle>
                <Button variant="ghost" size="sm">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Mini preview */}
              <div
                className="rounded-lg border overflow-hidden"
                style={{
                  backgroundColor: colors.background,
                  color: colors.text,
                }}
              >
                {/* Header preview */}
                <div
                  className="p-4 border-b"
                  style={{ borderColor: colors.border }}
                >
                  <div className="flex items-center justify-between">
                    <div
                      className="text-lg font-bold"
                      style={{ color: colors.primary }}
                    >
                      IndieCrowdfund
                    </div>
                    <button
                      className="px-3 py-1 rounded text-sm text-white"
                      style={{
                        backgroundColor: colors.primary,
                        borderRadius: `${spacing.borderRadius}px`,
                      }}
                    >
                      Start Project
                    </button>
                  </div>
                </div>

                {/* Content preview */}
                <div className="p-4 space-y-4">
                  <div
                    className="rounded-lg border p-4"
                    style={{
                      borderColor: colors.border,
                      backgroundColor: colors.backgroundAlt,
                      borderRadius: `${spacing.borderRadius}px`,
                    }}
                  >
                    <div className="h-20 bg-zinc-200 rounded mb-3" />
                    <div
                      className="font-semibold"
                      style={{ fontWeight: parseInt(typography.headingWeight) }}
                    >
                      Sample Project Title
                    </div>
                    <p
                      className="text-sm mt-1"
                      style={{
                        color: colors.textMuted,
                        fontSize: `${typography.baseSize - 2}px`,
                        lineHeight: typography.lineHeight,
                      }}
                    >
                      This is a preview of how your content will look.
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                      <div
                        className="h-2 flex-1 rounded-full"
                        style={{ backgroundColor: colors.border }}
                      >
                        <div
                          className="h-2 rounded-full w-3/4"
                          style={{ backgroundColor: colors.success }}
                        />
                      </div>
                      <span
                        className="text-xs font-medium"
                        style={{ color: colors.success }}
                      >
                        75%
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Badge
                      style={{
                        backgroundColor: `${colors.primary}20`,
                        color: colors.primary,
                        borderRadius: `${spacing.borderRadius}px`,
                      }}
                    >
                      Technology
                    </Badge>
                    <Badge
                      style={{
                        backgroundColor: `${colors.secondary}20`,
                        color: colors.secondary,
                        borderRadius: `${spacing.borderRadius}px`,
                      }}
                    >
                      Featured
                    </Badge>
                  </div>

                  <div className="flex gap-2">
                    <button
                      className="flex-1 py-2 text-sm font-medium rounded text-white"
                      style={{
                        backgroundColor: colors.primary,
                        borderRadius: `${spacing.borderRadius}px`,
                      }}
                    >
                      Back Project
                    </button>
                    <button
                      className="flex-1 py-2 text-sm font-medium rounded border"
                      style={{
                        borderColor: colors.border,
                        color: colors.text,
                        borderRadius: `${spacing.borderRadius}px`,
                      }}
                    >
                      Share
                    </button>
                  </div>
                </div>
              </div>

              {/* Color swatches */}
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm font-medium mb-2">Color Palette</p>
                <div className="flex gap-1 flex-wrap">
                  {Object.entries(colors).slice(0, 8).map(([name, color]) => (
                    <div
                      key={name}
                      className="h-8 w-8 rounded border"
                      style={{ backgroundColor: color }}
                      title={name}
                    />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
