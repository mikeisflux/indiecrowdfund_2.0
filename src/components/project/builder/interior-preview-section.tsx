"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { apiFetch } from "@/lib/fetch-utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Loader2, Upload, X, ArrowLeft, ArrowRight } from "lucide-react";

// Creator-facing manager for the campaign page's interior preview.
//
// The preview is an ordered list of images rendered in the page-turn reader on
// the campaign page. Images rather than a PDF, deliberately: a public campaign
// page can only show a PDF the browser is able to fetch, so the source file
// would be downloadable in full from the network tab — a creator who uploaded
// their finished book as "the preview" would be giving the whole thing away.
// Picking pages means nothing becomes public that wasn't chosen.
//
// Only campaigns on layout v2 render this; the section is hidden otherwise.

const MAX_PAGES = 24;
const MAX_BYTES = 10 * 1024 * 1024;

interface InteriorPreviewSectionProps {
  projectId: string | null;
  images: string[];
  onChange: (images: string[]) => void;
}

export function InteriorPreviewSection({
  projectId,
  images,
  onChange,
}: InteriorPreviewSectionProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    if (!projectId) {
      toast.error("Save the campaign first, then add preview pages.");
      return;
    }

    const picked = Array.from(files);
    const room = MAX_PAGES - images.length;
    if (room <= 0) {
      toast.error(`Preview is limited to ${MAX_PAGES} pages.`);
      return;
    }
    const batch = picked.slice(0, room);
    if (picked.length > room) {
      toast.info(`Only ${room} more page${room === 1 ? "" : "s"} will fit — the rest were skipped.`);
    }

    setUploading(true);
    setProgress({ done: 0, total: batch.length });

    // Sequential, not parallel: the order the creator selected the files in is
    // the reading order, and concurrent uploads would finish out of sequence.
    const uploaded: string[] = [];
    try {
      for (let i = 0; i < batch.length; i++) {
        const file = batch[i];

        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name} isn't an image — skipped.`);
          continue;
        }
        if (file.size > MAX_BYTES) {
          toast.error(`${file.name} is over 10MB — skipped.`);
          continue;
        }

        const formData = new FormData();
        formData.append("file", file);
        formData.append("projectId", projectId);
        formData.append("type", "preview");

        const res = await apiFetch("/api/upload", { method: "POST", body: formData });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Upload failed for ${file.name}`);
        }
        const result = await res.json();
        if (result.url) uploaded.push(result.url);
        setProgress({ done: i + 1, total: batch.length });
      }

      if (uploaded.length > 0) {
        onChange([...images, ...uploaded]);
        toast.success(`Added ${uploaded.length} preview page${uploaded.length === 1 ? "" : "s"}`);
      }
    } catch (error) {
      // Keep whatever did upload — losing five successful pages because the
      // sixth failed would be worse than a partial result.
      if (uploaded.length > 0) onChange([...images, ...uploaded]);
      toast.error(error instanceof Error ? error.message : "Failed to upload preview pages");
    } finally {
      setUploading(false);
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= images.length) return;
    const next = [...images];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  const remove = (index: number) => {
    onChange(images.filter((_, i) => i !== index));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          Interior preview
        </CardTitle>
        <CardDescription>
          Pages backers can flip through on your campaign page, in a real page-turn
          reader. Upload them in reading order — you can reorder them below.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/30">
          <p className="text-amber-800 dark:text-amber-200">
            <strong>Only upload pages you&apos;re happy to show publicly.</strong> Anyone
            visiting your campaign can view and save these images. Most creators use
            5&ndash;10 pages &mdash; enough to sell the book, not enough to replace it.
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={uploading || !projectId || images.length >= MAX_PAGES}
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {progress ? `Uploading ${progress.done} of ${progress.total}…` : "Uploading…"}
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Add pages
              </>
            )}
          </Button>
          <span className="text-sm text-muted-foreground">
            {images.length} of {MAX_PAGES} pages
          </span>
        </div>

        {!projectId && (
          <p className="text-sm text-muted-foreground">
            Save the campaign once and this will unlock — pages are stored against the
            project.
          </p>
        )}

        {images.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {images.map((src, index) => (
              <div key={`${src}-${index}`} className="group relative">
                <div className="relative aspect-[2/3] overflow-hidden rounded-md border bg-muted">
                  <Image
                    src={src}
                    alt={`Preview page ${index + 1}`}
                    fill
                    sizes="(max-width: 640px) 50vw, 16vw"
                    className="object-cover"
                  />
                  <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white tabular-nums">
                    {index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    aria-label={`Remove page ${index + 1}`}
                    className="absolute right-1 top-1 rounded bg-black/70 p-1 text-white opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
                <div className="mt-1 flex justify-center gap-1">
                  <button
                    type="button"
                    onClick={() => move(index, index - 1)}
                    disabled={index === 0}
                    aria-label={`Move page ${index + 1} earlier`}
                    className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    <ArrowLeft className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, index + 1)}
                    disabled={index === images.length - 1}
                    aria-label={`Move page ${index + 1} later`}
                    className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
