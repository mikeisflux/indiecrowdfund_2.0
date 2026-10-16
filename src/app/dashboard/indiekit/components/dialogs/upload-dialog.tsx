"use client";

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
import { uploadDigitalFileChunked, ChunkedUploadError } from "@/lib/digital-upload-client";


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
    setStatusNote(null);
    try {
      await uploadDigitalFileChunked({
        file: selectedFile,
        projectId,
        onProgress: setUploadProgress,
        onPhase: setPhase,
        onNote: setStatusNote,
      });
      setPhase("done");
      toast.success("File uploaded. Create a distribution rule to send it to backers.");
      onUploaded?.();
      setSelectedFile(null);
      setUploadProgress(0);
      setStatusNote(null);
      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to upload file";
      const resumable = error instanceof ChunkedUploadError && error.resumable;
      setPhase("error");
      // Parts already uploaded stay on the server for 24h: picking the same
      // file again resumes instead of starting over.
      setStatusNote(resumable ? `${message}. Your progress is saved — click Upload again to resume.` : message);
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
