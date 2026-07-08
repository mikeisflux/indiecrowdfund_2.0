"use client";

import { AlertTriangle, Check, AlertCircle } from "lucide-react";

interface StatusBannerProps {
  isPendingReview: boolean;
  isLive: boolean;
  contentChanged: boolean;
  pdfChanged: boolean;
  coverImageChanged: boolean;
  rejectionReason: string | null;
}

export function StatusBanner({
  isPendingReview,
  isLive,
  contentChanged,
  pdfChanged,
  coverImageChanged,
  rejectionReason,
}: StatusBannerProps) {
  return (
    <>
      {isPendingReview && (
        <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 dark:text-amber-400 flex-shrink-0" />
          <p className="text-amber-600 dark:text-amber-300">
            This book is pending review. You cannot edit it until the review is complete.
          </p>
        </div>
      )}

      {isLive && !contentChanged && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3">
          <Check className="w-5 h-5 text-emerald-500 dark:text-emerald-400 flex-shrink-0" />
          <div className="text-emerald-600 dark:text-emerald-300">
            <p>This book is live on the marketplace.</p>
            <p className="text-sm text-emerald-600/70 dark:text-emerald-300/70 mt-1">
              Note: Changing the PDF file or cover image will require re-approval before going live again.
            </p>
          </div>
        </div>
      )}

      {contentChanged && (
        <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 dark:text-amber-400 flex-shrink-0" />
          <div className="text-amber-600 dark:text-amber-300">
            <p className="font-medium">
              {pdfChanged && coverImageChanged
                ? "PDF File & Cover Image Changed"
                : pdfChanged
                ? "PDF File Changed"
                : "Cover Image Changed"} - Re-Review Required
            </p>
            <p className="text-sm text-amber-600/70 dark:text-amber-300/70 mt-1">
              You&apos;ve updated the {pdfChanged && coverImageChanged
                ? "PDF file and cover image"
                : pdfChanged
                ? "PDF file"
                : "cover image"}. Saving these changes will send the book for re-review,
              and it will be temporarily unavailable on the marketplace until approved.
            </p>
          </div>
        </div>
      )}

      {rejectionReason && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30">
          <div className="flex items-center gap-3 mb-2">
            <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400 flex-shrink-0" />
            <p className="text-red-600 dark:text-red-300 font-medium">Rejection Reason</p>
          </div>
          <p className="text-red-600/80 dark:text-red-300/80 ml-8">{rejectionReason}</p>
        </div>
      )}
    </>
  );
}
