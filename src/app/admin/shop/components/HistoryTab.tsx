import { Badge } from "@/components/ui/badge";
import { History } from "lucide-react";
import { ReviewHistory } from "../types";

interface HistoryTabProps {
  reviewHistory: ReviewHistory[];
}

export function HistoryTab({ reviewHistory }: HistoryTabProps) {
  return (
    <div className="rounded-xl bg-muted/50 border border-border overflow-hidden">
      <div className="p-4 border-b border-border">
        <h3 className="font-medium text-foreground">Review History</h3>
      </div>
      <div className="p-4 space-y-2 max-h-[700px] overflow-y-auto">
        {reviewHistory.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No review history</p>
          </div>
        ) : (
          reviewHistory.map((review) => (
            <div key={review.id} className="p-4 rounded-lg bg-muted/50 border border-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">{review.bookTitle}</p>
                  <p className="text-sm text-muted-foreground">
                    {review.action} by {review.reviewedBy}
                  </p>
                </div>
                <Badge
                  className={
                    review.action === "APPROVED"
                      ? "bg-emerald-100 text-emerald-400 border-emerald-200"
                      : "bg-rose-100 text-rose-400 border-rose-200"
                  }
                >
                  {review.action}
                </Badge>
              </div>
              {review.notes && (
                <p className="text-sm text-muted-foreground mt-2">
                  {review.notes}
                </p>
              )}
              <p className="text-xs text-muted-foreground/70 mt-2">
                {new Date(review.createdAt).toLocaleString()}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
