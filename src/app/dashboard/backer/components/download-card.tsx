"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatFileSize } from "@/lib/utils";
import {
  FileText,
  Download,
  Check,
  Loader2,
  FileImage,
  FileMusic,
  FileArchive,
  Sparkles,
} from "lucide-react";

interface DownloadCardProps {
  id: string;
  name: string;
  fileName: string;
  fileSize: number;
  mimeType?: string;
  description?: string;
  isNew?: boolean;
  downloadCount?: number;
  projectTitle?: string;
  onDownload: (id: string) => Promise<void>;
  className?: string;
}

const fileIcons: Record<string, typeof FileText> = {
  pdf: FileText,
  epub: FileText,
  jpg: FileImage,
  jpeg: FileImage,
  png: FileImage,
  mp3: FileMusic,
  wav: FileMusic,
  zip: FileArchive,
  default: FileText,
};

export function DownloadCard({
  id,
  name,
  fileName,
  fileSize,
  mimeType,
  description,
  isNew = false,
  downloadCount = 0,
  projectTitle,
  onDownload,
  className,
}: DownloadCardProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);

  const fileExt = fileName.split(".").pop()?.toLowerCase() || "default";
  const Icon = fileIcons[fileExt] || fileIcons.default;

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await onDownload(id);
      setIsDownloaded(true);
      setTimeout(() => setIsDownloaded(false), 3000);
    } catch (error) {
      console.error("Download failed:", error);
      toast.error("Download failed. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-all duration-300 glass-card glass-card-hover group",
        isNew && "animated-border",
        className
      )}
    >
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          {/* File icon with glow */}
          <div className={cn(
            "relative p-3 rounded-xl transition-all duration-300 shrink-0",
            isNew ? "bg-emerald-500/20 glow-pulse" : "bg-muted/50",
            "group-hover:bg-emerald-500/30"
          )}>
            <Icon className={cn(
              "h-8 w-8 transition-colors duration-300",
              isNew ? "text-emerald-400" : "text-muted-foreground",
              "group-hover:text-emerald-400"
            )} />
            {/* Glow backdrop */}
            <div className={cn(
              "absolute inset-0 rounded-xl blur-xl opacity-0 transition-opacity duration-300",
              "bg-emerald-500/30 group-hover:opacity-100"
            )} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">{name}</h3>
            <p className="text-sm text-muted-foreground truncate">{fileName}</p>

            {description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{description}</p>
            )}

            {projectTitle && (
              <p className="text-xs text-muted-foreground mt-2">
                From: <span className="text-foreground">{projectTitle}</span>
              </p>
            )}

            <div className="flex items-center gap-3 mt-3">
              <span className="text-xs text-muted-foreground">
                {formatFileSize(fileSize)}
              </span>
              {mimeType && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground uppercase">
                    {fileExt}
                  </span>
                </>
              )}
              {downloadCount > 0 && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">
                    Downloaded {downloadCount}x
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Download button and badge column */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            {isNew && (
              <Badge className="bg-emerald-500 text-white glow-pulse flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                New
              </Badge>
            )}
            <Button
              size="lg"
              onClick={handleDownload}
              disabled={isDownloading}
              className={cn(
                "download-btn min-w-[120px] transition-all duration-300",
                isDownloaded
                  ? "bg-emerald-500 hover:bg-emerald-600"
                  : "bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600"
              )}
            >
              {isDownloading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 spin-glow" />
                  Loading...
                </>
              ) : isDownloaded ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Done!
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>

      {/* Bottom gradient line on hover */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 to-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    </Card>
  );
}
