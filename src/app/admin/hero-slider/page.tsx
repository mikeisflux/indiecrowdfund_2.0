"use client";

import { getCSRFHeaders } from "@/lib/csrf";
import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";
import {
  Plus,
  Edit2,
  Trash2,
  MoreVertical,
  GripVertical,
  Eye,
  EyeOff,
  ImageIcon,
  Video,
  Youtube,
  RefreshCw,
  Save,
  ArrowUp,
  ArrowDown,
  Play,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

interface HeroSlide {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  buttonText: string | null;
  buttonLink: string | null;
  showPrimaryButton: boolean;
  secondaryButtonText: string | null;
  secondaryButtonLink: string | null;
  showSecondaryButton: boolean;
  mediaType: "IMAGE" | "YOUTUBE" | "VIDEO";
  imageUrl: string | null;
  videoUrl: string | null;
  videoThumbnail: string | null;
  videoAutoplay: boolean;
  videoMuted: boolean;
  videoLoop: boolean;
  textAlignment: string;
  overlayOpacity: number;
  textColor: string;
  showSubtitle: boolean;
  showDescription: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

const defaultSlide: Partial<HeroSlide> = {
  title: "",
  subtitle: "",
  description: "",
  buttonText: "Discover Projects",
  buttonLink: "/discover",
  showPrimaryButton: true,
  secondaryButtonText: "Start a Project",
  secondaryButtonLink: "/projects/new",
  showSecondaryButton: true,
  mediaType: "IMAGE",
  imageUrl: "",
  videoUrl: "",
  videoThumbnail: "",
  videoAutoplay: true,
  videoMuted: true,
  videoLoop: true,
  textAlignment: "center",
  overlayOpacity: 0,
  textColor: "white",
  showSubtitle: true,
  showDescription: true,
  isActive: true,
};

// Helper to extract YouTube video ID
function getYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?\s]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export default function HeroSliderPage() {
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0 });
  const [needsMigration, setNeedsMigration] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSlide, setEditingSlide] = useState<Partial<HeroSlide> | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Preview state
  const [previewSlide, setPreviewSlide] = useState<HeroSlide | null>(null);
  const [currentPreviewIndex, setCurrentPreviewIndex] = useState(0);

  // Run migration to create table and seed default slide
  const runMigration = async () => {
    setIsMigrating(true);
    try {
      const response = await fetch("/api/admin/hero-slides/migrate", {
        method: "POST",
        headers: getCSRFHeaders(),
      });
      const data = await response.json();
      if (response.ok) {
        toast.success(data.message || "Migration successful!");
        setNeedsMigration(false);
        fetchSlides();
      } else {
        toast.error(data.error || "Migration failed");
      }
    } catch (error) {
      console.error("Migration error:", error);
      toast.error("Migration failed");
    } finally {
      setIsMigrating(false);
    }
  };

  // Fetch slides
  const fetchSlides = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/hero-slides");
      if (response.ok) {
        const data = await response.json();
        setSlides(data.slides || []);
        setStats(data.stats || { total: 0, active: 0, inactive: 0 });
        setNeedsMigration(false);
      } else {
        // Check if it's a database error (table doesn't exist)
        const data = await response.json();
        if (data.error?.includes("does not exist") || data.error?.includes("relation")) {
          setNeedsMigration(true);
        } else {
          toast.error("Failed to load slides");
        }
      }
    } catch (error) {
      console.error("Failed to fetch slides:", error);
      setNeedsMigration(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSlides();
  }, [fetchSlides]);

  // Create or update slide
  const handleSave = async () => {
    if (!editingSlide?.title) {
      toast.error("Title is required");
      return;
    }

    setIsSaving(true);
    try {
      const method = isEditing ? "PUT" : "POST";
      const response = await fetch("/api/admin/hero-slides", {
        method,
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify(editingSlide),
      });

      if (response.ok) {
        toast.success(isEditing ? "Slide updated" : "Slide created");
        setIsDialogOpen(false);
        setEditingSlide(null);
        fetchSlides();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to save slide");
      }
    } catch (error) {
      console.error("Error saving slide:", error);
      toast.error("Failed to save slide");
    } finally {
      setIsSaving(false);
    }
  };

  // Delete slide
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this slide?")) return;

    try {
      const response = await fetch(`/api/admin/hero-slides?id=${id}`, {
        method: "DELETE",
        headers: getCSRFHeaders(),
      });

      if (response.ok) {
        toast.success("Slide deleted");
        fetchSlides();
      } else {
        toast.error("Failed to delete slide");
      }
    } catch (error) {
      console.error("Error deleting slide:", error);
      toast.error("Failed to delete slide");
    }
  };

  // Toggle active status
  const toggleActive = async (slide: HeroSlide) => {
    try {
      const response = await fetch("/api/admin/hero-slides", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({ id: slide.id, isActive: !slide.isActive }),
      });

      if (response.ok) {
        toast.success(slide.isActive ? "Slide hidden" : "Slide visible");
        fetchSlides();
      }
    } catch (error) {
      console.error("Error toggling slide:", error);
    }
  };

  // Move slide up/down
  const moveSlide = async (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= slides.length) return;

    const newSlides = [...slides];
    [newSlides[index], newSlides[newIndex]] = [newSlides[newIndex], newSlides[index]];

    try {
      const response = await fetch("/api/admin/hero-slides", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({ slideIds: newSlides.map((s) => s.id) }),
      });

      if (response.ok) {
        setSlides(newSlides);
        toast.success("Order updated");
      }
    } catch (error) {
      console.error("Error reordering:", error);
    }
  };

  // Open create dialog
  const openCreateDialog = () => {
    setEditingSlide({ ...defaultSlide });
    setIsEditing(false);
    setIsDialogOpen(true);
  };

  // Open edit dialog
  const openEditDialog = (slide: HeroSlide) => {
    setEditingSlide({ ...slide });
    setIsEditing(true);
    setIsDialogOpen(true);
  };

  // Preview navigation
  const activeSlides = slides.filter((s) => s.isActive);
  const nextPreview = () => {
    setCurrentPreviewIndex((prev) => (prev + 1) % activeSlides.length);
  };
  const prevPreview = () => {
    setCurrentPreviewIndex((prev) => (prev - 1 + activeSlides.length) % activeSlides.length);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (needsMigration) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white">Hero Slider</h1>
          <p className="text-zinc-500">Manage the hero section slides on the home page</p>
        </div>
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>Setup Required</CardTitle>
            <CardDescription>
              The Hero Slider table needs to be created in the database. Click the button below to set it up and create the default slide.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={runMigration} disabled={isMigrating} className="gap-2">
              {isMigrating ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Setting up...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Initialize Hero Slider
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white">Hero Slider</h1>
          <p className="text-zinc-500">Manage the hero section slides on the home page</p>
        </div>
        <Button onClick={openCreateDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Slide
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-sm text-zinc-500">Total Slides</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-emerald-600">{stats.active}</div>
            <p className="text-sm text-zinc-500">Active Slides</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-zinc-400">{stats.inactive}</div>
            <p className="text-sm text-zinc-500">Hidden Slides</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Slides List */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Slides</CardTitle>
              <CardDescription>Drag to reorder or use arrows. First active slide shows first.</CardDescription>
            </CardHeader>
            <CardContent>
              {slides.length === 0 ? (
                <div className="text-center py-12 text-zinc-500">
                  <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No slides yet. Create your first slide!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {slides.map((slide, index) => (
                    <div
                      key={slide.id}
                      className={`flex items-center gap-4 p-4 rounded-lg border transition-colors ${
                        slide.isActive ? "bg-background" : "bg-zinc-50 dark:bg-zinc-900 opacity-60"
                      }`}
                    >
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => moveSlide(index, "up")}
                          disabled={index === 0}
                          className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded disabled:opacity-30"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => moveSlide(index, "down")}
                          disabled={index === slides.length - 1}
                          className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded disabled:opacity-30"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </button>
                      </div>

                      <GripVertical className="h-5 w-5 text-zinc-400 cursor-grab" />

                      {/* Thumbnail */}
                      <div className="relative w-24 h-16 rounded overflow-hidden bg-zinc-100 dark:bg-zinc-800 flex-shrink-0">
                        {slide.imageUrl || slide.videoThumbnail ? (
                          <Image
                            src={slide.imageUrl || slide.videoThumbnail || ""}
                            alt={slide.title}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            {slide.mediaType === "YOUTUBE" && <Youtube className="h-6 w-6 text-red-500" />}
                            {slide.mediaType === "VIDEO" && <Video className="h-6 w-6 text-zinc-400" />}
                            {slide.mediaType === "IMAGE" && <ImageIcon className="h-6 w-6 text-zinc-400" />}
                          </div>
                        )}
                        {(slide.mediaType === "YOUTUBE" || slide.mediaType === "VIDEO") && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                            <Play className="h-6 w-6 text-white" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium truncate">{slide.title}</h3>
                          <Badge variant={slide.isActive ? "default" : "secondary"} className="text-xs">
                            {slide.isActive ? "Active" : "Hidden"}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {slide.mediaType === "YOUTUBE" ? "YouTube" : slide.mediaType === "VIDEO" ? "Video" : "Image"}
                          </Badge>
                        </div>
                        {slide.subtitle && (
                          <p className="text-sm text-zinc-500 truncate">{slide.subtitle}</p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleActive(slide)}
                          title={slide.isActive ? "Hide" : "Show"}
                        >
                          {slide.isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                        </Button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(slide)}>
                              <Edit2 className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setPreviewSlide(slide)}>
                              <Eye className="h-4 w-4 mr-2" />
                              Preview
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(slide.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Live Preview */}
        <div className="space-y-4">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Live Preview
              </CardTitle>
              <CardDescription>How the slider appears on the home page</CardDescription>
            </CardHeader>
            <CardContent>
              {activeSlides.length === 0 ? (
                <div className="aspect-video bg-zinc-100 dark:bg-zinc-800 rounded-lg flex items-center justify-center text-zinc-500">
                  No active slides
                </div>
              ) : (
                <div className="relative">
                  <div className="aspect-video bg-gradient-to-br from-primary/20 to-cyan-500/20 rounded-lg overflow-hidden relative">
                    {/* Preview content */}
                    {activeSlides[currentPreviewIndex]?.imageUrl && (
                      <Image
                        src={activeSlides[currentPreviewIndex].imageUrl!}
                        alt=""
                        fill
                        className="object-cover"
                      />
                    )}
                    {activeSlides[currentPreviewIndex]?.mediaType === "YOUTUBE" && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <Youtube className="h-12 w-12 text-red-500" />
                      </div>
                    )}

                    {/* Overlay */}
                    <div
                      className="absolute inset-0 bg-black"
                      style={{ opacity: (activeSlides[currentPreviewIndex]?.overlayOpacity || 0) / 100 }}
                    />

                    {/* Text content */}
                    <div
                      className={`absolute inset-0 flex flex-col justify-center p-4 text-white ${
                        activeSlides[currentPreviewIndex]?.textAlignment === "left"
                          ? "items-start"
                          : activeSlides[currentPreviewIndex]?.textAlignment === "right"
                          ? "items-end"
                          : "items-center text-center"
                      }`}
                    >
                      <h3 className="text-lg font-bold mb-1 drop-shadow-lg">
                        {activeSlides[currentPreviewIndex]?.title}
                      </h3>
                      {activeSlides[currentPreviewIndex]?.subtitle && (
                        <p className="text-sm opacity-90 drop-shadow">
                          {activeSlides[currentPreviewIndex].subtitle}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Navigation */}
                  {activeSlides.length > 1 && (
                    <>
                      <button
                        onClick={prevPreview}
                        className="absolute left-2 top-1/2 -translate-y-1/2 p-1 rounded-full bg-black/50 text-white hover:bg-black/70"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        onClick={nextPreview}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full bg-black/50 text-white hover:bg-black/70"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </>
                  )}

                  {/* Dots */}
                  {activeSlides.length > 1 && (
                    <div className="flex justify-center gap-1 mt-2">
                      {activeSlides.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => setCurrentPreviewIndex(idx)}
                          className={`w-2 h-2 rounded-full transition-colors ${
                            idx === currentPreviewIndex ? "bg-primary" : "bg-zinc-300"
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="mt-4 pt-4 border-t">
                <a
                  href="/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 text-sm text-primary hover:underline"
                >
                  View on Home Page
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Slide" : "Create New Slide"}</DialogTitle>
            <DialogDescription>
              Configure the slide content, media, and display settings.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Content */}
            <div className="space-y-4">
              <h4 className="font-medium">Content</h4>

              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={editingSlide?.title || ""}
                  onChange={(e) => setEditingSlide({ ...editingSlide, title: e.target.value })}
                  placeholder="Support Who You Love"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="subtitle">Subtitle</Label>
                <Input
                  id="subtitle"
                  value={editingSlide?.subtitle || ""}
                  onChange={(e) => setEditingSlide({ ...editingSlide, subtitle: e.target.value })}
                  placeholder="IndieCrowdfund leads the way!"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={editingSlide?.description || ""}
                  onChange={(e) => setEditingSlide({ ...editingSlide, description: e.target.value })}
                  placeholder="IndieCrowdfund is the future home to thousands of creative projects..."
                  rows={3}
                />
              </div>
            </div>

            {/* Buttons */}
            <div className="space-y-4">
              <h4 className="font-medium">Call to Action</h4>

              {/* Primary Button */}
              <div className="rounded-lg border p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Primary Button</Label>
                    <p className="text-sm text-zinc-500">Show/hide the primary call-to-action button</p>
                  </div>
                  <Switch
                    checked={editingSlide?.showPrimaryButton ?? true}
                    onCheckedChange={(checked) => setEditingSlide({ ...editingSlide, showPrimaryButton: checked })}
                  />
                </div>
                {editingSlide?.showPrimaryButton !== false && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="buttonText">Button Text</Label>
                      <Input
                        id="buttonText"
                        value={editingSlide?.buttonText || ""}
                        onChange={(e) => setEditingSlide({ ...editingSlide, buttonText: e.target.value })}
                        placeholder="Discover Projects"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="buttonLink">Button Link</Label>
                      <Input
                        id="buttonLink"
                        value={editingSlide?.buttonLink || ""}
                        onChange={(e) => setEditingSlide({ ...editingSlide, buttonLink: e.target.value })}
                        placeholder="/discover"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Secondary Button */}
              <div className="rounded-lg border p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Secondary Button</Label>
                    <p className="text-sm text-zinc-500">Show/hide the secondary call-to-action button</p>
                  </div>
                  <Switch
                    checked={editingSlide?.showSecondaryButton ?? true}
                    onCheckedChange={(checked) => setEditingSlide({ ...editingSlide, showSecondaryButton: checked })}
                  />
                </div>
                {editingSlide?.showSecondaryButton !== false && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="secondaryButtonText">Button Text</Label>
                      <Input
                        id="secondaryButtonText"
                        value={editingSlide?.secondaryButtonText || ""}
                        onChange={(e) => setEditingSlide({ ...editingSlide, secondaryButtonText: e.target.value })}
                        placeholder="Start a Project"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="secondaryButtonLink">Button Link</Label>
                      <Input
                        id="secondaryButtonLink"
                        value={editingSlide?.secondaryButtonLink || ""}
                        onChange={(e) => setEditingSlide({ ...editingSlide, secondaryButtonLink: e.target.value })}
                        placeholder="/projects/new"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Media */}
            <div className="space-y-4">
              <h4 className="font-medium">Media</h4>

              <div className="space-y-2">
                <Label>Media Type</Label>
                <Select
                  value={editingSlide?.mediaType || "IMAGE"}
                  onValueChange={(v) => setEditingSlide({ ...editingSlide, mediaType: v as "IMAGE" | "YOUTUBE" | "VIDEO" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IMAGE">
                      <div className="flex items-center gap-2">
                        <ImageIcon className="h-4 w-4" />
                        Image
                      </div>
                    </SelectItem>
                    <SelectItem value="YOUTUBE">
                      <div className="flex items-center gap-2">
                        <Youtube className="h-4 w-4 text-red-500" />
                        YouTube Video
                      </div>
                    </SelectItem>
                    <SelectItem value="VIDEO">
                      <div className="flex items-center gap-2">
                        <Video className="h-4 w-4" />
                        Uploaded Video
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {editingSlide?.mediaType === "IMAGE" && (
                <div className="space-y-2">
                  <Label htmlFor="imageUrl">Image URL</Label>
                  <Input
                    id="imageUrl"
                    value={editingSlide?.imageUrl || ""}
                    onChange={(e) => setEditingSlide({ ...editingSlide, imageUrl: e.target.value })}
                    placeholder="https://example.com/image.jpg"
                  />
                  <p className="text-xs text-zinc-500">
                    Recommended size: 1920x800px. Upload images via Media Library.
                  </p>
                </div>
              )}

              {editingSlide?.mediaType === "YOUTUBE" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="videoUrl">YouTube URL</Label>
                    <Input
                      id="videoUrl"
                      value={editingSlide?.videoUrl || ""}
                      onChange={(e) => setEditingSlide({ ...editingSlide, videoUrl: e.target.value })}
                      placeholder="https://www.youtube.com/watch?v=..."
                    />
                    {editingSlide?.videoUrl && getYouTubeVideoId(editingSlide.videoUrl) && (
                      <div className="mt-2 aspect-video bg-zinc-100 rounded overflow-hidden">
                        <iframe
                          src={`https://www.youtube.com/embed/${getYouTubeVideoId(editingSlide.videoUrl)}`}
                          className="w-full h-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="videoThumbnail">Thumbnail Image (optional)</Label>
                    <Input
                      id="videoThumbnail"
                      value={editingSlide?.videoThumbnail || ""}
                      onChange={(e) => setEditingSlide({ ...editingSlide, videoThumbnail: e.target.value })}
                      placeholder="https://example.com/thumbnail.jpg"
                    />
                    <p className="text-xs text-zinc-500">
                      Shown while video is loading or paused
                    </p>
                  </div>
                </>
              )}

              {editingSlide?.mediaType === "VIDEO" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="videoUrl">Video URL</Label>
                    <Input
                      id="videoUrl"
                      value={editingSlide?.videoUrl || ""}
                      onChange={(e) => setEditingSlide({ ...editingSlide, videoUrl: e.target.value })}
                      placeholder="https://example.com/video.mp4"
                    />
                    <p className="text-xs text-zinc-500">
                      Upload videos via Media Library. MP4 format recommended.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="videoThumbnail">Thumbnail Image (optional)</Label>
                    <Input
                      id="videoThumbnail"
                      value={editingSlide?.videoThumbnail || ""}
                      onChange={(e) => setEditingSlide({ ...editingSlide, videoThumbnail: e.target.value })}
                      placeholder="https://example.com/thumbnail.jpg"
                    />
                  </div>
                </>
              )}

              {/* Video Settings */}
              {(editingSlide?.mediaType === "YOUTUBE" || editingSlide?.mediaType === "VIDEO") && (
                <div className="rounded-lg border p-4 space-y-4">
                  <h5 className="font-medium text-sm">Video Playback Settings</h5>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="flex items-center justify-between rounded-lg bg-zinc-50 dark:bg-zinc-900 p-3">
                      <div>
                        <Label className="text-sm">Autoplay</Label>
                        <p className="text-xs text-zinc-500">Start automatically</p>
                      </div>
                      <Switch
                        checked={editingSlide?.videoAutoplay ?? true}
                        onCheckedChange={(checked) => setEditingSlide({ ...editingSlide, videoAutoplay: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-zinc-50 dark:bg-zinc-900 p-3">
                      <div>
                        <Label className="text-sm">Muted</Label>
                        <p className="text-xs text-zinc-500">Play without sound</p>
                      </div>
                      <Switch
                        checked={editingSlide?.videoMuted ?? true}
                        onCheckedChange={(checked) => setEditingSlide({ ...editingSlide, videoMuted: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-zinc-50 dark:bg-zinc-900 p-3">
                      <div>
                        <Label className="text-sm">Loop</Label>
                        <p className="text-xs text-zinc-500">Repeat video</p>
                      </div>
                      <Switch
                        checked={editingSlide?.videoLoop ?? true}
                        onCheckedChange={(checked) => setEditingSlide({ ...editingSlide, videoLoop: checked })}
                      />
                    </div>
                  </div>
                  {editingSlide?.videoAutoplay && !editingSlide?.videoMuted && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Note: Most browsers require videos to be muted for autoplay to work.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Display Settings */}
            <div className="space-y-4">
              <h4 className="font-medium">Display Settings</h4>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Text Alignment</Label>
                  <Select
                    value={editingSlide?.textAlignment || "center"}
                    onValueChange={(v) => setEditingSlide({ ...editingSlide, textAlignment: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">Left</SelectItem>
                      <SelectItem value="center">Center</SelectItem>
                      <SelectItem value="right">Right</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Text Color</Label>
                  <Select
                    value={editingSlide?.textColor || "white"}
                    onValueChange={(v) => setEditingSlide({ ...editingSlide, textColor: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="white">White (for dark backgrounds)</SelectItem>
                      <SelectItem value="dark">Dark (for light backgrounds)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Overlay Opacity ({editingSlide?.overlayOpacity || 0}%)</Label>
                <Slider
                  value={[editingSlide?.overlayOpacity || 0]}
                  onValueChange={([v]) => setEditingSlide({ ...editingSlide, overlayOpacity: v })}
                  min={0}
                  max={80}
                  step={5}
                />
                <p className="text-xs text-zinc-500">
                  Dark overlay to improve text readability over bright images/videos
                </p>
              </div>

              {/* Content Visibility Options */}
              <div className="rounded-lg border p-4 space-y-3">
                <h5 className="font-medium text-sm">Content Visibility</h5>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex items-center justify-between rounded-lg bg-zinc-50 dark:bg-zinc-900 p-3">
                    <div>
                      <Label className="text-sm">Show Subtitle</Label>
                    </div>
                    <Switch
                      checked={editingSlide?.showSubtitle ?? true}
                      onCheckedChange={(checked) => setEditingSlide({ ...editingSlide, showSubtitle: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-zinc-50 dark:bg-zinc-900 p-3">
                    <div>
                      <Label className="text-sm">Show Description</Label>
                    </div>
                    <Switch
                      checked={editingSlide?.showDescription ?? true}
                      onCheckedChange={(checked) => setEditingSlide({ ...editingSlide, showDescription: checked })}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label>Active</Label>
                  <p className="text-sm text-zinc-500">Show this slide on the home page</p>
                </div>
                <Switch
                  checked={editingSlide?.isActive ?? true}
                  onCheckedChange={(checked) => setEditingSlide({ ...editingSlide, isActive: checked })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {isEditing ? "Update" : "Create"} Slide
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single Slide Preview Dialog */}
      <Dialog open={!!previewSlide} onOpenChange={() => setPreviewSlide(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Slide Preview</DialogTitle>
          </DialogHeader>
          {previewSlide && (
            <div className="relative aspect-[21/9] bg-gradient-to-br from-primary/20 to-cyan-500/20 rounded-lg overflow-hidden">
              {previewSlide.imageUrl && previewSlide.mediaType === "IMAGE" && (
                <Image
                  src={previewSlide.imageUrl}
                  alt=""
                  fill
                  className="object-cover"
                />
              )}
              {previewSlide.mediaType === "YOUTUBE" && previewSlide.videoUrl && (
                <iframe
                  src={`https://www.youtube.com/embed/${getYouTubeVideoId(previewSlide.videoUrl)}?autoplay=${previewSlide.videoAutoplay !== false ? 1 : 0}&mute=${previewSlide.videoMuted !== false ? 1 : 0}&loop=${previewSlide.videoLoop !== false ? 1 : 0}&playlist=${getYouTubeVideoId(previewSlide.videoUrl)}`}
                  className="absolute inset-0 w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              )}
              {previewSlide.mediaType === "VIDEO" && previewSlide.videoUrl && (
                <video
                  src={previewSlide.videoUrl}
                  className="absolute inset-0 w-full h-full object-cover"
                  autoPlay={previewSlide.videoAutoplay !== false}
                  muted={previewSlide.videoMuted !== false}
                  loop={previewSlide.videoLoop !== false}
                  poster={previewSlide.videoThumbnail || undefined}
                />
              )}

              <div
                className="absolute inset-0 bg-black"
                style={{ opacity: previewSlide.overlayOpacity / 100 }}
              />

              <div
                className={`absolute inset-0 flex flex-col justify-center p-8 ${
                  previewSlide.textColor === "dark" ? "text-zinc-900" : "text-white"
                } ${
                  previewSlide.textAlignment === "left"
                    ? "items-start"
                    : previewSlide.textAlignment === "right"
                    ? "items-end"
                    : "items-center text-center"
                }`}
              >
                {previewSlide.subtitle && previewSlide.showSubtitle !== false && (
                  <p className="text-lg font-medium text-primary mb-2 drop-shadow">
                    {previewSlide.subtitle}
                  </p>
                )}
                <h2 className={`text-4xl font-bold mb-4 drop-shadow-lg ${previewSlide.textColor === "dark" ? "text-zinc-900" : ""}`}>
                  {previewSlide.title}
                </h2>
                {previewSlide.description && previewSlide.showDescription !== false && (
                  <p className={`text-lg opacity-90 max-w-2xl mb-6 drop-shadow ${previewSlide.textColor === "dark" ? "text-zinc-600" : ""}`}>
                    {previewSlide.description}
                  </p>
                )}
                <div className="flex gap-4">
                  {previewSlide.showPrimaryButton !== false && previewSlide.buttonText && (
                    <Button size="lg" className="bg-gradient-to-r from-primary to-emerald-600">
                      {previewSlide.buttonText}
                    </Button>
                  )}
                  {previewSlide.showSecondaryButton !== false && previewSlide.secondaryButtonText && (
                    <Button size="lg" variant="outline" className={previewSlide.textColor === "dark" ? "border-zinc-300" : "border-white text-white hover:bg-white/10"}>
                      {previewSlide.secondaryButtonText}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
