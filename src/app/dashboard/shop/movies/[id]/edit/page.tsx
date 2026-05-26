"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
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
  Loader2,
  AlertTriangle,
  Save,
  Upload,
  X,
  Clock,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

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
  { value: "experimental", label: "Experimental" },
  { value: "western", label: "Western" },
  { value: "other", label: "Other" },
];

export default function EditMoviePage() {
  const router = useRouter();
  const params = useParams();
  const bookId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingProcessor, setSavingProcessor] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [bookStatus, setBookStatus] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [genre, setGenre] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [videoFileUrl, setVideoFileUrl] = useState("");
  const [videoFileName, setVideoFileName] = useState("");
  const [videoFileSize, setVideoFileSize] = useState<number | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [videoResolution, setVideoResolution] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [paymentProcessor, setPaymentProcessor] = useState("PAYPAL");
  const [isNsfw, setIsNsfw] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagsInput, setTagsInput] = useState("");

  const fetchBook = useCallback(async () => {
    try {
      const res = await fetch(`/api/creator/marketplace/books/${bookId}`);
      if (!res.ok) { toast.error("Film not found"); router.push("/dashboard/shop"); return; }
      const data = await res.json();
      const b = data.book;
      setTitle(b.title);
      setDescription(b.description || "");
      setGenre(b.category || "");
      setCoverImageUrl(b.coverImage || "");
      setVideoFileUrl(b.videoFileUrl || "");
      setVideoFileName(b.videoFileName || "");
      setVideoFileSize(b.videoFileSize || null);
      setVideoDuration(b.videoDuration || null);
      setVideoResolution(b.videoResolution || "");
      setPrice(String(b.price));
      setCurrency(b.currency);
      setPaymentProcessor(b.paymentProcessor);
      setIsNsfw(b.isNsfw);
      setTags(b.tags || []);
      setTagsInput((b.tags || []).join(", "));
      setBookStatus(b.status);
    } catch { toast.error("Failed to load film"); router.push("/dashboard/shop"); }
    finally { setLoading(false); }
  }, [bookId, router]);

  useEffect(() => { fetchBook(); }, [fetchBook]);

  const handleVideoUpload = async (file: File) => {
    if (!file.type.startsWith("video/") && !/\.(mp4|mkv|mov|avi|webm|m4v)$/i.test(file.name)) {
      toast.error("Only video files allowed"); return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiFetch("/api/creator/marketplace/video/upload", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setVideoFileUrl(data.url);
      setVideoFileName(file.name);
      setVideoFileSize(file.size);
      // Detect duration + resolution
      try {
        const video = document.createElement("video");
        video.preload = "metadata";
        video.src = URL.createObjectURL(file);
        await new Promise<void>((resolve) => {
          video.onloadedmetadata = () => {
            setVideoDuration(Math.round(video.duration));
            if (video.videoHeight) {
              const h = video.videoHeight;
              setVideoResolution(h >= 2160 ? "4K" : h >= 1440 ? "1440p" : h >= 1080 ? "1080p" : h >= 720 ? "720p" : `${h}p`);
            }
            URL.revokeObjectURL(video.src);
            resolve();
          };
          video.onerror = () => { URL.revokeObjectURL(video.src); resolve(); };
          setTimeout(resolve, 5000);
        });
      } catch { /* ignore */ }
      toast.success("Video file replaced!");
    } catch { toast.error("Failed to upload video"); }
    finally { setUploading(false); }
  };

  const handleCoverUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Select an image"); return; }
    setCoverUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "marketplace-covers");
      const res = await apiFetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setCoverImageUrl(data.url);
      toast.success("Poster updated!");
    } catch { toast.error("Failed to upload poster"); }
    finally { setCoverUploading(false); }
  };

  const handleSaveProcessor = async () => {
    setSavingProcessor(true);
    try {
      const res = await apiFetch(
        `/api/creator/marketplace/books/${bookId}/payment-processor`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentProcessor }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Failed to update payment processor");
        return;
      }
      toast.success(data.unchanged ? "Payment processor already set" : "Payment processor updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Network error");
    } finally {
      setSavingProcessor(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) { toast.error("Title is required"); return; }
    setSaving(true);
    try {
      const res = await apiFetch(`/api/creator/marketplace/books/${bookId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, description, category: genre, promoImageUrl: coverImageUrl,
          videoFileUrl, videoFileName,
          videoFileSize: videoFileSize ? Number(videoFileSize) : null,
          videoDuration: videoDuration ? Number(videoDuration) : null,
          videoResolution,
          price: parseFloat(price), currency, paymentProcessor,
          isNsfw, tags,
        }),
      });
      if (!res.ok) {
        let errorMsg = "Failed to save";
        try { const d = await res.json(); errorMsg = d.error || errorMsg; } catch { /* non-JSON response */ }
        throw new Error(errorMsg);
      }
      toast.success("Film updated!");
      router.push("/dashboard/shop");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Failed to save"); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this film?")) return;
    try {
      const res = await apiFetch(`/api/creator/marketplace/books/${bookId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success("Film deleted");
      router.push("/dashboard/shop");
    } catch { toast.error("Failed to delete"); }
  };

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
  const currencySymbol = currency === "EUR" ? "€" : currency === "GBP" ? "£" : "$";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="container flex h-14 sm:h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/shop" className="p-2 rounded-lg hover:bg-muted"><ArrowLeft className="h-5 w-5" /></Link>
            <div className="flex items-center gap-2">
              <Film className="h-5 w-5 text-rose-500" />
              <h1 className="text-base sm:text-lg font-bold">Edit Film</h1>
            </div>
            {bookStatus && <Badge variant="secondary" className="text-xs">{bookStatus}</Badge>}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="destructive" size="sm" onClick={handleDelete} className="gap-1.5">
              <Trash2 className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Delete</span>
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-1.5 bg-rose-600 hover:bg-rose-700 text-white" size="sm">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">Save</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-3xl py-6 sm:py-8 px-4 space-y-6">
        {/* Film Info */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Film className="w-4 h-4 text-rose-500" /> Film Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <BlockEditor value={description} onChange={setDescription} placeholder="About this film..." />
            </div>
            <div className="space-y-2">
              <Label>Genre</Label>
              <Select value={genre} onValueChange={setGenre}>
                <SelectTrigger><SelectValue placeholder="Select genre" /></SelectTrigger>
                <SelectContent>{MOVIE_GENRES.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tags</Label>
              <Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} onBlur={() => setTags(tagsInput.split(",").map((t) => t.trim()).filter(Boolean))} placeholder="indie, thriller, award-winning" />
            </div>
          </CardContent>
        </Card>

        {/* Video File */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Film className="w-4 h-4 text-rose-500" /> Video File</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {videoFileUrl && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border">
                <Film className="w-5 h-5 text-rose-500 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{videoFileName || "Video file"}</p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    {videoDuration && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDuration(videoDuration)}</span>}
                    {videoFileSize && <span>{formatSize(videoFileSize)}</span>}
                    {videoResolution && <Badge variant="secondary" className="text-[10px]">{videoResolution}</Badge>}
                  </div>
                </div>
              </div>
            )}
            <label className="cursor-pointer block">
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-border hover:border-rose-500/40 hover:bg-rose-500/5 transition-colors">
                {uploading ? <Loader2 className="w-5 h-5 animate-spin text-rose-500" /> : <Upload className="w-5 h-5 text-muted-foreground" />}
                <span className="text-sm text-muted-foreground">{uploading ? "Uploading..." : "Replace video file"}</span>
              </div>
              <input type="file" accept="video/*,.mp4,.mkv,.mov,.avi,.webm,.m4v" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleVideoUpload(f); e.target.value = ""; }} disabled={uploading} />
            </label>
          </CardContent>
        </Card>

        {/* Movie Poster */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base">Movie Poster</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
              <div className="relative w-32 h-48 sm:w-40 sm:h-56 rounded-xl overflow-hidden bg-muted shrink-0">
                {coverImageUrl ? (
                  <>
                    <Image src={coverImageUrl} alt="Poster" fill className="object-cover" />
                    <button onClick={() => setCoverImageUrl("")} className="absolute top-2 right-2 p-1 rounded-full bg-black/50 text-white hover:bg-black/70"><X className="w-3 h-3" /></button>
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><Film className="w-10 h-10 text-muted-foreground/30" /></div>
                )}
              </div>
              <label className="cursor-pointer">
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-border hover:border-rose-500/40 transition-colors">
                  {coverUploading ? <Loader2 className="w-5 h-5 animate-spin text-rose-500" /> : <Upload className="w-5 h-5 text-muted-foreground" />}
                  <span className="text-sm text-muted-foreground">{coverUploading ? "Uploading..." : "Replace poster"}</span>
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCoverUpload(f); }} disabled={coverUploading} />
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Pricing */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base">Pricing</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-sm text-emerald-700 dark:text-emerald-300"><strong>Streaming is free.</strong> This price is for downloading.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Download Price</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{currencySymbol}</span>
                  <Input type="number" step="0.01" min="0.50" value={price} onChange={(e) => setPrice(e.target.value)} className="pl-8" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select value={currency} onValueChange={setCurrency}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="EUR">EUR</SelectItem><SelectItem value="GBP">GBP</SelectItem></SelectContent></Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Payment Processor</Label>
              <div className="flex gap-2">
                <Select value={paymentProcessor} onValueChange={setPaymentProcessor} disabled={isNsfw}>
                  <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="PAYPAL">PayPal</SelectItem><SelectItem value="DIVINITYCOIN">Divinity Payments</SelectItem><SelectItem value="WHOP">Whop</SelectItem></SelectContent>
                </Select>
                <Button type="button" variant="outline" onClick={handleSaveProcessor} disabled={savingProcessor || isNsfw} className="shrink-0">
                  {savingProcessor ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span className="ml-2">Save</span>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Switch processors anytime — saved immediately, no re-review needed.</p>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-center gap-3"><AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" /><div><p className="font-medium text-sm">NSFW Content</p><p className="text-xs text-muted-foreground">Divinity Payments only</p></div></div>
              <Switch checked={isNsfw} onCheckedChange={(c) => { setIsNsfw(c); if (c) setPaymentProcessor("DIVINITYCOIN"); }} />
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
