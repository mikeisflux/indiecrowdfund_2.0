"use client";

import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Clock,
  CheckCircle2,
  Store,
  Gift,
  Trash2,
  FolderOpen,
} from "lucide-react";
import { PdfThumbnail } from "@/components/PdfThumbnail";
import { LibraryItem, ReadingProgress, ViewMode } from "./types";
import { formatFileSize, getReadingStatus } from "./constants";

// Library Card Component
export function LibraryCard({
  item,
  progress,
  onClick,
  viewMode,
  onDelete,
}: {
  item: LibraryItem;
  progress: ReadingProgress | null;
  onClick: () => void;
  viewMode: ViewMode;
  onDelete?: () => void;
}) {
  const progressPercent = progress ? Math.round((progress.currentPage / progress.totalPages) * 100) : 0;
  const status = getReadingStatus(progress);

  // Determine colors based on source
  const isLocal = item.source === "local";
  const gradientColors = isLocal
    ? (item.coverColor || "from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/30")
    : "from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30";
  const iconColor = isLocal ? "text-purple-600/50" : "text-amber-600/50";

  if (viewMode === "list") {
    return (
      <div
        onClick={onClick}
        className="group flex items-center gap-4 p-4 rounded-xl bg-card/50 backdrop-blur border border-border/50 hover:border-amber-400/30 hover:shadow-lg hover:shadow-amber-500/10 transition-all duration-300 cursor-pointer"
      >
        {/* Thumbnail */}
        <div className={cn("relative w-16 h-20 rounded-lg overflow-hidden bg-gradient-to-br flex-shrink-0", gradientColors)}>
          {item.coverImageUrl ? (
            <Image
              src={item.coverImageUrl}
              alt={item.title}
              fill
              className="object-cover"
            />
          ) : (
            <PdfThumbnail
              fileId={item.sourceId}
              source={item.source}
              className="absolute inset-0"
              iconClassName={iconColor}
              fallbackGradient={gradientColors}
            />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold line-clamp-1 group-hover:text-amber-500 transition-colors">
            {item.title}
          </h3>
          <p className="text-sm text-muted-foreground line-clamp-1">{item.subtitle}</p>
          <div className="flex items-center gap-3 mt-2">
            <Badge variant={item.source === "marketplace" ? "default" : "secondary"} className="text-xs">
              {item.source === "marketplace" ? (
                <>
                  <Store className="w-3 h-3 mr-1" />
                  Purchased
                </>
              ) : item.source === "local" ? (
                <>
                  <FolderOpen className="w-3 h-3 mr-1" />
                  My Upload
                </>
              ) : (
                <>
                  <Gift className="w-3 h-3 mr-1" />
                  Reward
                </>
              )}
            </Badge>
            <span className="text-xs text-muted-foreground">{formatFileSize(item.fileSize)}</span>
          </div>
        </div>

        {/* Progress and Delete */}
        <div className="flex items-center gap-2">
          {status === "completed" ? (
            <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Completed
            </Badge>
          ) : status === "in-progress" ? (
            <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30">
              <Clock className="w-3 h-3 mr-1" />
              {progressPercent}%
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              Unread
            </Badge>
          )}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="p-1.5 rounded-full text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Grid view card
  const progressBarColor = isLocal
    ? "bg-gradient-to-r from-purple-400 to-indigo-500"
    : "bg-gradient-to-r from-amber-400 to-orange-500";
  const hoverTextColor = isLocal ? "group-hover:text-purple-400" : "group-hover:text-amber-400";
  const progressTextColor = isLocal ? "text-purple-400" : "text-amber-400";

  return (
    <Card
      onClick={onClick}
      className="group cursor-pointer overflow-hidden bg-gradient-to-br from-zinc-800/80 to-zinc-900/80 backdrop-blur-md border border-white/10 hover:border-amber-400/30 hover:shadow-lg hover:shadow-amber-500/10 transition-all duration-300"
    >
      {/* Cover Image - Aspect ratio 3:4 for book covers */}
      <div className={cn("relative aspect-[3/4] bg-gradient-to-br overflow-hidden", gradientColors)}>
        {item.coverImageUrl ? (
          <Image
            src={item.coverImageUrl}
            alt={item.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <PdfThumbnail
            fileId={item.sourceId}
            source={item.source}
            className="absolute inset-0 group-hover:scale-105 transition-transform duration-300"
            iconClassName={iconColor}
            fallbackGradient={gradientColors}
          />
        )}

        {/* Progress Overlay */}
        {progress && (
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/50">
            <div
              className={cn("h-full", progressBarColor)}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}

        {/* Source Badge */}
        <div className="absolute top-2 left-2">
          <Badge
            className={cn(
              "text-[10px] backdrop-blur-sm",
              item.source === "marketplace"
                ? "bg-purple-500/80 text-white"
                : item.source === "local"
                ? "bg-indigo-500/80 text-white"
                : "bg-emerald-500/80 text-white"
            )}
          >
            {item.source === "marketplace" ? "Purchased" : item.source === "local" ? "My Upload" : "Reward"}
          </Badge>
        </div>

        {/* Status indicator or Delete button */}
        <div className="absolute top-2 right-2">
          {onDelete ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="w-6 h-6 rounded-full bg-black/50 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          ) : status === "completed" ? (
            <div className="w-6 h-6 rounded-full bg-emerald-500/90 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-white" />
            </div>
          ) : null}
        </div>
      </div>

      {/* Content */}
      <CardContent className="p-3 space-y-1">
        <h3 className={cn("font-medium text-white line-clamp-2 transition-colors", hoverTextColor)}>
          {item.title}
        </h3>
        <p className="text-xs text-muted-foreground line-clamp-1">{item.subtitle}</p>
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-muted-foreground">{formatFileSize(item.fileSize)}</span>
          {progress && (
            <span className={cn("text-xs", progressTextColor)}>{progressPercent}% read</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
