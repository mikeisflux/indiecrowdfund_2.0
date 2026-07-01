"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Loader2, CheckCircle2, AlertCircle, Download } from "lucide-react";

export type DownloadPhase = "preparing" | "started" | "error";

export interface DownloadStatus {
  open: boolean;
  phase: DownloadPhase;
  fileName?: string;
  // Presigned URL kept around so the user can re-trigger the download
  // manually if the browser silently swallowed the first attempt
  // (common with cross-origin R2 links + popup blockers).
  downloadUrl?: string;
  error?: string;
}

interface DownloadStatusDialogProps {
  status: DownloadStatus;
  onOpenChange: (open: boolean) => void;
}

/**
 * Page-level feedback for a digital download. Because the actual file is
 * served from a cross-origin presigned R2 URL that opens in a new context,
 * the backer often gets no visible signal that anything happened. This
 * dialog gives them an explicit "Preparing… → Download started" flow plus a
 * manual fallback link so they always know the download is going.
 */
export function DownloadStatusDialog({ status, onOpenChange }: DownloadStatusDialogProps) {
  const { open, phase, fileName, downloadUrl, error } = status;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md text-center">
        <DialogHeader className="items-center">
          {/* Status icon */}
          <div
            className={cn(
              "relative w-16 h-16 mx-auto mb-2 rounded-full flex items-center justify-center",
              phase === "error"
                ? "bg-destructive/15"
                : "bg-gradient-to-br from-emerald-500/20 to-cyan-500/20"
            )}
          >
            {phase === "preparing" && (
              <Loader2 className="h-8 w-8 text-emerald-400 animate-spin" />
            )}
            {phase === "started" && (
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
            )}
            {phase === "error" && (
              <AlertCircle className="h-8 w-8 text-destructive" />
            )}
          </div>

          <DialogTitle className="text-center">
            {phase === "preparing" && "Preparing your download…"}
            {phase === "started" && "Download started!"}
            {phase === "error" && "Download failed"}
          </DialogTitle>

          <DialogDescription className="text-center">
            {phase === "preparing" && "Getting your file ready — this only takes a second."}
            {phase === "started" && (
              <>
                {fileName ? (
                  <>
                    <span className="font-medium text-foreground break-all">{fileName}</span> is
                    downloading now.
                  </>
                ) : (
                  "Your file is downloading now."
                )}{" "}
                Check your browser&apos;s downloads bar or your Downloads folder.
              </>
            )}
            {phase === "error" && (error || "Something went wrong. Please try again.")}
          </DialogDescription>
        </DialogHeader>

        {/* Manual fallback — some browsers block the automatic download for
            cross-origin links. Give the backer a direct button. */}
        {phase === "started" && downloadUrl && (
          <div className="mt-1 rounded-lg border border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground">
            Didn&apos;t start automatically?{" "}
            <a
              href={downloadUrl}
              download={fileName}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-emerald-400 hover:text-emerald-300 hover:underline"
            >
              <Download className="h-3.5 w-3.5" />
              Download it manually
            </a>
          </div>
        )}

        <DialogFooter className="sm:justify-center">
          {phase === "preparing" ? (
            <Button variant="outline" disabled className="min-w-[120px]">
              Please wait…
            </Button>
          ) : (
            <Button onClick={() => onOpenChange(false)} className="min-w-[120px]">
              {phase === "started" ? "Done" : "Close"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
