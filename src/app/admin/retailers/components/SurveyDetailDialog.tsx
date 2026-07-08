"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Star,
  ThumbsUp,
  ThumbsDown,
  Package,
  Store,
} from "lucide-react";
import type { SatisfactionSurvey } from "../types";
import { StarRating } from "./StarRating";

interface SurveyDetailDialogProps {
  survey: SatisfactionSurvey | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SurveyDetailDialog({ survey, open, onOpenChange }: SurveyDetailDialogProps) {
  if (!survey) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-100">
                <Star className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <DialogTitle>Survey Response</DialogTitle>
                <DialogDescription>
                  From {survey.retailer.businessName}
                </DialogDescription>
              </div>
            </div>
            {survey.completedAt ? (
              <Badge className="bg-emerald-100 text-emerald-700">Completed</Badge>
            ) : (
              <Badge className="bg-amber-100 text-amber-700">Pending</Badge>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Overall Rating */}
          <div className="text-center p-6 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground mb-2">Overall Rating</p>
            <div className="flex items-center justify-center gap-2 mb-2">
              <StarRating rating={survey.rating} size="lg" />
            </div>
            {survey.rating && (
              <p className="text-2xl font-bold">{survey.rating}/5</p>
            )}
          </div>

          {/* Would Recommend */}
          {survey.wouldRecommend !== null && (
            <div className={`p-4 rounded-lg ${survey.wouldRecommend ? "bg-emerald-50" : "bg-red-50"}`}>
              <div className="flex items-center gap-2">
                {survey.wouldRecommend ? (
                  <>
                    <ThumbsUp className="h-5 w-5 text-emerald-600" />
                    <span className="font-medium text-emerald-800">Would recommend to other retailers</span>
                  </>
                ) : (
                  <>
                    <ThumbsDown className="h-5 w-5 text-red-600" />
                    <span className="font-medium text-red-800">Would not recommend</span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Category Ratings */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Category Ratings</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-sm">Product Quality</span>
                <StarRating rating={survey.productQuality} />
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-sm">Shipping Speed</span>
                <StarRating rating={survey.shippingSpeed} />
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-sm">Packaging</span>
                <StarRating rating={survey.packaging} />
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-sm">Communication</span>
                <StarRating rating={survey.communication} />
              </div>
            </div>
          </div>

          {/* Feedback */}
          {survey.feedback && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Feedback</h3>
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-foreground whitespace-pre-wrap">{survey.feedback}</p>
              </div>
            </div>
          )}

          {/* Order Details */}
          {survey.order && (
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Package className="h-4 w-4" /> Order Details
              </h3>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {survey.order.project?.imageUrl && (
                      <Image
                        src={survey.order.project.imageUrl}
                        alt=""
                        width={64}
                        height={64}
                        className="h-16 w-16 rounded object-cover"
                      />
                    )}
                    <div className="flex-1">
                      <p className="font-medium">{survey.order.project?.title || "Unknown Project"}</p>
                      <p className="text-sm text-muted-foreground">
                        {survey.order.quantity}x {survey.order.reward?.title || "Item"}
                      </p>
                      <p className="text-sm font-medium mt-1">
                        ${Number(survey.order.totalAmount).toFixed(2)}
                      </p>
                    </div>
                    <Badge variant="outline">{survey.order.status}</Badge>
                  </div>
                  {survey.order.invoiceNumber && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Invoice: {survey.order.invoiceNumber}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Retailer Info */}
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Store className="h-4 w-4" /> Retailer
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Business</p>
                <p className="font-medium">{survey.retailer.businessName}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Contact</p>
                <p className="font-medium">{survey.retailer.contactName}</p>
              </div>
              <div className="col-span-2">
                <p className="text-muted-foreground">Email</p>
                <a href={`mailto:${survey.retailer.email}`} className="font-medium text-emerald-600 hover:underline">
                  {survey.retailer.email}
                </a>
              </div>
            </div>
          </div>

          {/* Timestamps */}
          <div className="text-xs text-muted-foreground border-t pt-4">
            <div className="flex justify-between">
              <span>Survey sent: {survey.sentAt ? new Date(survey.sentAt).toLocaleString() : "Not sent"}</span>
              <span>Completed: {survey.completedAt ? new Date(survey.completedAt).toLocaleString() : "Pending"}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
