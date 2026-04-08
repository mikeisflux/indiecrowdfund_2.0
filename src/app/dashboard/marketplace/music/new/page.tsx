"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockEditor } from "@/components/ui/block-editor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Music,
  ArrowLeft,
  ArrowRight,
  FileText,
  DollarSign,
  Image as ImageIcon,
  Check,
  Loader2,
  AlertTriangle,
  Eye,
  Upload,
  X,
  Disc3,
  Clock,
  Plus,
  Trash2,
  GripVertical,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────

interface TrackData {
  id: string;
  title: string;
  audioFileUrl: string;
  audioFileName: string;
  audioFileSize: number | null;
  audioDuration: number | null;
  trackNumber: number;
}

interface MusicFormData {
  // Release Info
  releaseType: "single" | "ep" | "album";
  title: string;
  artistName: string;
  description: string;
  genre: string;
  coverImageUrl: string;

  // Tracks
  tracks: TrackData[];

  // Pricing
  price: string;
  currency: string;
  paymentProcessor: "STRIPE" | "DIVINITYCOIN" | "PAYPAL";
  isNsfw: boolean;

  // Tags
  tags: string[];
}

const MUSIC_GENRES = [
  { value: "hip-hop", label: "Hip-Hop/Rap" },
  { value: "rnb", label: "R&B/Soul" },
  { value: "pop", label: "Pop" },
  { value: "rock", label: "Rock" },
  { value: "indie-rock", label: "Indie Rock" },
  { value: "electronic", label: "Electronic/EDM" },
  { value: "jazz", label: "Jazz" },
  { value: "classical", label: "Classical" },
  { value: "country", label: "Country" },
  { value: "folk", label: "Folk/Acoustic" },
  { value: "metal", label: "Metal" },
  { value: "punk", label: "Punk" },
  { value: "latin", label: "Latin" },
  { value: "afrobeats", label: "Afrobeats" },
  { value: "reggae", label: "Reggae/Dancehall" },
  { value: "lo-fi", label: "Lo-Fi/Chill" },
  { value: "soundtrack", label: "Soundtrack/Score" },
  { value: "experimental", label: "Experimental" },
  { value: "gospel", label: "Gospel" },
  { value: "other", label: "Other" },
];

const RELEASE_TYPES = [
  { value: "single", label: "Single", desc: "1-2 tracks" },
  { value: "ep", label: "EP", desc: "3-6 tracks" },
  { value: "album", label: "Album", desc: "7+ tracks" },
];

const STEPS = [
  { id: 1, title: "Release Info", icon: FileText },
  { id: 2, title: "Tracks", icon: Music },
  { id: 3, title: "Artwork", icon: ImageIcon },
  { id: 4, title: "Pricing", icon: DollarSign },
  { id: 5, title: "Review", icon: Eye },
];

// ─── Step Indicator ──────────────────────────────────────────────────

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEPS.map((step, index) => {
        const Icon = step.icon;
        const isActive = currentStep === step.id;
        const isCompleted = currentStep > step.id;
        return (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all",
                  isActive
                    ? "border-purple-500 bg-purple-500/20 text-purple-500"
                    : isCompleted
                    ? "border-emerald-500 bg-emerald-500/20 text-emerald-500"
                    : "border-border bg-muted text-muted-foreground"
                )}
              >
                {isCompleted ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
              </div>
              <span
                className={cn(
                  "text-xs font-medium hidden sm:block",
                  isActive
                    ? "text-foreground"
                    : isCompleted
                    ? "text-emerald-500 dark:text-emerald-400"
                    : "text-muted-foreground"
                )}
              >
                {step.title}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={cn(
                  "w-8 h-0.5 mx-2",
                  currentStep > step.id ? "bg-emerald-500/50" : "bg-border"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Cover Image Upload ──────────────────────────────────────────────

function CoverImageUploader({
  url,
  onUpload,
}: {
  url: string;
  onUpload: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be under 10MB");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "marketplace-covers");
      const res = await apiFetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      onUpload(data.url);
      toast.success("Cover uploaded!");
    } catch {
      toast.error("Failed to upload cover");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <Label>Cover Artwork *</Label>
      <p className="text-xs text-muted-foreground">
        Recommended: 3000x3000px square image. JPG or PNG, max 10MB.
      </p>
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
        {/* Preview */}
        <div className="relative w-36 h-36 sm:w-48 sm:h-48 rounded-xl overflow-hidden bg-muted border-2 border-dashed border-border shrink-0">
          {url ? (
            <>
              <Image src={url} alt="Cover" fill className="object-cover" />
              <button
                onClick={() => onUpload("")}
                className="absolute top-2 right-2 p-1 rounded-full bg-black/50 text-white hover:bg-black/70"
              >
                <X className="w-3 h-3" />
              </button>
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Disc3 className="w-10 h-10" />
              <span className="text-xs">No artwork</span>
            </div>
          )}
        </div>

        {/* Upload */}
        <div className="flex-1">
          <label className="cursor-pointer">
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-border hover:border-purple-500/40 hover:bg-purple-500/5 transition-colors">
              {uploading ? (
                <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
              ) : (
                <Upload className="w-5 h-5 text-muted-foreground" />
              )}
              <span className="text-sm text-muted-foreground">
                {uploading ? "Uploading..." : "Click to upload cover art"}
              </span>
            </div>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
              disabled={uploading}
            />
          </label>
        </div>
      </div>
    </div>
  );
}

// ─── Audio Track Upload ──────────────────────────────────────────────

function TrackUploader({
  tracks,
  onAdd,
  onRemove,
  onUpdate,
}: {
  tracks: TrackData[];
  onAdd: (track: TrackData) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, field: keyof TrackData, value: string | number | null) => void;
}) {
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (files: FileList) => {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file) continue;
      if (!file.type.startsWith("audio/") && !file.name.match(/\.(mp3|wav|flac|aac|ogg|m4a)$/i)) {
        toast.error(`${file.name} is not an audio file`);
        continue;
      }
      if (file.size > 100 * 1024 * 1024) {
        toast.error(`${file.name} exceeds 100MB limit`);
        continue;
      }

      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await apiFetch("/api/creator/marketplace/audio/upload", { method: "POST", body: formData });
        if (!res.ok) throw new Error(`Failed to upload ${file.name}`);
        const data = await res.json();

        // Try to get duration from audio
        let duration: number | null = null;
        try {
          const audio = new Audio();
          audio.src = data.url;
          await new Promise<void>((resolve) => {
            audio.addEventListener("loadedmetadata", () => {
              duration = Math.round(audio.duration);
              resolve();
            });
            audio.addEventListener("error", () => resolve());
            setTimeout(resolve, 3000);
          });
        } catch {
          // Duration detection failed, that's okay
        }

        // Extract title from filename
        const nameWithoutExt = file.name.replace(/\.[^.]+$/, "");
        // Remove track number prefix like "01 - " or "1. "
        const cleanTitle = nameWithoutExt.replace(/^\d+[\s._-]+/, "");

        onAdd({
          id: `track-${Date.now()}-${i}`,
          title: cleanTitle,
          audioFileUrl: data.url,
          audioFileName: file.name,
          audioFileSize: file.size,
          audioDuration: duration,
          trackNumber: tracks.length + i + 1,
        });

        toast.success(`Uploaded: ${file.name}`);
      } catch {
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    setUploading(false);
  };

  const formatDuration = (sec: number | null) => {
    if (!sec) return "--:--";
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Tracks *</Label>
        <span className="text-xs text-muted-foreground">{tracks.length} track{tracks.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Track List */}
      {tracks.length > 0 && (
        <div className="space-y-2">
          {tracks.map((track, idx) => (
            <div
              key={track.id}
              className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-xl bg-muted/50 border border-border"
            >
              <GripVertical className="w-4 h-4 text-muted-foreground shrink-0 hidden sm:block" />
              <span className="text-sm text-muted-foreground w-5 sm:w-6 text-right shrink-0">
                {idx + 1}
              </span>
              <Input
                value={track.title}
                onChange={(e) => onUpdate(track.id, "title", e.target.value)}
                className="flex-1 h-8 sm:h-9 text-sm"
                placeholder="Track title"
              />
              <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                <Clock className="w-3 h-3" />
                <span>{formatDuration(track.audioDuration)}</span>
              </div>
              <span className="text-xs text-muted-foreground shrink-0 hidden md:block">
                {formatSize(track.audioFileSize)}
              </span>
              <button
                onClick={() => onRemove(track.id)}
                className="p-1 text-muted-foreground hover:text-destructive transition-colors shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload Area */}
      <label className="cursor-pointer block">
        <div
          className={cn(
            "flex flex-col items-center gap-3 p-8 rounded-xl border-2 border-dashed transition-colors",
            uploading
              ? "border-purple-500/40 bg-purple-500/5"
              : "border-border hover:border-purple-500/40 hover:bg-purple-500/5"
          )}
        >
          {uploading ? (
            <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
          ) : (
            <Plus className="w-8 h-8 text-muted-foreground" />
          )}
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">
              {uploading ? "Uploading tracks..." : "Click to add audio files"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              MP3, WAV, FLAC, AAC, OGG, M4A — up to 100MB each. Select multiple files.
            </p>
          </div>
        </div>
        <input
          type="file"
          accept="audio/*,.mp3,.wav,.flac,.aac,.ogg,.m4a"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = "";
          }}
          disabled={uploading}
        />
      </label>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────

export default function NewMusicPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [tagsInput, setTagsInput] = useState("");
  const [formData, setFormData] = useState<MusicFormData>({
    releaseType: "single",
    title: "",
    artistName: "",
    description: "",
    genre: "",
    coverImageUrl: "",
    tracks: [],
    price: "",
    currency: "USD",
    paymentProcessor: "PAYPAL",
    isNsfw: false,
    tags: [],
  });

  // Load artist name from company profile
  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch("/api/creator/marketplace/company");
        if (res.ok) {
          const data = await res.json();
          if (data.company?.name) {
            setFormData((f) => ({ ...f, artistName: data.company.name }));
          }
        }
      } catch {
        // ignore
      }
    }
    loadProfile();
  }, []);

  const updateForm = useCallback(
    <K extends keyof MusicFormData>(field: K, value: MusicFormData[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const addTrack = useCallback((track: TrackData) => {
    setFormData((prev) => ({ ...prev, tracks: [...prev.tracks, track] }));
  }, []);

  const removeTrack = useCallback((id: string) => {
    setFormData((prev) => ({
      ...prev,
      tracks: prev.tracks.filter((t) => t.id !== id).map((t, i) => ({ ...t, trackNumber: i + 1 })),
    }));
  }, []);

  const updateTrack = useCallback(
    (id: string, field: keyof TrackData, value: string | number | null) => {
      setFormData((prev) => ({
        ...prev,
        tracks: prev.tracks.map((t) => (t.id === id ? { ...t, [field]: value } : t)),
      }));
    },
    []
  );

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (!formData.title.trim()) {
          toast.error("Please enter a release title");
          return false;
        }
        if (!formData.genre) {
          toast.error("Please select a genre");
          return false;
        }
        return true;
      case 2:
        if (formData.tracks.length === 0) {
          toast.error("Please upload at least one track");
          return false;
        }
        if (formData.tracks.some((t) => !t.title.trim())) {
          toast.error("All tracks need a title");
          return false;
        }
        return true;
      case 3:
        if (!formData.coverImageUrl) {
          toast.error("Please upload cover artwork");
          return false;
        }
        return true;
      case 4: {
        const priceVal = parseFloat(formData.price);
        if (!formData.price || isNaN(priceVal) || priceVal <= 0) {
          toast.error("Please enter a valid download price");
          return false;
        }
        return true;
      }
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 5));
    }
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const totalDuration = formData.tracks.reduce((sum, t) => sum + (t.audioDuration || 0), 0);
  const formatTotalDuration = () => {
    if (totalDuration === 0) return "0:00";
    const m = Math.floor(totalDuration / 60);
    const s = totalDuration % 60;
    if (m >= 60) {
      const h = Math.floor(m / 60);
      const rm = m % 60;
      return `${h}h ${rm}m`;
    }
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleSubmit = async (asDraft: boolean = true) => {
    for (let i = 1; i <= 4; i++) {
      if (!validateStep(i)) return;
    }

    setSaving(true);
    try {
      const res = await apiFetch("/api/creator/marketplace/music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          price: parseFloat(formData.price),
          submitForReview: !asDraft,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to create release");
      }

      toast.success(asDraft ? "Release saved as draft" : "Release submitted for review");
      router.push("/dashboard/marketplace");
    } catch (error) {
      console.error("Error creating release:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create release");
    } finally {
      setSaving(false);
    }
  };

  const currencySymbol =
    formData.currency === "EUR" ? "€" : formData.currency === "GBP" ? "£" : "$";

  return (
    <div className="min-h-screen bg-background">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/marketplace" className="p-2 rounded-lg hover:bg-muted">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex items-center gap-2">
              <Music className="h-5 w-5 text-purple-500" />
              <h1 className="text-lg font-bold text-foreground">Upload Music</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="container relative max-w-3xl py-8">
        <StepIndicator currentStep={currentStep} />

        {/* Step 1: Release Info */}
        {currentStep === 1 && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <FileText className="h-5 w-5 text-purple-500 dark:text-purple-400" />
                Release Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Release Type */}
              <div className="space-y-2">
                <Label>Release Type *</Label>
                <div className="grid grid-cols-3 gap-3">
                  {RELEASE_TYPES.map((rt) => (
                    <button
                      key={rt.value}
                      onClick={() => updateForm("releaseType", rt.value as MusicFormData["releaseType"])}
                      className={cn(
                        "p-4 rounded-xl border-2 text-center transition-all",
                        formData.releaseType === rt.value
                          ? "border-purple-500 bg-purple-500/10"
                          : "border-border hover:border-purple-500/30"
                      )}
                    >
                      <p className="font-semibold text-foreground">{rt.label}</p>
                      <p className="text-xs text-muted-foreground mt-1">{rt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Release Title *</Label>
                <Input
                  placeholder="e.g., Midnight Sessions, After Hours EP"
                  value={formData.title}
                  onChange={(e) => updateForm("title", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Artist / Band Name</Label>
                <Input
                  placeholder="Your artist name"
                  value={formData.artistName}
                  onChange={(e) => updateForm("artistName", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Defaults to your company profile name
                </p>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <BlockEditor
                  placeholder="Tell listeners about this release..."
                  value={formData.description}
                  onChange={(val) => updateForm("description", val)}
                />
              </div>

              <div className="space-y-2">
                <Label>Genre *</Label>
                <Select value={formData.genre} onValueChange={(v) => updateForm("genre", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a genre" />
                  </SelectTrigger>
                  <SelectContent>
                    {MUSIC_GENRES.map((g) => (
                      <SelectItem key={g.value} value={g.value}>
                        {g.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tags</Label>
                <Input
                  placeholder="e.g., chill, summer vibes, acoustic"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  onBlur={() => {
                    updateForm(
                      "tags",
                      tagsInput
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean)
                    );
                  }}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Tracks */}
        {currentStep === 2 && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Music className="h-5 w-5 text-purple-500 dark:text-purple-400" />
                Upload Tracks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TrackUploader
                tracks={formData.tracks}
                onAdd={addTrack}
                onRemove={removeTrack}
                onUpdate={updateTrack}
              />
            </CardContent>
          </Card>
        )}

        {/* Step 3: Artwork */}
        {currentStep === 3 && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <ImageIcon className="h-5 w-5 text-purple-500 dark:text-purple-400" />
                Cover Artwork
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CoverImageUploader
                url={formData.coverImageUrl}
                onUpload={(url) => updateForm("coverImageUrl", url)}
              />
            </CardContent>
          </Card>
        )}

        {/* Step 4: Pricing */}
        {currentStep === 4 && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <DollarSign className="h-5 w-5 text-purple-500 dark:text-purple-400" />
                Pricing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <p className="text-sm text-emerald-700 dark:text-emerald-300">
                  <strong>Streaming is free!</strong> Listeners can stream your music at no cost.
                  The price below is for downloading the full-quality audio files.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Download Price *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      {currencySymbol}
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.50"
                      placeholder="9.99"
                      value={formData.price}
                      onChange={(e) => updateForm("price", e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Select value={formData.currency} onValueChange={(v) => updateForm("currency", v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                      <SelectItem value="GBP">GBP (£)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Payment Processor</Label>
                <Select
                  value={formData.paymentProcessor}
                  onValueChange={(v) =>
                    updateForm("paymentProcessor", v as MusicFormData["paymentProcessor"])
                  }
                  disabled={formData.isNsfw}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PAYPAL">PayPal</SelectItem>
                    <SelectItem value="STRIPE">Stripe</SelectItem>
                    <SelectItem value="DIVINITYCOIN">DivinityCoin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500 dark:text-amber-400" />
                  <div>
                    <p className="font-medium text-foreground">Contains Explicit Content</p>
                    <p className="text-sm text-muted-foreground">
                      If enabled, payments will be processed via DivinityCoin only
                    </p>
                  </div>
                </div>
                <Switch
                  checked={formData.isNsfw}
                  onCheckedChange={(checked) => {
                    updateForm("isNsfw", checked);
                    if (checked) updateForm("paymentProcessor", "DIVINITYCOIN");
                  }}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 5: Review */}
        {currentStep === 5 && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Eye className="h-5 w-5 text-purple-500 dark:text-purple-400" />
                Review Your Release
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Preview Card */}
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
                <div className="relative w-32 h-32 sm:w-40 sm:h-40 rounded-xl overflow-hidden bg-muted shrink-0 mx-auto sm:mx-0">
                  {formData.coverImageUrl ? (
                    <Image
                      src={formData.coverImageUrl}
                      alt={formData.title}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500/30 to-pink-500/30">
                      <Disc3 className="w-12 h-12 text-muted-foreground/50" />
                    </div>
                  )}
                </div>
                <div>
                  <Badge variant="secondary" className="mb-2">
                    {RELEASE_TYPES.find((r) => r.value === formData.releaseType)?.label}
                  </Badge>
                  <h3 className="text-xl font-bold text-foreground">{formData.title || "Untitled"}</h3>
                  <p className="text-muted-foreground mt-1">{formData.artistName || "Unknown Artist"}</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    {formData.tracks.length} track{formData.tracks.length !== 1 ? "s" : ""} &middot;{" "}
                    {formatTotalDuration()}
                  </p>
                  <p className="text-lg font-bold text-emerald-500 mt-2">
                    {currencySymbol}
                    {parseFloat(formData.price || "0").toFixed(2)}
                    <span className="text-xs text-muted-foreground font-normal ml-1">download</span>
                  </p>
                </div>
              </div>

              {/* Track List */}
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Tracklist
                </h4>
                {formData.tracks.map((track, i) => (
                  <div key={track.id} className="flex items-center gap-3 py-2 text-sm">
                    <span className="w-5 text-right text-muted-foreground">{i + 1}</span>
                    <span className="flex-1 text-foreground">{track.title}</span>
                    <span className="text-muted-foreground text-xs">
                      {track.audioDuration
                        ? `${Math.floor(track.audioDuration / 60)}:${(track.audioDuration % 60)
                            .toString()
                            .padStart(2, "0")}`
                        : "--:--"}
                    </span>
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div className="space-y-3">
                <div className="flex justify-between p-3 rounded-lg bg-muted">
                  <span className="text-muted-foreground">Genre</span>
                  <span className="text-foreground">
                    {MUSIC_GENRES.find((g) => g.value === formData.genre)?.label || "Not set"}
                  </span>
                </div>
                <div className="flex justify-between p-3 rounded-lg bg-muted">
                  <span className="text-muted-foreground">Streaming</span>
                  <span className="text-emerald-500 font-medium">Free</span>
                </div>
                <div className="flex justify-between p-3 rounded-lg bg-muted">
                  <span className="text-muted-foreground">Download Price</span>
                  <span className="text-foreground">
                    {currencySymbol}
                    {parseFloat(formData.price || "0").toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between p-3 rounded-lg bg-muted">
                  <span className="text-muted-foreground">Explicit Content</span>
                  <span className={formData.isNsfw ? "text-amber-500" : "text-foreground"}>
                    {formData.isNsfw ? "Yes" : "No"}
                  </span>
                </div>
                {formData.tags.length > 0 && (
                  <div className="flex justify-between p-3 rounded-lg bg-muted">
                    <span className="text-muted-foreground">Tags</span>
                    <div className="flex flex-wrap gap-1 justify-end">
                      {formData.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <p className="text-sm text-blue-600 dark:text-blue-300">
                  <strong>What happens next?</strong> Your release will be reviewed by our team
                  within 24-48 hours. Once approved, it will be live on the marketplace for free
                  streaming and paid downloads.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8">
          {currentStep > 1 ? (
            <Button variant="outline" onClick={prevStep} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          ) : (
            <div />
          )}

          {currentStep < 5 ? (
            <Button onClick={nextStep} className="gap-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white">
              Next
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => handleSubmit(true)} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save as Draft
              </Button>
              <Button
                onClick={() => handleSubmit(false)}
                disabled={saving}
                className="gap-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Submit for Review
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
