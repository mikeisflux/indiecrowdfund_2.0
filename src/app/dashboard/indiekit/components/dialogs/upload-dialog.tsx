"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Upload, FileText, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";


interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
  onUploaded?: () => void;
}

export function UploadDialog({ open, onOpenChange, projectId, onUploaded }: UploadDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClose = (isOpen: boolean) => {
    if (!isOpen && !isUploading) {
      // Reset to default when closing
      setSelectedFile(null);
      setUploadProgress(0);
    }
    if (!isUploading) {
      onOpenChange(isOpen);
    }
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }, []);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select a file");
      return;
    }
    if (!projectId) {
      toast.error("No project selected");
      return;
    }

    setIsUploading(true);
    setUploadProgress(2);

    // Files above this size go through R2 multipart upload (separate
    // short PUTs per chunk) instead of a single browser-to-R2 PUT.
    // Single-PUT works fine for small files; at >100MB the long-lived
    // TCP becomes fragile across residential / CGNAT networks and
    // failures surface as the misleading "CORS request did not
    // succeed". 50MB chunks → 18 parts for a 900MB file.
    const MULTIPART_THRESHOLD = 100 * 1024 * 1024;
    const CHUNK_SIZE = 50 * 1024 * 1024;

    const reportClientFailure = (reason: string, extra: Record<string, unknown> = {}) => {
      try {
        void fetch("/api/error-report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: `[digital-file-upload] ${reason}`,
            url: typeof window !== "undefined" ? window.location.href : "",
            metadata: {
              fileName: selectedFile.name,
              fileSize: selectedFile.size,
              fileType: selectedFile.type || "application/octet-stream",
              userAgent: navigator.userAgent,
              ...extra,
            },
          }),
          keepalive: true,
        }).catch(() => {});
      } catch {}
    };

    try {
      if (selectedFile.size > MULTIPART_THRESHOLD) {
        // ---- Multipart path ----
        const initRes = await apiFetch("/api/creator/digital-files/multipart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "init",
            projectId,
            fileName: selectedFile.name,
            fileSize: selectedFile.size,
            mimeType: selectedFile.type || "application/octet-stream",
            name: selectedFile.name,
          }),
        });
        if (!initRes.ok) {
          const data = await initRes.json();
          throw new Error(data.error || "Failed to initiate multipart upload");
        }
        const { fileId, uploadId } = await initRes.json();
        setUploadProgress(5);

        const totalParts = Math.ceil(selectedFile.size / CHUNK_SIZE);
        const parts: { partNumber: number; etag: string }[] = [];
        let bytesUploaded = 0;

        try {
          for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
            const start = (partNumber - 1) * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, selectedFile.size);
            const chunk = selectedFile.slice(start, end);

            // Server-proxy upload: browser POSTs the chunk to our
            // origin (same-origin -> no CORS preflight, no
            // r2.cloudflarestorage.com to reach), and our server
            // forwards to R2 over its own clean upstream. This
            // bypasses the network-layer block creators have been
            // hitting on direct browser-to-R2 PUTs.
            //
            // CSRF: include the token so the proxy lets the POST
            // through. apiFetch can't be used here because it
            // JSON.stringify's the body -- we need raw bytes.
            const csrfToken =
              typeof document !== "undefined"
                ? document.cookie.match(/csrf_token=([^;]+)/)?.[1] || ""
                : "";

            const etag = await new Promise<string>((resolve, reject) => {
              const xhr = new XMLHttpRequest();
              const proxyUrl = `/api/creator/digital-files/multipart?action=upload-part&fileId=${encodeURIComponent(
                fileId
              )}&uploadId=${encodeURIComponent(uploadId)}&partNumber=${partNumber}`;
              xhr.open("POST", proxyUrl);
              xhr.setRequestHeader("Content-Type", "application/octet-stream");
              if (csrfToken) xhr.setRequestHeader("X-CSRF-Token", csrfToken);

              xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                  const total = selectedFile.size;
                  const done = bytesUploaded + event.loaded;
                  setUploadProgress(Math.round(5 + (done / total) * 90));
                }
              };

              xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                  try {
                    const data = JSON.parse(xhr.responseText);
                    if (!data.etag) {
                      reportClientFailure("Proxy response missing etag", {
                        partNumber,
                        phase: "proxy-upload-part",
                        xhrResponse: (xhr.responseText || "").slice(0, 500),
                      });
                      reject(new Error(`Part ${partNumber} returned no etag`));
                      return;
                    }
                    resolve(data.etag);
                  } catch {
                    reportClientFailure("Proxy response parse failed", {
                      partNumber,
                      phase: "proxy-upload-part",
                      xhrResponse: (xhr.responseText || "").slice(0, 500),
                    });
                    reject(new Error(`Part ${partNumber} parse failed`));
                  }
                } else {
                  reportClientFailure("HTTP error uploading part via proxy", {
                    partNumber,
                    xhrStatus: xhr.status,
                    xhrStatusText: xhr.statusText,
                    xhrResponse: (xhr.responseText || "").slice(0, 1000),
                    phase: "proxy-upload-part",
                  });
                  reject(new Error(`Part ${partNumber} failed with status ${xhr.status}`));
                }
              };
              xhr.onerror = () => {
                reportClientFailure("Network error uploading part via proxy", {
                  partNumber,
                  phase: "proxy-upload-part",
                });
                reject(new Error(`Network error on part ${partNumber}`));
              };
              xhr.onabort = () => reject(new Error("Upload cancelled"));

              xhr.send(chunk);
            });

            parts.push({ partNumber, etag });
            bytesUploaded += end - start;
          }

          const completeRes = await apiFetch("/api/creator/digital-files/multipart", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "complete",
              fileId,
              uploadId,
              parts,
            }),
          });
          if (!completeRes.ok) {
            const data = await completeRes.json();
            throw new Error(data.error || "Failed to complete upload");
          }
        } catch (err) {
          // Best-effort abort so R2 doesn't keep storing the partial
          // parts (and the DB row goes too). Don't await failure --
          // we want to surface the original error.
          void apiFetch("/api/creator/digital-files/multipart", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "abort", fileId, uploadId }),
          }).catch(() => {});
          throw err;
        }
      } else {
        // ---- Single-PUT path (small files) ----
        const res = await apiFetch("/api/creator/digital-files", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            fileName: selectedFile.name,
            fileSize: selectedFile.size,
            mimeType: selectedFile.type || "application/octet-stream",
            name: selectedFile.name,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to initiate upload");
        }

        const { uploadUrl } = await res.json();
        setUploadProgress(5);

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", uploadUrl);
          xhr.setRequestHeader("Content-Type", selectedFile.type || "application/octet-stream");

          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const percent = Math.round(5 + (event.loaded / event.total) * 90);
              setUploadProgress(percent);
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reportClientFailure("HTTP error from R2", {
                phase: "single-put",
                xhrStatus: xhr.status,
                xhrStatusText: xhr.statusText,
                xhrResponse: (xhr.responseText || "").slice(0, 1000),
              });
              reject(new Error("Failed to upload file to storage"));
            }
          };
          xhr.onerror = () => {
            reportClientFailure("Network error reaching R2", { phase: "single-put" });
            reject(new Error("Network error during upload"));
          };
          xhr.ontimeout = () => {
            reportClientFailure("XHR timeout", { phase: "single-put" });
            reject(new Error("Upload timed out"));
          };
          xhr.onabort = () => reject(new Error("Upload cancelled"));

          xhr.send(selectedFile);
        });
      }

      setUploadProgress(100);
      toast.success("File uploaded successfully. Create distribution rules to send it to backers.");
      onUploaded?.();

      // Reset and close
      setSelectedFile(null);
      setUploadProgress(0);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload file");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Digital File</DialogTitle>
          <DialogDescription>
            Upload a file for your backers. After uploading, create distribution rules to send it out.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Hidden file input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileInputChange}
            className="hidden"
          />

          {selectedFile ? (
            // Show selected file
            <div className="border-2 border-teal-500 rounded-lg p-4 bg-teal-50 dark:bg-teal-950/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(selectedFile.size)}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedFile(null)}
                  className="h-8 w-8"
                  disabled={isUploading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {isUploading && uploadProgress > 0 && (
                <div className="mt-3">
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-teal-500 transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 text-center">
                    {uploadProgress < 100 ? `Uploading... ${uploadProgress}%` : "Complete!"}
                  </p>
                </div>
              )}
            </div>
          ) : (
            // Show drop zone
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                isDragging
                  ? "border-teal-500 bg-teal-50 dark:bg-teal-950/20"
                  : "border-muted-foreground/25 hover:border-teal-500/50"
              )}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <Upload className={cn(
                "h-10 w-10 mx-auto mb-4 transition-colors",
                isDragging ? "text-teal-500" : "text-muted-foreground"
              )} />
              <p className="text-sm text-muted-foreground mb-2">
                Drag and drop your file here, or click to browse
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
              >
                Choose File
              </Button>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={isUploading}>
            Cancel
          </Button>
          <Button
            className="bg-teal-600 hover:bg-teal-700"
            disabled={!selectedFile || isUploading}
            onClick={handleUpload}
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
