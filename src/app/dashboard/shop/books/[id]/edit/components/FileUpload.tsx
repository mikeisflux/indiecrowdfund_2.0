"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useState, useCallback } from "react";
import { Label } from "@/components/ui/label";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function FileUpload({
  label,
  accept,
  onUpload,
  currentUrl,
  icon: Icon,
  description,
}: {
  label: string;
  accept: string;
  onUpload: (url: string, fileName?: string) => void;
  currentUrl: string;
  icon: React.ElementType;
  description: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", accept.includes("pdf") ? "pdf" : accept.includes("video") ? "video" : "image");

      const res = await apiFetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }

      const data = await res.json();
      onUpload(data.url, file.name);
      toast.success(`${label} uploaded successfully`);
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div
        className={cn(
          "relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer",
          dragActive ? "border-purple-500 bg-purple-500/10" : "border-border hover:border-purple-500/50",
          currentUrl && "border-emerald-500/50 bg-emerald-500/5"
        )}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = accept;
          input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) handleUpload(file);
          };
          input.click();
        }}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-10 w-10 animate-spin text-purple-500 dark:text-purple-400" />
            <p className="text-muted-foreground">Uploading...</p>
          </div>
        ) : currentUrl ? (
          <div className="flex flex-col items-center gap-2">
            <Check className="h-10 w-10 text-emerald-500 dark:text-emerald-400" />
            <p className="text-emerald-500 dark:text-emerald-400">File uploaded</p>
            <p className="text-xs text-muted-foreground truncate max-w-xs">{currentUrl}</p>
            <p className="text-xs text-purple-500 dark:text-purple-400 mt-1">Click to replace</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Icon className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">{description}</p>
            <p className="text-xs text-muted-foreground/70">Click or drag & drop</p>
          </div>
        )}
        {/* Delete button - positioned in corner */}
        {currentUrl && !uploading && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onUpload("");
              toast.info(`${label} removed`);
            }}
            className="absolute top-2 right-2 p-2 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-lg transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
