"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Edit2,
  Trash2,
  MoreVertical,
  RefreshCw,
  Save,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Megaphone,
  Brain,
  ShoppingBag,
  LayoutDashboard,
  Package,
  Eye,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  RotateCcw,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface PromoSlide {
  title: string;
  subtitle: string;
  features: string[];
  iconName: string;
  gradientFrom: string;
  gradientTo: string;
}

interface PromoPopup {
  id: string;
  isActive: boolean;
  showFrequency: string;
  slides: PromoSlide[];
}

const iconOptions = [
  { value: "Sparkles", label: "Sparkles (AI)" },
  { value: "Megaphone", label: "Megaphone (Marketing)" },
  { value: "Brain", label: "Brain (Algorithms)" },
  { value: "ShoppingBag", label: "Shopping Bag (Marketplace)" },
  { value: "LayoutDashboard", label: "Dashboard" },
  { value: "Package", label: "Package (Fulfillment)" },
];

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Sparkles,
  Megaphone,
  Brain,
  ShoppingBag,
  LayoutDashboard,
  Package,
};

const gradientPresets = [
  { from: "#6366f1", to: "#8b5cf6", label: "Purple" },
  { from: "#ec4899", to: "#f43f5e", label: "Pink" },
  { from: "#14b8a6", to: "#06b6d4", label: "Teal" },
  { from: "#f59e0b", to: "#f97316", label: "Orange" },
  { from: "#3b82f6", to: "#2563eb", label: "Blue" },
  { from: "#10b981", to: "#059669", label: "Green" },
];

export default function PromoPopupPage() {
  const [popup, setPopup] = useState<PromoPopup | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Slide editor state
  const [isSlideDialogOpen, setIsSlideDialogOpen] = useState(false);
  const [editingSlideIndex, setEditingSlideIndex] = useState<number | null>(null);
  const [editingSlide, setEditingSlide] = useState<PromoSlide>({
    title: "",
    subtitle: "",
    features: [""],
    iconName: "Sparkles",
    gradientFrom: "#6366f1",
    gradientTo: "#8b5cf6",
  });

  // Preview state
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewSlide, setPreviewSlide] = useState(0);

  const fetchPopup = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/admin/promo-popup");

      if (!response.ok) throw new Error("Failed to fetch");

      const data = await response.json();
      setPopup(data.popup);
    } catch (error) {
      console.error("Fetch error:", error);
      toast.error("Failed to load promotional popup");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPopup();
  }, [fetchPopup]);

  const handleSave = async () => {
    if (!popup) return;

    setIsSaving(true);
    try {
      const response = await apiFetch("/api/admin/promo-popup", {
        method: "PUT",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify(popup),
      });

      if (!response.ok) throw new Error("Failed to save");

      const data = await response.json();
      setPopup(data.popup);
      toast.success("Promotional popup saved");
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save promotional popup");
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefaults = async () => {
    setIsResetting(true);
    try {
      const response = await apiFetch("/api/admin/promo-popup", {
        method: "POST",
        headers: { "Content-Type": "application/json", },
      });

      if (!response.ok) throw new Error("Failed to reset");

      const data = await response.json();
      setPopup(data.popup);
      toast.success("Slides reset to defaults");
    } catch (error) {
      console.error("Reset error:", error);
      toast.error("Failed to reset slides");
    } finally {
      setIsResetting(false);
    }
  };

  const openSlideEditor = (index: number | null) => {
    if (index !== null && popup) {
      setEditingSlide({ ...popup.slides[index] });
      setEditingSlideIndex(index);
    } else {
      setEditingSlide({
        title: "",
        subtitle: "",
        features: [""],
        iconName: "Sparkles",
        gradientFrom: "#6366f1",
        gradientTo: "#8b5cf6",
      });
      setEditingSlideIndex(null);
    }
    setIsSlideDialogOpen(true);
  };

  const handleSaveSlide = () => {
    if (!popup) return;
    if (!editingSlide.title.trim()) {
      toast.error("Slide title is required");
      return;
    }

    // Filter out empty features
    const cleanedSlide = {
      ...editingSlide,
      features: editingSlide.features.filter((f) => f.trim() !== ""),
    };

    const newSlides = [...popup.slides];
    if (editingSlideIndex !== null) {
      newSlides[editingSlideIndex] = cleanedSlide;
    } else {
      newSlides.push(cleanedSlide);
    }

    setPopup({ ...popup, slides: newSlides });
    setIsSlideDialogOpen(false);
    toast.info("Slide updated — click Save Changes to persist");
  };

  const handleDeleteSlide = (index: number) => {
    if (!popup) return;
    const newSlides = popup.slides.filter((_, i) => i !== index);
    setPopup({ ...popup, slides: newSlides });
    toast.info("Slide removed — click Save Changes to persist");
  };

  const handleMoveSlide = (index: number, direction: "up" | "down") => {
    if (!popup) return;
    const newSlides = [...popup.slides];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newSlides.length) return;

    [newSlides[index], newSlides[targetIndex]] = [newSlides[targetIndex], newSlides[index]];
    setPopup({ ...popup, slides: newSlides });
  };

  const addFeature = () => {
    setEditingSlide({
      ...editingSlide,
      features: [...editingSlide.features, ""],
    });
  };

  const removeFeature = (index: number) => {
    setEditingSlide({
      ...editingSlide,
      features: editingSlide.features.filter((_, i) => i !== index),
    });
  };

  const updateFeature = (index: number, value: string) => {
    const newFeatures = [...editingSlide.features];
    newFeatures[index] = value;
    setEditingSlide({ ...editingSlide, features: newFeatures });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!popup) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Failed to load promotional popup settings.</p>
        <Button onClick={fetchPopup} className="mt-4">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Promotional Popup</h1>
          <p className="text-muted-foreground">
            Configure the feature tour popup that displays to new visitors
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => { setPreviewSlide(0); setIsPreviewOpen(true); }}>
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle>Popup Settings</CardTitle>
          <CardDescription>Control when and how the popup appears</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">Active</Label>
              <p className="text-sm text-muted-foreground">
                Show the promotional popup to visitors
              </p>
            </div>
            <Switch
              checked={popup.isActive}
              onCheckedChange={(checked) => setPopup({ ...popup, isActive: checked })}
            />
          </div>

          <div className="space-y-2">
            <Label>Display Frequency</Label>
            <Select
              value={popup.showFrequency}
              onValueChange={(value) => setPopup({ ...popup, showFrequency: value })}
            >
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="once_per_session">Once per session</SelectItem>
                <SelectItem value="once_per_login">Once per login session</SelectItem>
                <SelectItem value="once_per_day">Once per day</SelectItem>
                <SelectItem value="every_visit">Every page load</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Slides Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Slides ({popup.slides.length})</CardTitle>
              <CardDescription>Each slide highlights a feature area of the platform</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleResetToDefaults} disabled={isResetting}>
                {isResetting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4 mr-2" />
                )}
                Reset to Defaults
              </Button>
              <Button size="sm" onClick={() => openSlideEditor(null)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Slide
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {popup.slides.map((slide, index) => {
              const IconComp = iconMap[slide.iconName] || Sparkles;
              return (
                <div
                  key={index}
                  className="flex items-center gap-4 p-4 rounded-lg border"
                >
                  {/* Slide icon with gradient background */}
                  <div
                    className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-white"
                    style={{
                      background: `linear-gradient(135deg, ${slide.gradientFrom}, ${slide.gradientTo})`,
                    }}
                  >
                    <IconComp className="h-6 w-6" />
                  </div>

                  {/* Slide info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium truncate">{slide.title}</h4>
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {slide.features.length} features
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{slide.subtitle}</p>
                  </div>

                  {/* Order buttons */}
                  <div className="flex flex-col gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleMoveSlide(index, "up")}
                      disabled={index === 0}
                    >
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleMoveSlide(index, "down")}
                      disabled={index === popup.slides.length - 1}
                    >
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* Actions */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openSlideEditor(index)}>
                        <Edit2 className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => { setPreviewSlide(index); setIsPreviewOpen(true); }}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Preview
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => handleDeleteSlide(index)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}

            {popup.slides.length === 0 && (
              <div className="text-center py-12">
                <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold mb-2">No slides configured</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Add slides to create the promotional popup, or reset to defaults.
                </p>
                <div className="flex items-center justify-center gap-2">
                  <Button variant="outline" onClick={handleResetToDefaults}>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Load Defaults
                  </Button>
                  <Button onClick={() => openSlideEditor(null)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Slide
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Slide Editor Dialog */}
      <Dialog open={isSlideDialogOpen} onOpenChange={setIsSlideDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSlideIndex !== null ? "Edit Slide" : "Add Slide"}</DialogTitle>
            <DialogDescription>
              Configure the content and appearance of this feature slide
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Title */}
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                placeholder="e.g., AI-Powered Campaign Tools"
                value={editingSlide.title}
                onChange={(e) => setEditingSlide({ ...editingSlide, title: e.target.value })}
              />
            </div>

            {/* Subtitle */}
            <div className="space-y-2">
              <Label>Subtitle</Label>
              <Input
                placeholder="Brief description of this feature area"
                value={editingSlide.subtitle}
                onChange={(e) => setEditingSlide({ ...editingSlide, subtitle: e.target.value })}
              />
            </div>

            {/* Icon */}
            <div className="space-y-2">
              <Label>Icon</Label>
              <Select
                value={editingSlide.iconName}
                onValueChange={(value) => setEditingSlide({ ...editingSlide, iconName: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {iconOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Gradient */}
            <div className="space-y-2">
              <Label>Background Gradient</Label>
              <div className="flex flex-wrap gap-2">
                {gradientPresets.map((preset) => (
                  <button
                    key={preset.label}
                    className={`w-10 h-10 rounded-lg border-2 transition-all ${
                      editingSlide.gradientFrom === preset.from && editingSlide.gradientTo === preset.to
                        ? "border-primary scale-110"
                        : "border-transparent"
                    }`}
                    style={{
                      background: `linear-gradient(135deg, ${preset.from}, ${preset.to})`,
                    }}
                    onClick={() =>
                      setEditingSlide({
                        ...editingSlide,
                        gradientFrom: preset.from,
                        gradientTo: preset.to,
                      })
                    }
                    title={preset.label}
                  />
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">From</Label>
                  <Input
                    type="color"
                    value={editingSlide.gradientFrom}
                    onChange={(e) => setEditingSlide({ ...editingSlide, gradientFrom: e.target.value })}
                    className="h-8 p-1"
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">To</Label>
                  <Input
                    type="color"
                    value={editingSlide.gradientTo}
                    onChange={(e) => setEditingSlide({ ...editingSlide, gradientTo: e.target.value })}
                    className="h-8 p-1"
                  />
                </div>
              </div>
            </div>

            {/* Features */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Features</Label>
                <Button variant="ghost" size="sm" onClick={addFeature}>
                  <Plus className="h-3 w-3 mr-1" />
                  Add
                </Button>
              </div>
              <div className="space-y-2">
                {editingSlide.features.map((feature, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Textarea
                      value={feature}
                      onChange={(e) => updateFeature(i, e.target.value)}
                      placeholder="Feature description"
                      className="min-h-[38px] resize-none"
                      rows={1}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-red-600"
                      onClick={() => removeFeature(i)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSlideDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSlide}>
              <Save className="h-4 w-4 mr-2" />
              {editingSlideIndex !== null ? "Update Slide" : "Add Slide"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      {isPreviewOpen && popup.slides.length > 0 && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setIsPreviewOpen(false)}
          />
          <div className="relative w-full max-w-2xl max-h-[calc(100dvh-2rem)] rounded-2xl overflow-x-hidden overflow-y-auto shadow-2xl">
            <button
              onClick={() => setIsPreviewOpen(false)}
              className="absolute top-4 right-4 z-10 rounded-full p-1.5 bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            {(() => {
              const slide = popup.slides[previewSlide];
              const IconComp = iconMap[slide.iconName] || Sparkles;
              return (
                <div
                  className="relative p-8 pb-6 text-white min-h-[480px] flex flex-col"
                  style={{
                    background: `linear-gradient(135deg, ${slide.gradientFrom} 0%, ${slide.gradientTo} 100%)`,
                  }}
                >
                  <div
                    className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-10"
                    style={{ background: "white", transform: "translate(30%, -30%)" }}
                  />
                  <div
                    className="absolute bottom-0 left-0 w-48 h-48 rounded-full opacity-10"
                    style={{ background: "white", transform: "translate(-30%, 30%)" }}
                  />

                  <div className="relative z-[1] mb-6">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm mb-4">
                      <IconComp className="h-7 w-7" />
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight">{slide.title}</h2>
                    <p className="text-white/80 mt-1 text-sm">{slide.subtitle}</p>
                  </div>

                  <div className="relative z-[1] flex-1 space-y-2.5">
                    {slide.features.map((feature, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                          <Check className="h-3 w-3" />
                        </div>
                        <span className="text-sm text-white/90 leading-snug">{feature}</span>
                      </div>
                    ))}
                  </div>

                  <div className="relative z-[1] flex items-center justify-between mt-6 pt-4 border-t border-white/20">
                    <div className="flex items-center gap-1.5">
                      {popup.slides.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setPreviewSlide(i)}
                          className={`h-2 rounded-full transition-all ${
                            i === previewSlide
                              ? "w-6 bg-white"
                              : "w-2 bg-white/40 hover:bg-white/60"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-white/60">
                      {previewSlide + 1} / {popup.slides.length}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setPreviewSlide((p) => Math.max(0, p - 1))}
                        disabled={previewSlide === 0}
                        className="h-9 w-9 rounded-full text-white hover:bg-white/20 disabled:opacity-30"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </Button>
                      {previewSlide === popup.slides.length - 1 ? (
                        <Button
                          onClick={() => setIsPreviewOpen(false)}
                          className="h-9 px-4 rounded-full bg-white text-gray-900 hover:bg-white/90 text-sm font-medium"
                        >
                          Get Started
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setPreviewSlide((p) => Math.min(popup.slides.length - 1, p + 1))}
                          className="h-9 w-9 rounded-full text-white hover:bg-white/20"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
