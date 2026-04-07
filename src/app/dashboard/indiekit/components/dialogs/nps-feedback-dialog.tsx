"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface NPSFeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit?: (score: number, feedback: string) => void;
}

export function NPSFeedbackDialog({
  open,
  onOpenChange,
  onSubmit,
}: NPSFeedbackDialogProps) {
  const [selectedScore, setSelectedScore] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [step, setStep] = useState<"score" | "feedback">("score");

  const handleScoreSelect = (score: number) => {
    setSelectedScore(score);
    setStep("feedback");
  };

  const handleSubmit = () => {
    if (selectedScore !== null) {
      onSubmit?.(selectedScore, feedback);
      onOpenChange(false);
      // Reset state
      setSelectedScore(null);
      setFeedback("");
      setStep("score");
    }
  };

  const handleBack = () => {
    setStep("score");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">
            Give Us Your Feedback
          </DialogTitle>
          {step === "score" && (
            <DialogDescription className="text-center pt-2">
              How likely are you to recommend IndieKit to a fellow project creator?
            </DialogDescription>
          )}
        </DialogHeader>

        {step === "score" ? (
          <div className="py-6">
            {/* Score Selection */}
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
                <button
                  key={score}
                  onClick={() => handleScoreSelect(score)}
                  className={cn(
                    "h-10 w-10 rounded-lg border-2 font-medium transition-all",
                    "hover:border-teal-500 hover:bg-teal-50",
                    selectedScore === score
                      ? "border-teal-600 bg-teal-600 text-white"
                      : "border-border bg-card"
                  )}
                >
                  {score}
                </button>
              ))}
            </div>

            {/* Labels */}
            <div className="flex justify-between mt-4 text-xs text-muted-foreground">
              <span>1 = Not likely to recommend</span>
              <span>10 = Highly likely to recommend</span>
            </div>
          </div>
        ) : (
          <div className="py-4 space-y-4">
            {/* Score Display */}
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Your score:</p>
              <div className="flex justify-center gap-1 mt-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
                  <div
                    key={score}
                    className={cn(
                      "h-8 w-8 rounded flex items-center justify-center text-sm font-medium",
                      selectedScore === score
                        ? "bg-teal-600 text-white"
                        : score <= (selectedScore || 0)
                        ? "bg-teal-100 text-teal-600"
                        : "bg-gray-100 text-gray-400"
                    )}
                  >
                    {score}
                  </div>
                ))}
              </div>
            </div>

            {/* Feedback Text */}
            <div className="space-y-2">
              <p className="text-sm font-medium">
                {selectedScore && selectedScore >= 9
                  ? "Great! What do you love most about IndieKit?"
                  : selectedScore && selectedScore >= 7
                  ? "Thanks! What could we do better?"
                  : "We're sorry to hear that. What can we improve?"}
              </p>
              <Textarea
                placeholder="Share your thoughts (optional)..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={4}
              />
            </div>
          </div>
        )}

        <DialogFooter className="flex gap-2">
          {step === "feedback" && (
            <Button variant="outline" onClick={handleBack}>
              Back
            </Button>
          )}
          {step === "score" ? (
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full"
            >
              Maybe Later
            </Button>
          ) : (
            <Button
              className="bg-teal-600 hover:bg-teal-700"
              onClick={handleSubmit}
            >
              Submit Feedback
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
