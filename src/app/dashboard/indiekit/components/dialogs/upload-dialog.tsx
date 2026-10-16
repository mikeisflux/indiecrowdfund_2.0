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
  const [phase, setPhase] = useState<"idle" | "starting" | "uploading" | "finalizing" | "done" | "error">("idle");
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClose = (isOpen: boolean) => {
    if (!isOpen && !isUploading) {
      // Reset to default when closing
      setSelectedFile(null);
      setUploadProgress(0);
      setPhase("idle");
      setStatusNote(null);
    }
    if (!isUploading) {
      onOpenChange(isOpen);
    }
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setPhase("idle");
    setStatusNote(null);
    setUploadProgress(0);
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

  // ---- Upload engine ----
  //
  // Same-origin chunked multipart: the browser POSTs each part to our
  // server, which forwards it to R2. Parts are small (8MB) so every
  // request finishes in seconds on a slow link and well inside any proxy
  // timeout; a few run in parallel for throughput; each has its own
  // deadline and retry, so a stalled connection fails fast and resumes
  // instead of sitting at 63% forever. The server records every accepted
  // part, so if the tab is refreshed the same file picked again carries
  // on from the last good part.
  const CHUNK_SIZE = 8 * 1024 * 1024;
  const CONCURRENCY = 3;
  const PART_TIMEOUT_MS = 120_000;
  const MAX_PART_RETRIES = 5;

  const reportClientFailure = (reason: string, extra: Record<string, unknown> = {}) => {
    if (!selectedFile) return;
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
    setPhase("starting");
    setUploadProgress(1);
    setStatusNote(null);

    const csrfToken =
      typeof document !== "undefined" ? document.cookie.match(/csrf_token=([^;]+)/)?.[1] || "" : "";

    const postJson = async (payload: Record<string, unknown>) => {
      const res = await apiFetch("/api/creator/digital-files/multipart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      return { res, data };
    };

    const totalParts = Math.ceil(selectedFile.size / CHUNK_SIZE);
    let fileId: string | null = null;
    let uploadId: string | null = null;
    const etags = new Map<number, string>();

    try {
      // 1. Resume if the server already has parts of this exact file.
      const pending = await postJson({
        action: "find-pending",
        projectId,
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
      });
      if (pending.res.ok && pending.data.found && pending.data.fileId && pending.data.uploadId) {
        fileId = pending.data.fileId as string;
        uploadId = pending.data.uploadId as string;
        for (const [k, v] of Object.entries((pending.data.uploadedParts || {}) as Record<string, string>)) {
          const n = Number(k);
          if (Number.isInteger(n) && n >= 1 && n <= totalParts) etags.set(n, v);
        }
        if (etags.size > 0) {
          setStatusNote(`Resuming — ${etags.size} of ${totalParts} parts were already uploaded.`);
        }
      } else {
        const init = await postJson({
          action: "init",
          projectId,
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
          mimeType: selectedFile.type || "application/octet-stream",
          name: selectedFile.name,
        });
        if (!init.res.ok) {
          throw Object.assign(new Error(init.data.error || "Failed to start upload"), { permanent: true });
        }
        fileId = init.data.fileId as string;
        uploadId = init.data.uploadId as string;
      }

      // 2. Upload the missing parts, a few at a time.
      setPhase("uploading");
      const partProgress = new Map<number, number>();
      let doneBytes = 0;
      for (const n of etags.keys()) {
        doneBytes += Math.min(CHUNK_SIZE, selectedFile.size - (n - 1) * CHUNK_SIZE);
      }
      const paint = () => {
        let inFlight = 0;
        for (const v of partProgress.values()) inFlight += v;
        const pct = Math.min(99, Math.round(((doneBytes + inFlight) / selectedFile.size) * 100));
        setUploadProgress(Math.max(1, pct));
      };
      paint();

      const uploadPart = (partNumber: number, chunk: Blob) =>
        new Promise<string>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          const proxyUrl = `/api/creator/digital-files/multipart?action=upload-part&fileId=${encodeURIComponent(
            fileId as string
          )}&uploadId=${encodeURIComponent(uploadId as string)}&partNumber=${partNumber}`;
          xhr.open("POST", proxyUrl);
          xhr.timeout = PART_TIMEOUT_MS;
          xhr.setRequestHeader("Content-Type", "application/octet-stream");
          if (csrfToken) xhr.setRequestHeader("X-CSRF-Token", csrfToken);
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              partProgress.set(partNumber, event.loaded);
              paint();
            }
          };
          const fail = (message: string, retryable: boolean) =>
            reject(Object.assign(new Error(message), { retryable }));
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const data = JSON.parse(xhr.responseText);
                if (!data.etag) return fail(`Part ${partNumber} returned no etag`, true);
                resolve(data.etag as string);
              } catch {
                fail(`Part ${partNumber} returned an unreadable response`, true);
              }
            } else if (xhr.status === 409) {
              fail("This upload was closed elsewhere. Choose the file again to restart.", false);
            } else {
              // 5xx, 408 and 429 are transient. Other 4xx are permanent.
              const transient = xhr.status >= 500 || xhr.status === 408 || xhr.status === 429;
              fail(`Part ${partNumber} failed (HTTP ${xhr.status})`, transient);
            }
          };
          xhr.ontimeout = () => fail(`Part ${partNumber} timed out`, true);
          xhr.onerror = () => fail(`Network error on part ${partNumber}`, true);
          xhr.onabort = () => fail("Upload cancelled", false);
          xhr.send(chunk);
        });

      const uploadPartWithRetry = async (partNumber: number) => {
        const start = (partNumber - 1) * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, selectedFile.size);
        const chunk = selectedFile.slice(start, end);
        let lastErr: Error | null = null;
        for (let attempt = 1; attempt <= MAX_PART_RETRIES; attempt++) {
          try {
            const etag = await uploadPart(partNumber, chunk);
            etags.set(partNumber, etag);
            partProgress.delete(partNumber);
            doneBytes += end - start;
            paint();
            return;
          } catch (err) {
            lastErr = err as Error;
            partProgress.delete(partNumber);
            paint();
            const retryable = (err as { retryable?: boolean }).retryable === true;
            if (!retryable || attempt >= MAX_PART_RETRIES) {
              reportClientFailure("Upload part failed after retries", {
                partNumber,
                attempt,
                phase: "proxy-upload-part",
                error: lastErr.message,
              });
              throw lastErr;
            }
            setStatusNote(`Connection hiccup on part ${partNumber} — retrying (${attempt}/${MAX_PART_RETRIES - 1})…`);
            await new Promise((r) => setTimeout(r, Math.min(1000 * 2 ** (attempt - 1), 15000)));
          }
        }
        throw lastErr ?? new Error("Upload failed");
      };

      const queue: number[] = [];
      for (let n = 1; n <= totalParts; n++) if (!etags.has(n)) queue.push(n);
      let firstError: Error | null = null;
      const worker = async () => {
        while (queue.length > 0 && !firstError) {
          const n = queue.shift() as number;
          try {
            await uploadPartWithRetry(n);
          } catch (err) {
            firstError = firstError ?? (err as Error);
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length || 1) }, worker));
      if (firstError) throw firstError;

      // 3. Finalize. The server also knows every part it accepted, so a
      // lost response here is safe to retry.
      setPhase("finalizing");
      setUploadProgress(99);
      setStatusNote(null);
      let completed = false;
      let lastError = "Failed to complete upload";
      for (let attempt = 1; attempt <= 3 && !completed; attempt++) {
        const done = await postJson({
          action: "complete",
          fileId,
          uploadId,
          parts: Array.from(etags.entries()).map(([partNumber, etag]) => ({ partNumber, etag })),
        });
        if (done.res.ok) {
          completed = true;
        } else {
          lastError = done.data.error || lastError;
          if (done.res.status === 400 && typeof done.data.missingPart === "number") {
            // Server lost a part we think we sent; send it again and retry.
            await uploadPartWithRetry(done.data.missingPart as number);
          } else if (done.res.status < 500) {
            break;
          } else {
            await new Promise((r) => setTimeout(r, 2000 * attempt));
          }
        }
      }
      if (!completed) throw new Error(lastError);

      setUploadProgress(100);
      setPhase("done");
      toast.success("File uploaded. Create a distribution rule to send it to backers.");
      onUploaded?.();
      setSelectedFile(null);
      setUploadProgress(0);
      setStatusNote(null);
      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to upload file";
      const permanent = (error as { permanent?: boolean }).permanent === true;
      if (fileId && permanent) {
        // Nothing worth keeping (init-level failure); drop the empty row.
        void postJson({ action: "abort", fileId, uploadId }).catch(() => {});
      }
      // Otherwise the parts stay on the server for 24h: picking the same
      // file again resumes instead of starting over.
      setPhase("error");
      setStatusNote(
        fileId && !permanent
          ? `${message}. Your progress is saved — click Upload again to resume.`
          : message
      );
      toast.error(message);
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
                    {phase === "starting"
                      ? "Starting upload…"
                      : phase === "finalizing"
                        ? "Assembling file in storage… almost done"
                        : uploadProgress < 100
                          ? `Uploading… ${uploadProgress}%`
                          : "Complete!"}
                  </p>
                </div>
              )}
              {statusNote && (
                <p
                  className={cn(
                    "text-xs mt-2",
                    phase === "error" ? "text-red-600" : "text-muted-foreground"
                  )}
                >
                  {statusNote}
                </p>
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
