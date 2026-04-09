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
  Film,
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
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const MOVIE_GENRES = [
  { value: "action", label: "Action" },
  { value: "comedy", label: "Comedy" },
  { value: "drama", label: "Drama" },
  { value: "horror", label: "Horror" },
  { value: "thriller", label: "Thriller/Suspense" },
  { value: "sci-fi", label: "Sci-Fi" },
  { value: "fantasy", label: "Fantasy" },
  { value: "documentary", label: "Documentary" },
  { value: "animation", label: "Animation" },
  { value: "romance", label: "Romance" },
  { value: "short-film", label: "Short Film" },
  { value: "indie-film", label: "Indie Film" },
  { value: "music-video", label: "Music Video" },
  { value: "webseries", label: "Web Series" },
  { value: "noir", label: "Noir" },
  { value: "mockumentary", label: "Mockumentary" },
  { value: "experimental", label: "Experimental" },
  { value: "martial-arts", label: "Martial Arts" },
  { value: "western", label: "Western" },
  { value: "other", label: "Other" },
];

const STEPS = [
  { id: 1, title: "Details", icon: FileText },
  { id: 2, title: "Video", icon: Film },
  { id: 3, title: "Poster", icon: ImageIcon },
  { id: 4, title: "Pricing", icon: DollarSign },
  { id: 5, title: "Review", icon: Eye },
];

interface MovieFormData {
  title: string;
  description: string;
  genre: string;
  coverImageUrl: string;
  videoFileUrl: string;
  videoFileName: string;
  videoFileSize: number | null;
  videoDuration: number | null;
  videoResolution: string;
  price: string;
  currency: string;
  paymentProcessor: "PAYPAL" | "DIVINITYCOIN" | "WHOP";
  isNsfw: boolean;
  tags: string[];
}

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-1 sm:gap-2 mb-8">
      {STEPS.map((step, index) => {
        const Icon = step.icon;
        const isActive = currentStep === step.id;
        const isCompleted = currentStep > step.id;
        return (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center border-2 transition-all",
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
                  "text-[10px] sm:text-xs font-medium hidden sm:block",
                  isActive ? "text-foreground" : isCompleted ? "text-emerald-500" : "text-muted-foreground"
                )}
              >
                {step.title}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div className={cn("w-4 sm:w-8 h-0.5 mx-1 sm:mx-2", currentStep > step.id ? "bg-emerald-500/50" : "bg-border")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function NewMoviePage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [tagsInput, setTagsInput] = useState("");
  const [formData, setFormData] = useState<MovieFormData>({
    title: "",
    description: "",
    genre: "",
    coverImageUrl: "",
    videoFileUrl: "",
    videoFileName: "",
    videoFileSize: null,
    videoDuration: null,
    videoResolution: "",
    price: "",
    currency: "USD",
    paymentProcessor: "PAYPAL",
    isNsfw: false,
    tags: [],
  });

  const updateForm = useCallback(
    <K extends keyof MovieFormData>(field: K, value: MovieFormData[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (!formData.title.trim()) { toast.error("Please enter a title"); return false; }
        if (!formData.genre) { toast.error("Please select a genre"); return false; }
        return true;
      case 2:
        if (!formData.videoFileUrl) { toast.error("Please upload a video file"); return false; }
        return true;
      case 3:
        if (!formData.coverImageUrl) { toast.error("Please upload a poster image"); return false; }
        return true;
      case 4: {
        const p = parseFloat(formData.price);
        if (!formData.price || isNaN(p) || p <= 0) { toast.error("Please enter a valid price"); return false; }
        return true;
      }
      default: return true;
    }
  };

  const nextStep = () => { if (validateStep(currentStep)) setCurrentStep((p) => Math.min(p + 1, 5)); };
  const prevStep = () => setCurrentStep((p) => Math.max(p - 1, 1));

  const handleVideoUpload = async (file: File) => {
    if (!file.type.startsWith("video/") && !/\.(mp4|mkv|mov|avi|webm|m4v)$/i.test(file.name)) {
      toast.error("Only video files are allowed"); return;
    }
    if (file.size > 2 * 1024 * 1024 * 1024) { toast.error("Video must be under 2GB"); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiFetch("/api/creator/marketplace/video/upload", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      updateForm("videoFileUrl", data.url);
      updateForm("videoFileName", file.name);
      updateForm("videoFileSize", file.size);

      // Try to get duration
      try {
        const video = document.createElement("video");
        video.preload = "metadata";
        video.src = URL.createObjectURL(file);
        await new Promise<void>((resolve) => {
          video.onloadedmetadata = () => {
            updateForm("videoDuration", Math.round(video.duration));
            if (video.videoWidth && video.videoHeight) {
              const h = video.videoHeight;
              const res = h >= 2160 ? "4K" : h >= 1440 ? "1440p" : h >= 1080 ? "1080p" : h >= 720 ? "720p" : `${h}p`;
              updateForm("videoResolution", res);
            }
            URL.revokeObjectURL(video.src);
            resolve();
          };
          video.onerror = () => { URL.revokeObjectURL(video.src); resolve(); };
          setTimeout(() => resolve(), 5000);
        });
      } catch { /* ignore */ }

      toast.success("Video uploaded!");
    } catch {
      toast.error("Failed to upload video");
    } finally {
      setUploading(false);
    }
  };

  const handleCoverUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Please select an image"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Image must be under 10MB"); return; }
    setCoverUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "marketplace-covers");
      const res = await apiFetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      updateForm("coverImageUrl", data.url);
      toast.success("Poster uploaded!");
    } catch {
      toast.error("Failed to upload poster");
    } finally {
      setCoverUploading(false);
    }
  };

  const handleSubmit = async (asDraft: boolean = true) => {
    for (let i = 1; i <= 4; i++) { if (!validateStep(i)) return; }
    setSaving(true);
    try {
      const res = await apiFetch("/api/creator/marketplace/movies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, price: parseFloat(formData.price), submitForReview: !asDraft }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
      toast.success(asDraft ? "Movie saved as draft" : "Movie submitted for review");
      router.push("/dashboard/marketplace");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create movie");
    } finally {
      setSaving(false);
    }
  };

  const currencySymbol = formData.currency === "EUR" ? "€" : formData.currency === "GBP" ? "£" : "$";
  const formatDuration = (s: number | null) => {
    if (!s) return "--:--";
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };
  const formatSize = (b: number | null) => {
    if (!b) return "";
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
    if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
    return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl" />
      </div>

      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="container flex h-14 sm:h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <Link href="/dashboard/marketplace" className="p-2 rounded-lg hover:bg-muted">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex items-center gap-2">
              <Film className="h-5 w-5 text-rose-500" />
              <h1 className="text-base sm:text-lg font-bold text-foreground">Upload Movie</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="container relative max-w-3xl py-6 sm:py-8 px-4">
        <StepIndicator currentStep={currentStep} />

        {/* Step 1: Details */}
        {currentStep === 1 && (
          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-rose-500" /> Movie Details</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input placeholder="e.g., The Last Frontier" value={formData.title} onChange={(e) => updateForm("title", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <BlockEditor placeholder="Tell viewers about your film..." value={formData.description} onChange={(val) => updateForm("description", val)} />
              </div>
              <div className="space-y-2">
                <Label>Genre *</Label>
                <Select value={formData.genre} onValueChange={(v) => updateForm("genre", v)}>
                  <SelectTrigger><SelectValue placeholder="Select a genre" /></SelectTrigger>
                  <SelectContent>
                    {MOVIE_GENRES.map((g) => (<SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tags</Label>
                <Input placeholder="e.g., indie, thriller, award-winning" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} onBlur={() => updateForm("tags", tagsInput.split(",").map((t) => t.trim()).filter(Boolean))} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Video Upload */}
        {currentStep === 2 && (
          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="flex items-center gap-2"><Film className="h-5 w-5 text-rose-500" /> Upload Video</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {formData.videoFileUrl ? (
                <div className="p-4 rounded-xl bg-muted/50 border border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <Film className="w-5 h-5 text-rose-500 shrink-0" />
                      <span className="text-sm font-medium truncate">{formData.videoFileName}</span>
                    </div>
                    <button onClick={() => { updateForm("videoFileUrl", ""); updateForm("videoFileName", ""); }} className="p-1 text-muted-foreground hover:text-destructive"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {formData.videoFileSize && <span>{formatSize(formData.videoFileSize)}</span>}
                    {formData.videoDuration && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDuration(formData.videoDuration)}</span>}
                    {formData.videoResolution && <Badge variant="secondary" className="text-[10px]">{formData.videoResolution}</Badge>}
                  </div>
                </div>
              ) : (
                <label className="cursor-pointer block">
                  <div className={cn("flex flex-col items-center gap-3 p-8 sm:p-12 rounded-xl border-2 border-dashed transition-colors", uploading ? "border-rose-500/40 bg-rose-500/5" : "border-border hover:border-rose-500/40 hover:bg-rose-500/5")}>
                    {uploading ? <Loader2 className="w-10 h-10 animate-spin text-rose-500" /> : <Upload className="w-10 h-10 text-muted-foreground" />}
                    <div className="text-center">
                      <p className="text-sm font-medium">{uploading ? "Uploading video..." : "Click to upload video file"}</p>
                      <p className="text-xs text-muted-foreground mt-1">MP4, MKV, MOV, AVI, WebM — up to 2GB</p>
                    </div>
                  </div>
                  <input type="file" accept="video/*,.mp4,.mkv,.mov,.avi,.webm,.m4v" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleVideoUpload(f); e.target.value = ""; }} disabled={uploading} />
                </label>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 3: Poster */}
        {currentStep === 3 && (
          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="flex items-center gap-2"><ImageIcon className="h-5 w-5 text-rose-500" /> Movie Poster</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">Recommended: 2:3 portrait ratio (e.g., 1000x1500px). JPG or PNG, max 10MB.</p>
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
                <div className="relative w-36 h-52 sm:w-44 sm:h-64 rounded-xl overflow-hidden bg-muted border-2 border-dashed border-border shrink-0">
                  {formData.coverImageUrl ? (
                    <>
                      <Image src={formData.coverImageUrl} alt="Poster" fill className="object-cover" />
                      <button onClick={() => updateForm("coverImageUrl", "")} className="absolute top-2 right-2 p-1 rounded-full bg-black/50 text-white hover:bg-black/70"><X className="w-3 h-3" /></button>
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground"><Film className="w-10 h-10" /><span className="text-xs">No poster</span></div>
                  )}
                </div>
                <label className="cursor-pointer flex-1 w-full sm:w-auto">
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-border hover:border-rose-500/40 hover:bg-rose-500/5 transition-colors">
                    {coverUploading ? <Loader2 className="w-5 h-5 animate-spin text-rose-500" /> : <Upload className="w-5 h-5 text-muted-foreground" />}
                    <span className="text-sm text-muted-foreground">{coverUploading ? "Uploading..." : "Click to upload poster"}</span>
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCoverUpload(f); }} disabled={coverUploading} />
                </label>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Pricing */}
        {currentStep === 4 && (
          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5 text-rose-500" /> Pricing</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <p className="text-sm text-emerald-700 dark:text-emerald-300"><strong>Streaming is free!</strong> Viewers can watch your film at no cost. The price below is for purchasing a downloadable copy.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Download Price *</Label>
                  <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{currencySymbol}</span><Input type="number" step="0.01" min="0.50" placeholder="4.99" value={formData.price} onChange={(e) => updateForm("price", e.target.value)} className="pl-8" /></div>
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Select value={formData.currency} onValueChange={(v) => updateForm("currency", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="USD">USD ($)</SelectItem><SelectItem value="EUR">EUR (€)</SelectItem><SelectItem value="GBP">GBP (£)</SelectItem></SelectContent></Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Payment Processor</Label>
                <Select value={formData.paymentProcessor} onValueChange={(v) => updateForm("paymentProcessor", v as MovieFormData["paymentProcessor"])} disabled={formData.isNsfw}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PAYPAL">PayPal</SelectItem><SelectItem value="DIVINITYCOIN">DivinityCoin</SelectItem><SelectItem value="WHOP">Whop</SelectItem></SelectContent></Select>
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-center gap-3"><AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" /><div><p className="font-medium text-foreground text-sm">Contains NSFW Content</p><p className="text-xs sm:text-sm text-muted-foreground">If enabled, payments via DivinityCoin only</p></div></div>
                <Switch checked={formData.isNsfw} onCheckedChange={(c) => { updateForm("isNsfw", c); if (c) updateForm("paymentProcessor", "DIVINITYCOIN"); }} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 5: Review */}
        {currentStep === 5 && (
          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="flex items-center gap-2"><Eye className="h-5 w-5 text-rose-500" /> Review Your Movie</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
                <div className="relative w-32 h-48 sm:w-40 sm:h-56 rounded-xl overflow-hidden bg-muted shrink-0 mx-auto sm:mx-0">
                  {formData.coverImageUrl ? <Image src={formData.coverImageUrl} alt={formData.title} fill className="object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-rose-500/30 to-orange-500/30"><Film className="w-12 h-12 text-muted-foreground/50" /></div>}
                </div>
                <div className="text-center sm:text-left">
                  <h3 className="text-xl font-bold text-foreground">{formData.title || "Untitled"}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{MOVIE_GENRES.find((g) => g.value === formData.genre)?.label || "No genre"}</p>
                  <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-2 text-xs text-muted-foreground">
                    {formData.videoDuration && <span>{formatDuration(formData.videoDuration)}</span>}
                    {formData.videoResolution && <Badge variant="secondary" className="text-[10px]">{formData.videoResolution}</Badge>}
                  </div>
                  <p className="text-lg font-bold text-emerald-500 mt-3">{currencySymbol}{parseFloat(formData.price || "0").toFixed(2)} <span className="text-xs text-muted-foreground font-normal">download</span></p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between p-3 rounded-lg bg-muted"><span className="text-muted-foreground">Video File</span><span className="text-foreground truncate ml-2">{formData.videoFileName || "Uploaded"}</span></div>
                <div className="flex justify-between p-3 rounded-lg bg-muted"><span className="text-muted-foreground">Streaming</span><span className="text-emerald-500 font-medium">Free</span></div>
                <div className="flex justify-between p-3 rounded-lg bg-muted"><span className="text-muted-foreground">NSFW</span><span className={formData.isNsfw ? "text-amber-500" : "text-foreground"}>{formData.isNsfw ? "Yes" : "No"}</span></div>
                {formData.tags.length > 0 && (<div className="flex justify-between p-3 rounded-lg bg-muted"><span className="text-muted-foreground">Tags</span><div className="flex flex-wrap gap-1 justify-end">{formData.tags.map((t) => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}</div></div>)}
              </div>
              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20"><p className="text-sm text-blue-600 dark:text-blue-300"><strong>What happens next?</strong> Your movie will be reviewed within 24-48 hours. Once approved, it goes live for free streaming and paid downloads.</p></div>
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8">
          {currentStep > 1 ? <Button variant="outline" onClick={prevStep} className="gap-2"><ArrowLeft className="h-4 w-4" /> Back</Button> : <div />}
          {currentStep < 5 ? (
            <Button onClick={nextStep} className="gap-2 bg-gradient-to-r from-rose-500 to-orange-500 text-white">Next <ArrowRight className="h-4 w-4" /></Button>
          ) : (
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => handleSubmit(true)} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Save as Draft</Button>
              <Button onClick={() => handleSubmit(false)} disabled={saving} className="gap-2 bg-gradient-to-r from-rose-500 to-orange-500 text-white">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Submit for Review</Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
