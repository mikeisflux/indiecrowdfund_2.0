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
  Music,
  ArrowLeft,
  Loader2,
  AlertTriangle,
  Save,
  Upload,
  X,
  Clock,
  Disc3,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

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

export default function EditMusicPage() {
  const router = useRouter();
  const params = useParams();
  const bookId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [bookStatus, setBookStatus] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [genre, setGenre] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [audioFileUrl, setAudioFileUrl] = useState("");
  const [audioFileName, setAudioFileName] = useState("");
  const [audioFileSize, setAudioFileSize] = useState<number | null>(null);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [paymentProcessor, setPaymentProcessor] = useState("PAYPAL");
  const [isNsfw, setIsNsfw] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagsInput, setTagsInput] = useState("");

  const fetchBook = useCallback(async () => {
    try {
      const res = await fetch(`/api/creator/marketplace/books/${bookId}`);
      if (!res.ok) { toast.error("Track not found"); router.push("/dashboard/marketplace"); return; }
      const data = await res.json();
      const b = data.book;
      setTitle(b.title);
      setDescription(b.description || "");
      setGenre(b.category || "");
      setCoverImageUrl(b.coverImage || "");
      setAudioFileUrl(b.audioFileUrl || b.pdfFileUrl || "");
      setAudioFileName(b.audioFileName || "");
      setAudioFileSize(b.audioFileSize || null);
      setAudioDuration(b.audioDuration || null);
      setPrice(String(b.price));
      setCurrency(b.currency);
      setPaymentProcessor(b.paymentProcessor);
      setIsNsfw(b.isNsfw);
      setTags(b.tags || []);
      setTagsInput((b.tags || []).join(", "));
      setBookStatus(b.status);
    } catch { toast.error("Failed to load track"); router.push("/dashboard/marketplace"); }
    finally { setLoading(false); }
  }, [bookId, router]);

  useEffect(() => { fetchBook(); }, [fetchBook]);

  const handleAudioUpload = async (file: File) => {
    if (!file.type.startsWith("audio/") && !/\.(mp3|wav|flac|aac|ogg|m4a)$/i.test(file.name)) {
      toast.error("Only audio files allowed"); return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiFetch("/api/creator/marketplace/audio/upload", { method: "POST", body: fd });
      if (!res.ok) {
        let errorMsg = "Upload failed";
        try { const d = await res.json(); errorMsg = d.error || errorMsg; } catch { /* non-JSON response */ }
        throw new Error(errorMsg);
      }
      const data = await res.json();
      setAudioFileUrl(data.url);
      setAudioFileName(file.name);
      setAudioFileSize(file.size);
      // Detect duration
      try {
        const audio = new Audio();
        audio.src = URL.createObjectURL(file);
        await new Promise<void>((resolve) => {
          audio.onloadedmetadata = () => { setAudioDuration(Math.round(audio.duration)); URL.revokeObjectURL(audio.src); resolve(); };
          audio.onerror = () => { URL.revokeObjectURL(audio.src); resolve(); };
          setTimeout(resolve, 3000);
        });
      } catch { /* ignore */ }
      toast.success("Audio file replaced!");
    } catch { toast.error("Failed to upload audio"); }
    finally { setUploading(false); }
  };

  const handleCoverUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Select an image file"); return; }
    setCoverUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "marketplace-covers");
      const res = await apiFetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setCoverImageUrl(data.url);
      toast.success("Cover updated!");
    } catch { toast.error("Failed to upload cover"); }
    finally { setCoverUploading(false); }
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
          audioFileUrl, audioFileName,
          audioFileSize: audioFileSize ? Number(audioFileSize) : null,
          audioDuration: audioDuration ? Number(audioDuration) : null,
          price: parseFloat(price), currency, paymentProcessor,
          isNsfw, tags,
        }),
      });
      if (!res.ok) {
        let errorMsg = "Failed to save";
        try { const d = await res.json(); errorMsg = d.error || errorMsg; } catch { /* non-JSON response */ }
        throw new Error(errorMsg);
      }
      toast.success("Track updated!");
      router.push("/dashboard/marketplace");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Failed to save"); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this track?")) return;
    try {
      const res = await apiFetch(`/api/creator/marketplace/books/${bookId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success("Track deleted");
      router.push("/dashboard/marketplace");
    } catch { toast.error("Failed to delete"); }
  };

  const formatDuration = (s: number | null) => {
    if (!s) return "--:--";
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };
  const formatSize = (b: number | null) => {
    if (!b) return "";
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
    return `${(b / (1024 * 1024)).toFixed(1)} MB`;
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
            <Link href="/dashboard/marketplace" className="p-2 rounded-lg hover:bg-muted"><ArrowLeft className="h-5 w-5" /></Link>
            <div className="flex items-center gap-2">
              <Music className="h-5 w-5 text-emerald-500" />
              <h1 className="text-base sm:text-lg font-bold">Edit Track</h1>
            </div>
            {bookStatus && <Badge variant="secondary" className="text-xs">{bookStatus}</Badge>}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="destructive" size="sm" onClick={handleDelete} className="gap-1.5">
              <Trash2 className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Delete</span>
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white" size="sm">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">Save</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-3xl py-6 sm:py-8 px-4 space-y-6">
        {/* Track Info */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Music className="w-4 h-4 text-emerald-500" /> Track Info</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <BlockEditor value={description} onChange={setDescription} placeholder="About this track..." />
            </div>
            <div className="space-y-2">
              <Label>Genre</Label>
              <Select value={genre} onValueChange={setGenre}>
                <SelectTrigger><SelectValue placeholder="Select genre" /></SelectTrigger>
                <SelectContent>{MUSIC_GENRES.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tags</Label>
              <Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} onBlur={() => setTags(tagsInput.split(",").map((t) => t.trim()).filter(Boolean))} placeholder="chill, vibes, acoustic" />
            </div>
          </CardContent>
        </Card>

        {/* Audio File */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Disc3 className="w-4 h-4 text-emerald-500" /> Audio File</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {audioFileUrl && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border">
                <Music className="w-5 h-5 text-emerald-500 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{audioFileName || "Audio file"}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    {audioDuration && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDuration(audioDuration)}</span>}
                    {audioFileSize && <span>{formatSize(audioFileSize)}</span>}
                  </div>
                </div>
              </div>
            )}
            <label className="cursor-pointer block">
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-border hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-colors">
                {uploading ? <Loader2 className="w-5 h-5 animate-spin text-emerald-500" /> : <Upload className="w-5 h-5 text-muted-foreground" />}
                <span className="text-sm text-muted-foreground">{uploading ? "Uploading..." : "Replace audio file"}</span>
              </div>
              <input type="file" accept="audio/*,.mp3,.wav,.flac,.aac,.ogg,.m4a" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAudioUpload(f); e.target.value = ""; }} disabled={uploading} />
            </label>
          </CardContent>
        </Card>

        {/* Cover Art */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base">Cover Art</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
              <div className="relative w-32 h-32 sm:w-40 sm:h-40 rounded-xl overflow-hidden bg-muted shrink-0">
                {coverImageUrl ? (
                  <>
                    <Image src={coverImageUrl} alt="Cover" fill className="object-cover" />
                    <button onClick={() => setCoverImageUrl("")} className="absolute top-2 right-2 p-1 rounded-full bg-black/50 text-white hover:bg-black/70"><X className="w-3 h-3" /></button>
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><Disc3 className="w-10 h-10 text-muted-foreground/30" /></div>
                )}
              </div>
              <label className="cursor-pointer">
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-border hover:border-emerald-500/40 transition-colors">
                  {coverUploading ? <Loader2 className="w-5 h-5 animate-spin text-emerald-500" /> : <Upload className="w-5 h-5 text-muted-foreground" />}
                  <span className="text-sm text-muted-foreground">{coverUploading ? "Uploading..." : "Replace cover art"}</span>
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
              <Select value={paymentProcessor} onValueChange={setPaymentProcessor} disabled={isNsfw}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PAYPAL">PayPal</SelectItem><SelectItem value="DIVINITYCOIN">DivinityCoin</SelectItem><SelectItem value="WHOP">Whop</SelectItem></SelectContent></Select>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-center gap-3"><AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" /><div><p className="font-medium text-sm">Explicit Content</p><p className="text-xs text-muted-foreground">DivinityCoin only</p></div></div>
              <Switch checked={isNsfw} onCheckedChange={(c) => { setIsNsfw(c); if (c) setPaymentProcessor("DIVINITYCOIN"); }} />
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
