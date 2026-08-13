"use client";

import { useRef, useState } from "react";
import { apiFetch } from "@/lib/fetch-utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Loader2, Upload, Trash2, FileText } from "lucide-react";

// Creator-facing manager for the campaign page's interior preview.
//
// One PDF. It's rasterised in the backer's browser by pdf.js and rendered in
// the same page-turn reader the Digital Library uses, so what the creator
// exports is exactly what backers flip through.
//
// The file is served publicly from /api/uploads, which means anyone can pull
// it out of the network tab in full. There is no way around that — a page the
// browser can render is a file the browser has already fetched — so the rule
// stated in the UI below is the actual protection: upload the preview, not the
// book. The warning is deliberately blunt for that reason.
//
// Only campaigns on layout v2 render this; the section is hidden otherwise.

const MAX_BYTES = 50 * 1024 * 1024;

interface InteriorPreviewSectionProps {
  projectId: string | null;
  pdfUrl: string;
  onChange: (pdfUrl: string) => void;
}

export function InteriorPreviewSection({
  projectId,
  pdfUrl,
  onChange,
}: InteriorPreviewSectionProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;

    if (!projectId) {
      toast.error("Save the campaign first, then add a preview.");
      return;
    }

    if (file.type !== "application/pdf") {
      toast.error("The interior preview needs to be a PDF.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    if (file.size > MAX_BYTES) {
      toast.error("That PDF is over 50MB. Export it at a lower resolution and try again.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("projectId", projectId);
      formData.append("type", "preview");

      const res = await apiFetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Upload failed");
      }
      const result = await res.json();
      if (!result.url) {
        throw new Error("Upload didn't return a file URL");
      }

      onChange(result.url);
      toast.success("Interior preview uploaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload the preview PDF");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          Interior preview
        </CardTitle>
        <CardDescription>
          A PDF of the pages backers can flip through on your campaign page, in a real
          page-turn reader.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/30">
          <p className="text-amber-800 dark:text-amber-200">
            <strong>Upload a preview PDF, not your finished book.</strong> This file is
            public — anyone visiting your campaign can download the whole thing from
            their browser. Export only the pages you&apos;re happy to give away. Most
            creators use 5&ndash;10 pages: enough to sell the book, not enough to
            replace it.
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => handleFile(e.target.files)}
        />

        {pdfUrl ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
            <FileText className="h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Preview PDF attached</p>
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                Open it to check the pages
              </a>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading&hellip;
                </>
              ) : (
                "Replace"
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange("")}
              disabled={uploading}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Remove
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={uploading || !projectId}
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading&hellip;
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload preview PDF
              </>
            )}
          </Button>
        )}

        {!projectId && (
          <p className="text-sm text-muted-foreground">
            Save the campaign once and this will unlock — the preview is stored against
            the project.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
