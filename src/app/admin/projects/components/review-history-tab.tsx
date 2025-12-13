"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  XCircle,
  History,
  RotateCcw,
  Zap,
  Send,
  Power,
} from "lucide-react";
import { ReviewHistory } from "./types";
import { formatDate } from "./utils";

interface ReviewHistoryTabProps {
  reviewHistory: ReviewHistory[];
}

export function ReviewHistoryTab({ reviewHistory }: ReviewHistoryTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Review History</CardTitle>
        <CardDescription>All project review decisions and status changes</CardDescription>
      </CardHeader>
      <CardContent>
        {reviewHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <History className="h-12 w-12 text-zinc-300 mb-4" />
            <h3 className="font-medium text-zinc-900 dark:text-white mb-2">No review history yet</h3>
            <p className="text-sm text-zinc-500">Review decisions will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reviewHistory.map((review) => (
              <div key={review.id} className="flex items-start gap-4 rounded-lg border p-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full flex-shrink-0 ${
                  review.action === "APPROVED" ? "bg-emerald-100" :
                  review.action === "REJECTED" ? "bg-red-100" :
                  review.action === "DEACTIVATE" ? "bg-orange-100" :
                  review.action === "REACTIVATE" ? "bg-blue-100" :
                  review.action === "SEND_TO_REVIEW" ? "bg-purple-100" :
                  "bg-amber-100"
                }`}>
                  {review.action === "APPROVED" ? (
                    <CheckCircle className="h-5 w-5 text-emerald-600" />
                  ) : review.action === "REJECTED" ? (
                    <XCircle className="h-5 w-5 text-red-600" />
                  ) : review.action === "DEACTIVATE" ? (
                    <Power className="h-5 w-5 text-orange-600" />
                  ) : review.action === "REACTIVATE" ? (
                    <Zap className="h-5 w-5 text-blue-600" />
                  ) : review.action === "SEND_TO_REVIEW" ? (
                    <Send className="h-5 w-5 text-purple-600" />
                  ) : (
                    <RotateCcw className="h-5 w-5 text-amber-600" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <a
                      href={`/projects/${review.project.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium hover:underline truncate"
                    >
                      {review.project.title}
                    </a>
                    <Badge variant={
                      review.action === "APPROVED" ? "default" :
                      review.action === "REJECTED" ? "destructive" :
                      review.action === "DEACTIVATE" ? "outline" :
                      review.action === "REACTIVATE" ? "default" :
                      "secondary"
                    } className={
                      review.action === "APPROVED" ? "bg-emerald-600" :
                      review.action === "REACTIVATE" ? "bg-blue-600" :
                      ""
                    }>
                      {review.action.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <p className="text-sm text-zinc-500 mt-1">
                    by {review.project.creator.name || review.project.creator.email}
                  </p>
                  {review.notes && (
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2 line-clamp-2">
                      {review.notes}
                    </p>
                  )}
                  {review.rejectionReason && (
                    <p className="text-sm text-red-600 mt-1">
                      Reason: {review.rejectionReason.replace(/_/g, " ")}
                    </p>
                  )}
                  {review.previousStatus && review.newStatus && (
                    <p className="text-xs text-zinc-400 mt-1">
                      Status: {review.previousStatus} → {review.newStatus}
                    </p>
                  )}
                </div>

                <div className="text-right text-sm text-zinc-500 flex-shrink-0">
                  <p className="font-medium">{review.reviewer?.name || review.reviewer?.email || "System"}</p>
                  <p>{formatDate(review.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
