"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useState, useCallback, useRef } from "react";
import Image from "next/image";
import { Image as ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface DragDropImageCellProps {
  imageUrl?: string;
  alt: string;
  projectId?: string;
  uploadType: "item" | "reward" | "project" | "misc";
  onImageChange: (url: string) => Promise<void>;
  className?: string;
}

export function DragDropImageCell({
  imageUrl,
  alt,
  projectId,
  uploadType,
  onImageChange,
  className,
}: DragDropImageCellProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const dragCounter = useRef(0);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please drop an image file");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (projectId) {
        formData.append("projectId", projectId);
      }
      formData.append("uploadType", uploadType);

      const response = await apiFetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }

      const { url } = await response.json();
      await onImageChange(url);
      toast.success("Image uploaded");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to upload image");
    } finally {
      setIsUploading(false);
    }
  }, [projectId, uploadType, onImageChange]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Set dropEffect to copy to show the correct cursor
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      handleFile(file);
      e.dataTransfer.clearData();
    }
  }, [handleFile]);

  const handleClick = useCallback(() => {
    if (isUploading) return;

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        handleFile(file);
      }
    };
    input.click();
  }, [isUploading, handleFile]);

  return (
    <div
      className={cn(
        "w-24 aspect-video rounded overflow-hidden cursor-pointer transition-all relative",
        isDragging ? "ring-2 ring-primary ring-offset-2 scale-105" : "",
        isUploading ? "opacity-70" : "hover:ring-2 hover:ring-muted-foreground/30",
        className
      )}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      title="Click or drag image to upload"
    >
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={alt}
          width={96}
          height={54}
          className="w-full h-full object-cover pointer-events-none"
          unoptimized={imageUrl.endsWith(".gif")}
        />
      ) : (
        <div className="w-full h-full bg-muted flex items-center justify-center pointer-events-none">
          <ImageIcon className="h-6 w-6 text-muted-foreground" />
        </div>
      )}

      {isUploading && (
        <div className="absolute inset-0 bg-background/80 flex items-center justify-center pointer-events-none">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      )}

      {isDragging && (
        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center pointer-events-none">
          <div className="w-8 h-8 rounded-full bg-primary/30 animate-pulse" />
        </div>
      )}
    </div>
  );
}
