"use client";


import { useState, useRef, useCallback } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Upload, X, Image as ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ImageUploadProps {
  value?: string;
  onChange: (url: string | undefined) => void;
  projectId?: string;
  uploadType?: "project" | "item" | "reward" | "misc";
  className?: string;
  aspectRatio?: string;
  maxSizeMB?: number;
  recommendedSize?: string;
  accept?: string;
}

export function ImageUpload({
  value,
  onChange,
  projectId,
  uploadType = "misc",
  className,
  aspectRatio = "aspect-video",
  maxSizeMB = 10,
  recommendedSize = "1024 x 576 px",
  accept = "image/jpeg,image/png,image/gif,image/webp",
}: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  const uploadToServer = useCallback(
    async (file: File): Promise<string | null> => {
      if (!projectId) {
        // If no projectId, fall back to base64 (for new projects not yet saved)
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("Failed to read file"));
          reader.readAsDataURL(file);
        });
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("projectId", projectId);
      formData.append("type", uploadType);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }

      const data = await response.json();
      return data.url;
    },
    [projectId, uploadType]
  );

  const processFile = useCallback(
    async (file: File) => {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        toast.error("Please select an image file");
        return;
      }

      // Validate file size
      if (file.size > maxSizeBytes) {
        toast.error(`File size must be less than ${maxSizeMB}MB`);
        return;
      }

      setIsLoading(true);

      try {
        const url = await uploadToServer(file);
        if (url) {
          onChange(url);
        }
      } catch (error) {
        console.error("File upload error:", error);
        toast.error(error instanceof Error ? error.message : "Failed to upload image");
      } finally {
        setIsLoading(false);
      }
    },
    [maxSizeBytes, maxSizeMB, onChange, uploadToServer]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files?.[0];
      if (file) {
        processFile(file);
      }
    },
    [processFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        processFile(file);
      }
      // Reset input so same file can be selected again
      e.target.value = "";
    },
    [processFile]
  );

  const handleRemove = useCallback(() => {
    onChange(undefined);
  }, [onChange]);

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  if (value) {
    return (
      <div className={cn("relative rounded-lg overflow-hidden border", aspectRatio, className)}>
        <Image
          src={value}
          alt="Uploaded image"
          fill
          className="object-cover"
        />
        <Button
          type="button"
          variant="destructive"
          size="icon"
          className="absolute top-2 right-2 h-8 w-8"
          onClick={handleRemove}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative rounded-lg border-2 border-dashed transition-colors cursor-pointer",
        aspectRatio,
        isDragging
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-muted-foreground/50",
        className
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleFileSelect}
      />

      <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
        {isLoading ? (
          <>
            <Loader2 className="h-10 w-10 text-muted-foreground animate-spin mb-3" />
            <p className="text-sm text-muted-foreground">Uploading...</p>
          </>
        ) : (
          <>
            {isDragging ? (
              <Upload className="h-10 w-10 text-primary mb-3" />
            ) : (
              <ImageIcon className="h-10 w-10 text-muted-foreground mb-3" />
            )}
            <p className="text-sm text-muted-foreground mb-1">
              {isDragging ? "Drop image here" : "Drag and drop an image, or click to browse"}
            </p>
            <p className="text-xs text-muted-foreground">
              Recommended: {recommendedSize}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Max size: {maxSizeMB}MB (JPG, PNG, GIF, WEBP)
            </p>
          </>
        )}
      </div>
    </div>
  );
}
