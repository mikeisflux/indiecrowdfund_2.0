"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  FileText,
  Check,
  Loader2,
  FolderOpen,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ExistingFile } from "./types";

export function PDFFilePicker({
  onSelect,
  currentUrl,
  currentFileName,
  currentStorageKey,
}: {
  onSelect: (url: string, fileName: string, storageKey: string, fileSize?: number) => void;
  currentUrl: string;
  currentFileName: string;
  currentStorageKey: string;
}) {
  const [existingFiles, setExistingFiles] = useState<ExistingFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [mode, setMode] = useState<"select" | "upload">("select");
  const [deleting, setDeleting] = useState(false);

  const fetchExistingFiles = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/creator/marketplace/files");
      if (res.ok) {
        const data = await res.json();
        setExistingFiles(data.files || []);
      }
    } catch (error) {
      console.error("Error fetching files:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch existing files on mount
  useEffect(() => {
    fetchExistingFiles();
  }, [fetchExistingFiles]);

  const handleSelectExisting = (file: ExistingFile) => {
    // Don't encode slashes in the path
    const publicUrl = `/api/r2/serve/${file.key}`;
    onSelect(publicUrl, file.name, file.key, file.size);
    toast.success(`Selected: ${file.name}`);
  };

  const handleUploadNew = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Only PDF files are allowed");
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      // Use server-side upload proxy to bypass CORS issues with R2
      const formData = new FormData();
      formData.append("file", file);

      setUploadProgress(10);

      const uploadRes = await apiFetch("/api/creator/marketplace/files/upload", {
        method: "POST",
        body: formData,
      });

      // Check Content-Type to handle non-JSON error responses
      const contentType = uploadRes.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        // Server returned HTML error page (like 413 Payload Too Large)
        const text = await uploadRes.text();
        console.error("Non-JSON response:", text.substring(0, 500));
        if (uploadRes.status === 413) {
          throw new Error("File is too large for the server. Check nginx/proxy client_max_body_size setting.");
        }
        throw new Error(`Server error: ${uploadRes.status} ${uploadRes.statusText}`);
      }

      const result = await uploadRes.json();

      if (!uploadRes.ok) {
        throw new Error(result.error || "Failed to upload file");
      }

      setUploadProgress(90);

      const { publicUrl, storageKey, fileName: returnedFileName, fileSize: returnedFileSize, isDuplicate } = result;

      setUploadProgress(100);

      // Use returned filename (handles duplicates with different original names)
      onSelect(publicUrl, returnedFileName || file.name, storageKey, returnedFileSize || file.size);

      if (isDuplicate) {
        toast.info("This file was already uploaded. Using existing copy.");
      } else {
        toast.success("PDF uploaded successfully!");
      }

      await fetchExistingFiles();
      setMode("select");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async () => {
    if (!currentStorageKey) {
      onSelect("", "", "");
      toast.info("PDF file removed");
      return;
    }

    setDeleting(true);
    try {
      const response = await apiFetch(
        `/api/creator/marketplace/files?key=${encodeURIComponent(currentStorageKey)}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const error = await response.json();
        if (error.error?.includes("in use")) {
          onSelect("", "", "");
          toast.info("PDF file unselected (file kept in storage as it's used by another book)");
          return;
        }
        throw new Error(error.error || "Failed to delete file");
      }

      onSelect("", "", "");
      await fetchExistingFiles();
      toast.success("PDF file deleted successfully");
    } catch (error) {
      console.error("Delete error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete file");
    } finally {
      setDeleting(false);
    }
  };

  if (currentUrl) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Label>PDF File</Label>
          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full">
            Linked
          </span>
        </div>
        <div className="p-4 rounded-xl bg-emerald-500/10 border-2 border-emerald-500/30 relative">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-emerald-500/20">
              <FileText className="w-8 h-8 text-emerald-500 dark:text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-foreground font-semibold text-lg">
                {currentFileName || "PDF File"}
              </p>
              <p className="text-emerald-600 dark:text-emerald-400 text-sm font-medium flex items-center gap-1 mt-1">
                <Check className="w-4 h-4" />
                File linked and ready
              </p>
            </div>
          </div>
          {/* Delete button */}
          <button
            type="button"
            disabled={deleting}
            onClick={handleDelete}
            className="absolute top-2 right-2 p-2 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-lg transition-colors disabled:opacity-50"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label>PDF File</Label>
          <span className="text-xs font-medium text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full">
            Required
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={mode === "select" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("select")}
            className={mode === "select"
              ? "bg-purple-500/20 text-purple-600 dark:text-purple-300 border-purple-500/30"
              : ""
            }
          >
            <FolderOpen className="w-4 h-4 mr-2" />
            Choose Existing
          </Button>
          <Button
            type="button"
            variant={mode === "upload" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("upload")}
            className={mode === "upload"
              ? "bg-purple-500/20 text-purple-600 dark:text-purple-300 border-purple-500/30"
              : ""
            }
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload New
          </Button>
        </div>
      </div>

      {mode === "select" && (
        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-purple-500 dark:text-purple-400" />
            </div>
          ) : existingFiles.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed border-border rounded-xl">
              <FileText className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">No PDFs uploaded yet</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => setMode("upload")}
              >
                Upload your first PDF
              </Button>
            </div>
          ) : (
            <div className="grid gap-2 max-h-64 overflow-y-auto">
              {existingFiles.map((file) => (
                <button
                  key={file.id}
                  onClick={() => handleSelectExisting(file)}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted hover:bg-muted/80 border border-border hover:border-purple-500/30 transition-all text-left"
                >
                  <div className="p-2 rounded-lg bg-purple-500/20">
                    <FileText className="w-5 h-5 text-purple-500 dark:text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground font-medium truncate">{file.name}</p>
                    <p className="text-muted-foreground text-sm">{file.sizeFormatted}</p>
                  </div>
                  <Check className="w-5 h-5 text-muted-foreground/50" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {mode === "upload" && (
        <div
          className={cn(
            "relative border-2 border-dashed rounded-xl p-8 text-center transition-all",
            uploading ? "border-purple-500 bg-purple-500/10" : "border-border hover:border-purple-500/50 cursor-pointer"
          )}
          onClick={() => {
            if (uploading) return;
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".pdf,application/pdf";
            input.onchange = (e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (file) handleUploadNew(file);
            };
            input.click();
          }}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-purple-500 dark:text-purple-400" />
              <div className="w-48 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-muted-foreground">Uploading to cloud storage...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="h-10 w-10 text-muted-foreground" />
              <p className="text-muted-foreground">Click to upload or drag & drop</p>
              <p className="text-xs text-muted-foreground/70">PDF files only (max 100MB)</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
