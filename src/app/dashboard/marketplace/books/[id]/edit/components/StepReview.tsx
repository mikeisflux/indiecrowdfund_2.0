"use client";

import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Eye } from "lucide-react";
import { BookFormData, CATEGORIES } from "./types";

interface StepReviewProps {
  formData: BookFormData;
  bookStatus: string;
}

export function StepReview({ formData, bookStatus }: StepReviewProps) {
  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Eye className="h-5 w-5 text-purple-500 dark:text-purple-400" />
          Review Your Book
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Preview Card */}
        <div className="rounded-xl overflow-hidden bg-card border border-border max-w-[200px]">
          <div className="aspect-[2/3] relative">
            {formData.promoImageUrl ? (
              <Image
                src={formData.promoImageUrl}
                alt={formData.title}
                fill
                className="object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-purple-900/50 to-indigo-900/50 flex items-center justify-center">
                <BookOpen className="h-16 w-16 text-muted-foreground/50" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4">
              <h3 className="text-lg font-bold text-white line-clamp-2">{formData.title || "Untitled"}</h3>
              <p className="text-white/70 mt-1">{CATEGORIES.find(c => c.value === formData.category)?.label || "No category"}</p>
            </div>
          </div>
          <div className="p-4">
            <p className="text-muted-foreground text-sm line-clamp-3">{formData.description || "No description"}</p>
            <div className="flex items-center justify-between mt-4">
              <span className="text-2xl font-bold text-emerald-500 dark:text-emerald-400">
                ${parseFloat(formData.price || "0").toFixed(2)}
              </span>
              <Badge className={
                formData.paymentProcessor === "DIVINITYCOIN"
                  ? "bg-purple-500/20 text-purple-600 dark:text-purple-300"
                  : formData.paymentProcessor === "PAYPAL"
                  ? "bg-blue-900/20 text-blue-700 dark:text-blue-300"
                  : "bg-blue-500/20 text-blue-600 dark:text-blue-300"
              }>
                {formData.paymentProcessor === "DIVINITYCOIN" ? "DivinityCoin" : formData.paymentProcessor === "PAYPAL" ? "PayPal" : "Stripe"}
              </Badge>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="space-y-4">
          <div className="flex justify-between p-3 rounded-lg bg-muted">
            <span className="text-muted-foreground">PDF File</span>
            <span className="text-foreground">{formData.pdfFileName || "Uploaded"}</span>
          </div>
          <div className="flex justify-between p-3 rounded-lg bg-muted">
            <span className="text-muted-foreground">Cover Image</span>
            <span className="text-foreground">{formData.promoImageUrl ? "Uploaded" : "Not uploaded"}</span>
          </div>
          <div className="flex justify-between p-3 rounded-lg bg-muted">
            <span className="text-muted-foreground">Promo Video</span>
            <span className="text-foreground">{formData.promoVideoUrl ? "Uploaded" : "Not uploaded"}</span>
          </div>
          <div className="flex justify-between p-3 rounded-lg bg-muted">
            <span className="text-muted-foreground">NSFW Content</span>
            <span className={formData.isNsfw ? "text-amber-500 dark:text-amber-400" : "text-foreground"}>
              {formData.isNsfw ? "Yes" : "No"}
            </span>
          </div>
          {formData.tags.length > 0 && (
            <div className="flex justify-between p-3 rounded-lg bg-muted">
              <span className="text-muted-foreground">Tags</span>
              <div className="flex flex-wrap gap-1 justify-end">
                {formData.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <p className="text-sm text-blue-600 dark:text-blue-300">
            <strong>What happens next?</strong> {bookStatus === "LIVE"
              ? "Since your book is already live, saving changes will require re-approval."
              : "Your book will be reviewed by our team within 24-48 hours. You'll receive a notification once it's approved and live on the marketplace."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
